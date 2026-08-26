"use client";

import { useEffect, useMemo } from "react";
import { CylinderGeometry, SphereGeometry } from "three";

import type { SceneQuality } from "./use-scene-quality";
import { FRONT_SHELL_THETA, REAR_SHELL_THETA } from "./vessel-geometry";
import { NOZZLE_ANCHORS, SHELL_RADIUS_M, VESSEL_LENGTH_M } from "@/lib/visualization/scene-model";

interface SeparatorVesselProps {
  quality: SceneQuality;
}

export function SeparatorVessel({ quality }: SeparatorVesselProps) {
  const rearShellGeometry = useMemo(
    () => new CylinderGeometry(SHELL_RADIUS_M, SHELL_RADIUS_M, VESSEL_LENGTH_M, 64, 1, true, REAR_SHELL_THETA.start, REAR_SHELL_THETA.length),
    [],
  );
  const inspectionGeometry = useMemo(
    () => new CylinderGeometry(SHELL_RADIUS_M, SHELL_RADIUS_M, VESSEL_LENGTH_M, 64, 1, true, FRONT_SHELL_THETA.start, FRONT_SHELL_THETA.length),
    [],
  );
  const rearHeadGeometry = useMemo(() => new SphereGeometry(SHELL_RADIUS_M, 48, 24, Math.PI, Math.PI), []);
  const inspectionHeadGeometry = useMemo(() => new SphereGeometry(SHELL_RADIUS_M, 48, 24, 0, Math.PI), []);

  useEffect(() => () => {
    rearShellGeometry.dispose();
    inspectionGeometry.dispose();
    rearHeadGeometry.dispose();
    inspectionHeadGeometry.dispose();
  }, [inspectionGeometry, inspectionHeadGeometry, rearHeadGeometry, rearShellGeometry]);

  const shadowProps = quality.shadows ? { castShadow: true, receiveShadow: true } : {};

  return (
    <group name="SEP-101 vessel">
      {/* The rear shell provides structural mass; the front skin is the inspection cutaway. */}
      <mesh geometry={rearShellGeometry} rotation={[0, 0, Math.PI / 2]} {...shadowProps}>
        <meshPhysicalMaterial color="#708087" metalness={0.82} roughness={0.31} clearcoat={0.28} side={2} />
      </mesh>
      <mesh geometry={inspectionGeometry} rotation={[0, 0, Math.PI / 2]} renderOrder={5}>
        <meshPhysicalMaterial
          color="#a8d4d6"
          transparent
          opacity={0.13}
          transmission={0.42}
          thickness={0.08}
          roughness={0.12}
          metalness={0.12}
          clearcoat={1}
          side={0}
          depthWrite={false}
        />
      </mesh>

      {[-1.5, 1.5].map((x, index) => (
        <group key={x} position={[x, 0, 0]} scale={[0.52, 1, 1]}>
          <mesh geometry={rearHeadGeometry} {...shadowProps}>
            <meshPhysicalMaterial color={index ? "#64757d" : "#75868d"} metalness={0.86} roughness={0.34} clearcoat={0.22} side={2} />
          </mesh>
          <mesh geometry={inspectionHeadGeometry} renderOrder={5}>
            <meshPhysicalMaterial color="#a8d4d6" transparent opacity={0.13} transmission={0.42} thickness={0.08} roughness={0.12} clearcoat={1} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {[-1.34, -0.75, 0, 0.75, 1.34].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} {...shadowProps}>
          <torusGeometry args={[0.642, 0.022, 10, 64]} />
          <meshStandardMaterial color="#405159" metalness={0.85} roughness={0.4} />
        </mesh>
      ))}

      {Object.entries(NOZZLE_ANCHORS).map(([name, anchor]) => (
        <Nozzle key={name} position={[anchor.x, anchor.y, 0]} rotation={[0, 0, anchor.rotationZ]} quality={quality} />
      ))}

      {[-0.95, 0.95].map((x) => (
        <group key={x} position={[x, -0.93, 0]}>
          <mesh {...shadowProps}>
            <boxGeometry args={[0.16, 0.58, 0.48]} />
            <meshStandardMaterial color="#25383f" metalness={0.55} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.32, 0]} {...shadowProps}>
            <boxGeometry args={[0.48, 0.07, 0.7]} />
            <meshStandardMaterial color="#18292f" metalness={0.62} roughness={0.54} />
          </mesh>
        </group>
      ))}

      <mesh position={[0.35, 0.05, 0.646]} renderOrder={8}>
        <boxGeometry args={[0.58, 0.24, 0.025]} />
        <meshStandardMaterial color="#18272c" metalness={0.7} roughness={0.35} emissive="#123b3d" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0.35, 0.05, 0.664]} renderOrder={9}>
        <planeGeometry args={[0.48, 0.035]} />
        <meshBasicMaterial color="#78e8dc" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Nozzle({
  position,
  rotation,
  quality,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  quality: SceneQuality;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow={quality.shadows} receiveShadow={quality.shadows}>
        <cylinderGeometry args={[0.105, 0.105, 0.32, 24]} />
        <meshStandardMaterial color="#566a71" metalness={0.8} roughness={0.36} />
      </mesh>
      <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.035, 10, 32]} />
        <meshStandardMaterial color="#34474e" metalness={0.8} roughness={0.4} />
      </mesh>
    </group>
  );
}
