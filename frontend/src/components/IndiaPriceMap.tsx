import React, { useState, useRef, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { geoMercator } from 'd3-geo';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-50m.json';

/* ─── Tax constants ────────────────────────────────────────────── */
const CUSTOMS_DUTY = 0.15;
const GST_RATE     = 0.03;

/* ─── City data — real lon/lat, no pixel tracing ─────────────────
   Placement now comes from actual coordinates run through the same
   Mercator projection that draws the outline, so dots always land
   correctly regardless of how the outline geometry is sourced.
   ─────────────────────────────────────────────────────────────── */
interface City {
  name: string;
  lon: number;
  lat: number;
  premiumMultiplier: number;
}

const CITIES: City[] = [
  { name: 'Delhi',       lon: 77.1025, lat: 28.7041, premiumMultiplier: 1.0000 },
  { name: 'Mumbai',      lon: 72.8777, lat: 19.0760, premiumMultiplier: 1.0012 },
  { name: 'Kolkata',     lon: 88.3639, lat: 22.5726, premiumMultiplier: 0.9988 },
  { name: 'Chennai',     lon: 80.2707, lat: 13.0827, premiumMultiplier: 1.0008 },
  { name: 'Bengaluru',   lon: 77.5946, lat: 12.9716, premiumMultiplier: 1.0015 },
  { name: 'Hyderabad',   lon: 78.4867, lat: 17.3850, premiumMultiplier: 1.0005 },
  { name: 'Ahmedabad',   lon: 72.5714, lat: 23.0225, premiumMultiplier: 0.9995 },
  { name: 'Jaipur',      lon: 75.7873, lat: 26.9124, premiumMultiplier: 1.0003 },
  { name: 'Lucknow',     lon: 80.9462, lat: 26.8467, premiumMultiplier: 0.9992 },
  { name: 'Pune',        lon: 73.8567, lat: 18.5204, premiumMultiplier: 1.0010 },
  { name: 'Kochi',       lon: 76.2673, lat: 9.9312,  premiumMultiplier: 1.0018 },
  { name: 'Bhubaneswar', lon: 85.8245, lat: 20.2961, premiumMultiplier: 0.9996 },
];

/* Match the old viewBox so all tooltip clamp math below stays identical */
const VB_W = 400;
const VB_H = 500;
const MAP_PADDING = 20;

/* ─── Props ──────────────────────────────────────────────────── */
interface Props {
  rate: number;   // raw API rate per gram (pre-tax)
  asset: string;  // 'GOLD' | 'SILVER' | …
  theme: string;  // 'dark' | 'light'
}

export const IndiaPriceMap: React.FC<Props> = ({ rate, asset, theme }) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mouseXY, setMouseXY] = useState({ x: 0, y: 0 });
  const containerRef          = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  /* Indian retail rate (with customs + GST) */
  const isRetailMetal = ['GOLD', 'SILVER'].includes(asset.toUpperCase());
  const retailBase    = isRetailMetal
    ? rate * (1 + CUSTOMS_DUTY) * (1 + GST_RATE)
    : rate;

  /* ── Colour tokens ─────────────────────────────────────────── */
  const outline    = isDark ? '#C5A880' : '#1e40af';
  const fillColor  = isDark ? 'rgba(197,168,128,0.07)' : 'rgba(30,64,175,0.06)';
  const dotStroke  = isDark ? '#C5A880' : '#1e40af';
  const dotFill    = isDark ? 'rgba(197,168,128,0.55)' : 'rgba(30,64,175,0.50)';
  const pulseColor = isDark ? 'rgba(197,168,128,0.22)' : 'rgba(30,64,175,0.18)';
  const ttBg       = isDark ? 'rgba(14,14,16,0.97)' : 'rgba(255,255,255,0.97)';
  const ttBorder   = isDark ? '#C5A880' : '#1e40af';
  const ttTitle    = isDark ? '#ffffff' : '#0f172a';
  const ttPrice    = isDark ? '#C5A880' : '#1e40af';
  const ttSub      = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(15,23,42,0.40)';

  /* ── Format ₹ ──────────────────────────────────────────────── */
  const fmt = (v: number) =>
    '\u20B9' + Math.round(v).toLocaleString('en-IN');

  /* ── India outline: real TopoJSON boundary, decoded once ────── */
  const indiaFeature = useMemo(() => {
    const atlas = worldAtlas as any;
    const geo   = feature(atlas, atlas.objects.countries) as any;
    return geo.features.find((f: any) => f.properties?.name === 'India');
  }, []);

  /* Fit India tightly into the same 400x500 box the old hand-traced
     path used to occupy — fitExtent does the scale/center math so
     nothing here needs manual tuning if the data source changes. */
  const projection = useMemo(() => {
    const proj = geoMercator();
    if (indiaFeature) {
      proj.fitExtent(
        [[MAP_PADDING, MAP_PADDING], [VB_W - MAP_PADDING, VB_H - MAP_PADDING]],
        indiaFeature
      );
    }
    return proj;
  }, [indiaFeature]);

  /* ── Mouse tracking ───────────────────────────────────────────
     ComposableMap's <svg> keeps viewBox="0 0 400 500" with default
     preserveAspectRatio (xMidYMid meet), so the rendered map gets
     letterboxed inside the container. We replicate that math here
     to convert real cursor position back into the same 400x500
     coordinate space the tooltip geometry below is written in. */
  const track = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect   = el.getBoundingClientRect();
    const scale  = Math.min(rect.width / VB_W, rect.height / VB_H);
    const offX   = (rect.width - VB_W * scale) / 2;
    const offY   = (rect.height - VB_H * scale) / 2;
    const x = (e.clientX - rect.left - offX) / scale;
    const y = (e.clientY - rect.top - offY) / scale;
    setMouseXY({ x, y });
  };

  /* Tooltip dimensions */
  const TW = 190, TH = 72, TR = 10;

  /* Clamp tooltip inside viewBox 0 0 400 500 — unchanged from before */
  const ttX = Math.min(Math.max(mouseXY.x - TW / 2, 4), VB_W - 4 - TW);
  const ttY = mouseXY.y - TH - 18 < 4 ? mouseXY.y + 14 : mouseXY.y - TH - 18;

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onMouseMove={track}
    >
      <ComposableMap
        width={VB_W}
        height={VB_H}
        projection={projection}
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          <filter id="city-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <style>{`
            @keyframes imap-pulse {
              0%   { r: 7;  opacity: 0.7 }
              80%  { r: 20; opacity: 0   }
              100% { r: 20; opacity: 0   }
            }
            .imp0 { animation: imap-pulse 2.6s ease-out infinite 0.0s }
            .imp1 { animation: imap-pulse 2.6s ease-out infinite 0.4s }
            .imp2 { animation: imap-pulse 2.6s ease-out infinite 0.8s }
            .imp3 { animation: imap-pulse 2.6s ease-out infinite 1.2s }
            .imp4 { animation: imap-pulse 2.6s ease-out infinite 1.6s }
            .imp5 { animation: imap-pulse 2.6s ease-out infinite 2.0s }
          `}</style>
        </defs>

        {/* ── India outline (actual boundary data, not traced) ── */}
        <Geographies geography={worldAtlas}>
          {({ geographies }: { geographies: any[] }) =>
            geographies
              .filter((geo: any) => geo.properties?.name === 'India')
              .map((geo: any) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillColor}
                  stroke={outline}
                  strokeWidth={1.8}
                  style={{
                    default: { outline: 'none' },
                    hover:   { outline: 'none', fill: fillColor },
                    pressed: { outline: 'none', fill: fillColor },
                  }}
                />
              ))
          }
        </Geographies>

        {/* ── City dots ── */}
        {CITIES.map((city, i) => {
          const isH = hovered === city.name;
          return (
            <Marker
              key={city.name}
              coordinates={[city.lon, city.lat] as [number, number]}
              onMouseEnter={() => setHovered(city.name)}
              onMouseLeave={() => setHovered(null)}
              style={{ default: { cursor: 'pointer' } }}
            >
              <circle
                r="7"
                fill={pulseColor}
                stroke="none"
                className={`imp${i % 6}`}
              />
              <circle
                r={isH ? 7 : 4.5}
                fill={isH ? dotStroke : dotFill}
                stroke={dotStroke}
                strokeWidth={isH ? 2 : 1.2}
                filter={isH ? 'url(#city-glow)' : undefined}
                style={{ transition: 'r 0.15s ease' }}
              />
            </Marker>
          );
        })}

        {/* ── Tooltip ── */}
        {hovered && (() => {
          const city     = CITIES.find(c => c.name === hovered)!;
          const cityRate = retailBase * city.premiumMultiplier;
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={ttX + 2} y={ttY + 2}
                width={TW} height={TH} rx={TR}
                fill="rgba(0,0,0,0.25)"
              />
              <rect
                x={ttX} y={ttY}
                width={TW} height={TH} rx={TR}
                fill={ttBg}
                stroke={ttBorder}
                strokeWidth="1.4"
              />
              <text
                x={ttX + TW / 2} y={ttY + 24}
                textAnchor="middle"
                fontSize="14" fontWeight="700"
                fill={ttTitle}
                fontFamily="system-ui,-apple-system,sans-serif"
              >
                {city.name}
              </text>
              <text
                x={ttX + TW / 2} y={ttY + 46}
                textAnchor="middle"
                fontSize="15" fontWeight="700"
                fill={ttPrice}
                fontFamily="'Courier New',monospace"
              >
                {fmt(cityRate)}
                <tspan fontSize="11" fontWeight="400">/g</tspan>
              </text>
              <text
                x={ttX + TW / 2} y={ttY + 62}
                textAnchor="middle"
                fontSize="9.5" fontWeight="400"
                fill={ttSub}
                fontFamily="system-ui,-apple-system,sans-serif"
              >
                incl. 15% customs + 3% GST
              </text>
            </g>
          );
        })()}

        {/* ── Watermark ── */}
        <text
          x="200" y="350"
          textAnchor="middle"
          fontSize="30" fontWeight="800"
          fill={outline}
          opacity="0.05"
          fontFamily="system-ui,sans-serif"
          letterSpacing="10"
        >
          {asset}
        </text>
      </ComposableMap>
    </div>
  );
};