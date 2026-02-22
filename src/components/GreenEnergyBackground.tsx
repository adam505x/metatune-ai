import { useEffect, useRef } from "react";

// Wind turbine blade path (single blade, rotated by CSS)
const Blade = ({ angle }: { angle: number }) => (
  <line
    x1={0} y1={0}
    x2={0} y2={-38}
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    transform={`rotate(${angle})`}
  />
);

const WindTurbine = ({
  x, y, scale = 1, speed = 4, initialAngle = 0,
}: { x: number; y: number; scale?: number; speed?: number; initialAngle?: number }) => {
  const ref = useRef<SVGGElement>(null);
  const angle = useRef(initialAngle);

  useEffect(() => {
    let frame: number;
    const step = () => {
      angle.current = (angle.current + 360 / (60 * speed)) % 360;
      if (ref.current) {
        ref.current.setAttribute("transform", `rotate(${angle.current})`);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [speed]);

  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity={0.18}>
      {/* Tower */}
      <line x1={0} y1={0} x2={0} y2={70} stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      {/* Base */}
      <line x1={-12} y1={70} x2={12} y2={70} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      {/* Nacelle */}
      <circle cx={0} cy={0} r={5} fill="none" stroke="currentColor" strokeWidth={2} />
      {/* Rotor blades */}
      <g ref={ref} transform={`rotate(${initialAngle})`}>
        <Blade angle={0} />
        <Blade angle={120} />
        <Blade angle={240} />
      </g>
    </g>
  );
};

const SolarPanel = ({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity={0.15}>
    {/* Panel border */}
    <rect x={-28} y={-18} width={56} height={36} rx={2} fill="none" stroke="currentColor" strokeWidth={2} />
    {/* Grid lines horizontal */}
    <line x1={-28} y1={-6} x2={28} y2={-6} stroke="currentColor" strokeWidth={1} />
    <line x1={-28} y1={6} x2={28} y2={6} stroke="currentColor" strokeWidth={1} />
    {/* Grid lines vertical */}
    <line x1={-14} y1={-18} x2={-14} y2={18} stroke="currentColor" strokeWidth={1} />
    <line x1={0}   y1={-18} x2={0}   y2={18} stroke="currentColor" strokeWidth={1} />
    <line x1={14}  y1={-18} x2={14}  y2={18} stroke="currentColor" strokeWidth={1} />
    {/* Mount */}
    <line x1={-10} y1={18} x2={-8} y2={28} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <line x1={10}  y1={18} x2={8}  y2={28} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <line x1={-12} y1={28} x2={12} y2={28} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </g>
);

const Sun = ({ x, y }: { x: number | string; y: number }) => {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <g transform={`translate(${x}, ${y})`} opacity={0.14}>
      <circle cx={0} cy={0} r={22} fill="none" stroke="currentColor" strokeWidth={2} />
      <circle cx={0} cy={0} r={14} fill="none" stroke="currentColor" strokeWidth={1.5} />
      {rays.map((deg, i) => (
        <line
          key={i}
          x1={0} y1={-26}
          x2={0} y2={-34}
          stroke="currentColor"
          strokeWidth={i % 2 === 0 ? 2 : 1.2}
          strokeLinecap="round"
          transform={`rotate(${deg})`}
        />
      ))}
    </g>
  );
};

const GreenEnergyBackground = () => (
  <svg
    className="w-full text-emerald-400 pointer-events-none select-none"
    viewBox="0 0 1000 420"
    preserveAspectRatio="xMidYMax meet"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    {/* Sun — top-right corner */}
    <Sun x={940} y={60} />

    {/* Wind turbines */}
    <WindTurbine x={80}  y={180} scale={1.1} speed={5}  initialAngle={20} />
    <WindTurbine x={200} y={220} scale={0.8} speed={6}  initialAngle={80} />
    <WindTurbine x={310} y={195} scale={1.0} speed={4}  initialAngle={150} />
    <WindTurbine x={600} y={210} scale={0.9} speed={7}  initialAngle={40} />
    <WindTurbine x={700} y={180} scale={1.2} speed={5}  initialAngle={200} />
    <WindTurbine x={820} y={200} scale={0.85} speed={6} initialAngle={300} />

    {/* Solar panel clusters — bottom area */}
    <SolarPanel x={130} y={340} scale={1.0} />
    <SolarPanel x={210} y={350} scale={1.0} />
    <SolarPanel x={290} y={340} scale={1.0} />

    <SolarPanel x={520} y={330} scale={0.9} />
    <SolarPanel x={600} y={345} scale={0.9} />
    <SolarPanel x={680} y={330} scale={0.9} />
    <SolarPanel x={760} y={345} scale={0.9} />
  </svg>
);

export default GreenEnergyBackground;
