'use client';
// A server-side failure while loading the page (mostly Supabase statement timeouts under load)
// is transient: the page reloads itself, up to 2 times in a row, before showing the error.
import { useEffect, useState } from 'react';

const KEY = 'auto-reload';
const MAX_RELOADS = 2;
// Attempts older than this belong to an earlier failure, not to this streak
const STREAK_MS = 60_000;

export default function Error({ error }: { error: Error & { digest?: string } }) {
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let count = 0;
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
      if (saved && Date.now() - saved.at < STREAK_MS) count = saved.count;
      if (count < MAX_RELOADS) sessionStorage.setItem(KEY, JSON.stringify({ count: count + 1, at: Date.now() }));
    } catch {
      // No sessionStorage: the reloads can't be counted, so don't reload
      count = MAX_RELOADS;
    }
    // The second attempt waits longer: an immediate retry hits the same load
    const timer = count >= MAX_RELOADS
      ? setTimeout(() => setGaveUp(true), 0)
      : setTimeout(() => window.location.reload(), (count + 1) * 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1115] text-gray-100">
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        {gaveUp ? (
          <>
            <p>The data could not be loaded.</p>
            {error.digest && <p className="mt-1 text-xs">Error code: {error.digest}</p>}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded bg-blue-900/30 text-blue-400 border border-blue-800 text-xs font-bold uppercase tracking-widest"
            >
              Reload
            </button>
          </>
        ) : (
          <p>Loading failed, retrying...</p>
        )}
      </div>
    </div>
  );
}
