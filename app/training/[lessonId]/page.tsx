import { notFound } from "next/navigation";

import { LessonPlayer } from "@/components/training/lesson-player";
import { LESSON_IDS } from "@/lib/training/types";
import { isLessonId } from "@/lib/training/lessons";

/** The course is a fixed catalogue, so every lesson is prerendered. */
export function generateStaticParams() {
  return LESSON_IDS.map((lessonId) => ({ lessonId }));
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  if (!isLessonId(lessonId)) notFound();
  // Keyed by lesson so moving to the next one starts a genuinely fresh attempt.
  return <LessonPlayer key={lessonId} lessonId={lessonId} />;
}
