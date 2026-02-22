import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Upload, FileText, Info, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import DataCenterMap from "@/components/DataCenterMap";
import LossLandscape from "@/components/LossLandscape";

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

// ── Recommended config (shown after search space or skip) ─────────────────────

const configParams = [
  { label: "Base model", value: "nanoGPT", tip: "Lightweight GPT implementation, fast to fine-tune on consumer hardware" },
  { label: "Learning rate", value: "2e-5", tip: "Conservative rate to prevent catastrophic forgetting" },
  { label: "Batch size", value: "16", tip: "Optimized for your dataset's average sequence length" },
  { label: "Epochs", value: "3", tip: "Sufficient for convergence on ~5k samples" },
  { label: "Est. training time", value: "~14 min", tip: "Based on single A100 GPU allocation" },
];

const advancedParams = [
  { label: "Optimizer", value: "AdamW", tip: "Adam with decoupled weight decay, standard for transformer fine-tuning" },
  { label: "Weight decay", value: "0.01", tip: "L2 regularization to prevent overfitting on small datasets" },
  { label: "Warmup steps", value: "100", tip: "Gradual LR ramp-up to stabilize early training" },
  { label: "LR scheduler", value: "Cosine", tip: "Cosine annealing smoothly decays LR for better convergence" },
  { label: "Max seq length", value: "512", tip: "Truncates inputs beyond this token count to fit GPU memory" },
  { label: "Gradient accumulation", value: "4", tip: "Simulates larger batch sizes without extra VRAM" },
  { label: "Mixed precision", value: "bf16", tip: "Brain float16 halves memory usage with minimal accuracy loss" },
  { label: "LoRA rank", value: "16", tip: "Low-rank adaptation rank — higher means more capacity but slower" },
  { label: "LoRA alpha", value: "32", tip: "Scaling factor for LoRA; typically 2× the rank" },
  { label: "Dropout", value: "0.05", tip: "Light dropout on LoRA layers to reduce overfitting" },
  { label: "Gradient clipping", value: "1.0", tip: "Caps gradient norm to prevent exploding gradients" },
  { label: "Eval strategy", value: "steps", tip: "Evaluate every N steps rather than every epoch" },
  { label: "Eval steps", value: "50", tip: "Run evaluation metrics every 50 training steps" },
  { label: "Save strategy", value: "best", tip: "Only save the checkpoint with the lowest validation loss" },
];

// ── Component ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

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
    setCatSelections((prev) => ({ ...prev, [label]: [choice] }));
  };

  const updateRange = (label: string, field: "min" | "max", value: string) => {
    setRanges((prev) => ({ ...prev, [label]: { ...prev[label], [field]: value } }));
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-12 page-enter">
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

      <div className={`${step === 4 || step === 5 ? "max-w-4xl" : "max-w-2xl"} w-full mx-auto flex-1 transition-all duration-300`}>

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
              <button onClick={() => setStep(4)} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-4 py-3"
              >
                <Sparkles className="w-4 h-4" />
                Skip — make a smart decision for me
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Recommended config */}
        {step === 3 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold mb-2">Recommended config</h2>
              <p className="text-muted-foreground">We've selected the best settings for your task.</p>
            </div>
            <div className="surface-elevated rounded-md divide-y divide-border">
              {configParams.map((param) => (
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
              {advancedParams.map((param) => (
                <div key={param.label} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-secondary-foreground text-sm">{param.label}</span>
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
            <div className="pt-4">
              <button onClick={nextStep} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Loss Landscape */}
        {step === 5 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold mb-2">Hyperparameter search</h2>
              <p className="text-muted-foreground">Bayesian Optimization finds optimal hyperparameters with fewer trials than grid or random search.</p>
            </div>
            <LossLandscape />
            <div className="pt-4">
              <button onClick={nextStep} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity">
                Start training <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Onboarding;
