import { useState, useEffect, useMemo } from "react";

interface EmissionEntry {
  time_utc: string;
  co2_emission: number;
}

type EmissionsData = Record<string, EmissionEntry[]>;

const DC_COORDS: Record<string, { lat: number; lng: number; location: string }> = {
  "Crusoe Ireland":      { lat: 53.3,  lng: -7.9,   location: "Ireland, EU" },
  "Crusoe Italy":        { lat: 41.9,  lng: 12.5,   location: "Italy, EU" },
  "Crusoe Abilene TX":   { lat: 32.4,  lng: -99.7,  location: "Texas, US" },
  "Crusoe Charlotte NC": { lat: 35.2,  lng: -80.8,  location: "N. Carolina, US" },
  "Crusoe Iceland":      { lat: 64.9,  lng: -18.1,  location: "Iceland, EU" },
};

function emissionColor(v: number): string {
  if (v < 3) return "hsl(160 60% 40%)";   // green
  if (v <= 4) return "hsl(45 90% 50%)";   // yellow
  return "hsl(0 70% 50%)";                 // red
}

function emissionBg(v: number): string {
  if (v < 3) return "bg-emerald-500";
  if (v <= 4) return "bg-yellow-500";
  return "bg-red-500";
}

// Simplified world map dots
function generateWorldDots(): [number, number][] {
  const continents: { bounds: [number, number, number, number]; exclude?: (lat: number, lng: number) => boolean }[] = [
    { bounds: [25, 70, -170, -55], exclude: (lat, lng) => (lat > 50 && lat < 65 && lng > -95 && lng < -75) || (lat < 30 && lng < -115) || (lat < 28 && lng > -82) },
    { bounds: [7, 25, -120, -77] },
    { bounds: [-56, 12, -82, -34], exclude: (lat, lng) => (lat > 5 && lng < -78) || (lat < -45 && lng < -75) },
    { bounds: [36, 71, -10, 40], exclude: (lat, lng) => lat < 40 && lng > 20 },
    { bounds: [-35, 37, -18, 52], exclude: (lat, lng) => (lat > 30 && lng > 35) || (lat < -25 && lng > 35) },
    { bounds: [10, 75, 40, 180], exclude: (lat, lng) => (lat < 25 && lng > 40 && lng < 68) || (lat < 20 && lat > 5 && lng > 80 && lng < 95) },
    { bounds: [8, 35, 68, 90] },
    { bounds: [-40, -11, 113, 154], exclude: (lat, lng) => lat > -15 && lng < 130 },
    { bounds: [50, 59, -11, 2] },
    { bounds: [30, 46, 129, 146] },
    { bounds: [60, 84, -55, -15] },
    { bounds: [55, 72, -170, -140] },
  ];
  const dots: [number, number][] = [];
  for (let lat = -60; lat <= 85; lat += 3) {
    for (let lng = -180; lng <= 180; lng += 3) {
      for (const c of continents) {
        const [latMin, latMax, lngMin, lngMax] = c.bounds;
        if (lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax) {
          if (!c.exclude || !c.exclude(lat, lng)) { dots.push([lat, lng]); break; }
        }
      }
    }
  }
  return dots;
}

const WORLD_DOTS = generateWorldDots();

function toSvg(lat: number, lng: number, w: number, h: number) {
  return { x: ((lng + 180) / 360) * w, y: ((90 - lat) / 180) * h };
}

// ── Heatmap strip ──────────────────────────────────────────────────────────────

interface HeatmapRowProps {
  name: string;
  entries: EmissionEntry[];
  selected: boolean;
  onClick: () => void;
}

const HeatmapRow = ({ name, entries, selected, onClick }: HeatmapRowProps) => {
  const avg = entries.length ? entries.reduce((s, e) => s + e.co2_emission, 0) / entries.length : 0;

  return (
    <div
      onClick={onClick}
      className={`rounded-md px-4 py-3 cursor-pointer transition-colors ${selected ? "surface-elevated ring-1 ring-primary/40" : "hover:bg-border/10"}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-medium text-foreground w-44 shrink-0">{name}</span>
        <span className="text-xs text-muted-foreground">{DC_COORDS[name]?.location}</span>
        <span className="ml-auto text-xs font-mono text-muted-foreground">
          avg <span style={{ color: emissionColor(avg) }}>{avg.toFixed(2)}</span> kg/GB·h
        </span>
      </div>
      {/* 168 hourly cells */}
      <div className="flex gap-px overflow-hidden rounded-sm">
        {entries.map((e, i) => (
          <div
            key={i}
            title={`${e.time_utc}: ${e.co2_emission} kg/GB·h`}
            className="h-6 flex-1 min-w-0"
            style={{ backgroundColor: emissionColor(e.co2_emission), opacity: 0.85 }}
          />
        ))}
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

const DataCenterMap = () => {
  const [emissions, setEmissions] = useState<EmissionsData>({});
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/datacenter_emissions.json")
      .then((r) => r.json())
      .then((data: EmissionsData) => setEmissions(data));
  }, []);

  const dcNames = Object.keys(emissions);

  // Day labels from first DC — skip partial days (< 12h), position at segment centre
  const dayLabels = useMemo(() => {
    const entries = dcNames.length ? emissions[dcNames[0]] : [];
    const seen = new Map<string, number>();
    entries.forEach((e, i) => {
      const day = e.time_utc.slice(0, 10);
      if (!seen.has(day)) seen.set(day, i);
    });
    const days = Array.from(seen.entries()); // [date, startIdx]
    return days
      .map(([day, startIdx], i) => {
        const endIdx = days[i + 1]?.[1] ?? entries.length;
        const count = endIdx - startIdx;
        if (count < 1) return null;
        const [y, m, d] = day.split("-").map(Number);
        const label = new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
        const centerPct = ((startIdx + count / 2) / entries.length) * 100;
        return { label, centerPct };
      })
      .filter(Boolean) as { label: string; centerPct: number }[];
  }, [emissions, dcNames]);

  const totalHours = dcNames.length ? emissions[dcNames[0]].length : 0;

  // World map
  const svgW = 700, svgH = 350;
  const worldDots = useMemo(() => WORLD_DOTS.map(([lat, lng]) => toSvg(lat, lng, svgW, svgH)), []);
  const dcPositions = useMemo(() =>
    Object.entries(DC_COORDS).map(([name, c]) => ({ name, ...toSvg(c.lat, c.lng, svgW, svgH) })),
  []);

  return (
    <div className="space-y-6">
      {/* World map */}
      <div className="surface-elevated rounded-md p-4 overflow-hidden">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto" style={{ background: "hsl(var(--sidebar-background))" }}>
          {worldDots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={2} fill="hsl(var(--sidebar-border))" opacity={0.5} />
          ))}
          {dcPositions.map((dc) => {
            const isSel = dc.name === selected;
            const entries = emissions[dc.name] ?? [];
            const avg = entries.length ? entries.reduce((s, e) => s + e.co2_emission, 0) / entries.length : 3.5;
            return (
              <g key={dc.name} onClick={() => setSelected(dc.name === selected ? null : dc.name)} className="cursor-pointer">
                <circle cx={dc.x} cy={dc.y} r={isSel ? 7 : 5} fill={emissionColor(avg)} opacity={0.9} />
                {isSel && <circle cx={dc.x} cy={dc.y} r={12} fill="none" stroke={emissionColor(avg)} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.7} />}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground px-1">
        <span className="font-medium text-foreground">CO₂ intensity (kg/GB·h)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> &lt; 3 — low</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block" /> 3–4 — moderate</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> &gt; 4 — high</span>
      </div>

      {/* Heatmap rows */}
      <div className="space-y-1">
        {dcNames.map((name) => (
          <HeatmapRow
            key={name}
            name={name}
            entries={emissions[name]}
            selected={selected === name}
            onClick={() => setSelected(name === selected ? null : name)}
          />
        ))}

        {/* Day tick labels */}
        {totalHours > 0 && dayLabels.length > 0 && (
          <div className="relative h-5 mx-4 mt-1">
            {dayLabels.map((d) => (
              <span
                key={d.label}
                className="absolute text-[10px] text-muted-foreground whitespace-nowrap"
                style={{ left: `${d.centerPct}%`, transform: "translateX(-50%)" }}
              >
                {d.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataCenterMap;
