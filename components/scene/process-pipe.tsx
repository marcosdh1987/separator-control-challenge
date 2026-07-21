"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";

import type { SceneQualityTier } from "./use-scene-quality";
import type { FlowMotion } from "@/lib/visualization/scene-model";

export type PipePoint = readonly [number, number, number];

const wrapUnit = (value: number) => ((value % 1) + 1) % 1;

export function advanceFlowPhase(phase: number, deltaS: number, speed: number, motionAllowed: boolean): number {
  if (!motionAllowed || !Number.isFinite(deltaS) || deltaS <= 0 || !Number.isFinite(speed) || speed <= 0) {
    return Number.isFinite(phase) ? wrapUnit(phase) : 0;
  }
  return wrapUnit((Number.isFinite(phase) ? phase : 0) + deltaS * speed);
}

export function flowInstanceDistance(phase: number, offset: number, direction: -1 | 0 | 1): number {
  const distance = wrapUnit((Number.isFinite(phase) ? phase : 0) + (Number.isFinite(offset) ? offset : 0));
  return direction < 0 ? wrapUnit(1 - distance) : distance;
}

export function visiblePulseCount(visibleFraction: number, poolSize: number): number {
  if (!Number.isFinite(visibleFraction) || !Number.isFinite(poolSize) || poolSize <= 0 || visibleFraction <= 0) return 0;
  return Math.min(Math.floor(poolSize), Math.ceil(Math.min(1, visibleFraction) * Math.floor(poolSize)));
}

export const PIPE_MATRICES_DIRTY = 1;
export const PIPE_DIAGNOSTIC_DIRTY = 2;

export function pipeFrameUpdateFlags(
  initialized: boolean,
  previousPhase: number,
  previousCount: number,
  previousDirection: -1 | 0 | 1,
  previousMotionAllowed: boolean,
  nextPhase: number,
  nextCount: number,
  nextDirection: -1 | 0 | 1,
  nextMotionAllowed: boolean,
): number {
  if (!initialized) return PIPE_MATRICES_DIRTY | PIPE_DIAGNOSTIC_DIRTY;
  const phaseChanged = nextPhase !== previousPhase;
  const layoutChanged = nextCount !== previousCount || nextDirection !== previousDirection;
  const motionChanged = nextMotionAllowed !== previousMotionAllowed;
  return (phaseChanged || layoutChanged ? PIPE_MATRICES_DIRTY : 0) |
    (phaseChanged || motionChanged ? PIPE_DIAGNOSTIC_DIRTY : 0);
}

interface ProcessPipeProps {
  name: string;
  points: readonly PipePoint[];
  color: string;
  motion: FlowMotion;
  animate: boolean;
  quality: SceneQualityTier;
}

const UP = new Vector3(0, 1, 0);

export function ProcessPipe({ name, points, color, motion, animate, quality }: ProcessPipeProps) {
  const instances = useRef<InstancedMesh>(null);
  const diagnostic = useRef<HTMLSpanElement>(null);
  const phase = useRef(0.18);
  const frameState = useRef({ initialized: false, phase: 0.18, count: 0, direction: 0 as -1 | 0 | 1, motionAllowed: false });
  const poolSize = quality === "low" ? 5 : quality === "medium" ? 8 : 12;
  const curve = useMemo(
    () => new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)), false, "centripetal"),
    [points],
  );
  const tubeGeometry = useMemo(
    () => new TubeGeometry(curve, quality === "low" ? 28 : 56, 0.055, quality === "low" ? 8 : 12, false),
    [curve, quality],
  );
  const pipeMaterial = useMemo(() => new MeshStandardMaterial({
    color: new Color(color).multiplyScalar(0.52),
    metalness: 0.76,
    roughness: 0.31,
  }), [color]);
  const pulseGeometry = useMemo(() => new CylinderGeometry(0.085, 0.085, 0.18, 10), []);
  const pulseMaterial = useMemo(() => new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.4,
    roughness: 0.2,
    toneMapped: false,
  }), [color]);
  const scratch = useMemo(() => ({
    matrix: new Matrix4(),
    point: new Vector3(),
    tangent: new Vector3(),
    quaternion: new Quaternion(),
    scale: new Vector3(1, 1, 1),
  }), []);

  useFrame((_, delta) => {
    const motionAllowed = animate && motion.direction !== 0;
    const nextPhase = advanceFlowPhase(phase.current, delta, motion.speed, motionAllowed);
    const count = visiblePulseCount(motion.visibleFraction, poolSize);
    const flags = pipeFrameUpdateFlags(
      frameState.current.initialized,
      frameState.current.phase,
      frameState.current.count,
      frameState.current.direction,
      frameState.current.motionAllowed,
      nextPhase,
      count,
      motion.direction,
      motionAllowed,
    );
    phase.current = nextPhase;
    if (flags === 0) return;
    if ((flags & PIPE_DIAGNOSTIC_DIRTY) !== 0 && diagnostic.current) {
      if (!frameState.current.initialized || nextPhase !== frameState.current.phase) {
        diagnostic.current.dataset.phase = nextPhase.toFixed(5);
      }
      diagnostic.current.dataset.motion = motionAllowed ? "moving" : "frozen";
    }
    const mesh = instances.current;
    if (mesh && (flags & PIPE_MATRICES_DIRTY) !== 0) {
      mesh.count = count;
      for (let index = 0; index < count; index += 1) {
        const offset = index / poolSize;
        const distance = flowInstanceDistance(nextPhase, offset, motion.direction);
        curve.getPointAt(distance, scratch.point);
        curve.getTangentAt(distance, scratch.tangent).normalize();
        scratch.quaternion.setFromUnitVectors(UP, scratch.tangent);
        scratch.matrix.compose(scratch.point, scratch.quaternion, scratch.scale);
        mesh.setMatrixAt(index, scratch.matrix);
      }
      mesh.instanceMatrix.needsUpdate = count > 0;
    }
    frameState.current.initialized = true;
    frameState.current.phase = nextPhase;
    frameState.current.count = count;
    frameState.current.direction = motion.direction;
    frameState.current.motionAllowed = motionAllowed;
  });

  useEffect(() => () => {
    tubeGeometry.dispose();
    pipeMaterial.dispose();
    pulseGeometry.dispose();
    pulseMaterial.dispose();
  }, [pipeMaterial, pulseGeometry, pulseMaterial, tubeGeometry]);

  return (
    <group dispose={null} name={`${name} process pipe`}>
      <mesh geometry={tubeGeometry} material={pipeMaterial} castShadow={quality !== "low"} receiveShadow={quality !== "low"} />
      <instancedMesh
        ref={instances}
        args={[pulseGeometry, pulseMaterial, poolSize]}
        frustumCulled={false}
        name={`${name} flow markers`}
      />
      <Html position={points[Math.floor(points.length / 2)]} className="scene-html-anchor" zIndexRange={[0, 0]}>
        <span
          ref={diagnostic}
          aria-hidden="true"
          className="scene-flow-diagnostic visually-hidden"
          data-flow-direction={motion.direction}
          data-flow-name={name}
          data-motion={animate && motion.direction !== 0 ? "moving" : "frozen"}
          data-phase="0.18000"
          data-visible-pulses={visiblePulseCount(motion.visibleFraction, poolSize)}
        />
      </Html>
    </group>
  );
}
