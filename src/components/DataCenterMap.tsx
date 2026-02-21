import { useState, useEffect } from "react";

interface DataCenter {
  id: string;
  name: string;
  location: string;
  region: string;
  lat: number;
  lng: number;
  gpus: number;
  active: boolean;
  load: number; // 0-100
}

const dataCenters: DataCenter[] = [
  { id: "us-east-1", name: "Virginia", location: "US East", region: "NA", lat: 37, lng: -79, gpus: 128, active: true, load: 72 },
  { id: "us-west-2", name: "Oregon", location: "US West", region: "NA", lat: 44, lng: -120, gpus: 96, active: true, load: 45 },
  { id: "eu-west-1", name: "Ireland", location: "EU West", region: "EU", lat: 53, lng: -8, gpus: 64, active: false, load: 0 },
  { id: "eu-central-1", name: "Frankfurt", location: "EU Central", region: "EU", lat: 50, lng: 8, gpus: 80, active: true, load: 88 },
  { id: "ap-northeast-1", name: "Tokyo", location: "Asia Pacific", region: "AP", lat: 36, lng: 140, gpus: 48, active: false, load: 0 },
  { id: "ap-southeast-1", name: "Singapore", location: "SE Asia", region: "AP", lat: 1, lng: 104, gpus: 32, active: true, load: 61 },
  { id: "us-central-1", name: "Iowa", location: "US Central", region: "NA", lat: 42, lng: -93, gpus: 112, active: true, load: 55 },
  { id: "eu-north-1", name: "Stockholm", location: "EU North", region: "EU", lat: 59, lng: 18, gpus: 40, active: false, load: 0 },
  { id: "sa-east-1", name: "São Paulo", location: "South America", region: "SA", lat: -23, lng: -47, gpus: 24, active: true, load: 33 },
];

const DataCenterMap = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setPulsePhase((p) => (p + 1) % 100), 80);
    return () => clearInterval(interval);
  }, []);

  // Grid dimensions
  const cols = 36;
  const rows = 18;

  // Map lat/lng to grid position
  const toGrid = (lat: number, lng: number) => ({
    col: Math.round(((lng + 180) / 360) * cols),
    row: Math.round(((90 - lat) / 180) * rows),
  });

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

      {/* Grid map */}
      <div className="surface-elevated rounded-md p-4 overflow-hidden">
        <div
          className="grid gap-[2px] mx-auto"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            maxWidth: "100%",
          }}
        >
          {Array.from({ length: rows * cols }).map((_, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;

            // Check if any data center is near this cell
            const nearbyDC = dataCenters.find((dc) => {
              const pos = toGrid(dc.lat, dc.lng);
              const dist = Math.abs(pos.row - row) + Math.abs(pos.col - col);
              return dist <= 1;
            });

            const isCenter = nearbyDC
              ? (() => {
                  const pos = toGrid(nearbyDC.lat, nearbyDC.lng);
                  return pos.row === row && pos.col === col;
                })()
              : false;

            const isActive = nearbyDC?.active;
            const isSelected = nearbyDC?.id === selected;

            // Glow radius for active centers
            const glowDC = dataCenters.find((dc) => {
              if (!dc.active) return false;
              const pos = toGrid(dc.lat, dc.lng);
              const dist = Math.abs(pos.row - row) + Math.abs(pos.col - col);
              return dist <= 2 && dist > 1;
            });

            return (
              <div
                key={idx}
                className={`aspect-square rounded-[1px] transition-all duration-300 cursor-default ${
                  isCenter && isActive
                    ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] cursor-pointer"
                    : isCenter && !isActive
                      ? "bg-muted-foreground/40 cursor-pointer"
                      : glowDC
                        ? "bg-emerald-500/15"
                        : "bg-border/40"
                } ${isSelected ? "ring-1 ring-emerald-400 scale-150 z-10" : ""}`}
                style={
                  isCenter && isActive
                    ? {
                        opacity: 0.7 + Math.sin((pulsePhase + idx) * 0.1) * 0.3,
                      }
                    : undefined
                }
                onClick={() => {
                  if (nearbyDC && isCenter) setSelected(nearbyDC.id === selected ? null : nearbyDC.id);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Selected detail or legend */}
      {selected ? (
        <div className="surface-elevated rounded-md px-5 py-4 animate-fade-in">
          {(() => {
            const dc = dataCenters.find((d) => d.id === selected)!;
            return (
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
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${dc.load}%` }}
                        />
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
            );
          })()}
        </div>
      ) : (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[1px] bg-emerald-500" />
            Active
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[1px] bg-muted-foreground/40" />
            Idle
          </div>
          <span className="ml-auto">Click a region for details</span>
        </div>
      )}

      {/* Scheduler timeline */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">GPU Scheduler</p>
        <div className="space-y-2">
          {activeCenters.map((dc) => (
            <div key={dc.id} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 truncate">{dc.name}</span>
              <div className="flex-1 h-6 bg-border/30 rounded-sm overflow-hidden flex">
                {/* Simulated scheduled blocks */}
                {Array.from({ length: 8 }).map((_, i) => {
                  const isScheduled = Math.random() > 0.35;
                  const width = 8 + Math.random() * 10;
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

export default DataCenterMap;
