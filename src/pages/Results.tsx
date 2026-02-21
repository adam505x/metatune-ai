import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Key, ArrowRight } from "lucide-react";

const metrics = [
  { label: "Accuracy", value: "92.4%", delta: "+5.2%" },
  { label: "F1 Score", value: "0.891", delta: "+0.12" },
  { label: "Final Loss", value: "0.184", delta: "" },
  { label: "Training Time", value: "13m 42s", delta: "" },
];

const Results = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const handleTry = () => {
    if (!input.trim()) return;
    // Fake inference
    const responses: Record<string, string> = {
      default: "urgent",
    };
    setTimeout(() => {
      if (input.toLowerCase().includes("refund") || input.toLowerCase().includes("broken")) {
        setOutput("→ urgent (confidence: 0.94)");
      } else if (input.toLowerCase().includes("thanks") || input.toLowerCase().includes("great")) {
        setOutput("→ none (confidence: 0.97)");
      } else {
        setOutput("→ low (confidence: 0.82)");
      }
    }, 400);
  };

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
          <p className="text-muted-foreground text-lg">support-ticket-classifier · Llama 3.1 8B + LoRA</p>
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

        {/* Try it live */}
        <div className="space-y-4 animate-fade-in-up">
          <h3 className="text-lg font-semibold">Try it live</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter a support ticket..."
                className="w-full h-32 bg-card border border-border rounded-md px-4 py-3 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 transition-shadow"
              />
              <button
                onClick={handleTry}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Run inference <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="surface-elevated rounded-md p-5 flex items-center justify-center min-h-[128px]">
              {output ? (
                <p className="font-mono text-lg text-foreground animate-fade-in">{output}</p>
              ) : (
                <p className="text-muted-foreground text-sm">Output will appear here</p>
              )}
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
