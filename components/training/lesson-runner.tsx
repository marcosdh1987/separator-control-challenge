"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DualPidControls } from "../dual-pid-controls";
import { ProcessHero } from "../process-hero";
import { TrendCharts } from "../trend-charts";
import { useSimulation } from "@/hooks/use-simulation";
import { useMessages } from "@/lib/i18n/provider";
import { getScenario } from "@/lib/simulation/scenarios";
import {
  DEFAULT_SIMULATION,
  DEFAULT_SIMULATION_WITH_GAS,
  type DualPidConfig,
} from "@/lib/simulation/types";
import { buildAttemptEvidence, gradeAttempt } from "@/lib/training/grading";
import type { Lesson, LessonOutcome } from "@/lib/training/types";

interface LessonRunnerProps {
  lesson: Lesson;
  onOutcome: (outcome: LessonOutcome, score: number) => void;
}

/**
 * Runs one lesson's exercise. It reuses the same deck, hero and trends as the free
 * challenge, so what a trainee learns here transfers directly; what the lesson adds
 * is a fixed scenario, a starting tuning, and grading when the run ends.
 */
export function LessonRunner({ lesson, onOutcome }: LessonRunnerProps) {
  const messages = useMessages();
  const [pid, setPid] = useState<DualPidConfig>(lesson.exercise.initialPid);
  const config = lesson.exercise.gasEnabled ? DEFAULT_SIMULATION_WITH_GAS : DEFAULT_SIMULATION;
  const simulation = useSimulation(pid, lesson.exercise.scenarioId, config);
  const gradedRunRef = useRef<unknown>(null);

  const disturbanceStartS = useMemo(
    () => getScenario(lesson.exercise.scenarioId).disturbanceStartS,
    [lesson.exercise.scenarioId],
  );

  useEffect(() => {
    const result = simulation.result;
    if (!result || gradedRunRef.current === result) return;
    gradedRunRef.current = result;
    const evidence = buildAttemptEvidence(
      simulation.samples,
      result,
      config,
      disturbanceStartS,
    );
    onOutcome(gradeAttempt(lesson, evidence), result.score.total);
  }, [config, disturbanceStartS, lesson, onOutcome, simulation.result, simulation.samples]);

  const locked = simulation.status !== "idle";

  return (
    <section aria-label={messages.training.player.runHeading} className="lesson-runner">
      <DualPidControls
        config={pid}
        hero={<ProcessHero sample={simulation.currentSample} status={simulation.status} />}
        locked={locked}
        lockedGains={lesson.exercise.lockedGains}
        ready={simulation.ready}
        sample={simulation.currentSample}
        speed={simulation.speed}
        status={simulation.status}
        wellOpen={simulation.wellOpen}
        onWellChange={simulation.setWell}
        onChange={setPid}
        onPause={simulation.pause}
        onReset={simulation.reset}
        onResume={simulation.resume}
        onSpeedChange={simulation.setSpeed}
        onStart={simulation.start}
      />
      <TrendCharts samples={simulation.samples} />
    </section>
  );
}
