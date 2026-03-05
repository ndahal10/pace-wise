import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { RunLogSchema, PlannedRunSchema, TrainingPlanSchema } from "@/lib/schemas";
import type { UserProfile, RunLog } from "@/lib/schemas";
import { buildPrompt, PROMPT_VERSION } from "@/lib/prompts";

// ─── Anthropic client ─────────────────────────────────────────────────────────
//
// Instantiated once at module level (not per-request) so the SDK can reuse its
// internal HTTP connection pool across requests.

const anthropic = new Anthropic();

// ─── Claude output schema ─────────────────────────────────────────────────────
//
// Claude returns only weeklyPlan and reasoning. generatedAt and promptVersion
// are metadata we add server-side — Claude has no business knowing or setting
// those values. Separating the output schema from TrainingPlanSchema also means
// we can change the stored shape without touching the prompt.

const ClaudeOutputSchema = z.object({
  weeklyPlan: z.array(PlannedRunSchema),
  reasoning: z.string(),
});

// ─── Rate limiter ─────────────────────────────────────────────────────────────
//
// Stored at: users/{uid}/usage/{YYYY-MM-DD}  →  { planGenerations: number }
//
// A Firestore transaction is used to atomically read the current count and
// increment it in a single operation. Without a transaction, two simultaneous
// requests could both read count=2, both decide they're under the limit, and
// both increment to 3 — letting a user sneak past the cap.
//
// The document is created on first use (count starts at 0). It's naturally
// scoped to one calendar day because the date is part of the document path —
// no cron job needed to reset it.

const DAILY_PLAN_LIMIT = 5;

async function checkRateLimit(
  uid: string,
  today: string
): Promise<{ allowed: boolean; remaining: number }> {
  const usageRef = getAdminDb().doc(`users/${uid}/usage/${today}`);

  return getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const current = snap.exists ? (snap.data()!.planGenerations as number) : 0;

    if (current >= DAILY_PLAN_LIMIT) {
      return { allowed: false, remaining: 0 };
    }

    tx.set(usageRef, { planGenerations: current + 1 }, { merge: true });
    return { allowed: true, remaining: DAILY_PLAN_LIMIT - (current + 1) };
  });
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
//
// Extracts and verifies the Firebase ID token from the Authorization header.
// Returns the uid on success, or null if the token is missing or invalid.
//
// Why uid from the token — not the request body?
//   If the client sent { uid: "abc123", ...logData }, any user could claim to
//   be any other user just by changing that field. The server would have no way
//   to verify it. The verified token is cryptographically signed by Firebase
//   using the Admin SDK private key — it cannot be forged. Only Firebase Auth
//   can produce a valid token for a given uid.

async function getVerifiedUid(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7); // strip "Bearer "
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

// ─── Timestamp stripper ───────────────────────────────────────────────────────
//
// Firestore Admin SDK returns Timestamp objects for fields set with
// serverTimestamp(). These don't serialize to JSON — they come out as {}.
// This strips any field whose value is a Firestore Timestamp (identified by
// the presence of a .toDate() method) so the response is always clean JSON.

function stripTimestamps(
  data: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([, v]) => !(v !== null && typeof v === "object" && "toDate" in v)
    )
  );
}

// ─── POST /api/log ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Step 1: Verify Firebase Auth token ──────────────────────────────────────
  const uid = await getVerifiedUid(req);
  if (!uid) {
    return NextResponse.json(
      { error: "Unauthorized — valid Firebase ID token required" },
      { status: 401 }
    );
  }

  // ── Step 2: Validate request body against RunLog schema ─────────────────────
  //
  // safeParse never throws — it returns { success, data } or { success, error }.
  // We use it here so we can return a structured 422 with the exact validation
  // failures rather than a generic 500.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = RunLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid run log", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const log = parsed.data;

  // ── Step 3: Save log to users/{uid}/logs/{YYYY-MM-DD} ───────────────────────
  //
  // Using the date as the document ID (rather than addDoc's auto-id) means one
  // document per calendar day. A second log on the same day overwrites the
  // first — a deliberate choice for simplicity. If you later want multiple logs
  // per day, switch to addDoc and use a subcollection or composite key.
  //
  // savedAt is stored as an ISO string (not serverTimestamp) so it survives
  // JSON serialization without the stripTimestamps treatment.
  await getAdminDb().doc(`users/${uid}/logs/${log.date}`).set({
    ...log,
    savedAt: new Date().toISOString(),
  });

  // ── Steps 4 & 5: Fetch profile and last 14 logs in parallel ─────────────────
  //
  // Promise.all runs both Firestore reads concurrently — no reason to wait for
  // the profile before starting the logs query.
  //
  // Profile is at users/{uid} (the user document itself, not a subcollection).
  // Logs are ordered by date descending so index 0 is always the most recent.
  const [profileSnap, logsSnap] = await Promise.all([
    getAdminDb().doc(`users/${uid}`).get(),
    getAdminDb()
      .collection(`users/${uid}/logs`)
      .orderBy("date", "desc")
      .limit(14)
      .get(),
  ]);

  const profile = profileSnap.exists
    ? (stripTimestamps(profileSnap.data() as Record<string, unknown>) as UserProfile)
    : null;

  const recentLogs = logsSnap.docs.map(
    (d) => stripTimestamps(d.data() as Record<string, unknown>) as RunLog
  );

  // ── Step 6: Call Claude ───────────────────────────────────────────────────────
  //
  // We only call Claude if the user has a profile — without it the prompt has
  // no meaningful athlete data to work from.
  //
  // messages.parse() with zodOutputFormat does two things:
  //   1. Sends a JSON Schema derived from ClaudeOutputSchema to the API via
  //      output_config.format, constraining Claude to output valid JSON.
  //   2. Validates the parsed response client-side against the full Zod schema
  //      (including constraints the JSON Schema spec can't express, like max()).
  //
  // adaptive thinking lets Claude decide how much reasoning to apply — useful
  // for plan generation which benefits from multi-step thinking without
  // requiring a fixed token budget.
  if (!profile) {
    return NextResponse.json(
      { error: "Complete your profile before generating a plan" },
      { status: 422 }
    );
  }

  // ── Step 6a: Rate limit check ────────────────────────────────────────────────
  //
  // Checked after the profile guard so we don't burn a rate limit slot on a
  // request that would fail anyway. The transaction increments the counter
  // optimistically — if the Claude call later fails, the count is still
  // incremented. This is intentional: it prevents retrying past the limit by
  // just hammering the endpoint on errors.
  const today = new Date().toISOString().slice(0, 10);
  const { allowed, remaining } = await checkRateLimit(uid, today);

  if (!allowed) {
    // Retry-After: seconds until midnight UTC so clients know when to try again
    const now = new Date();
    const midnight = new Date(`${today}T24:00:00Z`);
    const secondsUntilReset = Math.ceil((midnight.getTime() - now.getTime()) / 1000);

    return NextResponse.json(
      {
        error: `Daily plan limit reached (${DAILY_PLAN_LIMIT}/day). Resets at midnight UTC.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(secondsUntilReset) },
      }
    );
  }

  const logsForPrompt = recentLogs.length > 0 ? recentLogs : [log];
  const { system, user } = buildPrompt(profile, logsForPrompt);

  let claudeOutput: z.infer<typeof ClaudeOutputSchema>;

  try {
    // Note: thinking and output_config.format (structured outputs) cannot be
    // used together — structured outputs constrain the token stream in a way
    // that is incompatible with thinking blocks. We rely on the system prompt's
    // explicit JSON instruction and zodOutputFormat for reliable output.
    const response = await anthropic.messages.parse({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        format: zodOutputFormat(ClaudeOutputSchema),
      },
    });

    // stop_reason "refusal" means Claude declined to respond — the parsed
    // output won't match the schema, so we treat it as an error.
    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Plan generation was refused" },
        { status: 422 }
      );
    }

    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "Claude returned an empty response — please try again" },
        { status: 502 }
      );
    }

    claudeOutput = response.parsed_output;
  } catch (err) {
    // What can go wrong here and how we handle each case:
    //
    // 1. Network / API errors (Anthropic.APIError subclasses):
    //    Rate limits (429), server errors (500/529) — these are transient.
    //    The SDK retries 429 and 5xx automatically (default: 2 retries).
    //    If retries are exhausted we return 502 so the client can retry later.
    //
    // 2. Schema validation failure (Zod throws after parsing):
    //    Structured outputs constrain Claude's JSON, but Zod also validates
    //    client-side constraints (e.g. string lengths, enum values). If Claude
    //    returns a value that passes JSON Schema but fails a Zod refinement,
    //    .parse() throws a ZodError. This is rare but possible — we return 502
    //    and log the raw response to help debug the prompt.
    //
    // 3. max_tokens exceeded (stop_reason "max_tokens"):
    //    The response is truncated — JSON will be malformed and parsing will
    //    throw. Solution: raise max_tokens or tighten the prompt constraints.
    const message = err instanceof Error ? err.message : String(err);
    console.error("Claude call failed:", message);
    return NextResponse.json(
      { error: `Claude error: ${message}` },
      { status: 502 }
    );
  }

  // ── Step 7: Compose and validate the full TrainingPlan ────────────────────────
  //
  // Add the server-controlled fields before validating against the full schema.
  // This is the single place generatedAt and promptVersion are set — Claude
  // never touches them.
  const planResult = TrainingPlanSchema.safeParse({
    ...claudeOutput,
    generatedAt: new Date().toISOString(),
    promptVersion: PROMPT_VERSION,
  });

  if (!planResult.success) {
    console.error("Plan failed TrainingPlanSchema validation:", planResult.error.issues);
    return NextResponse.json(
      { error: "Generated plan failed validation — please try again" },
      { status: 502 }
    );
  }

  const plan = planResult.data;

  // ── Step 8: Save plan to users/{uid}/plans/{YYYY-MM-DD} ───────────────────────
  //
  // Using today's date as the document ID means one plan per day per user.
  // Regenerating on the same day overwrites the previous plan — consistent
  // with the one-log-per-day approach used for run logs.
  await getAdminDb().doc(`users/${uid}/plans/${today}`).set(plan);

  // ── Step 9: Return the plan ───────────────────────────────────────────────────
  return NextResponse.json(
    { savedLog: log, plan, remainingGenerationsToday: remaining },
    { status: 201 }
  );
}
