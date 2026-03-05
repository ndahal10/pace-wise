import { z } from "zod";

// ─── RunLog ───────────────────────────────────────────────────────────────────
//
// Represents a single completed run logged by the user.
//
// date: ISO 8601 string (e.g. "2026-03-05"). We use a string rather than Date
//   because Firestore Timestamps and JS Dates don't round-trip cleanly through
//   JSON in API routes. Storing as a plain string avoids that friction.
//
// distanceMiles: must be > 0. A zero-distance run is meaningless data.
//
// durationMinutes: must be > 0 for the same reason.
//
// averagePaceMinsPerMile / maxHeartRate / averageHeartRate / cadence:
//   All optional — a user may not have a GPS watch or HR monitor. Marking them
//   optional keeps the form low-friction while still capturing the data when
//   it's available.
//   Cadence (steps per minute) is typically 150–200 for runners; no hard cap
//   here since we don't want to reject edge cases.
//
// notes: freeform text, capped at 500 chars to prevent accidental paste dumps.

export const RunLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  distanceMiles: z.number().positive(),
  durationMinutes: z.number().positive(),
  averagePaceMinsPerMile: z.number().positive().optional(),
  averageHeartRate: z.number().int().positive().optional(),
  maxHeartRate: z.number().int().positive().optional(),
  cadence: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

export type RunLog = z.infer<typeof RunLogSchema>;

// ─── UserProfile ──────────────────────────────────────────────────────────────
//
// Collected during onboarding and used to personalise AI-generated plans.
//
// name: display name only — not used for auth (that's Firebase Auth's job).
//
// age: int in [13, 100]. Minimum 13 aligns with standard digital service age
//   requirements; 100 is a generous cap that prevents typo inputs like 1000.
//
// gender: an enum rather than free text so the AI prompt can reference it
//   consistently. "prefer_not_to_say" is included for user comfort; the prompt
//   layer can treat it as a neutral default.
//
// weightLbs: positive float. Imperial units match the existing Firestore schema.
//   No upper cap — weight is sensitive data and hard limits feel judgmental.
//
// fitnessLevel: enum used directly in the AI prompt to calibrate plan intensity.
//   Four levels map cleanly to running archetypes.
//
// weeklyMileageMiles: current training load — critical input for the AI to
//   avoid overtraining. Capped at 150 to catch accidental input (e.g. typing
//   km instead of miles gives ~2× the actual figure).
//
// raceGoalDistance: what the user is training towards. Optional — not everyone
//   has a race goal; some just want to run consistently.
//
// injuryHistory: free text so users can describe complex histories
//   (e.g. "stress fracture in left tibia, 2024"). Capped at 1000 chars.
//
// availabilityDays: how many days per week the user can run. Drives the weekly
//   plan structure. Constrained to 1–7.

export const UserProfileSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().min(13).max(100),
  gender: z.enum(["male", "female", "non_binary", "prefer_not_to_say"]),
  weightLbs: z.number().positive(),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced", "elite"]),
  weeklyMileageMiles: z.number().min(0).max(150),
  raceGoalDistance: z
    .enum(["5k", "10k", "half_marathon", "marathon", "ultra", "none"])
    .optional(),
  injuryHistory: z.string().max(1000).optional(),
  availabilityDays: z.number().int().min(1).max(7),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// ─── PlannedRun ───────────────────────────────────────────────────────────────
//
// A single day's entry inside a TrainingPlan. Kept as a nested schema so it
// can be validated independently (useful in tests) and referenced by name.
//
// dayOfWeek: 1–7 where 1 = Monday, matching ISO 8601 convention. Using a
//   number instead of a string enum avoids locale/spelling bugs.
//
// type: drives both the UI label and the AI prompt template. "rest" and
//   "cross-train" are included because rest days are part of the plan.
//
// distanceMiles: optional because rest and cross-train days have no distance.
//
// description: the human-readable instruction the AI generates, e.g.
//   "Easy 5-mile run at conversational pace". Capped at 300 chars.

export const PlannedRunSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  type: z.enum(["easy", "tempo", "long", "interval", "rest", "cross-train"]),
  distanceMiles: z.number().positive().optional(),
  description: z.string().max(300),
});

export type PlannedRun = z.infer<typeof PlannedRunSchema>;

// ─── TrainingPlan ─────────────────────────────────────────────────────────────
//
// The AI-generated training plan stored at users/{userId}/plans/current.
//
// generatedAt: ISO 8601 datetime string (not a Timestamp) for the same
//   JSON-safety reason as RunLog.date. Stored as a string, displayed as a date.
//
// promptVersion: a semver-style string (e.g. "1.0.0") that identifies which
//   version of lib/prompts.ts generated this plan. Critical for debugging AI
//   output regressions — if the plan looks wrong, you can trace it back to the
//   exact prompt template used.
//
// weeklyPlan: array of PlannedRun entries for the week. No fixed length
//   constraint here since availabilityDays already governs how many run days
//   the AI should produce.
//
// reasoning: the AI's explanation of why it built the plan this way — surfaces
//   the "why this plan?" feature from Phase 6. Stored alongside the plan so
//   it's always available without a second AI call. Capped at 2000 chars to
//   keep Firestore document size reasonable.

export const TrainingPlanSchema = z.object({
  generatedAt: z.string().datetime(),
  promptVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Must be semver e.g. 1.0.0"),
  weeklyPlan: z.array(PlannedRunSchema),
  reasoning: z.string().max(2000),
});

export type TrainingPlan = z.infer<typeof TrainingPlanSchema>;
