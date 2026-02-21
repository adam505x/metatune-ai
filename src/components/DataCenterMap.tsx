import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Area,
  ComposedChart,
} from "recharts";

// ---- Types matching backend /api/schedule response ----
interface HourForecast {
  hour: string;
  carbon_gco2: number;
}

interface BackendDC {
  id: string;
  label: string;
  location: string;
  lat: number;
  lng: number;
  forecast: HourForecast[];
  avg_carbon: number;
}

interface OptimalSchedule {
  data_center_id: string;
  data_center_name: string;
  start_time: string;
  total_co2_kg: number;
  naive_co2_kg: number | null;
  savings_pct: number;
}

// Fallback positions shown while the API loads
const FALLBACK_DCS: BackendDC[] = [
  { id: "crusoe-tx", label: "Abilene, TX",  location: "US Central", lat: 32.4487, lng: -99.7331, forecast: [], avg_carbon: 0 },
  { id: "aws-va",    label: "Virginia, VA", location: "US East",    lat: 39.0438, lng: -77.4874, forecast: [], avg_carbon: 0 },
  { id: "google-fi", label: "Hamina, FI",   location: "EU North",   lat: 60.5693, lng: 27.1938,  forecast: [], avg_carbon: 0 },
];

// ---- World-map dot generation (unchanged) ----
const WORLD_POINTS: [number, number][] = generateWorldDots();

function generateWorldDots(): [number, number][] {
  const continents: { bounds: [number, number, number, number]; exclude?: (lat: number, lng: number) => boolean }[] = [
    { bounds: [25, 70, -170, -55], exclude: (lat, lng) => {
      if (lat > 50 && lat < 65 && lng > -95 && lng < -75) return true;
      if (lat < 30 && lng < -115) return true;
      if (lat > 60 && lng < -145) return true;
      if (lat < 28 && lng > -82) return true;
      if (lat < 30 && lat > 25 && lng > -98 && lng < -82) return true;
      return false;
    }},
    { bounds: [7, 25, -120, -77], exclude: (lat, lng) => {
      if (lat < 15 && lng < -105) return true;
      if (lat > 20 && lng < -105 && lng > -115) return lat > 22;
      if (lat < 10 && lng > -80) return true;
      return false;
    }},
    { bounds: [-56, 12, -82, -34], exclude: (lat, lng) => {
      if (lat > 5 && lng < -78) return true;
      if (lat < -45 && lng < -75) return true;
      if (lat > 8 && lng > -60) return true;
      if (lat < -40 && lng > -65) return true;
      return false;
    }},
    { bounds: [36, 71, -10, 40], exclude: (lat, lng) => {
      if (lat < 40 && lng > 20) return true;
      if (lat < 38 && lng > 0 && lng < 10) return true;
      return false;
    }},
    { bounds: [-35, 37, -18, 52], exclude: (lat, lng) => {
      if (lat > 30 && lng > 35) return true;
      if (lat < -30 && lng < -10) return true;
      if (lat < -25 && lng > 35) return true;
      if (lat > 0 && lat < 6 && lng > -5 && lng < 8) return true;
      return false;
    }},
    { bounds: [10, 75, 40, 180], exclude: (lat, lng) => {
      if (lat < 25 && lng > 40 && lng < 68) return true;
      if (lat < 20 && lat > 5 && lng > 80 && lng < 95) return true;
      if (lat < 15 && lng > 100 && lng < 105) return true;
      return false;
    }},
    { bounds: [8, 35, 68, 90], exclude: (lat, lng) => {
      if (lat < 12 && lng > 80) return true;
      if (lat > 30 && lng < 72) return true;
      return false;
    }},
    { bounds: [-40, -11, 113, 154], exclude: (lat, lng) => {
      if (lat > -15 && lng < 130) return true;
      if (lat < -38 && lng > 148) return true;
      return false;
    }},
    { bounds: [50, 59, -11, 2] },
    { bounds: [30, 46, 129, 146] },
    { bounds: [-8, 6, 95, 140], exclude: (lat, lng) => {
      if (lat > 2 && lng > 120) return true;
      if (lat < -5 && lng < 105) return true;
      return false;
    }},
    { bounds: [-47, -34, 166, 179] },
    { bounds: [60, 84, -55, -15], exclude: (lat, lng) => {
      if (lat < 65 && lng < -45) return true;
      return false;
    }},
    { bounds: [55, 72, -170, -140] },
  ];

  const dots: [number, number][] = [];
  const step = 3;

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

function toSvg(lat: number, lng: number, width: number, height: number) {
  return { x: ((lng + 180) / 360) * width, y: ((90 - lat) / 180) * height };
}

function carbonColor(gco2: number): string {
  if (gco2 < 30) return "bg-emerald-500/70";
  if (gco2 < 60) return "bg-amber-400/70";
  return "bg-red-400/70";
}

// ---- Main component ----
// Generate animated training loss curve data
function generateTrainingLossData(epoch: number) {
  const data: { step: number; loss: number; valLoss: number }[] = [];
  for (let i = 0; i <= epoch; i++) {
    const t = i / 200;
    const loss = 2.8 * Math.exp(-3.5 * t) + 0.15 + 0.08 * Math.sin(i * 0.3) * Math.exp(-2 * t);
    const valLoss = 2.9 * Math.exp(-3.2 * t) + 0.22 + 0.12 * Math.sin(i * 0.25 + 0.5) * Math.exp(-1.8 * t);
    data.push({ step: i, loss: Math.max(0.12, loss), valLoss: Math.max(0.18, valLoss) });
  }
  return data;
}

const LossTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-md text-xs">
      <p className="text-foreground font-medium">Step {d.step}</p>
      <p className="text-muted-foreground">Train: <span className="font-mono text-foreground">{d.loss.toFixed(4)}</span></p>
      <p className="text-muted-foreground">Val: <span className="font-mono text-foreground">{d.valLoss.toFixed(4)}</span></p>
    </div>
  );
};

const DataCenterMap = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [dataCenters, setDataCenters] = useState<BackendDC[]>(FALLBACK_DCS);
  const [optimal, setOptimal] = useState<OptimalSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainingStep, setTrainingStep] = useState(0);
  const [isTraining, setIsTraining] = useState(true);

  // Animate the training loss curve
  useEffect(() => {
    if (!isTraining) return;
    if (trainingStep >= 200) {
      setIsTraining(false);
      return;
    }
    const timer = setTimeout(() => setTrainingStep((s) => Math.min(s + 2, 200)), 40);
    return () => clearTimeout(timer);
  }, [isTraining, trainingStep]);

  const lossData = useMemo(() => generateTrainingLossData(trainingStep), [trainingStep]);
  const currentLoss = lossData.length > 0 ? lossData[lossData.length - 1] : null;

  useEffect(() => {
    const interval = setInterval(() => setPulsePhase((p) => (p + 1) % 100), 80);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("/api/schedule?job_hours=4&job_power_kw=15&deadline_hours=22")
      .then((r) => r.json())
      .then((data) => {
        if (data.data_centers?.length) setDataCenters(data.data_centers);
        setOptimal(data.optimal ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selectedDC = dataCenters.find((d) => d.id === selected);

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">{dataCenters.length}</span> active regions
          </span>
        </div>
        {optimal && (
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <span>Optimal: {optimal.data_center_name} @ {optimal.start_time}</span>
            <span className="bg-amber-400/15 px-2 py-0.5 rounded-full">↓{optimal.savings_pct}% CO₂</span>
          </div>
        )}
        {loading && (
          <span className="text-xs text-muted-foreground animate-pulse">Fetching live carbon data…</span>
        )}
      </div>

      {/* Training Loss Curve */}
      <div className="surface-elevated rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Training Loss — Live
          </p>
          <div className="flex items-center gap-4 text-xs">
            {currentLoss && (
              <>
                <span className="text-muted-foreground">
                  Train: <span className="font-mono text-foreground font-medium">{currentLoss.loss.toFixed(4)}</span>
                </span>
                <span className="text-muted-foreground">
                  Val: <span className="font-mono text-foreground font-medium">{currentLoss.valLoss.toFixed(4)}</span>
                </span>
                <span className="text-muted-foreground">
                  Step: <span className="font-mono text-foreground font-medium">{trainingStep}/200</span>
                </span>
              </>
            )}
            {isTraining && (
              <span className="flex items-center gap-1.5 text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Training
              </span>
            )}
          </div>
        </div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={lossData} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 16% 85%)" vertical={false} />
              <XAxis
                dataKey="step"
                type="number"
                domain={[0, 200]}
                ticks={[0, 50, 100, 150, 200]}
                tick={{ fontSize: 11, fill: "hsl(220 10% 50%)" }}
                axisLine={{ stroke: "hsl(220 16% 80%)" }}
                tickLine={{ stroke: "hsl(220 16% 80%)" }}
                label={{ value: "training step", position: "insideBottom", offset: -18, style: { fontSize: 12, fill: "hsl(220 10% 50%)" } }}
              />
              <YAxis
                domain={[0, 3.2]}
                ticks={[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]}
                tick={{ fontSize: 11, fill: "hsl(220 10% 50%)" }}
                axisLine={{ stroke: "hsl(220 16% 80%)" }}
                tickLine={{ stroke: "hsl(220 16% 80%)" }}
                label={{ value: "loss", angle: -90, position: "insideLeft", offset: -5, style: { fontSize: 12, fill: "hsl(220 10% 50%)" } }}
              />
              <RechartsTooltip content={<LossTooltip />} />
              <Line dataKey="loss" type="monotone" stroke="hsl(222 47% 25%)" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="valLoss" type="monotone" stroke="hsl(222 47% 25% / 0.4)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-[2px] rounded bg-primary inline-block" />
              Train loss
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-[2px] rounded bg-primary/40 inline-block border-t border-dashed border-primary/40" />
              Val loss
            </div>
          </div>
          {!isTraining && (
            <button
              onClick={() => { setTrainingStep(0); setIsTraining(true); }}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Replay
            </button>
          )}
        </div>
      </div>

      {/* Selected detail or legend */}
      {selectedDC ? (
        <SelectedDetail dc={selectedDC} isOptimal={selectedDC.id === optimal?.data_center_id} />
      ) : (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            MILP Optimal
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active
          </div>
          <span className="ml-auto">Click a region for details</span>
        </div>
      )}

      {/* Scheduler timeline */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Carbon Intensity Forecast (next 12h)</p>
        <div className="space-y-2">
          {dataCenters.map((dc) => {
            const hours = dc.forecast.slice(0, 12);
            const isOptimal = dc.id === optimal?.data_center_id;
            return (
              <div key={dc.id} className="flex items-center gap-3">
                <span className={`text-xs w-20 truncate ${isOptimal ? "text-amber-400 font-medium" : "text-muted-foreground"}`}>
                  {dc.label}
                </span>
                <div className="flex-1 h-6 bg-border/30 rounded-sm overflow-hidden flex">
                  {hours.length > 0
                    ? hours.map((h, i) => (
                        <div
                          key={i}
                          className={`h-full flex-1 border-r border-background/50 ${carbonColor(h.carbon_gco2)}`}
                          title={`${h.hour}: ${h.carbon_gco2} gCO₂/kWh`}
                        />
                      ))
                    : Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="h-full flex-1 border-r border-background/50 bg-border/20 animate-pulse" />
                      ))}
                </div>
                <span className="text-xs font-mono text-muted-foreground w-16 text-right">
                  {dc.avg_carbon > 0 ? `${dc.avg_carbon} g` : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Now</span>
          <div className="flex gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-500/70" />Low
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-amber-400/70" />Med
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-red-400/70" />High
            </span>
          </div>
          <span>+12h</span>
        </div>
      </div>

      {/* MILP savings summary */}
      {optimal && (
        <div className="surface-elevated rounded-md px-5 py-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Green scheduler saves</span>
          <div className="flex items-center gap-4">
            {optimal.naive_co2_kg != null && (
              <span className="text-muted-foreground font-mono line-through">{optimal.naive_co2_kg} kg CO₂</span>
            )}
            <span className="text-emerald-500 font-mono font-medium">{optimal.total_co2_kg} kg CO₂</span>
            <span className="text-amber-400 font-medium">↓{optimal.savings_pct}% saved</span>
          </div>
        </div>
      )}
    </div>
  );
};

const SelectedDetail = ({ dc, isOptimal }: { dc: BackendDC; isOptimal: boolean }) => (
  <div className="surface-elevated rounded-md px-5 py-4 animate-fade-in">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-foreground flex items-center gap-2">
          {dc.label}
          {isOptimal && (
            <span className="text-xs bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full">MILP Optimal</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">{dc.location}</p>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Avg Carbon</p>
          <p className="font-mono font-medium text-foreground">
            {dc.avg_carbon > 0 ? `${dc.avg_carbon} g/kWh` : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Next hour</p>
          <p className="font-mono font-medium text-foreground">
            {dc.forecast[0] ? `${dc.forecast[0].carbon_gco2} g` : "—"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isOptimal ? "bg-amber-400" : "bg-emerald-500"}`} />
          <span className={isOptimal ? "text-amber-400" : "text-emerald-600"}>
            {isOptimal ? "Recommended" : "Active"}
          </span>
        </div>
      </div>
    </div>
  </div>
);

export default DataCenterMap;
