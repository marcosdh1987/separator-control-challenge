import type { BriefingStep, LandingMessages } from "../en/landing";

export const landing: LandingMessages = {
  skipToMission: "Ir a la misión",

  header: {
    // The product name is not translated, so only the surrounding words are.
    homeLabel: "Inicio de Separator Control Challenge",
    eyebrow: "Laboratorio de control de procesos / desafío 01",
    disclaimerTitle: "Simulador educativo",
    disclaimerDetail: "No apto para operación en campo ni dimensionamiento de equipos",
  },

  hero: {
    eyebrow: "Separador trifásico / briefing del operador",
    headline: "¿Podés mantener estable un separador trifásico?",
    description:
      "Sintonizá dos lazos de control PID, superá perturbaciones realistas de ensayo de pozo y mantené el proceso dentro de su envolvente segura de operación.",
    visualLabel: "Presentación estática del separador",
    visualTag: "SEP-101 / OPERACIÓN NORMAL / VISUAL EN REPOSO",
  },

  cta: {
    startTraining: "Empezar el entrenamiento guiado",
    enterControlRoom: "Entrar a la sala de control",
  },

  briefing: {
    label: "Briefing del desafío",
    steps: [
      {
        title: "Sintonizá",
        description: "Ajustá las ganancias PID de petróleo y agua antes de que llegue la perturbación.",
      },
      {
        title: "Sobreviví",
        description: "Leé los inventarios acoplados y sostené la envolvente de seguridad.",
      },
      {
        title: "Sumá puntaje",
        description: "Terminá un intento determinístico e inspeccioná la respuesta del control.",
      },
    ] satisfies readonly BriefingStep[],
    controlNote: {
      eyebrow: "Relaciones de control",
      title: "Dos válvulas, dos inventarios acoplados.",
      oilValve: "La válvula de salida de petróleo controla el nivel total de líquido.",
      waterValve: "La válvula de salida de agua controla la interfase petróleo/agua.",
      goal: "Mantené el nivel total cerca del 50%, la interfase cerca del 20% y protegé la envolvente de operación.",
    },
  },

  training: {
    eyebrow: "Entrenamiento guiado",
    headline: "El entrenamiento guiado está en preparación.",
    description: "Aprendé los controles del separador paso a paso antes de encarar un desafío puntuado.",
  },
};
