import { useNavigate } from "react-router-dom";
import { Download, Key, Leaf, Trees, Car, Zap } from "lucide-react";

// ── Impact calculations ───────────────────────────────────────────────────────
// Grid search over the defined search space (batch: 4, optimizer: 4,
// scheduler: 4, lora_rank: 4, precision: 3) = 768 combos.
// Bayesian optimisation converged in 50 evals → 718 runs avoided.
const RUNS_SAVED = 718;
const BAYESIAN_RUNS = 50; // Bayesian optimisation converged in 50 evaluations
// nanoGPT: 8 GB VRAM, 0.5 h fine-tune, 4 g CO₂ / GB / h (user assumption)
const G_CO2_PER_RUN = 8 * 4 * 0.5;                                            // 16 g
const KG_CO2_HPO = +(RUNS_SAVED * G_CO2_PER_RUN / 1000).toFixed(1);           // 11.5 kg
// Scheduling: Ireland avg 4.222 g/GB/h vs Abilene TX avg 1.921 g/GB/h × 50 runs
const G_CO2_SCHED_PER_RUN = 8 * (4.222 - 1.921) * 0.5;                        // 9.2 g
const G_CO2_SCHED = +(G_CO2_SCHED_PER_RUN * BAYESIAN_RUNS).toFixed(0);        // 460 g
const KG_CO2_TOTAL = +(KG_CO2_HPO + G_CO2_SCHED / 1000).toFixed(2);
// Equivalences
const KM_CAR        = Math.round(KG_CO2_TOTAL / 0.25);   // 250 g CO₂/km avg car
const KWH_SAVED     = Math.round(KG_CO2_TOTAL / 0.233);  // UK grid 233 g CO₂/kWh
const STREAM_HOURS  = Math.round(KG_CO2_TOTAL * 1000 / 36); // Netflix ~36 g CO₂/h
// CO₂ multiplier: baseline (768 grid runs + worst DC) vs actual (50 Bayesian + best DC)
const G_CO2_BASELINE = 768 * G_CO2_PER_RUN + 768 * 8 * 4.222 * 0.5;
const G_CO2_ACTUAL   = BAYESIAN_RUNS * G_CO2_PER_RUN + BAYESIAN_RUNS * 8 * 1.921 * 0.5;
const CO2_MULTIPLIER = +(G_CO2_BASELINE / G_CO2_ACTUAL).toFixed(1); // ~15.2×

const metrics = [
  { label: "Accuracy", value: "92.4%", delta: "+5.2%" },
  { label: "F1 Score", value: "0.891", delta: "+0.12" },
  { label: "Final Loss", value: "0.2912", delta: "" },
  { label: "Training Time", value: "1h 58m", delta: "" },
];

const Results = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-16 page-enter">
      <div className="max-w-3xl w-full space-y-12">
        {/* Header */}
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-terminal-green" />
            <span className="text-sm font-medium text-terminal-green">Training complete</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Your model is ready</h1>
          <p className="text-muted-foreground text-lg">nanoGPT + LoRA</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
          {metrics.map((m) => (
            <div key={m.label} className="surface-elevated rounded-md p-5">
              <p className="text-sm text-muted-foreground mb-1">{m.label}</p>
              <p className="text-2xl font-semibold">{m.value}</p>
              {m.delta && (
                <p className="text-xs text-primary mt-1">{m.delta}</p>
              )}
            </div>
          ))}
        </div>

        {/* Green impact section */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-emerald-600">Your environmental impact</h3>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-4 py-1.5">
              <span className="text-2xl font-bold text-emerald-600">{CO2_MULTIPLIER}×</span>
              <span className="text-sm text-emerald-700">less CO₂ emitted</span>
            </div>
          </div>

          {/* Three stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-5 py-4">
              <p className="text-3xl font-bold text-emerald-600">{RUNS_SAVED}</p>
              <p className="text-sm font-medium text-emerald-700 mt-1">training runs saved</p>
              <p className="text-xs text-emerald-700/60 mt-2">Bayesian optimisation converged in just <span className="font-semibold">{BAYESIAN_RUNS} runs</span> vs {RUNS_SAVED + BAYESIAN_RUNS} for full grid search</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-5 py-4">
              <p className="text-3xl font-bold text-emerald-600">{KG_CO2_HPO} <span className="text-lg font-medium">kg</span></p>
              <p className="text-sm font-medium text-emerald-700 mt-1">CO₂ saved by HPO</p>
              <p className="text-xs text-emerald-700/60 mt-2">{RUNS_SAVED} fewer GPU runs × {G_CO2_PER_RUN} g CO₂ / run</p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-5 py-4">
              <p className="text-3xl font-bold text-emerald-600">{G_CO2_SCHED} <span className="text-lg font-medium">g</span></p>
              <p className="text-sm font-medium text-emerald-700 mt-1">CO₂ saved by scheduling</p>
              <p className="text-xs text-emerald-700/60 mt-2">Abilene TX vs Ireland × {BAYESIAN_RUNS} runs ({+(G_CO2_SCHED_PER_RUN).toFixed(1)} g/run)</p>
            </div>
          </div>

          {/* Total + equivalences */}
          <div className="border-t border-emerald-500/20 pt-4 space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-emerald-600">{KG_CO2_TOTAL}</span>
              <span className="text-xl text-emerald-600">kg CO₂ saved in total</span>
            </div>
            <div className="flex flex-wrap gap-5 text-sm text-emerald-700">
              <span className="flex items-center gap-1.5"><Car className="w-4 h-4" /> {KM_CAR} km not driven</span>
              <span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> {KWH_SAVED} kWh of electricity</span>
              <span className="flex items-center gap-1.5"><Trees className="w-4 h-4" /> {STREAM_HOURS} hours of video streaming</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 animate-fade-in-up">
          <button className="inline-flex items-center gap-2 surface-elevated rounded-md px-5 py-3 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
            <Download className="w-4 h-4" />
            Download model
          </button>
          <button className="inline-flex items-center gap-2 surface-elevated rounded-md px-5 py-3 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors">
            <Key className="w-4 h-4" />
            Get API key
          </button>
        </div>

        {/* Back home */}
        <div>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Start a new training
          </button>
        </div>
      </div>
    </div>
  );
};

export default Results;
