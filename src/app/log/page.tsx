'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { RunLogSchema } from '@/lib/schemas';
import type { TrainingPlan } from '@/lib/schemas';
import ProtectedRoute from '@/components/ProtectedRoute';

// ─── Utilities ────────────────────────────────────────────────────────────────

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Accepts "8:30" (mm:ss) or "8.5" (decimal). Returns decimal mins or undefined.
function parsePace(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const [minsStr, secsStr] = value.split(':');
  if (secsStr !== undefined) {
    const mins = parseInt(minsStr, 10);
    const secs = parseInt(secsStr, 10);
    if (!isNaN(mins) && !isNaN(secs)) return mins + secs / 60;
  }
  const decimal = parseFloat(value);
  return isNaN(decimal) ? undefined : decimal;
}

function inputClass(error?: string) {
  return `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-300'
  }`;
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── Plan view ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TYPE_BADGE: Record<string, string> = {
  easy:          'bg-green-100 text-green-800',
  tempo:         'bg-orange-100 text-orange-800',
  long:          'bg-blue-100 text-blue-800',
  interval:      'bg-purple-100 text-purple-800',
  rest:          'bg-gray-100 text-gray-500',
  'cross-train': 'bg-teal-100 text-teal-800',
};

function PlanView({
  plan,
  remaining,
  onReset,
}: {
  plan: TrainingPlan;
  remaining: number | null;
  onReset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-bold text-gray-900">Your Plan</h1>
          {remaining !== null && (
            <span className="text-xs text-gray-400">
              {remaining} generation{remaining !== 1 ? 's' : ''} left today
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm mb-8">
          Generated {new Date(plan.generatedAt).toLocaleDateString()}
        </p>

        <div className="space-y-3 mb-6">
          {plan.weeklyPlan.map((run) => (
            <div
              key={run.dayOfWeek}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900">
                  {DAY_NAMES[run.dayOfWeek - 1]}
                </span>
                <div className="flex items-center gap-2">
                  {run.distanceMiles && (
                    <span className="text-sm text-gray-500">{run.distanceMiles} mi</span>
                  )}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                      TYPE_BADGE[run.type] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {run.type}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600">{run.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Why this plan?
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">{plan.reasoning}</p>
        </div>

        <button
          onClick={onReset}
          className="w-full border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Log another run
        </button>
      </div>
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FormFields {
  date: string;
  distanceMiles: string;
  durationMinutes: string;
  averagePaceMinsPerMile: string;
  averageHeartRate: string;
  maxHeartRate: string;
  cadence: string;
  notes: string;
}

const EMPTY_FORM: FormFields = {
  date: todayString(),
  distanceMiles: '',
  durationMinutes: '',
  averagePaceMinsPerMile: '',
  averageHeartRate: '',
  maxHeartRate: '',
  cadence: '',
  notes: '',
};

function LogForm() {
  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  function setField(field: keyof FormFields, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // clear the error for this field as the user corrects it
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function handleReset() {
    setPlan(null);
    setRemaining(null);
    setForm({ ...EMPTY_FORM, date: todayString() });
    setFieldErrors({});
    setApiError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');
    setFieldErrors({});

    // ── Build numeric payload from string inputs ───────────────────────────────
    //
    // HTML inputs always give us strings. We convert to numbers here before
    // handing off to Zod, which expects number types.
    // Optional fields are omitted entirely when empty — spreading `undefined`
    // into an object would produce a key with value undefined, which Zod
    // treats differently from an absent key.
    const payload = {
      date: form.date,
      distanceMiles: parseFloat(form.distanceMiles),
      durationMinutes: parseFloat(form.durationMinutes),
      ...(form.averagePaceMinsPerMile && {
        averagePaceMinsPerMile: parsePace(form.averagePaceMinsPerMile),
      }),
      ...(form.averageHeartRate && {
        averageHeartRate: parseInt(form.averageHeartRate, 10),
      }),
      ...(form.maxHeartRate && {
        maxHeartRate: parseInt(form.maxHeartRate, 10),
      }),
      ...(form.cadence && {
        cadence: parseInt(form.cadence, 10),
      }),
      ...(form.notes && { notes: form.notes }),
    };

    // ── Client-side Zod validation ────────────────────────────────────────────
    //
    // We run the same schema the server uses. This catches obvious mistakes
    // instantly, without a network round-trip. The server still validates
    // independently — client validation is a UX convenience, not a security
    // boundary.
    const result = RunLogSchema.safeParse(payload);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = String(issue.path[0]);
        errors[field] = issue.message;
      });
      setFieldErrors(errors);
      return;
    }

    // ── Get Firebase ID token ─────────────────────────────────────────────────
    //
    // getIdToken() returns a short-lived JWT signed by Firebase.
    // The server's adminAuth.verifyIdToken() checks this signature.
    // We explain below (see comment in exports) why we use this instead of uid.
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setApiError('You must be signed in to log a run.');
      return;
    }

    let token: string;
    try {
      token = await currentUser.getIdToken();
    } catch {
      setApiError('Could not refresh your session. Please sign in again.');
      return;
    }

    // ── POST to /api/log ──────────────────────────────────────────────────────
    setSubmitting(true);
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(result.data),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.issues) {
          // Server returned per-field Zod errors — surface them inline
          const errors: Record<string, string> = {};
          (data.issues as { path: string[]; message: string }[]).forEach((issue) => {
            errors[String(issue.path[0])] = issue.message;
          });
          setFieldErrors(errors);
        } else {
          setApiError(data.error ?? 'Something went wrong. Please try again.');
        }
        return;
      }

      setPlan(data.plan);
      setRemaining(data.remainingGenerationsToday ?? null);
    } catch {
      setApiError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (plan) {
    return <PlanView plan={plan} remaining={remaining} onReset={handleReset} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Log a Run</h1>
        <p className="text-gray-500 text-sm mb-8">
          We'll generate a fresh training plan after saving.
        </p>

        {apiError && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {apiError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5 bg-white rounded-xl shadow-sm p-6 border border-gray-200"
        >
          <Field label="Date" error={fieldErrors.date}>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setField('date', e.target.value)}
              className={inputClass(fieldErrors.date)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Distance (miles)" error={fieldErrors.distanceMiles}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="3.1"
                required
                value={form.distanceMiles}
                onChange={(e) => setField('distanceMiles', e.target.value)}
                className={inputClass(fieldErrors.distanceMiles)}
              />
            </Field>

            <Field label="Duration (min)" error={fieldErrors.durationMinutes}>
              <input
                type="number"
                step="1"
                min="1"
                placeholder="28"
                required
                value={form.durationMinutes}
                onChange={(e) => setField('durationMinutes', e.target.value)}
                className={inputClass(fieldErrors.durationMinutes)}
              />
            </Field>
          </div>

          <Field
            label="Avg pace"
            hint="Optional — mm:ss /mile e.g. 8:30"
            error={fieldErrors.averagePaceMinsPerMile}
          >
            <input
              type="text"
              placeholder="8:30"
              value={form.averagePaceMinsPerMile}
              onChange={(e) => setField('averagePaceMinsPerMile', e.target.value)}
              className={inputClass(fieldErrors.averagePaceMinsPerMile)}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Avg HR" hint="Optional" error={fieldErrors.averageHeartRate}>
              <input
                type="number"
                min="1"
                placeholder="145"
                value={form.averageHeartRate}
                onChange={(e) => setField('averageHeartRate', e.target.value)}
                className={inputClass(fieldErrors.averageHeartRate)}
              />
            </Field>

            <Field label="Max HR" hint="Optional" error={fieldErrors.maxHeartRate}>
              <input
                type="number"
                min="1"
                placeholder="172"
                value={form.maxHeartRate}
                onChange={(e) => setField('maxHeartRate', e.target.value)}
                className={inputClass(fieldErrors.maxHeartRate)}
              />
            </Field>

            <Field label="Cadence" hint="Optional" error={fieldErrors.cadence}>
              <input
                type="number"
                min="1"
                placeholder="176"
                value={form.cadence}
                onChange={(e) => setField('cadence', e.target.value)}
                className={inputClass(fieldErrors.cadence)}
              />
            </Field>
          </div>

          <Field label="Notes" hint="Optional" error={fieldErrors.notes}>
            <textarea
              rows={3}
              placeholder="How did it feel?"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              className={inputClass(fieldErrors.notes)}
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving & generating plan…' : 'Log run & generate plan'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LogPage() {
  return (
    <ProtectedRoute>
      <LogForm />
    </ProtectedRoute>
  );
}
