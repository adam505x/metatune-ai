import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Upload, FileText, Info, Sparkles, Zap, Leaf } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import DataCenterMap from "@/components/DataCenterMap";
import GreenEnergyBackground from "@/components/GreenEnergyBackground";

const categories = ["Classification", "Generation", "Ranking", "Extraction"];

// ── File parsing ──────────────────────────────────────────────────────────────

interface ParsedFile {
  name: string;
  sizeLabel: string;
  rowCount: number;
  columns: string[];
  rows: string[][];
}

function parseCSV(text: string): { columns: string[]; rows: string[][] } {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return { columns: [], rows: [] };
  const columns = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1, 6).map((line) =>
    line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
  );
  return { columns, rows };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Search space definition ───────────────────────────────────────────────────

type CategoricalParam = { label: string; type: "categorical"; choices: string[]; tip: string };
type RangeParam = { label: string; type: "range"; min: string; max: string; tip: string };
type SearchParam = CategoricalParam | RangeParam;

const searchParams: SearchParam[] = [
  { label: "Learning rate", type: "range", min: "1e-6", max: "1e-3", tip: "Log-scale range to search over" },
  { label: "Batch size", type: "categorical", choices: ["8", "16", "32", "64"], tip: "Select all batch sizes to include in the search" },
  { label: "Epochs", type: "range", min: "1", max: "10", tip: "Number of full passes over the dataset" },
  { label: "Optimizer", type: "categorical", choices: ["AdamW", "Adam", "SGD", "Lion"], tip: "Optimizers to compare during search" },
  { label: "LR scheduler", type: "categorical", choices: ["Cosine", "Linear", "Constant", "Polynomial"], tip: "Learning rate decay strategies to try" },
  { label: "LoRA rank", type: "categorical", choices: ["8", "16", "32", "64"], tip: "Low-rank adaptation rank — controls capacity vs. speed" },
  { label: "Dropout", type: "range", min: "0.0", max: "0.3", tip: "Dropout rate range for LoRA layers" },
  { label: "Mixed precision", type: "categorical", choices: ["bf16", "fp16", "fp32"], tip: "Numeric precision formats to evaluate" },
];

const defaultCategoricalSelections: Record<string, string[]> = {
  "Batch size": ["16"],
  "Optimizer": ["AdamW"],
  "LR scheduler": ["Cosine"],
  "LoRA rank": ["16"],
  "Mixed precision": ["bf16"],
};
// Each categorical param allows exactly one selection (radio behaviour)

const defaultRanges: Record<string, { min: string; max: string }> = {
  "Learning rate": { min: "1e-5", max: "1e-4" },
  "Epochs": { min: "2", max: "5" },
  "Dropout": { min: "0.0", max: "0.1" },
};

// ── GP surrogate data & scatter plots ────────────────────────────────────────

interface GPRow {
  lora_r: number;
  learning_rate: number;
  lora_dropout: number;
  batch_size: number;
  predicted_loss: number;
}

function parseGPCSV(text: string): GPRow[] {
  const lines = text.trim().split("\n");
  return lines.slice(1).map((line) => {
    const [lora_r, learning_rate, lora_dropout, batch_size, predicted_loss] = line.split(",").map(Number);
    return { lora_r, learning_rate, lora_dropout, batch_size, predicted_loss };
  });
}

function formatParam(key: keyof GPRow, value: number): string {
  if (key === "learning_rate") return value.toExponential(2);
  if (key === "lora_dropout") return value.toFixed(3);
  return String(Math.round(value));
}

interface ScatterPlotProps {
  data: GPRow[];
  xKey: keyof GPRow;
  xLabel: string;
  bestIdx: number;
}

const ScatterPlot = ({ data, xKey, xLabel, bestIdx }: ScatterPlotProps) => {
  const W = 320, H = 220, PAD = { top: 14, right: 14, bottom: 40, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const xs = data.map((d) => d[xKey] as number);
  const ys = data.map((d) => d.predicted_loss);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys) - 0.05, yMax = Math.max(...ys) + 0.05;

  const px = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin || 1)) * plotW;
  const py = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  const yTicks = Array.from({ length: 4 }, (_, i) => yMin + (i / 3) * (yMax - yMin));
  const xTicks = Array.from({ length: 4 }, (_, i) => xMin + (i / 3) * (xMax - xMin));

  return (
    <div className="surface-elevated rounded-md p-3">
      <p className="text-xs text-muted-foreground mb-2 text-center">{xLabel}</p>
      <svg width={W} height={H} className="w-full h-auto">
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line key={i} x1={PAD.left} x2={W - PAD.right} y1={py(t)} y2={py(t)} stroke="hsl(var(--border))" strokeWidth={0.5} />
        ))}
        {/* Y axis ticks */}
        {yTicks.map((t, i) => (
          <text key={i} x={PAD.left - 4} y={py(t) + 3} textAnchor="end" fontSize={8} fill="hsl(var(--muted-foreground))">
            {t.toFixed(2)}
          </text>
        ))}
        {/* X axis ticks */}
        {xTicks.map((t, i) => (
          <text key={i} x={px(t)} y={H - PAD.bottom + 12} textAnchor="middle" fontSize={8} fill="hsl(var(--muted-foreground))">
            {xKey === "learning_rate"
              ? t.toExponential(1)
              : xKey === "batch_size" || xKey === "lora_r"
              ? String(Math.round(t))
              : t.toFixed(2)}
          </text>
        ))}
        {/* Axes */}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} stroke="hsl(var(--border))" strokeWidth={1} />
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="hsl(var(--border))" strokeWidth={1} />
        {/* Y axis label */}
        <text x={10} y={PAD.top + plotH / 2} textAnchor="middle" fontSize={8} fill="hsl(var(--muted-foreground))" transform={`rotate(-90, 10, ${PAD.top + plotH / 2})`}>
          Predicted loss
        </text>
        {/* Data points */}
        {data.map((d, i) => {
          const isBest = i === bestIdx;
          return (
            <circle
              key={i}
              cx={px(d[xKey] as number)}
              cy={py(d.predicted_loss)}
              r={isBest ? 5 : 3}
              fill={isBest ? "hsl(160 60% 45%)" : "hsl(var(--primary) / 0.4)"}
              stroke={isBest ? "hsl(160 60% 65%)" : "none"}
              strokeWidth={isBest ? 1.5 : 0}
            />
          );
        })}
      </svg>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 0
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Step 1
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — search space
  const [catSelections, setCatSelections] = useState<Record<string, string[]>>(defaultCategoricalSelections);
  const [ranges, setRanges] = useState<Record<string, { min: string; max: string }>>(defaultRanges);


  // Step 4 — scheduling
  const [deadline, setDeadline] = useState("");

  // Step 3 — GP surrogate data
  const [gpData, setGpData] = useState<GPRow[]>([]);

  useEffect(() => {
    fetch("/gp_surrogate_param_space.csv")
      .then((r) => r.text())
      .then((text) => setGpData(parseGPCSV(text)));
  }, []);

  const bestIdx = gpData.length
    ? gpData.reduce((bi, d, i) => (d.predicted_loss < gpData[bi].predicted_loss ? i : bi), 0)
    : -1;

  const best = bestIdx >= 0 ? gpData[bestIdx] : null;

  const nextStep = useCallback(() => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else navigate("/training");
  }, [step, navigate]);

  const prevStep = useCallback(() => {
    if (step > 0) setStep(step - 1);
    else navigate("/");
  }, [step, navigate]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { columns, rows } = parseCSV(text);
      const rowCount = text.trim().split("\n").length - 1;
      setParsedFile({ name: file.name, sizeLabel: formatSize(file.size), rowCount, columns, rows });
    };
    reader.readAsText(file);
  }, []);

  const toggleCatChoice = (label: string, choice: string) => {
    setCatSelections((prev) => {
      const current = prev[label] ?? [];
      return {
        ...prev,
        [label]: current.includes(choice)
          ? current.filter((c) => c !== choice)
          : [...current, choice],
      };
    });
  };

  const updateRange = (label: string, field: "min" | "max", value: string) => {
    setRanges((prev) => ({ ...prev, [label]: { ...prev[label], [field]: value } }));
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-12 page-enter">
      {step === 4 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full pointer-events-none -z-10 overflow-hidden">
          <GreenEnergyBackground />
        </div>
      )}
      {/* Top bar */}
      <div className="max-w-2xl w-full mx-auto flex items-center justify-between mb-12">
        <button onClick={prevStep} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/50" : "w-4 bg-border"}`} />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">Step {step + 1}/{TOTAL_STEPS}</span>
      </div>

      <div className={`${step === 3 || step === 4 || step === 5 ? "max-w-4xl" : "max-w-2xl"} w-full mx-auto flex-1 transition-all duration-300`}>

        {/* Step 0: Describe */}
        {step === 0 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold mb-2">What are you training for?</h2>
              <p className="text-muted-foreground">Describe your problem in plain English — we'll figure out the rest.</p>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your problem in plain English..."
              className="w-full h-40 bg-card border border-border rounded-md px-4 py-3 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 transition-shadow"
            />
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Or pick a category:</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                      selectedCategory === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-secondary-foreground hover:border-primary/50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-4">
              <button onClick={nextStep} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold mb-2">Upload your data</h2>
              <p className="text-muted-foreground">Select a CSV file from your machine. We'll handle the rest.</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFileChange} />
            {!parsedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-md p-12 text-center cursor-pointer hover:border-primary/50 transition-colors group"
              >
                <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-foreground font-medium mb-1">Click to select a file</p>
                <p className="text-sm text-muted-foreground">CSV or JSON, up to 500MB</p>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3 surface-elevated rounded-md px-4 py-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{parsedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {parsedFile.rowCount.toLocaleString()} rows · {parsedFile.columns.length} columns · {parsedFile.sizeLabel}
                    </p>
                  </div>
                  <button
                    onClick={() => { setParsedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Change
                  </button>
                </div>
                {parsedFile.columns.length > 0 && (
                  <div className="overflow-x-auto surface-elevated rounded-md">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {parsedFile.columns.map((col) => (
                            <th key={col} className="text-left px-4 py-2.5 text-muted-foreground font-medium">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedFile.rows.map((row, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0">
                            {row.map((cell, j) => (
                              <td key={j} className="px-4 py-2 text-secondary-foreground">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            <div className="pt-4">
              <button
                onClick={nextStep}
                disabled={!parsedFile}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Hyperparameter search space */}
        {step === 2 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold mb-2">Define your search space</h2>
              <p className="text-muted-foreground">Set the ranges and choices for Bayesian optimisation to explore.</p>
            </div>

            <div className="surface-elevated rounded-md divide-y divide-border">
              {searchParams.map((param) => (
                <div key={param.label} className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <span className="text-secondary-foreground text-sm">{param.label}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">{param.tip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {param.type === "categorical" ? (
                    <div className="flex flex-wrap gap-1.5">
                      {param.choices.map((choice) => {
                        const selected = (catSelections[param.label] ?? []).includes(choice);
                        return (
                          <button
                            key={choice}
                            onClick={() => toggleCatChoice(param.label, choice)}
                            className={`px-3 py-1 rounded text-xs font-mono font-medium border transition-colors ${
                              selected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            {choice}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">min</span>
                      <input
                        value={ranges[param.label]?.min ?? param.min}
                        onChange={(e) => updateRange(param.label, "min", e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground w-20 text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <span className="text-muted-foreground text-xs">–</span>
                      <input
                        value={ranges[param.label]?.max ?? param.max}
                        onChange={(e) => updateRange(param.label, "max", e.target.value)}
                        className="bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground w-20 text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <span className="text-xs text-muted-foreground">max</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-4">
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                <Sparkles className="w-4 h-4" />
                Skip — make a smart decision for me
              </button>
              <button
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-4 py-3"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Recommended config */}
        {step === 3 && (
          <div className="space-y-8 animate-fade-in max-w-3xl">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold mb-2">Recommended config</h2>
              <p className="text-muted-foreground">Optimal hyperparameters selected by the GP surrogate model.</p>
            </div>

            {/* Config table */}
            <div className="surface-elevated rounded-md divide-y divide-border">
              {[
                { label: "Base model", value: "nanoGPT", tip: "Lightweight GPT implementation" },
                { label: "LoRA rank", value: best ? formatParam("lora_r", best.lora_r) : "—", tip: "Low-rank adaptation rank from GP optimisation" },
                { label: "Learning rate", value: best ? formatParam("learning_rate", best.learning_rate) : "—", tip: "Optimal learning rate from GP surrogate" },
                { label: "LoRA dropout", value: best ? formatParam("lora_dropout", best.lora_dropout) : "—", tip: "Dropout rate on LoRA layers" },
                { label: "Batch size", value: best ? formatParam("batch_size", best.batch_size) : "—", tip: "Mini-batch size for gradient updates" },
              ].map((param) => (
                <div key={param.label} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-secondary-foreground">{param.label}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">{param.tip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="font-mono text-sm text-foreground">{param.value}</span>
                </div>
              ))}
            </div>

            {/* Scatter plots */}
            {gpData.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <ScatterPlot data={gpData} xKey="lora_r" xLabel="Lora rank" bestIdx={bestIdx} />
                <ScatterPlot data={gpData} xKey="learning_rate" xLabel="Learning rate" bestIdx={bestIdx} />
                <ScatterPlot data={gpData} xKey="lora_dropout" xLabel="Lora dropout" bestIdx={bestIdx} />
                <ScatterPlot data={gpData} xKey="batch_size" xLabel="Batch size" bestIdx={bestIdx} />
              </div>
            )}

            <div className="pt-4">
              <button onClick={nextStep} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Data Center Map */}
        {step === 4 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold mb-2">Compute allocation</h2>
              <p className="text-muted-foreground">We've scheduled GPUs across our global infrastructure for your training job.</p>
            </div>
            <DataCenterMap />

            {/* Two action sections */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Schedule now */}
              <div className="surface-elevated rounded-md px-5 py-5 flex flex-col gap-4">
                <div>
                  <p className="font-medium text-foreground mb-1">Schedule now</p>
                  <p className="text-sm text-muted-foreground">Start training immediately on the best available data center.</p>
                </div>
                <button
                  onClick={nextStep}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-medium hover:opacity-90 transition-opacity self-start"
                >
                  <Zap className="w-4 h-4" />
                  Schedule now!
                </button>
              </div>

              {/* CO₂-optimised */}
              <div className="surface-elevated rounded-md px-5 py-5 flex flex-col gap-4">
                <div>
                  <p className="font-medium text-foreground mb-1">Optimise for CO₂</p>
                  <p className="text-sm text-muted-foreground">Set a deadline and we'll find the lowest-carbon window to run your job.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    placeholder="Hours"
                    className="bg-background border border-border rounded px-3 py-2 text-sm text-foreground w-24 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <span className="text-sm text-muted-foreground">h deadline</span>
                </div>
                <button
                  onClick={nextStep}
                  disabled={!deadline}
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-md font-medium hover:opacity-90 transition-opacity self-start disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Leaf className="w-4 h-4" />
                  Optimise CO₂ emissions
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default Onboarding;
