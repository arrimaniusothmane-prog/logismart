import { useEffect, useState } from 'react';

/** Bandeau discret indiquant la connectivité réseau et l'état de synchronisation. */
export function NetworkBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-red-500 px-3 py-1.5 text-xs font-medium text-white">
      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
      Mode hors ligne — les données sont mises en cache localement.
    </div>
  );
}
