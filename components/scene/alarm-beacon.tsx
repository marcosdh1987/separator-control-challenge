"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { BufferGeometry, Mesh, MeshPhysicalMaterial, PointLight } from "three";

import type { SceneModel } from "@/lib/visualization/scene-model";

interface AlarmBeaconProps {
  safety: SceneModel["safety"];
  animate: boolean;
}

const COLORS = { safe: "#54dfa8", alarm: "#ffb45c", trip: "#ff5d63" } as const;

export function beaconPresentation(severity: SceneModel["safety"]["severity"]) {
  if (severity === "trip") return { intensity: 2.4, pulseHz: 0, animated: false } as const;
  if (severity === "alarm") return { intensity: 1.25, pulseHz: 0.7, animated: true } as const;
  return { intensity: 0.34, pulseHz: 0, animated: false } as const;
}

/**
 * The one alarm cadence in the scene. The beacon lens and the rim accent light both
 * read from it so they cannot drift into two slightly different pulses.
 */
export function alarmPulseFactor(phase: number): number {
  return 0.82 + 0.18 * Math.sin(phase * Math.PI * 2);
}

export function beaconPulse(severity: SceneModel["safety"]["severity"], phase: number, animate: boolean): number {
  const presentation = beaconPresentation(severity);
  if (!animate || !presentation.animated) return presentation.intensity;
  return presentation.intensity * alarmPulseFactor(phase);
}

export function beaconFramePresentation(
  severity: SceneModel["safety"]["severity"],
  phase: number,
  animate: boolean,
) {
  const intensity = beaconPulse(severity, phase, animate);
  return {
    lensEmissiveIntensity: intensity,
    lightIntensity: intensity,
  };
}

export function AlarmBeacon({ safety, animate }: AlarmBeaconProps) {
  const lens = useRef<Mesh<BufferGeometry, MeshPhysicalMaterial>>(null);
  const light = useRef<PointLight>(null);
  const phase = useRef(0);
  const color = COLORS[safety.severity];

  useFrame((_, delta) => {
    if (animate && safety.severity === "alarm") phase.current += delta * safety.pulseHz;
    const frame = beaconFramePresentation(safety.severity, phase.current, animate);
    if (lens.current) lens.current.material.emissiveIntensity = frame.lensEmissiveIntensity;
    if (light.current) light.current.intensity = frame.lightIntensity;
  });

  return (
    <group position={[0.98, 1.16, 0]} name={`Safety beacon: ${safety.severity}`}>
      <mesh position={[0, -0.09, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.08, 24]} />
        <meshStandardMaterial color="#17262b" metalness={0.8} roughness={0.38} />
      </mesh>
      <mesh ref={lens}>
        <cylinderGeometry args={[0.1, 0.12, 0.19, 24]} />
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={safety.beaconIntensity} transparent opacity={0.86} roughness={0.12} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color={color} distance={2.6} decay={2} />
    </group>
  );
}
