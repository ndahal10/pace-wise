import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  DocumentReference,
  Timestamp,
} from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  age: number;           // years
  weightLbs: number;     // pounds
  gender: string;        // free text
  weeklyMileage: number; // current weekly running distance in miles
  injuries: string;      // free text description
  availabilityDays: number; // days per week available to run
  updatedAt?: Timestamp;
}

export interface RunLog {
  date: string;           // ISO date e.g. "2026-02-26"
  distanceMiles: number;
  durationMinutes: number;
  averagePaceMinsPerMile?: number;
  averageHeartRate?: number;
  notes?: string;
  createdAt?: Timestamp;
}

export interface TrainingPlan {
  weekStartDate: string; // ISO date of Monday
  runs: PlannedRun[];
  generatedAt?: Timestamp;
}

export interface PlannedRun {
  day: number;           // 1 = Monday, 7 = Sunday
  type: 'easy' | 'tempo' | 'long' | 'rest' | 'cross-train';
  distanceMiles?: number;
  notes: string;
}

// ─── Generic document fetcher ─────────────────────────────────────────────────
//
// T is a type parameter — a placeholder for whatever shape the document has.
// The caller decides what T is (e.g. UserProfile, TrainingPlan).
// This lets one function safely fetch any document without duplicating logic.

async function fetchDoc<T>(ref: DocumentReference): Promise<T | null> {
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as T;
}

// ─── Profile ──────────────────────────────────────────────────────────────────
//
// Stored at: users/{userId}
// merge: true means partial updates won't wipe existing fields.

export async function saveProfile(
  userId: string,
  profile: Partial<UserProfile>
): Promise<void> {
  const ref = doc(db, 'users', userId);
  await setDoc(ref, { ...profile, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const ref = doc(db, 'users', userId);
  return fetchDoc<UserProfile>(ref); // T = UserProfile
}

// ─── Run Logs ─────────────────────────────────────────────────────────────────
//
// Stored at: users/{userId}/logs/{auto-id}
// addDoc auto-generates a unique ID per entry.

export async function saveLog(userId: string, log: RunLog): Promise<string> {
  const ref = collection(db, 'users', userId, 'logs');
  const docRef = await addDoc(ref, { ...log, createdAt: serverTimestamp() });
  return docRef.id;
}

// ─── Training Plan ────────────────────────────────────────────────────────────
//
// Stored at: users/{userId}/plans/current
// One active plan per user at a time.

export async function savePlan(userId: string, plan: TrainingPlan): Promise<void> {
  const ref = doc(db, 'users', userId, 'plans', 'current');
  await setDoc(ref, { ...plan, generatedAt: serverTimestamp() });
}

export async function getPlan(userId: string): Promise<TrainingPlan | null> {
  const ref = doc(db, 'users', userId, 'plans', 'current');
  return fetchDoc<TrainingPlan>(ref); // T = TrainingPlan
}
