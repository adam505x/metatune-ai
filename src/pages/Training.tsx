import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Clock, Cpu, Zap, Thermometer, Activity } from "lucide-react";

// ── Training simulation ────────────────────────────────────────────────────────

const TOTAL_STEPS = 2000;
const SEED = 42;

function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function buildFullCurves() {
  const rand = seededRand(SEED);
  const train: { step: number; train: number; val: number }[] = [];
  for (let i = 0; i <= TOTAL_STEPS; i += 20) {
    const t = i / TOTAL_STEPS;
    const trainLoss = 2.8 * Math.exp(-4.5 * t) + 0.18 + rand() * 0.04 - 0.02;
    const valLoss   = 2.8 * Math.exp(-4.0 * t) + 0.24 + rand() * 0.06 - 0.03;
    train.push({ step: i, train: +trainLoss.toFixed(4), val: +valLoss.toFixed(4) });
  }
  return train;
}

const FULL_CURVES = buildFullCurves();

// ── Log lines ─────────────────────────────────────────────────────────────────

const LOG_LINES: { tag: "INFO" | "TRAIN" | "EVAL" | "WARN"; text: string }[] = [
  { tag: "INFO",  text: "Loading dataset from uploaded file" },
  { tag: "INFO",  text: "Tokenizing samples... avg length: 128 tokens" },
  { tag: "INFO",  text: "Tokenization complete" },
  { tag: "INFO",  text: "Initializing nanoGPT from checkpoint" },
  { tag: "INFO",  text: "LoRA adapters attached (rank=8, alpha=16)" },
  { tag: "INFO",  text: "Mixed precision: bf16 enabled" },
  { tag: "INFO",  text: "Starting training — 3 epochs, 2000 steps" },
  { tag: "TRAIN", text: "Step  200/2000 | loss: 1.8821 | lr: 2.37e-4 | tok/s: 12,340" },
  { tag: "TRAIN", text: "Step  400/2000 | loss: 1.3104 | lr: 2.20e-4 | tok/s: 12,480" },
  { tag: "EVAL",  text: "Val loss: 1.2893 | perplexity: 3.63" },
  { tag: "TRAIN", text: "Step  600/2000 | loss: 0.9912 | lr: 1.98e-4 | tok/s: 12,510" },
  { tag: "TRAIN", text: "Step  800/2000 | loss: 0.7341 | lr: 1.72e-4 | tok/s: 12,560" },
  { tag: "INFO",  text: "Checkpoint saved (step 800)" },
  { tag: "EVAL",  text: "Val loss: 0.7102 | perplexity: 2.03" },
  { tag: "TRAIN", text: "Step 1000/2000 | loss: 0.5630 | lr: 1.41e-4 | tok/s: 12,590" },
  { tag: "TRAIN", text: "Step 1200/2000 | loss: 0.4521 | lr: 1.08e-4 | tok/s: 12,600" },
  { tag: "EVAL",  text: "Val loss: 0.4388 | perplexity: 1.55" },
  { tag: "TRAIN", text: "Step 1400/2000 | loss: 0.3714 | lr: 7.60e-5 | tok/s: 12,610" },
  { tag: "TRAIN", text: "Step 1600/2000 | loss: 0.3148 | lr: 4.60e-5 | tok/s: 12,620" },
  { tag: "INFO",  text: "Checkpoint saved (step 1600)" },
  { tag: "EVAL",  text: "Val loss: 0.3091 | perplexity: 1.36" },
  { tag: "TRAIN", text: "Step 1800/2000 | loss: 0.2741 | lr: 2.10e-5 | tok/s: 12,630" },
  { tag: "TRAIN", text: "Step 2000/2000 | loss: 0.2512 | lr: 0.00e+0 | tok/s: 12,640" },
  { tag: "INFO",  text: "Training complete — best val loss: 0.2891" },
];

const TAG_STYLE: Record<string, string> = {
  INFO:  "text-muted-foreground",
  TRAIN: "text-primary",
  EVAL:  "text-emerald-400",
  WARN:  "text-yellow-400",
};


// ── Metric card ───────────────────────────────────────────────────────────────

const MetricCard = ({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) => (
  <div className="surface-elevated rounded-md px-4 py-3 flex items-center gap-3">
    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-medium text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const Training = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<typeof LOG_LINES>([]);
  const [gpuTemp, setGpuTemp] = useState(52);
  const logRef = useRef<HTMLDivElement>(null);

  // Step counter
  useEffect(() => {
    const iv = setInterval(() => {
      setCurrentStep((p) => {
        if (p >= TOTAL_STEPS) { clearInterval(iv); return TOTAL_STEPS; }
        return p + 34;
      });
    }, 50);
    return () => clearInterval(iv);
  }, []);

  // Log reveal
  useEffect(() => {
    const iv = setInterval(() => {
      setVisibleLogs((p) => p.length >= LOG_LINES.length ? p : [...p, LOG_LINES[p.length]]);
    }, 125);
    return () => clearInterval(iv);
  }, []);

  // GPU temp jitter
  useEffect(() => {
    const iv = setInterval(() => setGpuTemp((t) => Math.min(82, Math.max(68, t + Math.round((Math.random() - 0.48) * 2)))), 1200);
    return () => clearInterval(iv);
  }, []);

  // Auto-scroll logs
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [visibleLogs]);

  const progress = Math.min(currentStep / TOTAL_STEPS, 1);
  const pct = Math.round(progress * 100);
  const eta = Math.max(0, Math.round((TOTAL_STEPS - currentStep) * 0.042));
  const etaStr = eta > 60 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : `${eta}s`;
  const currentVal = FULL_CURVES[Math.min(Math.floor(progress * (FULL_CURVES.length - 1)), FULL_CURVES.length - 1)].val;
  const tokensPerSec = (11800 + Math.round(progress * 900)).toLocaleString();

  const visibleCurves = useMemo(
    () => FULL_CURVES.slice(0, Math.max(1, Math.floor(progress * FULL_CURVES.length))),
    [progress]
  );

  return (
    <div className="min-h-screen flex flex-col page-enter bg-background">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-primary animate-pulse"}`} />
          <span className="text-sm font-medium">
            {pct >= 100 ? "Training complete" : "Training in progress"}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            step {Math.min(currentStep, TOTAL_STEPS).toLocaleString()} / {TOTAL_STEPS.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-40 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
          {pct < 100 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Clock className="w-3.5 h-3.5" /> {etaStr}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 min-h-0">

        {/* Left — charts */}
        <div className="lg:col-span-2 flex flex-col gap-4 p-5 min-h-0">

          {/* Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard icon={Activity}    label="Val loss"     value={currentVal.toFixed(4)} />
            <MetricCard icon={Zap}         label="Tokens/sec"   value={tokensPerSec} />
            <MetricCard icon={Cpu}         label="GPU util"     value={`${Math.round(88 + progress * 6)}%`} />
            <MetricCard icon={Thermometer} label="GPU temp"     value={`${gpuTemp}°C`} sub={gpuTemp > 78 ? "⚠ warm" : "nominal"} />
          </div>

          {/* Loss chart */}
          <div className="surface-elevated rounded-md p-4 flex-1 min-h-[220px]">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Loss curve</p>
            <ResponsiveContainer width="100%" height="88%">
              <LineChart data={visibleCurves} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="step" stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} />
                <YAxis stroke="hsl(var(--border))" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickLine={false} domain={[0, 3]} width={36} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                <Line type="monotone" dataKey="train" name="Train" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="val"   name="Val"   stroke="hsl(160 60% 45%)"    strokeWidth={2} dot={false} strokeDasharray="4 2" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* Right — logs */}
        <div className="border-l border-border flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live logs</span>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-0">
            {visibleLogs.map((line, i) => (
              <div key={i} className="font-mono text-xs leading-relaxed">
                <span className={`font-semibold mr-2 ${TAG_STYLE[line.tag]}`}>[{line.tag}]</span>
                <span className="text-secondary-foreground">{line.text}</span>
              </div>
            ))}
            {pct < 100 && visibleLogs.length > 0 && (
              <div className="font-mono text-xs text-muted-foreground animate-pulse">█</div>
            )}
          </div>

          {pct >= 100 && (
            <div className="p-4 border-t border-border shrink-0 animate-fade-in">
              <button
                onClick={() => navigate("/results")}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                View results →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Training;
