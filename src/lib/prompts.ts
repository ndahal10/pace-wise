import type { UserProfile, RunLog } from "@/lib/schemas";

// ─── Versioning ───────────────────────────────────────────────────────────────
//
// Every plan stored in Firestore records which version of this file produced it.
// When you change the prompt, bump this version so you can tell old plans from
// new ones without reading their content.
//
// Format is semver (major.minor.patch) to match the TrainingPlanSchema regex:
//   major — structural change (different JSON shape, renamed fields)
//   minor — meaningful wording change (different instructions, new context)
//   patch — cosmetic fix (typo, formatting, no semantic change)
//
// "v1" would be readable but doesn't satisfy the schema's /^\d+\.\d+\.\d+$/
// constraint, so we use "1.0.0" instead.

export const PROMPT_VERSION = "1.0.0";

// ─── Types ────────────────────────────────────────────────────────────────────
//
// buildPrompt returns two strings rather than one because the Anthropic API
// takes system and user as separate parameters. Keeping them separate here
// means the generate-plan route can pass them directly without splitting.

export interface PromptPayload {
  system: string;
  user: string;
}

// ─── Log summariser ───────────────────────────────────────────────────────────
//
// Converts a raw array of RunLog entries into a compact paragraph Claude can
// reason over. We compute averages rather than listing every run individually —
// a list of 14 entries is noisy; averages are what actually drive plan design.
// The full log array is still passed as a secondary block for Claude to
// reference individual outlier sessions if needed.

function summariseLogs(logs: RunLog[]): string {
  if (logs.length === 0) return "No recent runs logged.";

  const totalMiles = logs.reduce((sum, l) => sum + l.distanceMiles, 0);
  const avgMiles = totalMiles / logs.length;

  const paceEntries = logs.filter((l) => l.averagePaceMinsPerMile != null);
  const avgPace =
    paceEntries.length > 0
      ? paceEntries.reduce((sum, l) => sum + l.averagePaceMinsPerMile!, 0) /
        paceEntries.length
      : null;

  const hrEntries = logs.filter((l) => l.averageHeartRate != null);
  const avgHR =
    hrEntries.length > 0
      ? Math.round(
          hrEntries.reduce((sum, l) => sum + l.averageHeartRate!, 0) /
            hrEntries.length
        )
      : null;

  // Infer weekly frequency from the date span of the logs
  const dates = logs.map((l) => l.date).sort();
  const daySpan =
    (new Date(dates[dates.length - 1]).getTime() -
      new Date(dates[0]).getTime()) /
    (1000 * 60 * 60 * 24);
  const weeksSpan = Math.max(daySpan / 7, 1);
  const runsPerWeek = (logs.length / weeksSpan).toFixed(1);

  const lines = [
    `Runs logged: ${logs.length} over the past ~${Math.round(weeksSpan)} week(s)`,
    `Average runs per week: ${runsPerWeek}`,
    `Total distance: ${totalMiles.toFixed(1)} miles`,
    `Average distance per run: ${avgMiles.toFixed(1)} miles`,
  ];

  if (avgPace !== null) {
    const mins = Math.floor(avgPace);
    const secs = Math.round((avgPace - mins) * 60)
      .toString()
      .padStart(2, "0");
    lines.push(`Average pace: ${mins}:${secs} min/mile`);
  }

  if (avgHR !== null) {
    lines.push(`Average heart rate: ${avgHR} bpm`);
  }

  return lines.join("\n");
}

// ─── Individual log formatter ─────────────────────────────────────────────────
//
// Formats each log as a single readable line for the secondary block.
// Omits optional fields if absent to keep the block concise.

function formatLog(log: RunLog): string {
  const parts = [
    `${log.date}:`,
    `${log.distanceMiles.toFixed(1)} mi`,
    `${log.durationMinutes} min`,
  ];

  if (log.averagePaceMinsPerMile != null) {
    const mins = Math.floor(log.averagePaceMinsPerMile);
    const secs = Math.round((log.averagePaceMinsPerMile - mins) * 60)
      .toString()
      .padStart(2, "0");
    parts.push(`${mins}:${secs}/mi`);
  }

  if (log.averageHeartRate != null) parts.push(`${log.averageHeartRate} bpm avg`);
  if (log.maxHeartRate != null) parts.push(`${log.maxHeartRate} bpm max`);
  if (log.cadence != null) parts.push(`${log.cadence} spm`);
  if (log.notes) parts.push(`(${log.notes})`);

  return parts.join(" | ");
}

// ─── buildPrompt ──────────────────────────────────────────────────────────────

export function buildPrompt(
  profile: UserProfile,
  recentLogs: RunLog[]
): PromptPayload {
  const system = `You are an expert running coach with deep knowledge of periodisation, \
injury prevention, and training load management. You generate personalised weekly \
training plans based on a runner's profile and recent training history.

You always respond with a single valid JSON object — no markdown fences, no prose \
outside the JSON. The object must match this exact shape:

{
  "weeklyPlan": [
    {
      "dayOfWeek": <number 1–7, where 1 = Monday>,
      "type": <"easy" | "tempo" | "long" | "interval" | "rest" | "cross-train">,
      "distanceMiles": <positive number, omit for rest/cross-train days>,
      "description": <string, max 300 chars — specific instruction for this session>
    }
  ],
  "reasoning": <string — explain why you designed the plan this way, referencing the \
athlete's data. Max 2000 chars.>
}

Constraints:
- Include exactly ${profile.availabilityDays} run/activity days and fill the remaining \
days as rest.
- Do not exceed a 10% increase over the athlete's current weekly mileage.
- If injury history is present, avoid workouts that stress the affected area.
- The plan covers one week (7 days total, dayOfWeek 1 through 7).`;

  const goal =
    profile.raceGoalDistance && profile.raceGoalDistance !== "none"
      ? profile.raceGoalDistance.replace("_", " ")
      : "general fitness";

  const injuryNote =
    profile.injuryHistory?.trim()
      ? `Injury history: ${profile.injuryHistory}`
      : "No reported injuries.";

  const user = `Generate a one-week training plan for the following athlete.

## Athlete Profile
- Name: ${profile.name}
- Age: ${profile.age}
- Gender: ${profile.gender === "prefer_not_to_say" ? "not specified" : profile.gender.replace("_", " ")}
- Weight: ${profile.weightLbs} lbs
- Fitness level: ${profile.fitnessLevel}
- Current weekly mileage: ${profile.weeklyMileageMiles} miles
- Available training days per week: ${profile.availabilityDays}
- Race goal: ${goal}
- ${injuryNote}

## Recent Training Summary (last ${recentLogs.length} run${recentLogs.length !== 1 ? "s" : ""})
${summariseLogs(recentLogs)}

## Individual Sessions
${recentLogs.length > 0 ? recentLogs.map(formatLog).join("\n") : "None"}

Respond with the JSON training plan only.`;

  return { system, user };
}
