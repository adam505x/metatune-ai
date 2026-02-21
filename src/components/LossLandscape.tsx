import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const GRID = 80;
const SIZE = 5;

// Generate loss landscape heightmap
function generateHeightmap() {
  const data: number[][] = [];
  for (let i = 0; i < GRID; i++) {
    data[i] = [];
    for (let j = 0; j < GRID; j++) {
      const x = (i / GRID - 0.5) * SIZE * 2;
      const z = (j / GRID - 0.5) * SIZE * 2;

      // Create a landscape with peaks and valleys
      const d = Math.sqrt(x * x + z * z);
      const valley = -1.5 * Math.exp(-d * d * 0.15);
      const peak1 = 1.2 * Math.exp(-((x - 2) ** 2 + (z - 1.5) ** 2) * 0.4);
      const peak2 = 1.0 * Math.exp(-((x + 2.5) ** 2 + (z - 2) ** 2) * 0.3);
      const peak3 = 0.8 * Math.exp(-((x - 1) ** 2 + (z + 2.5) ** 2) * 0.35);
      const peak4 = 1.4 * Math.exp(-((x + 1.5) ** 2 + (z + 1) ** 2) * 0.5);
      const noise = Math.sin(x * 3) * Math.cos(z * 2.5) * 0.15 + Math.sin(x * 5 + z * 3) * 0.08;

      data[i][j] = valley + peak1 + peak2 + peak3 + peak4 + noise + 0.3;
    }
  }
  return data;
}

// Optimization path from a high point to the minimum
const optimizationPath: [number, number, number][] = [];
{
  const steps = 40;
  const startX = 3.5, startZ = 3.0;
  const endX = 0.0, endZ = 0.0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ease = t * t * (3 - 2 * t);
    const x = startX + (endX - startX) * ease + Math.sin(t * Math.PI * 3) * 0.3 * (1 - t);
    const z = startZ + (endZ - startZ) * ease + Math.cos(t * Math.PI * 2.5) * 0.25 * (1 - t);
    optimizationPath.push([x, 0, z]);
  }
}

function Terrain({ heightmap }: { heightmap: number[][] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, colors } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE * 2, SIZE * 2, GRID - 1, GRID - 1);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colorsArr = new Float32Array(positions.count * 3);

    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const idx = i * GRID + j;
        const h = heightmap[i][j];
        positions.setY(idx, h);

        // Color gradient: deep blue (low) → cyan → green → red (high)
        const t = (h + 1.5) / 3.0;
        const color = new THREE.Color();
        if (t < 0.25) {
          color.setHSL(0.6, 0.8, 0.15 + t * 1.5);
        } else if (t < 0.5) {
          color.setHSL(0.5 - (t - 0.25) * 1.2, 0.7, 0.3 + t * 0.4);
        } else if (t < 0.75) {
          color.setHSL(0.3 - (t - 0.5) * 0.8, 0.6, 0.4 + t * 0.2);
        } else {
          color.setHSL(0.0, 0.7, 0.35 + (t - 0.75) * 0.6);
        }
        colorsArr[idx * 3] = color.r;
        colorsArr[idx * 3 + 1] = color.g;
        colorsArr[idx * 3 + 2] = color.b;
      }
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colorsArr, 3));
    geo.computeVertexNormals();
    return { geometry: geo, colors: colorsArr };
  }, [heightmap]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshPhongMaterial vertexColors wireframe={false} side={THREE.DoubleSide} shininess={20} />
    </mesh>
  );
}

function WireframeTerrain({ heightmap }: { heightmap: number[][] }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE * 2, SIZE * 2, GRID - 1, GRID - 1);
    g.rotateX(-Math.PI / 2);
    const positions = g.attributes.position;
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        positions.setY(i * GRID + j, heightmap[i][j] + 0.01);
      }
    }
    g.computeVertexNormals();
    return g;
  }, [heightmap]);

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial wireframe color="#ffffff" opacity={0.06} transparent />
    </mesh>
  );
}

function OptimizationPathLine({ heightmap, showPath }: { heightmap: number[][]; showPath: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!showPath) { setProgress(0); return; }
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= optimizationPath.length - 1) { clearInterval(interval); return p; }
        return p + 1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [showPath]);

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const visiblePath = optimizationPath.slice(0, progress + 1);
    for (const [x, , z] of visiblePath) {
      const gi = Math.min(GRID - 1, Math.max(0, Math.round(((x / (SIZE * 2)) + 0.5) * (GRID - 1))));
      const gj = Math.min(GRID - 1, Math.max(0, Math.round(((z / (SIZE * 2)) + 0.5) * (GRID - 1))));
      const y = heightmap[gi]?.[gj] ?? 0;
      pts.push(new THREE.Vector3(x, y + 0.1, z));
    }
    return pts;
  }, [heightmap, progress]);

  if (points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, points.length * 4, 0.03, 8, false);

  // Current position marker
  const current = points[points.length - 1];

  return (
    <group>
      <mesh geometry={tubeGeo}>
        <meshBasicMaterial color="#ffffff" opacity={0.9} transparent />
      </mesh>
      {/* Current position sphere */}
      <mesh position={current}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Start marker */}
      {points.length > 0 && (
        <mesh position={points[0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>
      )}
    </group>
  );
}

function RotatingScene({ heightmap, showPath }: { heightmap: number[][]; showPath: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      <Terrain heightmap={heightmap} />
      <WireframeTerrain heightmap={heightmap} />
      <OptimizationPathLine heightmap={heightmap} showPath={showPath} />
    </group>
  );
}

const LossLandscape = () => {
  const heightmap = useMemo(() => generateHeightmap(), []);
  const [showPath, setShowPath] = useState(false);

  return (
    <div className="space-y-4">
      <div className="surface-elevated rounded-md overflow-hidden" style={{ height: 380 }}>
        <Canvas
          camera={{ position: [6, 5, 6], fov: 45 }}
          style={{ background: "#0a0a0a" }}
          gl={{ antialias: true }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 8, 5]} intensity={0.8} />
          <directionalLight position={[-3, 5, -3]} intensity={0.3} />
          <RotatingScene heightmap={heightmap} showPath={showPath} />
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={4}
            maxDistance={14}
            minPolarAngle={0.3}
            maxPolarAngle={Math.PI / 2.2}
          />
        </Canvas>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f97316]" />
            Start position
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white" />
            Current position
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-[2px] bg-white/80 rounded" />
            Optimization path
          </div>
        </div>
        <button
          onClick={() => setShowPath(!showPath)}
          className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {showPath ? "Reset" : "Show optimal path"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        3D loss landscape of your model's parameter space. Peaks represent high loss; valleys represent optimal configurations. 
        Drag to rotate, scroll to zoom.
      </p>
    </div>
  );
};

export default LossLandscape;
