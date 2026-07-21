"use client";

import { Html } from "@react-three/drei";

export interface ValvePose {
  openFraction: number;
  diskAngleRad: number;
  stemLiftM: number;
}

export interface ValveOrientation {
  bodyRotation: readonly [number, number, number];
  diskRotation: readonly [number, number, number];
}

export function createValvePose(value: number): ValvePose {
  const openFraction = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return {
    openFraction,
    diskAngleRad: openFraction * Math.PI / 2,
    stemLiftM: openFraction * 0.09,
  };
}

export function createValveOrientation(pose: ValvePose): ValveOrientation {
  return {
    bodyRotation: [0, 0, -Math.PI / 2],
    diskRotation: [0, pose.diskAngleRad, -Math.PI / 2],
  };
}

interface ControlValveProps {
  tag: "LV-101" | "WV-101";
  description: string;
  openFraction: number;
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  accent: string;
  compact?: boolean;
}

export function ControlValve({ tag, description, openFraction, position, rotation = [0, 0, 0], accent, compact = false }: ControlValveProps) {
  const pose = createValvePose(openFraction);
  const orientation = createValveOrientation(pose);
  const percent = `${(pose.openFraction * 100).toFixed(1)}%`;
  const labelOffsetX = tag === "LV-101" ? -0.42 : 0.28;
  return (
    <group position={[...position]} rotation={[...rotation]} name={`${tag} ${description}`}>
      <mesh rotation={[...orientation.bodyRotation]}>
        <cylinderGeometry args={[0.16, 0.16, 0.16, 24]} />
        <meshStandardMaterial color="#33484f" metalness={0.82} roughness={0.3} />
      </mesh>
      <mesh rotation={[...orientation.diskRotation]}>
        <cylinderGeometry args={[0.11, 0.11, 0.025, 24]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.34} metalness={0.58} roughness={0.26} />
      </mesh>
      <mesh position={[0, 0.18 + pose.stemLiftM, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.3, 12]} />
        <meshStandardMaterial color="#9ab0b5" metalness={0.9} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.38 + pose.stemLiftM, 0]}>
        <boxGeometry args={[0.3, 0.2, 0.24]} />
        <meshStandardMaterial color="#25383f" metalness={0.65} roughness={0.4} />
      </mesh>
      <Html center position={[labelOffsetX, 0.72, 0]} className="scene-html-anchor" zIndexRange={[20, 0]}>
        <div className="scene-equipment-label" data-valve-open={percent} data-valve-tag={tag}>
          <strong>{tag}</strong>
          {!compact ? <span>{description}</span> : null}
          <output>{percent} actual</output>
        </div>
      </Html>
    </group>
  );
}
