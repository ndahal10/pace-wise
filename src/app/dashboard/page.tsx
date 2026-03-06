'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import type { TrainingPlan, UserProfile, RunLog } from '@/lib/schemas';

// ─── Utilities ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_BADGE: Record<string, string> = {
  easy:          'bg-emerald-100 text-emerald-700',
  tempo:         'bg-orange-100 text-orange-700',
  long:          'bg-blue-100 text-blue-700',
  interval:      'bg-violet-100 text-violet-700',
  rest:          'bg-gray-100 text-gray-400',
  'cross-train': 'bg-teal-100 text-teal-700',
};

const TYPE_DOT: Record<string, string> = {
  easy:          'bg-emerald-400',
  tempo:         'bg-orange-400',
  long:          'bg-blue-400',
  interval:      'bg-violet-400',
  rest:          'bg-gray-300',
  'cross-train': 'bg-teal-400',
};

function formatPace(minsPerMile: number) {
  const m = Math.floor(minsPerMile);
  const s = Math.round((minsPerMile - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function shortDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400">
      {message}
    </div>
  );
}

// ─── Dashboard content ────────────────────────────────────────────────────────

function DashboardContent() {
  const { user } = useAuth();

  const [plan, setPlan]       = useState<TrainingPlan | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs]       = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const uid = user!.uid;

  useEffect(() => {
    async function fetchData() {
      try {
        const [profileSnap, plansSnap, logsSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          getDocs(query(collection(db, 'users', uid, 'plans'), orderBy('generatedAt', 'desc'), limit(1))),
          getDocs(query(collection(db, 'users', uid, 'logs'), orderBy('date', 'desc'), limit(10))),
        ]);

        if (profileSnap.exists()) setProfile(profileSnap.data() as UserProfile);
        if (!plansSnap.empty)    setPlan(plansSnap.docs[0].data() as TrainingPlan);

        const fetchedLogs = logsSnap.docs.map(d => d.data() as RunLog);
        setLogs(fetchedLogs.reverse()); // chronological for charts
      } catch (err) {
        console.error('Dashboard fetch failed:', err);
        setError('Failed to load your data. Please refresh.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="text-sm text-indigo-600 underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Chart data derived from logs
  const hrData = logs
    .filter(l => l.averageHeartRate != null)
    .map(l => ({ date: shortDate(l.date), hr: l.averageHeartRate }));

  const paceData = logs
    .filter(l => l.averagePaceMinsPerMile != null)
    .map(l => ({ date: shortDate(l.date), pace: l.averagePaceMinsPerMile }));

  const mileageData = logs.map(l => ({ date: shortDate(l.date), miles: l.distanceMiles }));

  const totalMilesThisWeek = (() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return logs
      .filter(l => new Date(l.date) >= weekAgo)
      .reduce((sum, l) => sum + l.distanceMiles, 0);
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">PaceWise</h1>
            {profile?.name && (
              <p className="text-xs text-gray-400">Hey, {profile.name}</p>
            )}
          </div>
          <Link
            href="/log"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            + Log run
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Onboarding nudge */}
        {!profile && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center justify-between">
            <span>Complete your profile to get a personalised plan.</span>
            <Link href="/onboarding" className="font-semibold underline ml-3 whitespace-nowrap">
              Set up →
            </Link>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            {
              label: 'Miles this week',
              value: totalMilesThisWeek > 0 ? `${totalMilesThisWeek.toFixed(1)} mi` : '—',
            },
            {
              label: 'Runs logged',
              value: logs.length > 0 ? logs.length : '—',
            },
            {
              label: 'Avg HR',
              value: hrData.length > 0
                ? `${Math.round(hrData.reduce((s, d) => s + (d.hr ?? 0), 0) / hrData.length)} bpm`
                : '—',
            },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 text-center">
              <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-1 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Mileage chart */}
        <SectionCard title="Mileage">
          {mileageData.length === 0 ? (
            <EmptyChart message="Log runs to see your mileage history." />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={mileageData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                  formatter={(v: number | undefined) => [`${v ?? 0} mi`, 'Distance']}
                />
                <Bar dataKey="miles" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* HR and Pace charts side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Avg HR */}
          <SectionCard title="Avg Heart Rate">
            {hrData.length === 0 ? (
              <EmptyChart message="No HR data yet. Add a HR monitor to your runs." />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={hrData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={35} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                    formatter={(v: number | undefined) => [`${v ?? 0} bpm`, 'Avg HR']}
                  />
                  <Line type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* Avg Pace */}
          <SectionCard title="Avg Pace">
            {paceData.length === 0 ? (
              <EmptyChart message="No pace data yet. Log pace with your next run." />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={paceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    reversed
                    domain={['auto', 'auto']}
                    tickFormatter={formatPace}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                    formatter={(v: number | undefined) => [formatPace(v ?? 0) + ' /mi', 'Pace']}
                  />
                  <Line type="monotone" dataKey="pace" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>

        {/* Training plan */}
        {plan ? (
          <SectionCard title="This week's plan">
            <div className="flex items-center justify-between -mt-1 mb-4">
              <span className="text-xs text-gray-400">
                Generated {new Date(plan.generatedAt).toLocaleDateString()}
              </span>
            </div>

            <div className="space-y-2 mb-5">
              {plan.weeklyPlan.map((run) => (
                <div
                  key={run.dayOfWeek}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
                >
                  <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${TYPE_DOT[run.type] ?? 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-800">
                        {DAY_NAMES[run.dayOfWeek - 1]}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {run.distanceMiles != null && (
                          <span className="text-xs text-gray-400">{run.distanceMiles} mi</span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_BADGE[run.type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {run.type}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-snug">{run.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-1.5">
                Why this plan?
              </p>
              <p className="text-sm text-indigo-900 leading-relaxed">{plan.reasoning}</p>
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Training plan">
            <div className="text-center py-10">
              <p className="text-gray-500 mb-1">No plan generated yet.</p>
              <p className="text-sm text-gray-400 mb-5">Log your first run and we'll build one for you.</p>
              <Link
                href="/log"
                className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors text-sm"
              >
                Log your first run
              </Link>
            </div>
          </SectionCard>
        )}
      </main>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
