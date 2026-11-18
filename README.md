# Separator Control Challenge

*Léelo en [español](#separator-control-challenge-en-español).*

An open training environment for three-phase separator control. Tune the loops on a
simplified horizontal separator and watch what happens when the feed steps, a slug
arrives, an instrument gets noisy, or the well starts making more gas, with nothing
real at stake.

Separator Control Challenge originally started during OpenAI Build Week and
continued evolving afterwards as an independent educational project.

It is built for people who work on or around well testing: operators, technicians,
and engineers who want to see *why* a loop behaves the way it does before they meet
it in the field.

The simulator is deliberately educational. It is **not** suitable for field
operation, equipment sizing, safety-system design, or real process control. What it
does and does not represent is stated plainly in the [model card](docs/model-card.md).

## Highlights

- **A seven-lesson course** at `/training`: each lesson isolates one idea, gives you
  a separator that shows it, and grades what you actually achieved. Includes a
  presentation mode for teaching in front of a class.
- **Bilingual, English and Spanish**, detected from the browser and switchable at any
  time — including all the teaching material.
- **Cold-start realism**: every run begins empty, well shut in, valves closed. The feed ramps in
  over 15 seconds and protection logic arms as signals reach normal ranges — no equilibrium magic.
- **Live well control**: close or open the well during a run to test loop response and see why
  tight control is the margin against a trip.
- **Three coupled control loops**: total liquid level, oil/water interface, and
  optionally gas-cap pressure, which is where trainees first meet loop interaction.
- **Real-gas thermodynamics** for the pressure loop: compressibility from Dranchuk &
  Abou-Kassem, valve flow to IEC 60534-2-1, integrated semi-implicitly.
- **Deterministic**: fixed 0.05 s step in a Web Worker, seeded scenarios, golden runs
  asserted in CI. The same seed always produces the same run.
- **Honest failure modes**: saturation, integral windup, derivative amplifying sensor
  noise, and a slug that a purely reactive controller cannot fully catch.
- Interactive 3D view of the vessel with a P&ID diagram alternative.
- **Research Lab** at `/research`: replay recorded runs of the author's eng_dacs research
  simulator (a separate, higher-fidelity model), accelerated up to ×50, with the 3D scene,
  a technical P&ID view, synchronized charts, controller comparisons and an operating-envelope
  explorer. Read-only and static: the data is exported offline and verified bit for bit.
- No backend, no account, no telemetry, and no AI at runtime.

## Using it in a course

The `/training` route is the guided path: seven lessons, roughly 90 minutes end to
end, each with a short theory section, an exercise with a fixed scenario, and a
debrief that reports what was measured against what the lesson asked for.

Progress is stored in the trainee's own browser and is never sent anywhere. If you
are teaching and want to collect results, ask trainees to use **Export progress** —
it produces a small JSON file with attempts, best score, and time to first attempt
per lesson.

**Presentation mode** on any lesson strips the interface down for projection and
lets you reveal the task when you are ready.

The `/challenge` route is the free-play simulator, for people who would rather
explore than be led.

## Built with GPT-5.6 and Codex

Separator Control Challenge was started during OpenAI Build Week and continued
afterwards using GPT-5.6 and Codex as AI-assisted engineering tools.

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

## Author

Created and maintained by Marcos Esteban Soto.

- Portfolio: <https://marcosdh1987.github.io/cv/>
- LinkedIn: <https://www.linkedin.com/in/marcosesoto/>
- ORCID: <https://orcid.org/0009-0000-5787-5965>
- GitHub: <https://github.com/marcosdh1987>
- Repository: <https://github.com/marcosdh1987/separator-control-challenge>

This is an independent educational simulator. It is not certified, industrially
validated, or suitable for field operation, equipment sizing, safety analysis, or
real process control.

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

- [Model card](docs/model-card.md) — what the simulator represents, and what it does not
- [Research Lab](docs/research-lab.md) — replay contract, export procedure, design and limitations
- [Physical model](docs/physical-model.md) — equations, correlations and defaults
- [Scoring](docs/scoring.md) — how a run is judged
- [Internationalisation](docs/i18n.md) — how the bilingual layer works
- [Architecture decisions](docs/adr/) — why the simulation runs where it does
- [Implementation plan](PLAN.md)

The Python package in `src/separator_control_challenge/` supports repository
governance and agent tooling only. It is not part of the browser runtime.

## Privacy and independence

The application uses independently written, generic educational equations and
parameters. It has no runtime or build-time dependency on private engineering
repositories, documentation, services, data, or credentials.

## Contributing

Issues and pull requests are welcome, particularly from people who run well tests
for a living: a lesson that does not match field reality is a bug worth reporting.

Before opening a pull request, run `make check`. It is read-only and covers linting,
type checking, unit tests and the production build. `make ci` additionally runs the
Playwright flows.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).

---

# Separator Control Challenge (en español)

Un entorno abierto de entrenamiento en control de separadores trifásicos. Sintoniza
los lazos de un separador horizontal simplificado y observa qué pasa cuando la
alimentación da un escalón, llega un slug, un instrumento se pone ruidoso o el pozo
empieza a producir más gas, sin nada real en juego.

Está hecho para personas que trabajan en well testing o alrededor: operadores,
técnicos e ingenieros que quieren entender *por qué* un lazo se comporta como se
comporta antes de encontrárselo en el campo.

Separator Control Challenge comenzó durante OpenAI Build Week y continuó
desarrollándose después como un proyecto educativo independiente.

El simulador es deliberadamente educativo. **No** sirve para operar en campo,
dimensionar equipos, diseñar sistemas de seguridad ni para control de procesos real.
Lo que representa y lo que no está dicho sin vueltas en el
[model card](docs/model-card.md).

## Para usarlo en un curso

La ruta `/training` es el camino guiado: siete lecciones, unos 90 minutos en total,
cada una con una parte de teoría breve, un ejercicio con escenario fijo, y un cierre
que informa qué se midió contra lo que la lección pedía.

El progreso se guarda en el navegador de cada persona y no se envía a ningún lado. Si
estás dando el curso y quieres juntar resultados, pídeles que usen **Exportar
progreso**: genera un JSON chico con intentos, mejor puntaje y tiempo hasta el primer
intento por lección.

El **modo presentación** de cada lección deja la interfaz limpia para proyectar y te
permite revelar la tarea cuando quieras.

La ruta `/challenge` es el simulador libre, para quien prefiera explorar en vez de
que lo lleven de la mano.

La ruta `/research` es el **Research Lab**: reproduce corridas registradas en eng_dacs,
el simulador de investigación del autor (un modelo distinto y de mayor fidelidad), con
vista 3D, vista técnica P&ID, gráficos sincronizados, comparación de controladores y un
explorador de la envolvente operativa. Es de solo lectura: los datos se exportan fuera
de línea, se verifican bit a bit y no son datos de campo ni un sistema de control
industrial validado.

## Autor

Creado y mantenido por Marcos Esteban Soto.

- Portfolio: <https://marcosdh1987.github.io/cv/>
- LinkedIn: <https://www.linkedin.com/in/marcosesoto/>
- ORCID: <https://orcid.org/0009-0000-5787-5965>
- GitHub: <https://github.com/marcosdh1987>
- Repositorio: <https://github.com/marcosdh1987/separator-control-challenge>

Este es un simulador educativo independiente. No está certificado ni validado
industrialmente, y no es apto para operación en campo, dimensionamiento de equipos,
análisis de seguridad ni control de procesos real.

## Para correrlo

```bash
npm install
make run-dev
```

Abre <http://localhost:3000> automáticamente.

## Contribuir

Las issues y los pull requests son bienvenidos, especialmente de gente que hace
pruebas de pozo a diario: una lección que no coincide con la realidad de campo es un
bug que vale la pena reportar.
