import { useState, useEffect, useMemo } from "react";

interface DataCenter {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  gpus: number;
  active: boolean;
  load: number;
}

const dataCenters: DataCenter[] = [
  { id: "us-east-1", name: "Virginia", location: "US East", lat: 37, lng: -79, gpus: 128, active: true, load: 72 },
  { id: "us-west-2", name: "Oregon", location: "US West", lat: 44, lng: -120, gpus: 96, active: true, load: 45 },
  { id: "eu-west-1", name: "Ireland", location: "EU West", lat: 53, lng: -8, gpus: 64, active: false, load: 0 },
  { id: "eu-central-1", name: "Frankfurt", location: "EU Central", lat: 50, lng: 8, gpus: 80, active: true, load: 88 },
  { id: "ap-northeast-1", name: "Tokyo", location: "Asia Pacific", lat: 36, lng: 140, gpus: 48, active: false, load: 0 },
  { id: "ap-southeast-1", name: "Singapore", location: "SE Asia", lat: 1, lng: 104, gpus: 32, active: true, load: 61 },
  { id: "us-central-1", name: "Iowa", location: "US Central", lat: 42, lng: -93, gpus: 112, active: true, load: 55 },
  { id: "eu-north-1", name: "Stockholm", location: "EU North", lat: 59, lng: 18, gpus: 40, active: false, load: 0 },
  { id: "sa-east-1", name: "São Paulo", location: "South America", lat: -23, lng: -47, gpus: 24, active: true, load: 33 },
];

// Simplified world continent outline as polygon coordinate sets
// Each continent is an array of [lat, lng] boundary points
const WORLD_POINTS: [number, number][] = generateWorldDots();

function generateWorldDots(): [number, number][] {
  // Generate a dot-grid world map by defining continent bounding regions
  // Each region: [latMin, latMax, lngMin, lngMax] with optional exclusions
  const continents: { bounds: [number, number, number, number]; exclude?: (lat: number, lng: number) => boolean }[] = [
    // North America
    { bounds: [25, 70, -170, -55], exclude: (lat, lng) => {
      // Hudson Bay area
      if (lat > 50 && lat < 65 && lng > -95 && lng < -75) return true;
      // Cut off ocean areas - shape NA roughly
      if (lat < 30 && lng < -115) return true;
      if (lat > 60 && lng < -145) return true;
      if (lat < 28 && lng > -82) return true;
      // Gulf of Mexico
      if (lat < 30 && lat > 25 && lng > -98 && lng < -82) return true;
      return false;
    }},
    // Central America
    { bounds: [7, 25, -120, -77], exclude: (lat, lng) => {
      if (lat < 15 && lng < -105) return true;
      if (lat > 20 && lng < -105 && lng > -115) return lat > 22;
      if (lat < 10 && lng > -80) return true;
      return false;
    }},
    // South America
    { bounds: [-56, 12, -82, -34], exclude: (lat, lng) => {
      if (lat > 5 && lng < -78) return true;
      if (lat < -45 && lng < -75) return true;
      if (lat > 8 && lng > -60) return true;
      // Narrow the southern tip
      if (lat < -40 && lng > -65) return true;
      return false;
    }},
    // Europe
    { bounds: [36, 71, -10, 40], exclude: (lat, lng) => {
      // Mediterranean
      if (lat < 40 && lng > 20) return true;
      if (lat < 38 && lng > 0 && lng < 10) return true;
      return false;
    }},
    // Africa
    { bounds: [-35, 37, -18, 52], exclude: (lat, lng) => {
      if (lat > 30 && lng > 35) return true;
      if (lat < -30 && lng < -10) return true;
      if (lat < -25 && lng > 35) return true;
      // Gulf of Guinea indent
      if (lat > 0 && lat < 6 && lng > -5 && lng < 8) return true;
      return false;
    }},
    // Asia (mainland)
    { bounds: [10, 75, 40, 180], exclude: (lat, lng) => {
      // Arabian sea / Indian ocean
      if (lat < 25 && lng > 40 && lng < 68) return true;
      // Bay of Bengal
      if (lat < 20 && lat > 5 && lng > 80 && lng < 95) return true;
      if (lat < 15 && lng > 100 && lng < 105) return true;
      return false;
    }},
    // India
    { bounds: [8, 35, 68, 90], exclude: (lat, lng) => {
      if (lat < 12 && lng > 80) return true;
      if (lat > 30 && lng < 72) return true;
      return false;
    }},
    // Australia
    { bounds: [-40, -11, 113, 154], exclude: (lat, lng) => {
      if (lat > -15 && lng < 130) return true;
      if (lat < -38 && lng > 148) return true;
      return false;
    }},
    // UK / Ireland
    { bounds: [50, 59, -11, 2] },
    // Japan
    { bounds: [30, 46, 129, 146] },
    // Indonesia (simplified)
    { bounds: [-8, 6, 95, 140], exclude: (lat, lng) => {
      // Only islands, very rough
      if (lat > 2 && lng > 120) return true;
      if (lat < -5 && lng < 105) return true;
      return false;
    }},
    // New Zealand
    { bounds: [-47, -34, 166, 179] },
    // Greenland
    { bounds: [60, 84, -55, -15], exclude: (lat, lng) => {
      if (lat < 65 && lng < -45) return true;
      return false;
    }},
    // Alaska
    { bounds: [55, 72, -170, -140] },
  ];

  const dots: [number, number][] = [];
  const step = 3; // Degree spacing for dot density

  for (let lat = -60; lat <= 85; lat += step) {
    for (let lng = -180; lng <= 180; lng += step) {
      for (const continent of continents) {
        const [latMin, latMax, lngMin, lngMax] = continent.bounds;
        if (lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax) {
          if (!continent.exclude || !continent.exclude(lat, lng)) {
            dots.push([lat, lng]);
            break;
          }
        }
      }
    }
  }

  return dots;
}

// Convert lat/lng to SVG x/y using Mercator-like projection
function toSvg(lat: number, lng: number, width: number, height: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

const DataCenterMap = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setPulsePhase((p) => (p + 1) % 100), 80);
    return () => clearInterval(interval);
  }, []);

  const svgWidth = 800;
  const svgHeight = 450;
  const dotRadius = 2.2;

  const worldDots = useMemo(() =>
    WORLD_POINTS.map(([lat, lng]) => toSvg(lat, lng, svgWidth, svgHeight)),
    []
  );

  const dcPositions = useMemo(() =>
    dataCenters.map(dc => ({
      ...dc,
      ...toSvg(dc.lat, dc.lng, svgWidth, svgHeight),
    })),
    []
  );

  const activeCenters = dataCenters.filter((dc) => dc.active);
  const totalGpus = activeCenters.reduce((sum, dc) => sum + dc.gpus, 0);

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">{activeCenters.length}</span> active regions
          </span>
        </div>
        <div className="text-muted-foreground">
          <span className="text-foreground font-medium">{totalGpus}</span> GPUs allocated
        </div>
      </div>

      {/* SVG World Map */}
      <div className="surface-elevated rounded-md p-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto"
          style={{ background: "hsl(var(--sidebar-background))" }}
        >
          {/* Continent dots */}
          {worldDots.map((dot, i) => (
            <circle
              key={i}
              cx={dot.x}
              cy={dot.y}
              r={dotRadius}
              fill="hsl(var(--sidebar-border))"
              opacity={0.5}
            />
          ))}

          {/* Data center markers */}
          {dcPositions.map((dc) => {
            const isActive = dc.active;
            const isSelected = dc.id === selected;
            const pulse = isActive ? 0.6 + Math.sin((pulsePhase + dc.lat) * 0.15) * 0.4 : 1;

            return (
              <g key={dc.id} onClick={() => setSelected(dc.id === selected ? null : dc.id)} className="cursor-pointer">
                {/* Glow ring for active */}
                {isActive && (
                  <circle
                    cx={dc.x}
                    cy={dc.y}
                    r={14}
                    fill="none"
                    stroke="hsl(160 60% 45%)"
                    strokeWidth={1}
                    opacity={pulse * 0.4}
                  />
                )}
                {isActive && (
                  <circle
                    cx={dc.x}
                    cy={dc.y}
                    r={8}
                    fill="hsl(160 60% 45% / 0.15)"
                    opacity={pulse}
                  />
                )}
                {/* Center dot */}
                <circle
                  cx={dc.x}
                  cy={dc.y}
                  r={isSelected ? 5 : 4}
                  fill={isActive ? "hsl(160 60% 45%)" : "hsl(var(--muted-foreground))"}
                  opacity={isActive ? pulse : 0.4}
                />
                {isSelected && (
                  <circle
                    cx={dc.x}
                    cy={dc.y}
                    r={18}
                    fill="none"
                    stroke="hsl(160 60% 50%)"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    opacity={0.7}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected detail or legend */}
      {selected ? (
        <SelectedDetail dc={dataCenters.find((d) => d.id === selected)!} />
      ) : (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
            Idle
          </div>
          <span className="ml-auto">Click a region for details</span>
        </div>
      )}

      {/* Scheduler timeline */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">GPU Scheduler</p>
        <div className="space-y-2">
          {activeCenters.map((dc, idx) => (
            <div key={dc.id} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 truncate">{dc.name}</span>
              <div className="flex-1 h-6 bg-border/30 rounded-sm overflow-hidden flex">
                {Array.from({ length: 8 }).map((_, i) => {
                  // Deterministic "random" based on index
                  const seed = (idx * 8 + i) * 2654435761;
                  const isScheduled = (seed % 100) > 35;
                  const width = 8 + (seed % 10);
                  return (
                    <div
                      key={i}
                      className={`h-full border-r border-background/50 transition-colors ${
                        isScheduled ? "bg-emerald-500/70" : "bg-transparent"
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  );
                })}
              </div>
              <span className="text-xs font-mono text-muted-foreground w-10 text-right">{dc.load}%</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Now</span>
          <span>+15 min (est. completion)</span>
        </div>
      </div>
    </div>
  );
};

const SelectedDetail = ({ dc }: { dc: DataCenter }) => (
  <div className="surface-elevated rounded-md px-5 py-4 animate-fade-in">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-foreground">{dc.name}</p>
        <p className="text-sm text-muted-foreground">{dc.location} · {dc.id}</p>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div>
          <p className="text-muted-foreground">GPUs</p>
          <p className="font-mono font-medium text-foreground">{dc.gpus}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Load</p>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${dc.load}%` }} />
            </div>
            <span className="font-mono text-foreground text-xs">{dc.load}%</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dc.active ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
          <span className={dc.active ? "text-emerald-600" : "text-muted-foreground"}>
            {dc.active ? "Allocated" : "Idle"}
          </span>
        </div>
      </div>
    </div>
  </div>
);

export default DataCenterMap;
