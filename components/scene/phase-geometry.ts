import type { SceneModel } from "@/lib/visualization/scene-model";
import { PHASE_LENGTH_M as VESSEL_PHASE_LENGTH_M, VESSEL_RADIUS_M } from "@/lib/visualization/scene-model";

export const PHASE_RADIUS_M = VESSEL_RADIUS_M;
export const PHASE_LENGTH_M = VESSEL_PHASE_LENGTH_M;

export interface PhaseSurfaceTransform {
  y: number;
  chordWidth: number;
}

export function phaseSurfaceTransforms(
  model: Pick<SceneModel, "totalSurfaceY" | "totalChordWidthM" | "interfaceSurfaceY" | "interfaceChordWidthM">,
): {
  total: PhaseSurfaceTransform;
  interface: PhaseSurfaceTransform;
} {
  return {
    total: { y: model.totalSurfaceY, chordWidth: model.totalChordWidthM },
    interface: { y: model.interfaceSurfaceY, chordWidth: model.interfaceChordWidthM },
  };
}

export function generateGasParticlePositions(
  count: number,
  radius = PHASE_RADIUS_M,
  length = PHASE_LENGTH_M,
  seed = 0x5e70101,
): Float32Array {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const safeLength = Number.isFinite(length) ? Math.max(0, length) : 0;
  const positions = new Float32Array(safeCount * 3);
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };

  for (let index = 0; index < safeCount; index += 1) {
    const radial = safeRadius * Math.sqrt(next());
    const angle = next() * Math.PI * 2;
    const offset = index * 3;
    positions[offset] = (next() - 0.5) * safeLength;
    positions[offset + 1] = radial * Math.sin(angle);
    positions[offset + 2] = radial * Math.cos(angle);
  }
  return positions;
}

export interface PhaseDepthPalette {
  top: string;
  base: string;
  depth: string;
}

export const PHASE_DEPTH_PALETTES = Object.freeze({
  oil: Object.freeze({ top: "#f2bd62", base: "#d58a24", depth: "#6e3305" }),
  water: Object.freeze({ top: "#29bbce", base: "#04778e", depth: "#032f42" }),
});

const glslColor = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  const component = (shift: number) => ((value >> shift) & 0xff) / 255;
  return `vec3(${component(16).toFixed(6)}, ${component(8).toFixed(6)}, ${component(0).toFixed(6)})`;
};

/**
 * Each field is injected after the `#include` chunk its name refers to. Naming the
 * blocks keeps the patches independent of how the source happens to be line-wrapped.
 */
export type PhaseVolumeShaderPatches = {
  vertexCommon: string;
  vertexWorldpos: string;
  fragmentCommon: string;
  fragmentColor: string;
};

export function phaseVolumeShaderSource(palette: PhaseDepthPalette): PhaseVolumeShaderPatches {
  return {
    vertexCommon: `varying float vPhaseWorldY;`,
    vertexWorldpos: `vPhaseWorldY = (modelMatrix * vec4(transformed, 1.0)).y;`,
    fragmentCommon: `varying float vPhaseWorldY;`,
    fragmentColor: `float phaseHeight = clamp((vPhaseWorldY + ${PHASE_RADIUS_M.toFixed(6)}) / ${(2 * PHASE_RADIUS_M).toFixed(6)}, 0.0, 1.0);
      vec3 phaseDeep = mix(${glslColor(palette.depth)}, ${glslColor(palette.base)}, smoothstep(0.0, 0.72, phaseHeight));
      diffuseColor.rgb = mix(phaseDeep, ${glslColor(palette.top)}, smoothstep(0.72, 1.0, phaseHeight));`,
  };
}

export const SURFACE_SHADER_PATCHES = Object.freeze({
  fragmentCommon: `uniform float uSurfaceTime;\nuniform float uSurfaceAmplitude;`,
  fragmentNormal: `float surfaceWave = sin(vViewPosition.x * 15.0 + uSurfaceTime * 2.3) *
          cos(vViewPosition.z * 18.0 - uSurfaceTime * 1.7);
        normal = normalize(normal + vec3(surfaceWave, 0.0, surfaceWave * 0.55) * uSurfaceAmplitude * 0.11);`,
});

/**
 * Three.js caches compiled programs by this key, so it must change whenever the
 * injected source does. Deriving it from the source itself removes the manual
 * version suffix that could be forgotten while editing a shader.
 */
export function shaderCacheKey(prefix: string, patches: Readonly<Record<string, string>>): string {
  let hash = 0x811c9dc5;
  for (const source of Object.values(patches)) {
    for (let index = 0; index < source.length; index += 1) {
      hash = Math.imul(hash ^ source.charCodeAt(index), 0x01000193);
    }
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}
