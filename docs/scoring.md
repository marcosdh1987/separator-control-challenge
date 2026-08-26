# Deterministic Scoring

Scores use true simulated level and actual valve position; measurement noise only
affects the PID input. All values are calculated from the same fixed-step history,
so identical configuration, scenario, and seed produce the same result.

## Base score (100 points)

The score comprises five weighted categories. When a gas cap (pressure loop) is
enabled, the tracking and stability budget is shared with the pressure loop:

```text
Safety (35 points)
  = trip ? 0 : 35 · (1 − min(alarmSeconds / 45, 1))

Tracking (25 points)
  = 25 · (1 − min(trackingLoss, 1))
  where (without gas):
    trackingLoss = min(MAE_combined / 15, 1)
    MAE_combined = 0.5 · MAE_total + 0.5 · MAE_interface
  where (with gas):
    trackingLoss = (2 · liquid_tracking + pressure_tracking) / 3
    pressure_tracking = min(MAE_pressure / 1.5, 1)

Stability (15 points)
  = 15 · (1 − min(stabilityLoss, 1))
  where (without gas):
    stabilityLoss = min(σ_combined / 8, 1)
    σ_combined = 0.5 · σ_total + 0.5 · σ_interface
  where (with gas):
    stabilityLoss = (2 · liquid_stability + pressure_stability) / 3
    pressure_stability = min(σ_pressure / 1, 1)
  (σ = standard deviation of error in final 60 seconds)

Recovery (15 points)
  = 15 · (1 − min(recoverySeconds / 90, 1))

Valve Efficiency (10 points, liquid valves only)
  = 6 · (1 − min(travelLoss, 1)) + 4 · (1 − min(saturationLoss, 1))
  where travelLoss = 0.5 · (oil_travel / 300) + 0.5 · (water_travel / 300)
        saturationLoss = 0.5 · (oil_saturation / 45) + 0.5 · (water_saturation / 45)
```

**Pressure loop sharing:** Holding liquid level while pressure swings widely is not
control—it is luck. When a pressure loop is present, both liquid tracking and
stability share their budgets (2/3 weight) with the pressure loop (1/3 weight). This
prevents an operator from appearing skillful on level by neglecting pressure
disturbances, and prevents an otherwise brilliant pressure loop from masking poor
level control.

### Loop-specific targets and alarms

| Loop | Setpoint | Target Band | Low Alarm | High Alarm | Low Low | High High |
|------|----------|-------------|-----------|------------|---------|-----------|
| Total level | 50% | ±5% (45–55%) | 25% | 75% | 10% | 90% |
| Interface | 20% | ±3% (17–23%) | 8% | 35% | 3% | 45% |

- **Alarm time**: accumulates when either loop is outside its alarm band.
- **Target band time**: counted separately; recovers when *both* loops remain in target
  band for ≥10 continuous seconds after disturbance end.
- **Recovery score**: zero if recovery never achieved; otherwise, score based on time from
  disturbance end to first qualifying settlement.

## Modifiers (additional penalties)

Penalties are applied for specific performance failures:

| Condition | Penalty | Label |
|-----------|---------|-------|
| Any trip (LL/HH) | 0 points (cap at 35) | Trip cap |
| Total level sustained oscillation | −5 | Total level sustained oscillation |
| Interface sustained oscillation | −5 | Interface sustained oscillation |
| **Pressure sustained oscillation** (with gas) | **−5** | **Pressure sustained oscillation** |
| Oil valve saturation > 30 s | −4 | Oil valve long saturation |
| Water valve saturation > 30 s | −4 | Water valve long saturation |
| **Gas valve saturation > 30 s** (with gas) | **−4** | **Gas valve long saturation** |
| Oil valve travel > 300 percentage points | −2.5 | Excessive oil valve travel |
| Water valve travel > 300 percentage points | −2.5 | Excessive water valve travel |
| **Gas valve travel > 300 percentage points** (with gas) | **−2.5** | **Excessive gas valve travel** |
| Total level integral limit > 10 s | −2.5 | Total level integral limit |
| Interface integral limit > 10 s | −2.5 | Interface integral limit |
| **Pressure integral limit > 10 s** (with gas) | **−2.5** | **Pressure integral windup** |

### Oscillation definition

Sustained oscillation requires *both*:
- At least 6 zero crossings of loop error in the final 60 seconds.
- Peak-to-peak error **in the same units as the setpoint**:
  - **Total level**: ≥ 8 percentage points in final 60 s
  - **Interface**: ≥ 6 percentage points in final 60 s
  - **Pressure** (with gas): ≥ 4 bar(g) in final 60 s

### Saturation and travel definitions

- **Saturation**: time when valve command is within 0.5% of either limit (0% or 100%).
- **Travel**: sum of absolute changes in valve position across all samples.
- **Integral limit**: time when the integral term is pinned at ±`integralLimit` due to
  anti-windup.

## Final score computation

```text
uncapped = Safety + Tracking + Stability + Recovery + Valve Efficiency + modifiers
maximum = trip ? 35 : 100
score = round(clamp(uncapped, 0, maximum))
```

## Diagnostic and coaching

The result screen automatically generates a **diagnosis** and **suggestion** based on the
dominant loss or first active modifier:

- **Trip feedback**: specific to the trip kind (e.g., TOTAL_LL, INTERFACE_HH, PRESSURE_HH, etc.).
- **Modifier feedback**: addresses the largest penalty (e.g., sustained oscillation,
  saturation, travel).
- **Base feedback**: if no modifiers apply, identifies the largest normalized loss
  (safety, tracking, stability, recovery, or valve efficiency) and suggests a tuning
  direction.
- **Pressure feedback** (when gas is enabled): a dedicated `{ kind: "pressure" }` code
  signals that the pressure loop performance is limiting the score, separate from
  liquid-level coaching.

Examples:

| Event | Diagnosis | Suggestion |
|-------|-----------|-----------|
| TOTAL_HH trip | Total level high-high trip | Retune the total level loop so the oil valve opens sooner and preserves margin. |
| Total oscillation > threshold | Total level sustained oscillation | Reduce Kp or Ki in the total level loop before adding filtered derivative action. |
| MAE_total large | Total level tracking error dominates | Increase Kp gradually in the total level loop, then add modest Ki for offset. |
| PRESSURE_HH trip (with gas) | Separator pressure high-high trip | Retune the pressure loop to open the gas valve sooner and reduce back-pressure buildup. |
| Pressure oscillation > 4 bar(g) | Pressure sustained oscillation | Reduce Kp or increase τ_d (derivative filter) in the pressure loop to damp chatter. |
| Pressure feedback code | Pressure loop performance limits score | Focus on pressure setpoint tracking before adding derivative action on a fast measurement. |

## Rank scale

| Score Range | Rank |
|-------------|------|
| 90–100 | Separator Control Master |
| 75–89 | Loop Tuning Specialist |
| 60–74 | Process Engineer |
| 40–59 | Control Technician |
| 0–39 | Trainee Operator |

No LLM or external service is used to generate feedback.
