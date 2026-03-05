'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { UserProfileSchema } from '@/lib/schemas';
import ProtectedRoute from '@/components/ProtectedRoute';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inputClass(error?: string) {
  return `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-300'
  }`;
}

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

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FormFields {
  name: string;
  age: string;
  gender: string;
  weightLbs: string;
  fitnessLevel: string;
  weeklyMileageMiles: string;
  raceGoalDistance: string;
  injuryHistory: string;
  availabilityDays: string;
}

const EMPTY_FORM: FormFields = {
  name: '',
  age: '',
  gender: '',
  weightLbs: '',
  fitnessLevel: '',
  weeklyMileageMiles: '',
  raceGoalDistance: 'none',
  injuryHistory: '',
  availabilityDays: '',
};

function OnboardingForm() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function setField(field: keyof FormFields, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Build numeric payload from string inputs
    const payload = {
      name: form.name,
      age: parseInt(form.age, 10),
      gender: form.gender,
      weightLbs: parseFloat(form.weightLbs),
      fitnessLevel: form.fitnessLevel,
      weeklyMileageMiles: parseFloat(form.weeklyMileageMiles),
      raceGoalDistance: form.raceGoalDistance || undefined,
      injuryHistory: form.injuryHistory || undefined,
      availabilityDays: parseInt(form.availabilityDays, 10),
    };

    const result = UserProfileSchema.safeParse(payload);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        errors[String(issue.path[0])] = issue.message;
      });
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      // Profile is saved directly on the user document at users/{uid}.
      // setDoc with merge:true means re-visiting onboarding to update your
      // profile won't wipe any other fields that may have been added later.
      await setDoc(doc(db, 'users', user!.uid), result.data, { merge: true });
      router.push('/dashboard');
    } catch (err) {
      console.error('Firestore write failed:', err);
      setError('Failed to save your profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Set up your profile</h1>
          <p className="text-gray-500 text-sm">
            This helps Claude personalise your training plan.
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5 bg-white rounded-xl shadow-sm p-6 border border-gray-200"
        >
          {/* ── Personal ──────────────────────────────────────────────────── */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            About you
          </p>

          <Field label="Name" error={fieldErrors.name}>
            <input
              type="text"
              placeholder="Alex"
              required
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              className={inputClass(fieldErrors.name)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Age" error={fieldErrors.age}>
              <input
                type="number"
                min="13"
                max="100"
                placeholder="28"
                required
                value={form.age}
                onChange={(e) => setField('age', e.target.value)}
                className={inputClass(fieldErrors.age)}
              />
            </Field>

            <Field label="Weight (lbs)" error={fieldErrors.weightLbs}>
              <input
                type="number"
                step="0.1"
                min="1"
                placeholder="155"
                required
                value={form.weightLbs}
                onChange={(e) => setField('weightLbs', e.target.value)}
                className={inputClass(fieldErrors.weightLbs)}
              />
            </Field>
          </div>

          <Field label="Gender" error={fieldErrors.gender}>
            <select
              required
              value={form.gender}
              onChange={(e) => setField('gender', e.target.value)}
              className={inputClass(fieldErrors.gender)}
            >
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </Field>

          {/* ── Running ───────────────────────────────────────────────────── */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">
            Your running
          </p>

          <Field label="Fitness level" error={fieldErrors.fitnessLevel}>
            <select
              required
              value={form.fitnessLevel}
              onChange={(e) => setField('fitnessLevel', e.target.value)}
              className={inputClass(fieldErrors.fitnessLevel)}
            >
              <option value="">Select…</option>
              <option value="beginner">Beginner — new to running or returning after a break</option>
              <option value="intermediate">Intermediate — running consistently for 6+ months</option>
              <option value="advanced">Advanced — regular racing, structured training</option>
              <option value="elite">Elite — competitive, high mileage</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Weekly mileage"
              hint="Current average"
              error={fieldErrors.weeklyMileageMiles}
            >
              <input
                type="number"
                step="0.5"
                min="0"
                max="150"
                placeholder="20"
                required
                value={form.weeklyMileageMiles}
                onChange={(e) => setField('weeklyMileageMiles', e.target.value)}
                className={inputClass(fieldErrors.weeklyMileageMiles)}
              />
            </Field>

            <Field
              label="Days available"
              hint="Per week"
              error={fieldErrors.availabilityDays}
            >
              <input
                type="number"
                min="1"
                max="7"
                placeholder="4"
                required
                value={form.availabilityDays}
                onChange={(e) => setField('availabilityDays', e.target.value)}
                className={inputClass(fieldErrors.availabilityDays)}
              />
            </Field>
          </div>

          <Field label="Race goal" hint="Optional" error={fieldErrors.raceGoalDistance}>
            <select
              value={form.raceGoalDistance}
              onChange={(e) => setField('raceGoalDistance', e.target.value)}
              className={inputClass(fieldErrors.raceGoalDistance)}
            >
              <option value="none">No specific race goal</option>
              <option value="5k">5K</option>
              <option value="10k">10K</option>
              <option value="half_marathon">Half marathon</option>
              <option value="marathon">Marathon</option>
              <option value="ultra">Ultra</option>
            </select>
          </Field>

          <Field
            label="Injury history"
            hint="Optional"
            error={fieldErrors.injuryHistory}
          >
            <textarea
              rows={3}
              placeholder="e.g. stress fracture in left tibia (2024), occasional IT band tightness"
              value={form.injuryHistory}
              onChange={(e) => setField('injuryHistory', e.target.value)}
              className={inputClass(fieldErrors.injuryHistory)}
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingForm />
    </ProtectedRoute>
  );
}
