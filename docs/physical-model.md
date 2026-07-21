# Educational Physical Model

## Purpose

The model creates a credible, responsive level-control problem for a game. It is
not a digital twin and must not be used for field operation, equipment sizing,
safety analysis, or controller deployment.

## Vessel inventory

The vessel is a horizontal cylinder with diameter `D = 1.2 m`, length `L = 3.0 m`,
and one incompressible liquid of density `rho = 850 kg/m3`.

For radius `r = D/2` and liquid height `h`, the filled cross-sectional area is:

```text
A(h) = r^2 acos((r-h)/r) - (r-h) sqrt(2 r h - h^2)
V(h) = L A(h)
```

Level is recovered from volume by bounded bisection. Inventory advances at a
fixed `dt = 0.05 s`:

```text
V(k+1) = clamp(V(k) + (Qin - Qout) dt / 3600, 0, Vfull)
```

Flows are displayed in `m3/h`; volume and integration remain SI internally.

## Outlet valve and actuator

The generic valve flow is:

```text
Qout = capacityFactor * 100 * (xv / 100)
       * sqrt((dP0 + rho g h) / (dP0 + rho g hSP))
```

`dP0 = 1 bar`, `g = 9.80665 m/s2`, and the denominator normalizes the valve at
the 50% setpoint. The nominal equilibrium is `Qin = Qout = 50 m3/h`.

The stem follows an exact first-order update, then a `20 %/s` travel-rate limit,
and is clamped to 0-100%. Nominal actuator lag is 3 s.

The valve-delay challenge raises the actuator time constant to 12 s and applies a
50-to-70 m3/h inlet step at 30 s. The shared excitation makes its slower stem
response observable against the nominal inlet-step challenge.

## PID and measurement

The dump valve is reverse acting: a level above setpoint produces a larger valve
command. The controller uses proportional action, a limited integral contribution,
and a filtered derivative on measurement. Conditional integration prevents the
integral from driving farther into output saturation.

A seeded bounded-uniform error is applied at the transmitter sample period and
held between samples. The process truth is used for scoring; the PID receives the
measured value.

## Explicit exclusions

- Separate oil, water, and gas phases or an oil/water interface.
- Gas-cap pressure, compressibility, flashing, foaming, or entrainment.
- Heat and mass transfer, chemistry, emulsions, or variable density.
- Pipe-network hydraulics, valve sizing, relief devices, trips, or SIL analysis.
- Real transmitter, PLC, actuator, or equipment behavior.
- Validation for any operating facility.
