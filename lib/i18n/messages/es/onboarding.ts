import type {
  MissionValveCopy,
  OnboardingMessages,
  PresetCopy,
  TourStepCopy,
} from "../en/onboarding";
import type { PidPresetId, TourTargetId } from "@/lib/onboarding/types";
import type { PhaseId } from "@/lib/simulation/types";

/** Neutral Latin American Spanish, professional register, for every instruction given to the trainee. */
export const onboarding: OnboardingMessages = {
  quickStart: {
    eyebrow: "Primera visita a la sala de control",
    title: "Tu misión",
    startGuidedTour: "Empezar la visita guiada",
    skipAndPlay: "Omitir e ir al simulador",
    dontShowAgain: "No mostrar de nuevo",
  },

  mission: {
    objective:
      "Mantén el nivel total cerca del 50% y la interfase petróleo/agua cerca del 20% mientras el proceso se perturba.",
    valve: {
      oil: {
        term: "Válvula de petróleo LV-101",
        definition: "Extrae petróleo para corregir el nivel total de líquido.",
      },
      water: {
        term: "Válvula de agua WV-101",
        definition: "Extrae agua para corregir la interfase.",
      },
    } satisfies Record<PhaseId, MissionValveCopy>,
    gainsLockNote:
      "Las ganancias se bloquean al iniciar el intento, así que sintoniza antes de correr.",
    howToPlayLabel: "Cómo funciona",
    howToPlaySteps: [
      "Elige un escenario.",
      "Ajusta las ganancias del PID.",
      "Inicia el intento.",
      "Sigue los niveles, las válvulas y la seguridad.",
      "Vuelve a intentar con lo que aprendiste.",
    ],
  },

  tour: {
    eyebrow: "Guía de sala de control",
    skip: "Omitir",
    back: "Atrás",
    next: "Siguiente",
    finish: "Finalizar",
    progress: (current, total) => `Paso ${current} de ${total}`,
    step: {
      "scenario-selector": {
        title: "Selector de escenario",
        description:
          "Elige una perturbación. El escalón de alimentación es un buen primer desafío puntuado.",
      },
      "total-pid": {
        title: "PID de nivel total",
        description:
          "Este controlador mueve la válvula de petróleo. Más apertura extrae más petróleo y baja el nivel total.",
      },
      "interface-pid": {
        title: "PID de interfase",
        description:
          "Este controlador mueve la válvula de agua. Más apertura extrae más agua y baja la interfase.",
      },
      "manual-pid-tuning": {
        title: "Sintonía manual del PID",
        description:
          "Repite el mismo escenario determinista y la misma semilla. Fija Ki = 0 y Kd = 0. Empieza sintonizando solo la acción proporcional. Deja correr la recuperación completa antes de comparar un cambio.",
      },
      "start-attempt": {
        title: "Iniciar el intento",
        description:
          "Comienza solo cuando tu sintonía esté lista. Las ganancias PID quedan bloqueadas mientras dura el intento.",
      },
      "process-view": {
        title: "Vista del proceso",
        description:
          "Observa en conjunto el nivel total, la interfase petróleo/agua, la posición de las válvulas y la envolvente de seguridad.",
      },
      "live-trends": {
        title: "Tendencias en vivo",
        description:
          "Usa las tendencias para distinguir una recuperación rápida de una oscilación, una saturación o una deriva.",
      },
      "score-safety": {
        title: "Puntaje y seguridad",
        description:
          "La seguridad va primero. Tu puntaje determinista queda firme recién cuando termina el intento.",
      },
    } satisfies Record<TourTargetId, TourStepCopy>,
  },

  presetLegend: "Presets de PID",

  preset: {
    balanced: {
      label: "Equilibrado",
      guidance: "Un punto de partida confiable para los dos lazos de nivel.",
    },
    conservative: {
      label: "Conservador",
      guidance: "Correcciones más suaves y menos movimiento de válvula.",
    },
    aggressive: {
      label: "Agresivo",
      guidance: "Correcciones más rápidas, con más riesgo de oscilación.",
    },
  } satisfies Record<PidPresetId, PresetCopy>,

  presetOptionLabel: (label) => `Preset ${label}`,
};
