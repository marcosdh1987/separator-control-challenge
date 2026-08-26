"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { DIAGNOSIS_PATTERN_IDS } from "@/lib/education/diagnosis";
import type { LoopId } from "@/lib/simulation/types";
import {
  LIQUID_LOOP_EXPLANATION_IDS,
  MANUAL_TUNING_STEP_IDS,
  PID_PARALLEL_FORMULA,
  REFERENCES,
} from "@/lib/education/pid-content";
import { useMessages } from "@/lib/i18n/provider";

interface LearningDisclosureProps {
  title: string;
  children: ReactNode;
}

function LearningDisclosure({ title, children }: LearningDisclosureProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className="learning-disclosure">
    <button aria-controls={id} aria-expanded={open} className="learning-disclosure__trigger" type="button" onClick={() => setOpen((current) => !current)}>
      {title}<ChevronDown aria-hidden="true" />
    </button>
    {open ? <div className="learning-disclosure__content" id={id}>{children}</div> : null}
  </section>;
}

interface PidLearningPanelProps {
  /** Which loops this run actually has; the pressure loop needs the gas cap. */
  loopIds?: readonly LoopId[];
}

export function PidLearningPanel({
  loopIds = LIQUID_LOOP_EXPLANATION_IDS,
}: PidLearningPanelProps = {}) {
  const {
    panel,
    theory,
    diagnosisPattern,
    loopExplanation,
    manualTuning,
    referenceDescription,
    piNote,
    antiWindupNote,
    derivativeNoiseNote,
    classicalTuning,
    repeatableExperimentGoldenRule,
  } = useMessages().education;

  return <aside aria-label={panel.ariaLabel} className="pid-learning-panel">
    <div className="pid-learning-panel__heading"><BookOpen aria-hidden="true" /><div><p>{panel.eyebrow}</p><h2>{panel.title}</h2></div></div>
    <LearningDisclosure title={panel.theory}>
      <p className="pid-formula">{PID_PARALLEL_FORMULA}</p>
      <p>{theory.errorDefinition}</p><p>{theory.parallelGainsNote}</p><p>{theory.reverseActionConvention}</p>
    </LearningDisclosure>
    <LearningDisclosure title={panel.goldenRule}>
      <p className="golden-rule">{repeatableExperimentGoldenRule}</p>
      <ol className="tuning-step-list">{MANUAL_TUNING_STEP_IDS.map((id) => <li key={id}><h3>{manualTuning.step[id].title}</h3><ul>{manualTuning.step[id].body.map((line) => <li key={line}>{line}</li>)}</ul></li>)}</ol>
      <p className="pid-help__note">{manualTuning.reminder}</p>
    </LearningDisclosure>
    <LearningDisclosure title={panel.diagnosis}>
      <div className="diagnosis-list">{DIAGNOSIS_PATTERN_IDS.map((id) => <section key={id}><h3>{diagnosisPattern[id].title}</h3><ul>{diagnosisPattern[id].symptoms.map((symptom) => <li key={symptom}>{symptom}</li>)}</ul><p>{diagnosisPattern[id].suggestion}</p></section>)}</div>
    </LearningDisclosure>
    <LearningDisclosure title={panel.learnMore}>
      <p>{piNote}</p><p>{antiWindupNote}</p><p>{derivativeNoiseNote}</p><section><h3>{classicalTuning.title}</h3><p>{classicalTuning.body}</p></section>
      <ul className="reference-list">{REFERENCES.map((reference) => <li key={reference.id}>{reference.url ? <a href={reference.url} rel="noreferrer" target="_blank">{reference.title}</a> : reference.title}<span>{referenceDescription[reference.id]}</span></li>)}</ul>
    </LearningDisclosure>
    <LearningDisclosure title={panel.loops}>
      {loopIds.map((id) => <section className="loop-explanation" key={id}><h3>{loopExplanation[id].title}</h3>{loopExplanation[id].paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<p className="pid-help__note">{loopExplanation[id].caution}</p></section>)}
    </LearningDisclosure>
  </aside>;
}
