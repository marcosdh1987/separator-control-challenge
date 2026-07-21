# Deterministic Scoring

Scores use true simulated level and actual valve position. Measurement noise only
affects the PID input. All values are calculated from the same fixed-step history,
so identical configuration, scenario, and seed produce the same result.

## Base score

```text
Safety   = trip ? 0 : 35 * (1 - min(alarmSeconds / 45, 1))
Tracking = 25 * (1 - min(MAE / 15, 1))
Stability = 15 * (1 - min(last60sErrorStdDev / 8, 1))
Recovery = 15 * (1 - min(recoverySeconds / 90, 1))
Valve = 6 * (1 - min(totalTravel / 300, 1))
      + 4 * (1 - min(saturationSeconds / 45, 1))
```

The target band is 45-55%. Alarm time accumulates below 25% or above 75%.
Recovery is the first post-disturbance period that remains in the target band for
10 continuous seconds; a run that never recovers receives zero recovery points.

## Modifiers

- A LL/HH trip caps the total at 35.
- Sustained oscillation subtracts 10 points.
- More than 30 s of command saturation subtracts 8 points.
- More than 300 percentage points of valve travel subtracts 5 points.
- More than 10 s at the integral limit subtracts 5 points.

Sustained oscillation requires at least six setpoint crossings and at least eight
percentage points peak-to-peak error in the final 60 seconds. The final score is
rounded and clamped to 0-100.

## Ranks

| Score | Rank |
| --- | --- |
| 0-39 | Trainee Operator |
| 40-59 | Control Technician |
| 60-74 | Process Engineer |
| 75-89 | Loop Tuning Specialist |
| 90-100 | Separator Control Master |

The result screen selects its coaching message from the largest normalized point
loss or active modifier. No LLM or external service is used.
