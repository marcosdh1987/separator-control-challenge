# Educational Physical Model

## Purpose

The model creates a credible, responsive two-phase level-control problem for a game. It is
not a digital twin and must not be used for field operation, equipment sizing,
safety analysis, or controller deployment.

## Vessel geometry and inventory

The separator is a horizontal cylinder with diameter `D = 1.2 m`, length `L = 3.0 m`.
For radius `r = D/2` and height `h`, the filled cross-sectional area is:

```text
A(h) = r² arccos((r − h)/r) − (r − h)√(2rh − h²)
V(h) = L · A(h)
```

Volume is recovered from level by bounded bisection over 60 iterations. The vessel's full
volume is `V_full = π r² L ≈ 3.393 m³`.

### Two-phase inventory model

The vessel contains two incompressible phases with distinct densities:

- **Oil**: density ρ_oil = 850 kg/m³ (default, configurable)
- **Water**: density ρ_water = 1000 kg/m³ (default, configurable)

Level is partitioned into:
- **Total level** (% of vessel height): height of combined oil + water
- **Interface level** (% of vessel height): height of the water phase measured from vessel bottom

The oil layer height is `h_oil = h_total − h_interface`. Both inventory masses advance
at fixed `dt = 0.05 s`:

```text
V_oil(k+1)   = clamp(V_oil(k) + (Q_oil_in − Q_oil_out) · dt/3600, 0, V_oil_max)
V_water(k+1) = clamp(V_water(k) + (Q_water_in − Q_water_out) · dt/3600, 0, V_water_max)
```

where `V_oil_max + V_water_max ≤ V_full`. If combined volume exceeds capacity, inlet flows
are rationed proportionally to their requested rates.

### Inlet feed splitting

The inlet feed of total flow `Q_total` and water cut fraction `w_cut ∈ [0, 1]` is split:

```text
Q_oil_in = Q_total · (1 − w_cut)
Q_water_in = Q_total · w_cut
```

## Outlet valves and actuators

Two outlet valves (one per phase) follow reverse-acting proportional-to-flow logic. Each
valve opening `x_v ∈ [0, 100]%` commands a flow:

```text
Q_out = capFactor · Q_rated · (x_v/100) · √(ΔP/ΔP_ref)
```

where `ΔP_ref = 100 kPa` is the reference differential pressure (at setpoint levels).

The actual differential pressure includes the hydrostatic heads of both phases:

```text
ΔP_oil = ΔP0 + ρ_oil · g · h_oil
ΔP_water = ΔP0 + g · (ρ_water · h_water + ρ_oil · h_oil)
```

with `ΔP0 = 100 kPa` (vessel back-pressure or outlet datum) and `g = 9.80665 m/s²`.
Note that water's pressure includes the weight of the oil layer above it.

Reference pressures are computed at the setpoint levels (`h_total_SP = 50%`, `h_interface_SP = 20%`):

```text
ΔP_ref_oil = ΔP0 + ρ_oil · g · (50 − 20)% · D
ΔP_ref_water = ΔP0 + g · (ρ_water · 20% · D + ρ_oil · (50−20)% · D)
```

### Valve nomenclature

- **LV-101** (level control valve, oil outlet): controlled by the total-level PID loop (LIC-101)
- **WV-101** (water interface valve): controlled by the interface-level PID loop (IIC-101)

### Actuator dynamics

Each valve stem follows a first-order low-pass filter (time constant `τ_actuator`, default 3 s)
and a stroke-rate limit (default 20 %/s), clamped to [0, 100]%:

```text
τ · dx_v/dt = u − x_v
x_v_saturated = clamp(x_v, x_v_prev − rate_limit · dt, x_v_prev + rate_limit · dt)
x_v = clamp(x_v_saturated, 0, 100)
```

Scenario definitions may override `τ_actuator` per valve (e.g., `slow-water-dump` sets water τ = 12 s).

## Two-phase PID control

### Control loops

Two independent feedback loops maintain separate levels:

| Loop | ID | Sensor | Valve | Setpoint | Band | Actuator |
|------|----|----|-------|----------|------|----------|
| Total level | LIC-101 | Total level (%) | LV-101 (oil) | 50% | ±5% | 3 s default |
| Interface | IIC-101 | Interface level (%) | WV-101 (water) | 20% | ±3% | 3 s default |

Each loop runs a reverse-acting parallel PID controller:

```text
e = PV − SP
P = K_p · e
I = K_i · ∫e dt
D = K_d · filt(de/dt)
u = bias + P + I + D
```

with default gains `K_p = 4`, `K_i = 0.08`, `K_d = 8`, sample time `T_s = 0.2 s`, and
integral limit `I_limit = 40` (clamped integral contribution).

The output clamps to [0, 100]% after all three terms sum. **Anti-windup:** conditional
integration freezes the integral when the proposed output is already saturated (at its min
or max) and the current error would drive it farther into saturation. Once the error
reverses, the integral unwinds to allow recovery.

**Derivative filtering:** raw measurement derivative `de_raw/dt` is smoothed with a
first-order filter (time constant `τ_d = 1 s`) to avoid derivative kick:

```text
filt(de/dt) = α · filt_prev + (1 − α) · de_raw/dt
α = τ_d / (τ_d + T_s)
```

This filtered derivative acts only on measurement, not on error, reducing measurement-noise
amplification.

### Measurement model

Level sensors (one for total, one for interface) employ a deterministic sample-and-hold
model:

1. At each sample interval (default 0.2 s per sensor), measure the true level.
2. Apply seeded bounded-uniform noise: `noise ∼ U(−σ_sensor, +σ_sensor)` where `σ_sensor`
   is configurable per sensor (default 0% for both).
3. Hold the noisy value until the next sample.

The PRNG is seeded per scenario to ensure repeatability. The PID receives the held measured
value; the true level is used for metrics and scoring.

## Safety trips

The run terminates if any of the following thresholds are violated:

- **TOTAL_LL**: Total level ≤ 10% (vessel risks running dry)
- **TOTAL_HH**: Total level ≥ 90% (vessel risks overflow)
- **INTERFACE_LL**: Interface level ≤ 3% (water layer risks collapse)
- **INTERFACE_HH**: Interface level ≥ 45% (oil layer risks collapse into water)
- **OIL_LAYER_LL**: Oil layer height ≤ 5% (oil fails to maintain minimum operational thickness)

Any trip caps the final score at 35 points and generates a diagnosis/suggestion.

## Gas cap and pressure control

When enabled by the configuration, a gas dome sits above the liquid inventory and
maintains a backpressure through a proportional control loop. This section describes
its model, integration, and control.

### Gas cap state and thermodynamics

The gas cap contains `n` moles of hydrocarbon gas at fixed temperature `T_c`. Its
volume is the vessel space left by the liquid phases:

```text
V_gas = V_full − V_liquid = V_full − (V_oil + V_water)
```

A lower bound `V_min = 0.01 · V_full` prevents numerical singularities if liquid rises
excessively. The gas pressure is computed from the real-gas law:

```text
P = (n · R · T_c · Z) / V_gas
```

where `R = 8.314462618 J/(mol·K)` is the universal gas constant, `Z` is the
compressibility factor, and pressures are in bar absolute.

### Compressibility factor (Dranchuk & Abou-Kassem, 1975)

The eleven-constant Dranchuk–Abou-Kassem (1975) correlation is solved by fixed-point
iteration on reduced density. Pseudo-critical pressures and temperatures are
calculated using Sutton (1985) correlations for associated and wet gases:

```text
P_pc (psia) = 756.8 − 131·γ_g − 3.6·γ_g²
T_pc (°R) = 169.2 + 349.5·γ_g − 74·γ_g²
```

where `γ_g` is gas gravity (air = 1). The correlation is valid for
`0.2 ≤ P_r ≤ 30` and `1.0 ≤ T_r ≤ 3.0`, and returns `Z = 1` outside these bounds.
Z is clamped to `[0.2, 1.2]` to reject unphysical solutions.

### Gas valve and outlet flow (IEC 60534-2-1 / ISA-75.01.01)

Gas exits through a single proportional backpressure valve with metric flow coefficient `Kv`.
The compressible flow is sized using the IEC standard mass form:

```text
ṁ_gas = IEC_N6 · Kv · x_v · Y · √(Δx · P_upstream · ρ_upstream)
```

where:
- `IEC_N6 = √1000 ≈ 31.62` (metric Kv constant)
- `x_v ∈ [0, 1]` is valve opening fraction (commanded by the pressure loop)
- `Y` is the compressible expansion factor
- `Δx = P_upstream − P_downstream` is the pressure differential
- `ρ_upstream` is the upstream (gas cap) density in kg/m³

Real-gas density is:

```text
ρ = (P · M_g) / (Z · R · T)
```

where `M_g = γ_g · 0.02896 kg/mol` is the gas molar mass.

**Choked flow saturation:** Above a threshold pressure ratio, sonic conditions set in
and the flow saturates. The effective pressure ratio is:

```text
x_effective = min(x, x_choked)
where x_choked = F_γ · x_T
F_γ = γ_specific_heat / 1.4
x_T = 0.7 (globe valve reference)
```

Once choked, flow becomes proportional to upstream pressure alone, which is the
self-stabilizing property that the semi-implicit update exploits.

### Semi-implicit molar balance and sub-stepping

The gas cap is integrated on a finer grid than the 0.05 s physics step because
pressure responds much faster than level. Each 0.05 s step is split into
`GAS_SUBSTEPS = 10` sub-steps of 0.005 s each.

The molar balance uses a linearized backward-Euler (semi-implicit) scheme:

```text
ṅ = inlet_rate − outlet_rate
n_{k+1} = (n_k + inlet · Δt) / (1 + outflow_per_mole · Δt / 3600)
```

where `outflow_per_mole = outlet_molar_rate / n_k`. This implicit solve is
unconditionally stable and is essential: an explicit update can overshoot past zero
within a single sub-step when the valve is wide open, which manifests on screen as
the separator pressure collapsing instantly. The implicit solve instead relaxes
smoothly toward whatever equilibrium the inflow and outflow support.

**Why:** gas is stiffer than liquids. With `GOR ≈ 120 Sm³/m³` at a 35 m³/h oil feed,
inflow is about 4200 Sm³/h of gas. The valve design-duty Kv is sized so that mid-travel
drains approximately the design inflow, leaving servo authority in both directions; but
at wide-open travel the outlet rate can exceed steady inflow by 10–50×, making the
explicit scheme unstable over 5 ms steps.

### Gas inlet and GOR disturbances

Gas enters the cap from the oil outlet stream according to the feed gas-oil ratio (GOR):

```text
inlet_Sm3/h = oil_inlet_flow_m3/h · GOR · scenario_gorFactor
```

where `scenario.gorFactor` multiplies the base GOR for test scenarios. At time `t ≥ 40 s`
in the `gor-surge` scenario, `gorFactor` jumps to 1.6, doubling gas inflow and forcing
the pressure loop to manage a sustained disturbance without changing level setpoints.

### Coupling with liquid inventory

The gas balance is integrated **after** the liquid balance because the cap volume
depends on what the liquid balance leaves behind. This sequential coupling is
physically natural: liquid drains or fills first, then gas pressure adjusts to fill
the available space. It also simplifies implementation and testing, as the three-loop
state can be stepped deterministically.

### Default parameters

| Parameter | Symbol | Value | Unit | Note |
|-----------|--------|-------|------|------|
| Gas-oil ratio | GOR | 120 | Sm³/m³ | Typical dry gas well |
| Gas gravity | γ_g | 0.72 | — | Near-dry C1–C2 mix |
| Cap temperature | T_c | 45 | °C | Fixed isothermal |
| Initial pressure | P_0 | 9 | bar(a) | Modest well-testing pressure |
| Valve flow coefficient | Kv | 55 | metric | See sizing note below |
| Downstream (header) pressure | P_ds | 2 | bar(a) | Outlet datum |
| Setpoint | SP | 8 | bar(g) | Operator target |
| Control band | ±δ | ±0.4 | bar(g) | Tolerance |
| Low alarm | — | 6 | bar(g) | Early warning |
| High alarm | — | 10 | bar(g) | Early warning |
| Low low (trip) | — | 4 | bar(g) | Safety shut-in |
| High high (trip) | — | 12 | bar(g) | Safety relief |

### Valve sizing rationale

The default `Kv = 55` metric is chosen so that design-duty gas flow (35 m³/h oil ×
120 GOR = 4200 Sm³/h gas at separator conditions) exits near mid-valve travel,
typically 50–60%. This leaves control authority in both directions and is the
signature of a correctly sized valve. The counter-example is an oversized valve that
can only cycle between shut and fully open, offering no stable intermediate position.
At design duty with Kv = 55, the valve sees a choked expansion and is stable; if Kv
were 4000, the same duty would barely crack the valve open, and tuning would be a
guessing game.

### Pressure protection and trips

Two digital limits stop the run if pressure strays outside safe bounds:

```text
trip = PRESSURE_HH if P_gauge ≥ highHigh  (typically 12 bar(g))
trip = PRESSURE_LL if P_gauge ≤ lowLow    (typically 4 bar(g))
```

Pressure alarms (low and high) appear in the safety state when a liquid trip is not
in progress, following the rule that slower disturbances (liquid) remain the headline
once declared.

## Explicit exclusions

This model intentionally omits:

- Flash and VLE calculations; all gas leaves in the dome, no dissolved gas in liquid.
- Carry-over (liquid entrainment) or carry-under (gas bubbles below interface).
- Coalescence, emulsification, rag layers, or real separation kinetics.
- Variable density with pressure or composition.
- Temperature effects, heat transfer, or thermal stability.
- Pipe-network hydraulics, non-ideal valve discharge coefficients, or relief devices.
- Pressure safety instrumented systems or voting logic.
- Real transmitter calibration, hysteresis, or sensor fusion.
- Actuator hysteresis, stiction, or failure modes.
- SIL, LOPA, or safety-system analysis.
- Real equipment sizing validation, maintenance intervals, or field calibration.
- Any validation for an operating facility or well-test unit.
