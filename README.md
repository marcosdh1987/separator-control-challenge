# Separator Control Challenge

Separator Control Challenge is a browser game about tuning a PID level-control
loop. Keep a simplified horizontal separator near its setpoint while deterministic
flow, valve, and instrument disturbances stress the controller.

The simulator is deliberately educational. It is **not** suitable for field
operation, equipment sizing, safety-system design, or real process control.

## Highlights

- Interactive 3D visualization of a simplified three-phase separator.
- Two coupled PID loops controlling total liquid level and oil/water interface.
- Fixed-step, deterministic simulation running entirely in a Web Worker.
- Six repeatable scenarios, from steady flow to a water-rich liquid slug.
- PID saturation, anti-windup, derivative filtering, actuator lag, and noise.
- Transparent 100-point scoring with deterministic engineering feedback.
- Guided onboarding, training flow, and synchronized process trends.
- No backend, external API, account, or runtime AI required.

## Built with GPT-5.6 and Codex

Separator Control Challenge was created during the OpenAI Build Week using
GPT-5.6 and Codex as AI-assisted engineering tools.

GPT-5.6 was used to:

- turn the initial industrial-control concept into a focused product;
- define the gameplay and onboarding experience;
- reason about the reduced-order physical model;
- refine PID-control explanations and scoring requirements;
- review visual design and usability decisions;
- prepare the demo script and English voice-over.

Codex was used as the primary implementation agent to:

- inspect the engineering requirements;
- implement the deterministic simulation engine;
- build the two PID control loops;
- create the Three.js separator visualization;
- develop the landing page, guided training, and control-room interface;
- add scenarios, scoring, tests, accessibility, and deployment support;
- iterate from prompts, screenshots, test results, and engineering feedback.

Human engineering judgment was used to define the physical simplifications,
validate the process behavior, review the generated code, and decide whether
the controller responses were technically meaningful.

The final application does not use AI at runtime. GPT-5.6 and Codex were used
to build the product, while the deployed simulator runs deterministically and
entirely in the browser.

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
