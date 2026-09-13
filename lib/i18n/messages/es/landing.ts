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
    headline: "¿Puedes mantener estable un separador trifásico?",
    description:
      "Sintoniza dos lazos de control PID, supera perturbaciones realistas de ensayo de pozo y mantén el proceso dentro de su envolvente segura de operación.",
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
        title: "Sintoniza",
        description: "Ajusta las ganancias PID de petróleo y agua antes de que llegue la perturbación.",
      },
      {
        title: "Resiste",
        description: "Lee los inventarios acoplados y sostén la envolvente de seguridad.",
      },
      {
        title: "Suma puntaje",
        description: "Completa un intento determinista e inspecciona la respuesta del control.",
      },
    ] satisfies readonly BriefingStep[],
    controlNote: {
      eyebrow: "Relaciones de control",
      title: "Dos válvulas, dos inventarios acoplados.",
      oilValve: "La válvula de salida de petróleo controla el nivel total de líquido.",
      waterValve: "La válvula de salida de agua controla la interfase petróleo/agua.",
      goal: "Mantén el nivel total cerca del 50%, la interfase cerca del 20% y protege la envolvente de operación.",
    },
  },

  about: {
    eyebrow: "Nota del proyecto / autoría",
    title: "Sobre este proyecto",
    description:
      "Separator Control Challenge es un proyecto educativo independiente desarrollado por Marcos Esteban Soto, que combina well testing y control de procesos industriales con trabajo actual en machine learning y sistemas industriales inteligentes.",
    aiNote:
      "Fue desarrollado mediante ingeniería asistida por IA utilizando GPT-5.6 y Codex. Las hipótesis de proceso, simplificaciones físicas, comportamiento de los lazos y contenido educativo fueron definidos y revisados utilizando criterio de ingeniería.",
    invitation: "¿Te interesa conversar sobre IA industrial, control de procesos, investigación o uso educativo?",
    links: {
      author: "Sobre el autor",
      linkedin: "LinkedIn",
      orcid: "Investigación / ORCID",
      github: "GitHub",
      repository: "Repositorio",
    },
  },

  training: {
    eyebrow: "Entrenamiento guiado",
    headline: "El entrenamiento guiado está en preparación.",
    description: "Aprende los controles del separador paso a paso antes de encarar un desafío puntuado.",
  },
};
