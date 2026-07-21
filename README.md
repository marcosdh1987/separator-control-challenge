# Separator Control Challenge

Separator Control Challenge is a browser game about tuning a PID level-control
loop. Keep a simplified horizontal separator near its setpoint while deterministic
flow, valve, and instrument disturbances stress the controller.

The simulator is deliberately educational. It is **not** suitable for field
operation, equipment sizing, safety-system design, or real process control.

## Highlights

- Fixed-step, deterministic simulation running entirely in a Web Worker.
- Six repeatable scenarios, from steady flow to a liquid slug.
- PID saturation, anti-windup, derivative filtering, actuator lag, and noise.
- A transparent 100-point score with deterministic coaching.
- Responsive industrial dashboard with synchronized trend charts.

## Run locally

Requirements: Node.js 20.19+, 22.13+, or 24+, npm, Python 3.11, `uv`, and Make.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Run all read-only quality gates with:

```bash
make check
```

The full CI-equivalent gate also runs the Playwright desktop and mobile flows:

```bash
npx playwright install chromium
make ci
```

## Documentation

- [Implementation plan](PLAN.md)
- [Physical model](docs/physical-model.md)
- [Scoring](docs/scoring.md)

The Python package in `src/separator_control_challenge/` supports repository
governance and agent tooling only. It is not part of the browser runtime.

## Privacy and independence

The application uses independently written, generic educational equations and
parameters. It has no runtime or build-time dependency on private engineering
repositories, documentation, services, data, or credentials.
