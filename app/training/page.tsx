import Link from "next/link";

export default function TrainingPage() {
  return (
    <main className="training-placeholder">
      <p className="eyebrow">Guided training</p>
      <h1>Guided training is being prepared.</h1>
      <p>Learn the separator controls step by step before taking a scored challenge.</p>
      <Link className="secondary-button" href="/challenge">Enter control room</Link>
    </main>
  );
}
