'use client';

import { useState } from 'react';
import Link from 'next/link';
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

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TYPE_BADGE: Record<string, string> = {
  easy:          'bg-emerald-100 text-emerald-700',
  tempo:         'bg-orange-100 text-orange-700',
  long:          'bg-blue-100 text-blue-700',
  interval:      'bg-violet-100 text-violet-700',
  rest:          'bg-gray-100 text-gray-400',
  'cross-train': 'bg-teal-100 text-teal-700',
};

// Returns bullet lines if the text is already structured (new prompt format),
// or null if it's a plain paragraph (old format) — so the caller can render
// it as prose instead of forcing a broken bullet split.
function parseReasoning(text: string): string[] | null {
  const lines = text.split('\n').map(l => l.replace(/^[•\-]\s*/, '').trim()).filter(Boolean);
  return lines.length > 1 ? lines : null;
}

const TYPE_BORDER: Record<string, string> = {
  easy:          'border-l-emerald-400',
  tempo:         'border-l-orange-400',
  long:          'border-l-blue-400',
  interval:      'border-l-violet-400',
  rest:          'border-l-gray-200',
  'cross-train': 'border-l-teal-400',
};

const TYPE_DOT: Record<string, string> = {
  easy:          'bg-emerald-400',
  tempo:         'bg-orange-400',
  long:          'bg-blue-400',
  interval:      'bg-violet-400',
  rest:          'bg-gray-200',
  'cross-train': 'bg-teal-400',
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
  const totalMiles = plan.weeklyPlan
    .filter(r => r.distanceMiles != null)
    .reduce((sum, r) => sum + (r.distanceMiles ?? 0), 0);
  const runDays = plan.weeklyPlan.filter(r => r.type !== 'rest').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <span>←</span>
            <span>Dashboard</span>
          </Link>
          {remaining !== null && (
            <span className="text-xs text-gray-400">
              {remaining} generation{remaining !== 1 ? 's' : ''} left today
            </span>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 space-y-6">
        {/* Success banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-semibold text-emerald-700 mb-0.5">Plan generated!</p>
          <p className="text-xs text-emerald-600">
            {new Date(plan.generatedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Week at a glance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Week at a glance</p>
          <div className="flex justify-between mb-3">
            {Array.from({ length: 7 }, (_, i) => {
              const run = plan.weeklyPlan.find(r => r.dayOfWeek === i + 1);
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="text-xs text-gray-400">{DAY_NAMES[i]}</span>
                  <div className={`w-3 h-3 rounded-full ${run ? (TYPE_DOT[run.type] ?? 'bg-gray-200') : 'bg-gray-100'}`} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 pt-3 border-t border-gray-50">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{totalMiles.toFixed(1)}</p>
              <p className="text-xs text-gray-400">total miles</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{runDays}</p>
              <p className="text-xs text-gray-400">active days</p>
            </div>
          </div>
        </div>

        {/* Day cards */}
        <div className="space-y-2">
          {plan.weeklyPlan.map((run) => (
            <div
              key={run.dayOfWeek}
              className={`bg-white rounded-xl border border-gray-100 border-l-4 shadow-sm p-4 ${TYPE_BORDER[run.type] ?? 'border-l-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-900">
                  {DAY_NAMES_FULL[run.dayOfWeek - 1]}
                </span>
                <div className="flex items-center gap-2">
                  {run.distanceMiles != null && (
                    <span className="text-xs text-gray-400">{run.distanceMiles} mi</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_BADGE[run.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {run.type}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 leading-snug">{run.description}</p>
            </div>
          ))}
        </div>

        {/* Reasoning */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Why this plan?</p>
          {(() => {
            const bullets = parseReasoning(plan.reasoning);
            return bullets ? (
              <ul className="space-y-3">
                {bullets.map((line, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">{plan.reasoning}</p>
            );
          })()}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 pb-8">
          <Link
            href="/dashboard"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-3 rounded-xl text-center transition-colors"
          >
            View Dashboard
          </Link>
          <button
            onClick={onReset}
            className="w-full border border-gray-200 text-gray-600 text-sm font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Log another run
          </button>
        </div>
      </main>
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

type RateLimitError =
  | { kind: 'burst' }
  | { kind: 'daily'; resetsIn: number };

function LogForm() {
  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [rateLimit, setRateLimit] = useState<RateLimitError | null>(null);
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
    setRateLimit(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');
    setRateLimit(null);
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
        } else if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After') ?? 0);
          // Burst limit has Retry-After: 60; daily limit has Retry-After up to ~86400
          setRateLimit(retryAfter <= 60 ? { kind: 'burst' } : { kind: 'daily', resetsIn: retryAfter });
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

        {rateLimit?.kind === 'burst' && (
          <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg flex items-start gap-2">
            <span className="mt-0.5">⏳</span>
            <span>Too many requests — wait a moment and try again.</span>
          </div>
        )}

        {rateLimit?.kind === 'daily' && (
          <div className="mb-6 px-4 py-3 bg-orange-50 border border-orange-200 text-orange-800 text-sm rounded-lg">
            <p className="font-medium mb-0.5">Daily plan limit reached</p>
            <p className="text-orange-700">
              You&apos;ve used all 5 plan generations today. Resets at midnight UTC
              {rateLimit.resetsIn > 0 && ` (in ~${Math.ceil(rateLimit.resetsIn / 3600)}h)`}.
            </p>
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
            hint="mm:ss per mile — e.g. 8:30"
            error={fieldErrors.averagePaceMinsPerMile}
          >
            <input
              type="text"
              placeholder="8:30"
              value={form.averagePaceMinsPerMile}
              onChange={(e) => setField('averagePaceMinsPerMile', e.target.value)}
              className={inputClass(fieldErrors.averagePaceMinsPerMile)}
            />
            {(() => {
              const parsed = parsePace(form.averagePaceMinsPerMile);
              if (!form.averagePaceMinsPerMile.trim() || parsed == null) return null;
              const m = Math.floor(parsed);
              const s = Math.round((parsed - m) * 60).toString().padStart(2, '0');
              return (
                <p className="mt-1 text-xs text-gray-400">= {m}:{s} min/mile</p>
              );
            })()}
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
            disabled={submitting || rateLimit?.kind === 'daily'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving & generating plan…' : 'Log run & generate plan'}
          </button>

          {remaining !== null && (
            <p className="text-center text-xs text-gray-400">
              {remaining} plan generation{remaining !== 1 ? 's' : ''} remaining today
            </p>
          )}
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
