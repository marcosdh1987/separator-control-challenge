import { describe, expect, it } from "vitest";

import { createEquilibriumSample } from "@/hooks/use-simulation";
import { createSceneModel, VESSEL_RADIUS_M } from "@/lib/visualization/scene-model";
import {
  generateGasParticlePositions,
  PHASE_DEPTH_PALETTES,
  PHASE_RADIUS_M,
  phaseSurfaceTransforms,
  phaseVolumeShaderSource,
  shaderCacheKey,
  SURFACE_SHADER_PATCHES,
} from "./phase-geometry";

const sampleAt = (totalPct: number, interfacePct: number) => {
  const sample = createEquilibriumSample();
  sample.total.processValuePct = totalPct;
  sample.interface.processValuePct = interfacePct;
  return sample;
};

describe("exact phase geometry", () => {
  it.each([{ levelPct: 1 }, { levelPct: 20 }, { levelPct: 50 }, { levelPct: 99 }])("keeps the $levelPct% surface and chord on the 0.6 m vessel circle", ({ levelPct }) => {
    const model = createSceneModel(sampleAt(levelPct, levelPct));
    const transforms = phaseSurfaceTransforms(model);
    const expectedY = -VESSEL_RADIUS_M + 2 * VESSEL_RADIUS_M * levelPct / 100;
    const expectedChord = 2 * Math.sqrt(VESSEL_RADIUS_M ** 2 - expectedY ** 2);
    expect(PHASE_RADIUS_M).toBe(VESSEL_RADIUS_M);
    expect(transforms.total.y).toBeCloseTo(expectedY, 12);
    expect(transforms.total.chordWidth).toBeCloseTo(expectedChord, 12);
    expect(Math.abs(transforms.total.y)).toBeLessThanOrEqual(PHASE_RADIUS_M);
    expect((transforms.total.chordWidth / 2) ** 2 + transforms.total.y ** 2).toBeCloseTo(PHASE_RADIUS_M ** 2, 12);
  });

  it("maps 99% to y=0.588 m without breaching the envelope", () => {
    const transform = phaseSurfaceTransforms(createSceneModel(sampleAt(99, 20))).total;
    expect(transform.y).toBeCloseTo(0.588, 12);
    expect(transform.chordWidth).toBeLessThanOrEqual(2 * PHASE_RADIUS_M);
  });

  it("keeps crossed total/interface inputs finite", () => {
    const transforms = phaseSurfaceTransforms(createSceneModel(sampleAt(20, 99)));
    expect(Object.values(transforms).flatMap(Object.values).every(Number.isFinite)).toBe(true);
  });
});

describe("gas particle distribution", () => {
  it("is deterministic and bounded inside the complete YZ vessel disk", () => {
    const first = generateGasParticlePositions(128);
    const second = generateGasParticlePositions(128);
    expect(Array.from(first)).toEqual(Array.from(second));
    for (let offset = 0; offset < first.length; offset += 3) {
      const y = first[offset + 1];
      const z = first[offset + 2];
      expect(y * y + z * z).toBeLessThanOrEqual(PHASE_RADIUS_M ** 2 + 1e-7);
    }
  });
});

describe("phase depth coloring", () => {
  it("uses distinct top, base, and depth colors for oil and water", () => {
    expect(PHASE_DEPTH_PALETTES.oil).not.toEqual(PHASE_DEPTH_PALETTES.water);
    for (const palette of Object.values(PHASE_DEPTH_PALETTES)) {
      expect(new Set([palette.top, palette.base, palette.depth]).size).toBe(3);
    }
  });

  it("mixes depth colors from world Y without changing vertex positions", () => {
    const shader = phaseVolumeShaderSource(PHASE_DEPTH_PALETTES.water);
    expect(shader.vertexWorldpos).toContain("vPhaseWorldY = (modelMatrix * vec4(transformed, 1.0)).y");
    expect(shader.fragmentColor).toContain("mix");
    const vertex = `${shader.vertexCommon}\n${shader.vertexWorldpos}`;
    expect(vertex).not.toContain("transformed +=");
    expect(vertex).not.toContain("transformed.y =");
  });

  it("declares the varying it reads in both shader stages", () => {
    const shader = phaseVolumeShaderSource(PHASE_DEPTH_PALETTES.oil);
    expect(shader.vertexCommon).toContain("varying float vPhaseWorldY;");
    expect(shader.fragmentCommon).toContain("varying float vPhaseWorldY;");
    // The declaration belongs in the <common> blocks; repeating it beside the body
    // that uses it would fail to compile.
    expect(shader.vertexWorldpos).not.toContain("varying");
    expect(shader.fragmentColor).not.toContain("varying");
  });

  it("changes the program cache key whenever the injected source changes", () => {
    const water = phaseVolumeShaderSource(PHASE_DEPTH_PALETTES.water);
    const oil = phaseVolumeShaderSource(PHASE_DEPTH_PALETTES.oil);
    expect(shaderCacheKey("phase", water)).toBe(shaderCacheKey("phase", water));
    expect(shaderCacheKey("phase", water)).not.toBe(shaderCacheKey("phase", oil));
    expect(shaderCacheKey("phase", water)).not.toBe(shaderCacheKey("surface", water));
    expect(shaderCacheKey("surface", SURFACE_SHADER_PATCHES)).toMatch(/^surface-[0-9a-z]+$/);
  });
});
