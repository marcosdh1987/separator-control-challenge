"use client";

import { Html } from "@react-three/drei";

import { createValveOrientation, createValvePose } from "@/components/scene/control-valve";

interface ResearchValveProps {
  tag: string;
  /** Modelled stem position, 0..1: what the valve actually does. */
  stemFraction: number;
  /** PLC command, 0..1: what the controller asks for. */
  commandFraction: number;
  position: readonly [number, number, number];
  accent: string;
  label: string;
  labelOffsetX: number;
  compact?: boolean;
}

/**
 * A control valve drawn from recorded positions. The solid disk and stem follow
 * the modelled stem; a translucent ghost disk shows the commanded opening, so a
 * stuck or lagging valve is visible as the gap between the two.
 */
export function ResearchValve({ tag, stemFraction, commandFraction, position, accent, label, labelOffsetX, compact = false }: ResearchValveProps) {
  const stem = createValvePose(stemFraction);
  const command = createValvePose(commandFraction);
  const stemOrientation = createValveOrientation(stem);
  const commandOrientation = createValveOrientation(command);
  const known = Number.isFinite(stemFraction);
  return (
    <group name={`${tag} recorded valve`} position={[...position]}>
      <mesh rotation={[...stemOrientation.bodyRotation]}>
        <cylinderGeometry args={[0.16, 0.16, 0.16, 24]} />
        <meshStandardMaterial color="#33484f" metalness={0.82} roughness={0.3} />
      </mesh>
      {known ? (
        <mesh rotation={[...stemOrientation.diskRotation]}>
          <cylinderGeometry args={[0.11, 0.11, 0.025, 24]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.34} metalness={0.58} roughness={0.26} />
        </mesh>
      ) : null}
      {Number.isFinite(commandFraction) ? (
        <mesh rotation={[...commandOrientation.diskRotation]}>
          <cylinderGeometry args={[0.125, 0.125, 0.012, 24]} />
          <meshBasicMaterial color="#f0f6f7" depthWrite={false} opacity={0.32} transparent wireframe />
        </mesh>
      ) : null}
      <mesh position={[0, 0.18 + stem.stemLiftM, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.3, 12]} />
        <meshStandardMaterial color="#9ab0b5" metalness={0.9} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.38 + stem.stemLiftM, 0]}>
        <boxGeometry args={[0.3, 0.2, 0.24]} />
        <meshStandardMaterial color="#25383f" metalness={0.65} roughness={0.4} />
      </mesh>
      {/* Commanded stem height marker beside the actuator. */}
      <mesh position={[0.2, 0.18 + command.stemLiftM, 0]}>
        <boxGeometry args={[0.05, 0.012, 0.05]} />
        <meshBasicMaterial color="#f0f6f7" />
      </mesh>
      <Html center className="scene-html-anchor" position={[labelOffsetX, 0.74, 0]} zIndexRange={[20, 0]}>
        <div className={`scene-equipment-label research-valve-label ${compact ? "is-compact" : ""}`} data-valve-tag={tag}>
          <strong>{tag}</strong>
          <output>{label}</output>
        </div>
      </Html>
    </group>
  );
}
