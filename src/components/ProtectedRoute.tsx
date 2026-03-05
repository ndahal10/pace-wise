'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
//
// Wraps any page that requires authentication. Three possible states:
//
//  loading=true          → Firebase is still checking localStorage for a
//                          persisted session. Render a spinner; don't redirect.
//
//  loading=false, no user → Auth check is complete, no one is signed in.
//                          Redirect to /login.
//
//  loading=false, user   → Confirmed signed in. Render children.

interface Props {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect once Firebase has finished its initial check.
    // If we redirected while loading=true, we'd bounce logged-in users to
    // /login on every page refresh — they'd have to sign in again every time.
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // user is null and the redirect is in-flight — render nothing to avoid a
  // flash of the protected content before navigation completes.
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
