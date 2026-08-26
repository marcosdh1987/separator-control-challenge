"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  MeshPhysicalMaterial,
  Plane,
  Vector3,
  type IUniform,
} from "three";

import { decaySurfaceAmplitude, surfaceImpulse } from "./surface-motion";
import type { SceneQuality } from "./use-scene-quality";
import {
  generateGasParticlePositions,
  PHASE_DEPTH_PALETTES,
  PHASE_LENGTH_M,
  PHASE_RADIUS_M,
  phaseSurfaceTransforms,
  phaseVolumeShaderSource,
  shaderCacheKey,
  SURFACE_SHADER_PATCHES,
  type PhaseDepthPalette,
} from "./phase-geometry";
import type { SimulationSample, SimulationStatus } from "@/lib/simulation/types";
import type { SceneModel } from "@/lib/visualization/scene-model";

interface PhaseVolumesProps {
  model: SceneModel;
  sample: SimulationSample;
  status: SimulationStatus;
  quality: SceneQuality;
}

interface SurfaceShaderUniforms {
  uSurfaceTime: IUniform<number>;
  uSurfaceAmplitude: IUniform<number>;
}

class PhaseClippingPlanes {
  readonly waterUpper = new Plane(new Vector3(0, -1, 0), 0);
  readonly oilLower = new Plane(new Vector3(0, 1, 0), 0);
  readonly oilUpper = new Plane(new Vector3(0, -1, 0), 0);
  readonly gasLower = new Plane(new Vector3(0, 1, 0), 0);

  update(totalSurfaceY: number, interfaceSurfaceY: number) {
    this.waterUpper.constant = interfaceSurfaceY;
    this.oilLower.constant = -interfaceSurfaceY;
    this.oilUpper.constant = totalSurfaceY;
    this.gasLower.constant = -totalSurfaceY;
  }
}

function createSurfaceMaterial(color: string, emissive: string) {
  const uniforms: SurfaceShaderUniforms = {
    uSurfaceTime: { value: 0 },
    uSurfaceAmplitude: { value: 0 },
  };
  const material = new MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity: 0.16,
    metalness: 0.03,
    roughness: 0.19,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
    transparent: true,
    opacity: 0.78,
    side: 2,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSurfaceTime = uniforms.uSurfaceTime;
    shader.uniforms.uSurfaceAmplitude = uniforms.uSurfaceAmplitude;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${SURFACE_SHADER_PATCHES.fragmentCommon}`)
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>\n${SURFACE_SHADER_PATCHES.fragmentNormal}`,
      );
  };
  material.customProgramCacheKey = () => shaderCacheKey("separator-surface-normal", SURFACE_SHADER_PATCHES);
  return { material, uniforms };
}

function createDeterministicParticles(count: number) {
  const geometry = new BufferGeometry();
  const positions = generateGasParticlePositions(count);
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  return geometry;
}

function createPhaseVolumeMaterial(
  palette: PhaseDepthPalette,
  clippingPlanes: Plane[],
  kind: "oil" | "water",
) {
  const material = new MeshPhysicalMaterial({
    color: palette.base,
    emissive: palette.depth,
    emissiveIntensity: kind === "oil" ? 0.27 : 0.34,
    roughness: kind === "oil" ? 0.3 : 0.22,
    clearcoat: kind === "oil" ? 0.9 : 0.72,
    clearcoatRoughness: kind === "oil" ? 0.18 : 0.2,
    ior: kind === "oil" ? 1.46 : 1.33,
    transparent: true,
    opacity: kind === "oil" ? 0.67 : 0.72,
    depthWrite: false,
    clippingPlanes,
  });
  const patches = phaseVolumeShaderSource(palette);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${patches.vertexCommon}`)
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${patches.vertexWorldpos}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${patches.fragmentCommon}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${patches.fragmentColor}`);
  };
  material.customProgramCacheKey = () => shaderCacheKey(`separator-phase-depth-${kind}`, patches);
  return material;
}

export function PhaseVolumes({ model, sample, status, quality }: PhaseVolumesProps) {
  const volumeGeometry = useMemo(
    () => new CylinderGeometry(PHASE_RADIUS_M, PHASE_RADIUS_M, PHASE_LENGTH_M, quality.tier === "low" ? 32 : 64, 1, false),
    [quality.tier],
  );
  const clipping = useMemo(() => new PhaseClippingPlanes(), []);
  const waterVolumeMaterial = useMemo(
    () => createPhaseVolumeMaterial(PHASE_DEPTH_PALETTES.water, [clipping.waterUpper], "water"),
    [clipping],
  );
  const oilVolumeMaterial = useMemo(
    () => createPhaseVolumeMaterial(PHASE_DEPTH_PALETTES.oil, [clipping.oilLower, clipping.oilUpper], "oil"),
    [clipping],
  );
  const oilSurface = useMemo(() => createSurfaceMaterial("#e5a342", "#8b4b0b"), []);
  const waterSurface = useMemo(() => createSurfaceMaterial("#0d90aa", "#064d68"), []);
  const animatedSurfaces = useRef([oilSurface, waterSurface] as const);
  const particles = useMemo(() => createDeterministicParticles(quality.tier === "high" ? 52 : 30), [quality.tier]);
  const amplitude = useRef(0);
  const targetAmplitude = useRef(0);
  const previous = useRef({ timeS: sample.timeS, totalPct: sample.total.processValuePct });
  const motionAllowed = quality.animateAmbient && !["paused", "tripped", "completed", "error"].includes(status);

  useEffect(() => {
    const dt = sample.timeS - previous.current.timeS;
    const levelRatePctS = Number.isFinite(dt) && dt > 0
      ? (sample.total.processValuePct - previous.current.totalPct) / dt
      : 0;
    targetAmplitude.current = surfaceImpulse({
      levelRatePctS,
      totalFeedM3H: sample.flows.totalInletM3H,
    });
    previous.current = { timeS: sample.timeS, totalPct: sample.total.processValuePct };
  }, [sample.flows.totalInletM3H, sample.timeS, sample.total.processValuePct]);

  useFrame(({ clock }, delta) => {
    clipping.update(model.totalSurfaceY, model.interfaceSurfaceY);
    amplitude.current = motionAllowed
      ? Math.max(decaySurfaceAmplitude(amplitude.current, delta), targetAmplitude.current)
      : 0;
    targetAmplitude.current = decaySurfaceAmplitude(targetAmplitude.current, delta, 3.1);
    const displayAmplitude = quality.tier === "low" ? 0 : amplitude.current;
    for (const surface of animatedSurfaces.current) {
      surface.uniforms.uSurfaceTime.value = clock.elapsedTime;
      surface.uniforms.uSurfaceAmplitude.value = displayAmplitude;
    }
  });

  useEffect(() => () => {
    volumeGeometry.dispose();
    particles.dispose();
    oilVolumeMaterial.dispose();
    waterVolumeMaterial.dispose();
    oilSurface.material.dispose();
    waterSurface.material.dispose();
  }, [oilSurface.material, oilVolumeMaterial, particles, volumeGeometry, waterSurface.material, waterVolumeMaterial]);

  const oilVisible = model.oilLayerHeightM > 0.0001;
  const surfaces = phaseSurfaceTransforms(model);
  return (
    <group name="Simulated phase volumes">
      <mesh geometry={volumeGeometry} rotation={[0, 0, Math.PI / 2]} renderOrder={2}>
        <primitive object={waterVolumeMaterial} attach="material" />
      </mesh>
      {oilVisible ? (
        <mesh geometry={volumeGeometry} rotation={[0, 0, Math.PI / 2]} renderOrder={3}>
          <primitive object={oilVolumeMaterial} attach="material" />
        </mesh>
      ) : null}
      <mesh geometry={volumeGeometry} rotation={[0, 0, Math.PI / 2]} renderOrder={1}>
        <meshPhysicalMaterial
          color="#5cb7bd"
          emissive="#123f47"
          emissiveIntensity={0.12}
          transparent
          opacity={0.075}
          depthWrite={false}
          roughness={0.72}
          clippingPlanes={[clipping.gasLower]}
        />
      </mesh>

      <mesh position={[0, surfaces.interface.y, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[PHASE_LENGTH_M, surfaces.interface.chordWidth, 1]} renderOrder={6}>
        <planeGeometry args={[1, 1, 1, 1]} />
        <primitive object={waterSurface.material} attach="material" />
      </mesh>
      <mesh position={[0, surfaces.total.y, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[PHASE_LENGTH_M, surfaces.total.chordWidth, 1]} renderOrder={7}>
        <planeGeometry args={[1, 1, 1, 1]} />
        <primitive object={oilSurface.material} attach="material" />
      </mesh>

      {quality.tier !== "low" && model.gasHeightM > 0.002 ? (
        <points
          geometry={particles}
          renderOrder={4}
        >
          <pointsMaterial color="#8bd8d4" size={0.018} transparent opacity={0.2} depthWrite={false} sizeAttenuation clippingPlanes={[clipping.gasLower]} />
        </points>
      ) : null}
    </group>
  );
}
