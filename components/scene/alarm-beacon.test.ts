import { describe, expect, it } from "vitest";

import { beaconFramePresentation, beaconPresentation, beaconPulse } from "./alarm-beacon";

describe("alarm beacon presentation", () => {
  it("keeps safe calm, alarms slowly pulsing, and trips constantly bright", () => {
    expect(beaconPresentation("safe")).toMatchObject({ pulseHz: 0, animated: false });
    expect(beaconPresentation("alarm")).toMatchObject({ pulseHz: 0.7, animated: true });
    expect(beaconPresentation("alarm").pulseHz).toBeLessThan(2);
    expect(beaconPresentation("trip")).toMatchObject({ pulseHz: 0, animated: false });
    expect(beaconPresentation("trip").intensity).toBeGreaterThan(beaconPresentation("alarm").intensity);
  });

  it("returns a severity-appropriate static value when animation is disabled", () => {
    expect(beaconPulse("alarm", 10, false)).toBe(beaconPresentation("alarm").intensity);
    expect(beaconPulse("trip", 10, true)).toBe(beaconPresentation("trip").intensity);
  });

  it("pulses both the alarm lens and light slowly while a trip remains constant", () => {
    const alarmLow = beaconFramePresentation("alarm", 0.75, true);
    const alarmHigh = beaconFramePresentation("alarm", 0.25, true);
    expect(alarmLow.lensEmissiveIntensity).not.toBe(alarmHigh.lensEmissiveIntensity);
    expect(alarmLow.lightIntensity).not.toBe(alarmHigh.lightIntensity);

    expect(beaconFramePresentation("trip", 0.25, true)).toEqual(
      beaconFramePresentation("trip", 0.75, true),
    );
    expect(beaconFramePresentation("trip", 0.25, true).lensEmissiveIntensity).toBeGreaterThan(
      beaconPresentation("alarm").intensity,
    );
  });
});
