import { useMemo } from 'react';

export interface MapPoint {
  lat: number;
  lng: number;
  kind: 'driver' | 'history' | 'destination';
  label?: string;
}

/**
 * Carte schématique en SVG — positions GPS réelles projetées
 * sur une grille (aucune librairie externe, aucune tuile distante).
 */
export function LiveMap({
  points,
  height = 340,
  caption,
}: {
  points: MapPoint[];
  height?: number;
  caption?: string;
}) {
  const model = useMemo(() => {
    const valid = points.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
    );
    if (valid.length === 0) return null;

    const lats = valid.map((p) => p.lat);
    const lngs = valid.map((p) => p.lng);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);
    const padLat = Math.max((maxLat - minLat) * 0.25, 0.004);
    const padLng = Math.max((maxLng - minLng) * 0.25, 0.004);
    minLat -= padLat;
    maxLat += padLat;
    minLng -= padLng;
    maxLng += padLng;

    const W = 1000;
    const H = 620;
    const project = (p: MapPoint) => ({
      x: ((p.lng - minLng) / (maxLng - minLng)) * W,
      y: H - ((p.lat - minLat) / (maxLat - minLat)) * H,
    });

    return { projected: valid.map((p) => ({ ...p, ...project(p) })), W, H };
  }, [points]);

  if (!model) {
    return (
      <div className="p-map p-stack" style={{ height, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span className="p-map-chip">Aucune position GPS disponible</span>
      </div>
    );
  }

  const { projected, W, H } = model;
  const historyLine = projected.filter((p) => p.kind !== 'driver');
  const driver = projected.find((p) => p.kind === 'driver');
  const destination = projected.find((p) => p.kind === 'destination');

  return (
    <div className="p-map" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        role="img"
        aria-label={caption ?? 'Carte des positions GPS'}
      >
        <defs>
          <pattern id="pmap-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0V64" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
          <radialGradient id="pmap-glow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(79,70,229,0.35)" />
            <stop offset="100%" stopColor="rgba(79,70,229,0)" />
          </radialGradient>
        </defs>

        <rect width={W} height={H} fill="#111213" />
        <rect width={W} height={H} fill="url(#pmap-grid)" />
        <rect width={W} height={H} fill="url(#pmap-glow)" />

        {historyLine.length > 1 && (
          <polyline
            points={historyLine.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10 9"
          />
        )}

        {historyLine.map((p, i) => (
          <circle key={`h-${i}`} cx={p.x} cy={p.y} r="5" fill="rgba(255,255,255,0.65)" />
        ))}

        {destination && (
          <g transform={`translate(${destination.x}, ${destination.y})`}>
            <circle r="14" fill="rgba(17,18,19,0.9)" stroke="#fff" strokeWidth="3" />
            <rect x="-4" y="-4" width="8" height="8" rx="1.5" fill="#fff" />
          </g>
        )}

        {driver && (
          <g transform={`translate(${driver.x}, ${driver.y})`}>
            <circle r="26" fill="none" stroke="rgba(79,70,229,0.55)" strokeWidth="3">
              <animate attributeName="r" values="18;34;18" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0;0.9" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle r="13" fill="#4f46e5" stroke="#fff" strokeWidth="4" />
          </g>
        )}
      </svg>

      <div className="p-map-overlay">
        {caption && <span className="p-map-chip">{caption}</span>}
        {driver?.label && <span className="p-map-chip">● {driver.label}</span>}
        <span className="p-map-chip" style={{ opacity: 0.75 }}>
          positions GPS réelles
        </span>
      </div>
    </div>
  );
}
