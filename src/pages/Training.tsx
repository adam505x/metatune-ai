import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Clock, Database, Cpu, Layers } from "lucide-react";

// Generate fake loss data
const generateLossData = (steps: number) => {
  const data = [];
  for (let i = 0; i <= steps; i += 10) {
    const loss = 2.5 * Math.exp(-i / 400) + 0.15 + Math.random() * 0.05;
    data.push({ step: i, loss: parseFloat(loss.toFixed(4)) });
  }
  return data;
};

const logLines = [
  "[INFO] Loading dataset: support_tickets.csv",
  "[INFO] Tokenizing 4,892 samples...",
  "[INFO] Tokenization complete. Avg length: 128 tokens",
  "[INFO] Initializing Llama 3.1 8B from checkpoint",
  "[INFO] LoRA adapters attached (rank=16, alpha=32)",
  "[INFO] Starting training — 3 epochs, 2,000 steps",
  "[TRAIN] Step 100/2000 | Loss: 1.8234 | LR: 1.9e-5",
  "[TRAIN] Step 200/2000 | Loss: 1.2451 | LR: 1.8e-5",
  "[TRAIN] Step 300/2000 | Loss: 0.8923 | LR: 1.7e-5",
  "[TRAIN] Step 400/2000 | Loss: 0.6341 | LR: 1.5e-5",
  "[TRAIN] Step 500/2000 | Loss: 0.4812 | LR: 1.3e-5",
  "[EVAL]  Validation loss: 0.4523 | Accuracy: 87.2%",
  "[TRAIN] Step 600/2000 | Loss: 0.3891 | LR: 1.1e-5",
  "[TRAIN] Step 700/2000 | Loss: 0.3214 | LR: 9.0e-6",
  "[TRAIN] Step 800/2000 | Loss: 0.2845 | LR: 7.0e-6",
  "[INFO] Checkpoint saved at step 800",
];

const Training = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [lossData, setLossData] = useState<{ step: number; loss: number }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= 2000) {
          clearInterval(stepInterval);
          return 2000;
        }
        return prev + 7;
      });
    }, 50);
    return () => clearInterval(stepInterval);
  }, []);

  useEffect(() => {
    setLossData(generateLossData(Math.min(currentStep, 2000)));
  }, [currentStep]);

  useEffect(() => {
    const logInterval = setInterval(() => {
      setVisibleLogs((prev) => {
        if (prev.length >= logLines.length) return prev;
        return [...prev, logLines[prev.length]];
      });
    }, 800);
    return () => clearInterval(logInterval);
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visibleLogs]);

  const progress = Math.min((currentStep / 2000) * 100, 100);
  const eta = Math.max(0, Math.round((2000 - currentStep) * 0.42));
  const etaMin = Math.floor(eta / 60);
  const etaSec = eta % 60;

  return (
    <div className="min-h-screen flex page-enter">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border p-6 hidden lg:flex flex-col gap-8">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm font-medium tracking-widest uppercase text-muted-foreground">MetaTune</span>
          </div>
          <h3 className="font-semibold text-lg mb-1">support-ticket-classifier</h3>
          <p className="text-sm text-muted-foreground">Classification task</p>
        </div>

        <div className="space-y-5 text-sm">
          <div className="flex items-center gap-3 text-secondary-foreground">
            <Database className="w-4 h-4 text-muted-foreground" />
            <span>4,892 samples</span>
          </div>
          <div className="flex items-center gap-3 text-secondary-foreground">
            <Cpu className="w-4 h-4 text-muted-foreground" />
            <span>Llama 3.1 8B</span>
          </div>
          <div className="flex items-center gap-3 text-secondary-foreground">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span>LoRA r=16</span>
          </div>
          <div className="flex items-center gap-3 text-secondary-foreground">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>LR 2e-5 · BS 16 · 3 epochs</span>
          </div>
        </div>

        <div className="mt-auto">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Status bar */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${progress >= 100 ? "bg-terminal-green" : "bg-primary animate-pulse"}`} />
              <span className="font-mono text-sm">
                Step {Math.min(currentStep, 2000).toLocaleString()} / 2,000
              </span>
            </div>
            <div className="h-1.5 w-48 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Clock className="w-4 h-4" />
            <span>ETA {etaMin}m {etaSec}s</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
          {/* Loss chart */}
          <div className="surface-elevated rounded-md p-5 flex-1 min-h-[280px]">
            <h4 className="text-sm font-medium text-muted-foreground mb-4">Training Loss</h4>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={lossData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
                <XAxis
                  dataKey="step"
                  stroke="hsl(0 0% 30%)"
                  tick={{ fill: "hsl(0 0% 45%)", fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="hsl(0 0% 30%)"
                  tick={{ fill: "hsl(0 0% 45%)", fontSize: 12 }}
                  tickLine={false}
                  domain={[0, 3]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0 0% 7%)",
                    border: "1px solid hsl(0 0% 15%)",
                    borderRadius: "6px",
                    color: "hsl(0 0% 93%)",
                    fontSize: 13,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="loss"
                  stroke="hsl(25 95% 53%)"
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Log console */}
          <div className="surface-elevated rounded-md flex flex-col h-56">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-terminal-green" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live logs</span>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto p-4 log-scroll">
              {visibleLogs.map((line, i) => (
                <div key={i} className="terminal-text whitespace-pre font-mono">
                  {line}
                </div>
              ))}
            </div>
          </div>

          {progress >= 100 && (
            <div className="flex justify-end animate-fade-in">
              <button
                onClick={() => navigate("/results")}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                View results →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Training;
