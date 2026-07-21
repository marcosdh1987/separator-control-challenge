"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import {
  DIAGNOSIS_PATTERNS,
  LOOP_EXPLANATIONS,
  PID_EDUCATION_CONTENT,
  REFERENCES,
} from "@/lib/education/pid-content";

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

export function PidLearningPanel() {
  const { theory, piNote, antiWindupNote, derivativeNoiseNote, classicalTuning, repeatableExperimentGoldenRule } = PID_EDUCATION_CONTENT;
  return <aside aria-label="PID learning resources" className="pid-learning-panel">
    <div className="pid-learning-panel__heading"><BookOpen aria-hidden="true" /><div><p>Learning station</p><h2>Observe, change, compare</h2></div></div>
    <LearningDisclosure title="PID theory">
      <p className="pid-formula">{theory.parallelFormula}</p>
      <p>{theory.errorDefinition}</p><p>{theory.parallelGainsNote}</p><p>{theory.reverseActionConvention}</p>
    </LearningDisclosure>
    <LearningDisclosure title="Manual tuning golden rule"><p className="golden-rule">{repeatableExperimentGoldenRule}</p></LearningDisclosure>
    <LearningDisclosure title="How do I diagnose the response?">
      <div className="diagnosis-list">{DIAGNOSIS_PATTERNS.map((pattern) => <section key={pattern.title}><h3>{pattern.title}</h3><ul>{pattern.symptoms.map((symptom) => <li key={symptom}>{symptom}</li>)}</ul><p>{pattern.suggestion}</p></section>)}</div>
    </LearningDisclosure>
    <LearningDisclosure title="Learn more">
      <p>{piNote}</p><p>{antiWindupNote}</p><p>{derivativeNoiseNote}</p><section><h3>{classicalTuning.title}</h3><p>{classicalTuning.body}</p></section>
      <ul className="reference-list">{REFERENCES.map((reference) => <li key={reference.title}>{reference.url ? <a href={reference.url} rel="noreferrer" target="_blank">{reference.title}</a> : reference.title}<span>{reference.description}</span></li>)}</ul>
    </LearningDisclosure>
    <LearningDisclosure title="What each loop moves">
      {Object.values(LOOP_EXPLANATIONS).map((loop) => <section className="loop-explanation" key={loop.title}><h3>{loop.title}</h3>{loop.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{loop.caution ? <p className="pid-help__note">{loop.caution}</p> : null}</section>)}
    </LearningDisclosure>
  </aside>;
}
