import { describe, expect, it } from "vitest";

import {
  gasDensityKgM3,
  gasValveMolarFlow,
  MOLES_PER_SM3,
  suttonPseudoCriticals,
  zFactorDak,
} from "./gas-properties";

describe("gas pseudo-criticals", () => {
  it("reproduces the Sutton correlation for a typical associated gas", () => {
    const gravity = 0.7;
    // The published correlation, in its original psia and Rankine units.
    const expectedPsia = 756.8 - 131 * gravity - 3.6 * gravity ** 2;
    const expectedRankine = 169.2 + 349.5 * gravity - 74 * gravity ** 2;

    const { pressureBarA, temperatureK } = suttonPseudoCriticals(gravity);
    expect(pressureBarA).toBeCloseTo(expectedPsia * 0.0689476, 6);
    expect(temperatureK).toBeCloseTo((expectedRankine * 5) / 9, 6);
  });

  it("gives a heavier gas a lower critical pressure and a higher critical temperature", () => {
    const light = suttonPseudoCriticals(0.6);
    const heavy = suttonPseudoCriticals(0.9);
    expect(heavy.pressureBarA).toBeLessThan(light.pressureBarA);
    expect(heavy.temperatureK).toBeGreaterThan(light.temperatureK);
  });
});

describe("compressibility factor", () => {
  it("falls back to ideal behaviour outside the correlation's range", () => {
    // Near-atmospheric pressure is below the reduced-pressure floor.
    expect(zFactorDak(1.01325, 20, 0.7)).toBe(1);
    // A reduced temperature far above the fitted range is equally out of scope.
    expect(zFactorDak(50, 900, 0.7)).toBe(1);
  });

  it("stays below one where real gas is more compressible than ideal", () => {
    const z = zFactorDak(60, 45, 0.7);
    expect(z).toBeGreaterThan(0.7);
    expect(z).toBeLessThan(1);
  });

  it("is monotonically decreasing with pressure through the working range", () => {
    const pressures = [20, 40, 60, 80];
    const factors = pressures.map((p) => zFactorDak(p, 45, 0.7));
    for (let index = 1; index < factors.length; index += 1) {
      expect(factors[index]).toBeLessThan(factors[index - 1]);
    }
  });

  it("never returns a non-finite factor for hostile input", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      expect(Number.isFinite(zFactorDak(value, 45, 0.7))).toBe(true);
    }
  });
});

describe("gas density", () => {
  it("scales with pressure and molar mass", () => {
    const low = gasDensityKgM3(9, 45, 0.72, 1);
    const high = gasDensityKgM3(18, 45, 0.72, 1);
    expect(high / low).toBeCloseTo(2, 6);
    const heavier = gasDensityKgM3(9, 45, 0.9, 1);
    expect(heavier).toBeGreaterThan(low);
  });
});

describe("gas valve", () => {
  const base = {
    kv: 55,
    openFraction: 0.5,
    upstreamPressureBarA: 9,
    downstreamPressureBarA: 2,
    temperatureC: 45,
    gasGravity: 0.72,
    zFactor: zFactorDak(9, 45, 0.72),
  };

  it("passes nothing when shut or when there is no differential", () => {
    expect(gasValveMolarFlow({ ...base, openFraction: 0 })).toBe(0);
    expect(gasValveMolarFlow({ ...base, downstreamPressureBarA: 9 })).toBe(0);
    expect(gasValveMolarFlow({ ...base, downstreamPressureBarA: 12 })).toBe(0);
  });

  it("sits near mid-capacity at the design duty", () => {
    const sm3h = gasValveMolarFlow(base) / MOLES_PER_SM3;
    expect(sm3h).toBeGreaterThan(3800);
    expect(sm3h).toBeLessThan(4600);
  });

  it("rises monotonically with opening", () => {
    const flows = [0.2, 0.4, 0.6, 0.8, 1].map((openFraction) =>
      gasValveMolarFlow({ ...base, openFraction }),
    );
    for (let index = 1; index < flows.length; index += 1) {
      expect(flows[index]).toBeGreaterThan(flows[index - 1]);
    }
  });

  it("stops responding to downstream pressure once choked", () => {
    // At p2/p1 well below the critical ratio the valve is choked, so lowering the
    // header further cannot pull more gas through.
    const choked = gasValveMolarFlow({ ...base, downstreamPressureBarA: 2 });
    const deeperVacuum = gasValveMolarFlow({ ...base, downstreamPressureBarA: 1.2 });
    expect(deeperVacuum).toBeCloseTo(choked, 6);
  });

  it("stays monotonic in upstream pressure, which is what stabilises the gas cap", () => {
    const flows = [6, 9, 12, 16].map((upstreamPressureBarA) =>
      gasValveMolarFlow({
        ...base,
        upstreamPressureBarA,
        zFactor: zFactorDak(upstreamPressureBarA, 45, 0.72),
      }),
    );
    for (let index = 1; index < flows.length; index += 1) {
      expect(flows[index]).toBeGreaterThan(flows[index - 1]);
    }
  });
});
