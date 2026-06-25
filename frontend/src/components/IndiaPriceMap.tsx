import React, { useState } from 'react';

interface City {
  name: string;
  x: number; // SVG coordinate
  y: number;
  premiumMultiplier: number; // local price variation factor
}

// Major Indian gold/silver pricing cities with SVG coords mapped to India outline
const CITIES: City[] = [
  { name: 'Delhi',     x: 198, y: 108, premiumMultiplier: 1.0000 },
  { name: 'Mumbai',    x: 148, y: 218, premiumMultiplier: 1.0012 },
  { name: 'Kolkata',   x: 298, y: 178, premiumMultiplier: 0.9988 },
  { name: 'Chennai',   x: 218, y: 318, premiumMultiplier: 1.0008 },
  { name: 'Bengaluru', x: 198, y: 308, premiumMultiplier: 1.0015 },
  { name: 'Hyderabad', x: 208, y: 268, premiumMultiplier: 1.0005 },
  { name: 'Ahmedabad', x: 138, y: 178, premiumMultiplier: 0.9995 },
  { name: 'Jaipur',    x: 178, y: 138, premiumMultiplier: 1.0003 },
  { name: 'Lucknow',   x: 228, y: 128, premiumMultiplier: 0.9992 },
  { name: 'Pune',      x: 158, y: 238, premiumMultiplier: 1.0010 },
];

interface Props {
  rate: number;       // current rate per gram from selectedMarketRate
  asset: string;      // GOLD, SILVER etc
  theme: string;      // 'dark' | 'light'
}

export const IndiaPriceMap: React.FC<Props> = ({ rate, asset, theme }) => {
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const isDark = theme === 'dark';

  // Color tokens based on theme
  const mapStroke    = isDark ? '#C5A880' : '#1e40af';   // gold | blue
  const mapFill      = isDark ? 'rgba(197,168,128,0.04)' : 'rgba(30,64,175,0.04)';
  const dotColor     = isDark ? '#C5A880' : '#1e40af';
  const dotPulse     = isDark ? 'rgba(197,168,128,0.25)' : 'rgba(30,64,175,0.20)';
  const tooltipBg    = isDark ? '#1C1C1E' : '#ffffff';
  const tooltipText  = isDark ? '#ffffff' : '#0f172a';
  const tooltipBorder= isDark ? '#C5A880' : '#1e40af';

  const formatRate = (r: number) =>
    '₹' + r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleMouseEnter = (city: City, e: React.MouseEvent<SVGCircleElement>) => {
    setHoveredCity(city.name);
    const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 36,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGCircleElement>) => {
    const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 36,
    });
  };

  return (
    <div className="relative w-full" style={{ height: '192px' }}>
      <svg
        viewBox="0 60 370 340"
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <style>{`
            @keyframes pulse-ring {
              0%   { r: 6px;  opacity: 0.8; }
              100% { r: 14px; opacity: 0;   }
            }
            .city-pulse { animation: pulse-ring 2s ease-out infinite; }
            .city-pulse-2 { animation: pulse-ring 2s ease-out infinite 0.6s; }
            .city-pulse-3 { animation: pulse-ring 2s ease-out infinite 1.2s; }
          `}</style>
        </defs>

        {/* ── India SVG outline path (simplified, accurate outline) ── */}
        <path
          d="
            M 178 65
            L 192 62 L 210 65 L 228 62 L 242 70
            L 255 68 L 268 75 L 275 85 L 268 95
            L 278 105 L 285 118 L 280 128
            L 292 135 L 305 145 L 310 158
            L 318 165 L 315 178 L 308 185
            L 312 195 L 305 205 L 295 208
            L 288 218 L 278 225 L 268 228
            L 260 238 L 250 248 L 242 258
            L 238 268 L 232 278 L 228 290
            L 222 302 L 218 315 L 222 325
            L 228 335 L 232 345 L 228 355
            L 222 362 L 215 368 L 208 362
            L 202 352 L 198 342 L 192 332
            L 185 320 L 180 308 L 175 295
            L 168 282 L 162 268 L 155 255
            L 148 242 L 142 228 L 135 218
            L 128 205 L 122 192 L 118 178
            L 112 165 L 108 152 L 112 140
            L 118 130 L 122 118 L 128 108
            L 135 98 L 142 90 L 150 82
            L 158 75 L 168 68 Z

            M 215 368 L 218 375 L 222 382
            L 218 388 L 212 392 L 205 388
            L 200 382 L 202 375 L 208 370 Z
          "
          fill={mapFill}
          stroke={mapStroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* ── City dots with pulsing rings ── */}
        {CITIES.map((city, i) => {
            const isHovered = hoveredCity === city.name;
            const pulseClass = i % 3 === 0 ? 'city-pulse' : i % 3 === 1 ? 'city-pulse-2' : 'city-pulse-3';

            return (
                <g key={city.name}>
                <circle
                    cx={city.x}
                    cy={city.y}
                    r="6"
                    fill={dotPulse}
                    stroke="none"
                    className={isHovered ? undefined : pulseClass}
                />
                <circle
                    cx={city.x}
                    cy={city.y}
                    r={isHovered ? 5 : 3.5}
                    fill={isHovered ? dotColor : dotPulse.replace('0.25', '0.7').replace('0.20', '0.6')}
                    stroke={dotColor}
                    strokeWidth={isHovered ? 1.5 : 1}
                    style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                    onMouseEnter={(e) => handleMouseEnter(city, e)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredCity(null)}
                />
                </g>
            );
            })}

        {/* ── Tooltip ── */}
        {hoveredCity && (() => {
          const city = CITIES.find(c => c.name === hoveredCity)!;
          const cityRate = rate * city.premiumMultiplier;
          const label = `${city.name}: ${formatRate(cityRate)}/g`;
          const tw = label.length * 6.5 + 16;
          const tx = Math.min(tooltipPos.x - tw / 2, 330);
          const ty = tooltipPos.y;

          return (
            <g>
              <rect
                x={tx}
                y={ty}
                width={tw}
                height={26}
                rx={5}
                fill={tooltipBg}
                stroke={tooltipBorder}
                strokeWidth="1"
                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
              />
              <text
                x={tx + tw / 2}
                y={ty + 16}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill={tooltipText}
                fontFamily="system-ui, sans-serif"
              >
                {label}
              </text>
            </g>
          );
        })()}

        {/* ── Asset label watermark ── */}
        <text
          x="215"
          y="220"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={mapStroke}
          opacity="0.12"
          fontFamily="system-ui, sans-serif"
          letterSpacing="4"
        >
          {asset}
        </text>
      </svg>
    </div>
  );
};