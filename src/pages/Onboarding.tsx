import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Upload, FileText, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const categories = ["Classification", "Generation", "Ranking", "Extraction"];

const mockColumns = ["id", "text", "label", "created_at", "source"];
const mockRows = [
  ["1", "My order hasn't arrived yet", "urgent", "2024-01-15", "email"],
  ["2", "How do I reset my password?", "low", "2024-01-15", "chat"],
  ["3", "Product is broken on arrival", "high", "2024-01-16", "email"],
  ["4", "Thanks for the quick response!", "none", "2024-01-16", "chat"],
  ["5", "I need a refund immediately", "urgent", "2024-01-17", "email"],
];

const configParams = [
  { label: "Base model", value: "Llama 3.1 8B", tip: "Best balance of speed and quality for your dataset size" },
  { label: "Learning rate", value: "2e-5", tip: "Conservative rate to prevent catastrophic forgetting" },
  { label: "Batch size", value: "16", tip: "Optimized for your dataset's average sequence length" },
  { label: "Epochs", value: "3", tip: "Sufficient for convergence on ~5k samples" },
  { label: "Est. training time", value: "~14 min", tip: "Based on single A100 GPU allocation" },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [overrideConfig, setOverrideConfig] = useState(false);

  const nextStep = useCallback(() => {
    if (step < 2) setStep(step + 1);
    else navigate("/training");
  }, [step, navigate]);

  const prevStep = useCallback(() => {
    if (step > 0) setStep(step - 1);
    else navigate("/");
  }, [step, navigate]);

  return (
    <div className="min-h-screen flex flex-col px-6 py-12 page-enter">
      {/* Top bar */}
      <div className="max-w-2xl w-full mx-auto flex items-center justify-between mb-12">
        <button onClick={prevStep} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/50" : "w-4 bg-border"}`} />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">Step {step + 1}/3</span>
      </div>

      <div className="max-w-2xl w-full mx-auto flex-1">
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
              <p className="text-muted-foreground">Drop a CSV or JSON file. We'll handle the rest.</p>
            </div>

            {!fileUploaded ? (
              <div
                onClick={() => setFileUploaded(true)}
                className="border-2 border-dashed border-border rounded-md p-12 text-center cursor-pointer hover:border-primary/50 transition-colors group"
              >
                <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-foreground font-medium mb-1">Drop your file here</p>
                <p className="text-sm text-muted-foreground">CSV or JSON, up to 500MB</p>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3 surface-elevated rounded-md px-4 py-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">support_tickets.csv</p>
                    <p className="text-xs text-muted-foreground">4,892 rows · 5 columns · 2.1 MB</p>
                  </div>
                </div>

                {/* Data preview */}
                <div className="overflow-x-auto surface-elevated rounded-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {mockColumns.map((col) => (
                          <th key={col} className="text-left px-4 py-2.5 text-muted-foreground font-medium">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mockRows.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-2 text-secondary-foreground">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-4">
              <button onClick={nextStep} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Config */}
        {step === 2 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold mb-2">Recommended config</h2>
              <p className="text-muted-foreground">We've selected the best settings for your task. Override if you know better.</p>
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
                  {overrideConfig ? (
                    <input
                      defaultValue={param.value}
                      className="bg-background border border-border rounded px-3 py-1 text-sm text-foreground w-36 text-right focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  ) : (
                    <span className="font-mono text-sm text-foreground">{param.value}</span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setOverrideConfig(!overrideConfig)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {overrideConfig ? "← Use defaults" : "Override settings →"}
            </button>

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
