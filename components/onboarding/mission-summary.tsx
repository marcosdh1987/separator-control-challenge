export function MissionSummary() {
  return (
    <div className="mission-summary">
      <p id="quick-start-description">
        Keep the total level near 50% and the oil/water interface near 20% while the process is disturbed.
      </p>
      <dl>
        <div>
          <dt>Oil valve LV-101</dt>
          <dd>Moves oil out to correct total liquid level.</dd>
        </div>
        <div>
          <dt>Water valve WV-101</dt>
          <dd>Moves water out to correct the interface.</dd>
        </div>
      </dl>
      <p>Gains lock when an attempt starts, so tune before you run.</p>
      <ol aria-label="How to play">
        <li>Choose a scenario.</li>
        <li>Adjust the PID gains.</li>
        <li>Start the attempt.</li>
        <li>Monitor levels, valves, and safety.</li>
        <li>Retry with what you learned.</li>
      </ol>
    </div>
  );
}
