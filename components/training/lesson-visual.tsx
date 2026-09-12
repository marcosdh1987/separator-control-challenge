import { useId, type ReactNode } from "react";

import type { LessonVisualKind } from "@/lib/training/types";

interface LessonVisualProps {
  alt: string;
  kind: LessonVisualKind;
  variant: "thumbnail" | "detail";
}

export function LessonVisual({ alt, kind, variant }: LessonVisualProps) {
  const titleId = useId();

  return (
    <svg
      aria-labelledby={titleId}
      className="lesson-visual"
      data-visual-kind={kind}
      data-visual-variant={variant}
      role="img"
      viewBox="0 0 320 180"
    >
      <title id={titleId}>{alt}</title>
      <rect className="lesson-visual__backdrop" height="178" rx="16" width="318" x="1" y="1" />
      {renderVisual(kind)}
    </svg>
  );
}

function renderVisual(kind: LessonVisualKind): ReactNode {
  switch (kind) {
    case "separator":
      return <SeparatorVisual />;
    case "proportional-action":
      return <ProportionalActionVisual />;
    case "integral-windup":
      return <IntegralWindupVisual />;
    case "interface-noise":
      return <InterfaceNoiseVisual />;
    case "slug-feedback":
      return <SlugFeedbackVisual />;
    case "pressure-loop":
      return <PressureLoopVisual />;
    case "systematic-tuning":
      return <SystematicTuningVisual />;
    default:
      return assertNever(kind);
  }
}

function SeparatorVisual() {
  return (
    <g>
      <path className="lesson-visual__vessel" d="M62 45c0-12 12-22 27-22h142c15 0 27 10 27 22v90c0 12-12 22-27 22H89c-15 0-27-10-27-22z" />
      <path className="lesson-visual__gas" d="M64 44c0-11 11-19 25-19h142c14 0 25 8 25 19v31H64z" />
      <path className="lesson-visual__oil" d="M64 75h192v28H64z" />
      <path className="lesson-visual__water" d="M64 103h192v32c0 11-11 19-25 19H89c-14 0-25-8-25-19z" />
      <path className="lesson-visual__control" d="M64 75h192M64 103h192" />
      <path className="lesson-visual__muted" d="M18 89h44M256 58h34M256 124h34" />
      <path className="lesson-visual__accent" d="M290 58v-18h14M290 124v18h14" />
      <circle className="lesson-visual__accent" cx="304" cy="40" r="9" />
      <circle className="lesson-visual__accent" cx="304" cy="142" r="9" />
      <g className="lesson-visual__detail">
        <text className="lesson-visual__label" x="19" y="82">WELL</text>
        <text className="lesson-visual__label" x="212" y="48">GAS</text>
        <text className="lesson-visual__label" x="215" y="94">OIL</text>
        <text className="lesson-visual__label" x="203" y="127">WATER</text>
        <text className="lesson-visual__label" x="254" y="31">PCV</text>
        <text className="lesson-visual__label" x="254" y="166">LCV</text>
      </g>
    </g>
  );
}

function ProportionalActionVisual() {
  return (
    <g>
      <path className="lesson-visual__muted" d="M42 28v120h244M42 148h244" />
      <path className="lesson-visual__control" d="M42 62h244" strokeDasharray="7 6" />
      <path className="lesson-visual__accent" d="M110 148V42" strokeDasharray="3 4" />
      <path className="lesson-visual__control" d="M43 142C70 140 86 138 110 128c16-7 20-36 43-38 33-3 47 13 77 14 19 1 36 0 55 0" />
      <g className="lesson-visual__detail">
        <text className="lesson-visual__label" x="249" y="57">SP</text>
        <text className="lesson-visual__label" x="248" y="99">PV</text>
        <text className="lesson-visual__label" x="98" y="39">FEED STEP</text>
        <text className="lesson-visual__label" x="185" y="172">TIME</text>
        <text className="lesson-visual__label" x="7" y="66">%</text>
      </g>
    </g>
  );
}

function IntegralWindupVisual() {
  return (
    <g>
      <path className="lesson-visual__muted" d="M34 142h252M34 142V28" />
      <path className="lesson-visual__control" d="M45 128c25 0 29-5 40-17 13-15 21-35 38-35 24 0 29 48 57 48 30 0 35-61 63-61" />
      <path className="lesson-visual__accent" d="M243 43h43M243 148h43" strokeDasharray="4 4" />
      <path className="lesson-visual__accent" d="M235 72h19v-12h19v-12h19" />
      <path className="lesson-visual__accent" d="M235 111h19v-12h19v-12h19" />
      <path className="lesson-visual__muted" d="M260 72v39" />
      <g className="lesson-visual__detail">
        <text className="lesson-visual__label" x="244" y="35">100%</text>
        <text className="lesson-visual__label" x="242" y="168">0%</text>
        <text className="lesson-visual__label" x="38" y="22">INTEGRAL</text>
        <text className="lesson-visual__label" x="211" y="131">VALVE</text>
      </g>
    </g>
  );
}

function InterfaceNoiseVisual() {
  return (
    <g>
      <path className="lesson-visual__vessel" d="M42 54c0-9 9-16 20-16h120c11 0 20 7 20 16v75c0 9-9 16-20 16H62c-11 0-20-7-20-16z" />
      <path className="lesson-visual__water" d="M44 101h156v28c0 8-8 14-18 14H62c-10 0-18-6-18-14z" />
      <path className="lesson-visual__control" d="M44 101h156" />
      <path className="lesson-visual__signal" d="M201 95h34" />
      <path className="lesson-visual__accent" d="M235 95h14M249 95l9 9-9 9h14" />
      <path className="lesson-visual__accent" d="M272 102v-20h18M272 102v20h18" />
      <circle className="lesson-visual__accent" cx="300" cy="82" r="8" />
      <circle className="lesson-visual__accent" cx="300" cy="122" r="8" />
      <g className="lesson-visual__detail">
        <path className="lesson-visual__control" d="M44 98l8 5 7-9 8 10 7-13 8 11 8-8 8 12 8-15 8 10 8-7 8 10 8-13 8 9 8-7 8 10 8-12 8 8 8-6 8 9 8-11 8 8" />
        <text className="lesson-visual__label" x="51" y="31">INTERFACE PV</text>
        <text className="lesson-visual__label" x="273" y="71">WATER</text>
        <text className="lesson-visual__label" x="274" y="148">VALVE</text>
      </g>
    </g>
  );
}

function SlugFeedbackVisual() {
  return (
    <g>
      <path className="lesson-visual__muted" d="M18 97h38M246 104h56" />
      <path className="lesson-visual__vessel" d="M56 48c0-10 10-18 22-18h138c12 0 22 8 22 18v88c0 10-10 18-22 18H78c-12 0-22-8-22-18z" />
      <path className="lesson-visual__water" d="M58 98h178v38c0 9-9 16-20 16H78c-11 0-20-7-20-16z" />
      <path className="lesson-visual__control" d="M58 98h178" />
      <path className="lesson-visual__accent" d="M18 97h30" strokeWidth="12" />
      <path className="lesson-visual__accent" d="M38 81h25M38 113h25" />
      <path className="lesson-visual__control" d="M78 74h137" strokeDasharray="3 4" />
      <g className="lesson-visual__detail">
        <text className="lesson-visual__label" x="15" y="68">SLUG</text>
        <text className="lesson-visual__label" x="76" y="68">SURGE VOLUME</text>
        <text className="lesson-visual__label" x="245" y="90">SP</text>
        <path className="lesson-visual__muted" d="M77 77h136v14H77z" strokeDasharray="3 3" />
      </g>
    </g>
  );
}

function PressureLoopVisual() {
  return (
    <g>
      <path className="lesson-visual__vessel" d="M54 67c0-12 12-22 27-22h130c15 0 27 10 27 22v68c0 12-12 22-27 22H81c-15 0-27-10-27-22z" />
      <path className="lesson-visual__gas" d="M56 66c0-10 11-18 25-18h130c14 0 25 8 25 18v30H56z" />
      <path className="lesson-visual__water" d="M56 120h180v15c0 10-11 18-25 18H81c-14 0-25-8-25-18z" />
      <path className="lesson-visual__oil" d="M56 96h180v24H56z" />
      <path className="lesson-visual__control" d="M56 96h180M56 120h180" />
      <circle className="lesson-visual__accent" cx="148" cy="32" r="14" />
      <path className="lesson-visual__signal" d="M222 32h38v31h22" />
      <circle className="lesson-visual__accent" cx="292" cy="63" r="8" />
      <path className="lesson-visual__accent" d="M300 63h12" />
      <g className="lesson-visual__detail">
        <text className="lesson-visual__label" x="135" y="36">PT</text>
        <text className="lesson-visual__label" x="116" y="78">GAS CAP</text>
        <text className="lesson-visual__label" x="262" y="50">PCV</text>
        <text className="lesson-visual__label" x="73" y="112">OIL</text>
        <text className="lesson-visual__label" x="72" y="145">WATER</text>
      </g>
    </g>
  );
}

function SystematicTuningVisual() {
  return (
    <g>
      <path className="lesson-visual__muted" d="M25 144h270M25 144V28" />
      <path className="lesson-visual__control" d="M35 126c18-3 25-38 43-38 19 0 18 35 37 35 18 0 22-23 38-23" />
      <path className="lesson-visual__accent" d="M148 100h32M148 100v-23h32M148 100v23h32" />
      <path className="lesson-visual__control" d="M191 120c17-2 17-38 34-38 16 0 18 23 34 23 11 0 20-3 31-3" />
      <g className="lesson-visual__detail">
        <rect className="lesson-visual__muted" height="28" rx="5" width="42" x="30" y="34" />
        <rect className="lesson-visual__muted" height="28" rx="5" width="42" x="84" y="34" />
        <rect className="lesson-visual__muted" height="28" rx="5" width="42" x="138" y="34" />
        <text className="lesson-visual__label" x="44" y="53">Kp</text>
        <text className="lesson-visual__label" x="98" y="53">Ki</text>
        <text className="lesson-visual__label" x="151" y="53">Kd?</text>
        <text className="lesson-visual__label" x="235" y="31">STABLE</text>
        <path className="lesson-visual__control" d="M219 43h68" strokeDasharray="6 5" />
      </g>
    </g>
  );
}

function assertNever(value: never): never {
  throw new Error(`Unsupported lesson visual kind: ${value}`);
}
