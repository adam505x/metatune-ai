import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
  ComposedChart,
} from "recharts";

// Simulated GP surrogate for Bayesian Optimization
// Generate a smooth function + confidence band + observed samples

function gpMean(x: number): number {
  return (
    0.22 +
    0.35 * Math.exp(-((x - 0.28) ** 2) / 0.02) +
    0.15 * Math.sin(x * 8) * Math.exp(-((x - 0.5) ** 2) / 0.08) +
    0.38 * Math.exp(-((x - 0.76) ** 2) / 0.025) -
    0.1 * Math.cos(x * 12) * 0.08
  );
}

function generateChartData() {
  const data: {
    x: number;
    mean: number;
    upper: number;
    lower: number;
    band: [number, number];
  }[] = [];

  for (let i = 0; i <= 200; i++) {
    const x = i / 200;
    const mean = gpMean(x);
    // Confidence widens away from observed points
    const observedXs = [0.1, 0.35, 0.42, 0.76, 0.95];
    let minDist = 1;
    for (const ox of observedXs) {
      minDist = Math.min(minDist, Math.abs(x - ox));
    }
    const uncertainty = 0.06 + minDist * 0.45;
    const upper = mean + uncertainty;
    const lower = Math.max(0, mean - uncertainty);

    data.push({
      x: Math.round(x * 100) / 100,
      mean,
      upper,
      lower,
      band: [lower, upper],
    });
  }
  return data;
}

const observedPoints = [
  { x: 0.1, y: 0.28, label: "Trial 1" },
  { x: 0.35, y: 0.55, label: "Trial 2" },
  { x: 0.42, y: 0.44, label: "Trial 3" },
  { x: 0.76, y: 0.6, label: "Best" },
  { x: 0.95, y: 0.44, label: "Trial 5" },
];

const bestPoint = observedPoints.reduce((best, p) =>
  p.y > best.y ? p : best
);

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-md text-xs">
      <p className="text-foreground font-medium">HP = {d.x.toFixed(2)}</p>
      <p className="text-muted-foreground">
        GP mean: <span className="font-mono text-foreground">{d.mean.toFixed(3)}</span>
      </p>
      <p className="text-muted-foreground">
        CI: [{d.band[0].toFixed(2)}, {d.band[1].toFixed(2)}]
      </p>
    </div>
  );
};

interface Props {
  showPath?: boolean;
}

const LossLandscape = () => {
  const chartData = useMemo(() => generateChartData(), []);
  const [revealed, setRevealed] = useState(0);
  const [animating, setAnimating] = useState(false);

  const animateTrials = () => {
    setRevealed(0);
    setAnimating(true);
  };

  useEffect(() => {
    if (!animating) return;
    if (revealed >= observedPoints.length) {
      setAnimating(false);
      return;
    }
    const timer = setTimeout(() => setRevealed((r) => r + 1), 600);
    return () => clearTimeout(timer);
  }, [animating, revealed]);

  const visiblePoints = animating
    ? observedPoints.slice(0, revealed)
    : observedPoints;

  return (
    <div className="space-y-4">
      <div className="surface-elevated rounded-md p-4 pb-2">
        <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">
          Bayesian Optimization — GP Surrogate
        </p>
        <div style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 20, bottom: 30, left: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(220 16% 85%)"
                vertical={false}
              />
              <XAxis
                dataKey="x"
                type="number"
                domain={[0, 1]}
                ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                tick={{ fontSize: 11, fill: "hsl(220 10% 50%)" }}
                axisLine={{ stroke: "hsl(220 16% 80%)" }}
                tickLine={{ stroke: "hsl(220 16% 80%)" }}
                label={{
                  value: "hyperparameter",
                  position: "insideBottom",
                  offset: -18,
                  style: {
                    fontSize: 12,
                    fill: "hsl(220 10% 50%)",
                  },
                }}
              />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1.0]}
                tick={{ fontSize: 11, fill: "hsl(220 10% 50%)" }}
                axisLine={{ stroke: "hsl(220 16% 80%)" }}
                tickLine={{ stroke: "hsl(220 16% 80%)" }}
                label={{
                  value: "value",
                  angle: -90,
                  position: "insideLeft",
                  offset: -5,
                  style: {
                    fontSize: 12,
                    fill: "hsl(220 10% 50%)",
                  },
                }}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Confidence interval band */}
              <Area
                dataKey="band"
                type="monotone"
                fill="hsl(222 47% 25% / 0.12)"
                stroke="none"
                isAnimationActive={false}
              />

              {/* GP mean line */}
              <Line
                dataKey="mean"
                type="monotone"
                stroke="hsl(222 47% 25%)"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />

              {/* Observed sample points */}
              {visiblePoints.map((pt) => (
                <ReferenceDot
                  key={pt.label}
                  x={pt.x}
                  y={pt.y}
                  r={5}
                  fill="hsl(222 47% 25%)"
                  stroke="hsl(0 0% 100%)"
                  strokeWidth={2}
                />
              ))}

              {/* Best point annotation */}
              {visiblePoints.includes(bestPoint) && (
                <ReferenceLine
                  x={bestPoint.x}
                  stroke="hsl(222 47% 25%)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: "best observed value",
                    position: "top",
                    style: {
                      fontSize: 11,
                      fill: "hsl(222 47% 18%)",
                      fontWeight: 500,
                    },
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-[2.5px] rounded bg-primary inline-block" />
            GP mean
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary/15 border border-primary/30 inline-block" />
            Confidence interval
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
            Observed values
          </div>
        </div>
        <button
          onClick={animateTrials}
          className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {animating ? "Running..." : "Replay trials"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Bayesian Optimization uses a Gaussian Process surrogate to model the objective function. 
        The shaded region shows the 95% confidence interval — wider bands indicate unexplored regions. 
        Each trial evaluates a new hyperparameter configuration, balancing exploration and exploitation via an acquisition function.
      </p>
    </div>
  );
};

export default LossLandscape;
