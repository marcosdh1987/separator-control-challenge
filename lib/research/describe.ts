import type { Locale } from "@/lib/i18n/locale";
import type { ResearchMessages } from "@/lib/i18n/messages/en/research";
import type { ReplayEvent } from "@/lib/research/contract";
import { formatNumber } from "@/lib/research/format";

/**
 * Event text built from the recorded kind and detail. No wording is stored in
 * the data; the message catalogues supply it, so the same event reads in either
 * language and nothing is paraphrased by a model.
 */

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export function codeLabel(copy: ResearchMessages, code: unknown): string {
  const key = str(code);
  return copy.codes[key] ?? key;
}

export function describeEvent(event: ReplayEvent, copy: ResearchMessages, locale: Locale): string {
  const d = event.detail;
  const describe = copy.events.describe;
  switch (event.kind) {
    case "command":
      return describe.command(str(d.command), str(d.result));
    case "fault": {
      const parameters = (d.parameters ?? {}) as Record<string, number>;
      const parts = Object.entries(parameters)
        .filter(([, value]) => typeof value === "number" && value !== 0)
        .map(([name, value]) => copy.events.faultParts[name]?.(formatNumber(value, locale, value % 1 === 0 ? 0 : 1)) ?? `${name} ${value}`);
      return describe.fault(str(d.valve), parts.join(", "));
    }
    case "setpoint_change":
      return describe.setpoint(str(d.controller), formatNumber(Number(d.from), locale, 2), formatNumber(Number(d.to), locale, 2));
    case "alarm_on":
    case "alarm_off":
      return describe.alarm(copy.events.alarms[str(d.alarm)] ?? str(d.alarm), event.kind === "alarm_on");
    case "trip":
      return describe.trip;
    case "plant_state":
      return describe.plant(codeLabel(copy, d.from), codeLabel(copy, d.to));
    case "well_state":
      return describe.well(codeLabel(copy, d.from), codeLabel(copy, d.to));
    case "band_exit":
      return describe.bandExit(
        str(d.controller),
        `${formatNumber(Number(d.band), locale, d.loop === "gas" ? 2 : 0)} ${d.loop === "gas" ? "bar" : "%"}`,
        formatNumber(Number(d.secondsFromPhaseStart), locale, 0),
        str(d.phase),
      );
    case "settled":
      return describe.settled(str(d.controller), formatNumber(Number(d.secondsFromPhaseStart), locale, 0), copy.metrics.classes[str(d.class)] ?? str(d.class));
    case "oil_pad_lost":
      return describe.oilPad;
    default:
      return copy.events.kinds[event.kind] ?? event.kind;
  }
}
