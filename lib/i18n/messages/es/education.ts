import type {
  CoachPresetCopy,
  DiagnosisPatternCopy,
  EducationMessages,
  GainHelpCopy,
  LoopExplanationCopy,
  TuningStepCopy,
} from "../en/education";
import type { DiagnosisPatternId } from "@/lib/education/diagnosis";
import type { GainId, ManualTuningStepId, ReferenceId } from "@/lib/education/pid-content";
import type { TeachingPresetId } from "@/lib/onboarding/types";
import type { LoopId } from "@/lib/simulation/types";

/**
 * Río de la Plata Spanish: voseo for anything addressed to the trainee. Terms an
 * operator says in English stay in English (setpoint, windup, hunting); "overshoot"
 * is taught as "sobrepaso" and glossed once, in the diagnosis pattern that names it.
 */
export const education: EducationMessages = {
  panel: {
    ariaLabel: "Recursos de aprendizaje de PID",
    eyebrow: "Estación de aprendizaje",
    title: "Observá, cambiá, compará",
    theory: "Teoría del PID",
    goldenRule: "Regla de oro de la sintonía manual",
    diagnosis: "¿Cómo diagnostico la respuesta?",
    learnMore: "Aprender más",
    loops: "Qué mueve cada lazo",
  },

  theory: {
    errorDefinition:
      "PV es la variable de proceso y SP es el setpoint. La teoría clásica suele definir e(t) = SP − PV; esta implementación de acción inversa sobre válvulas de salida usa PV − SP internamente.",
    parallelGainsNote:
      "Este simulador usa ganancias en forma paralela Kp, Ki y Kd. No mezcles estos valores con banda proporcional, tiempo integral o tiempo derivativo sin convertirlos explícitamente.",
    reverseActionConvention:
      "Este simulador usa la convención de acción inversa sobre válvulas de salida: un nivel por encima del setpoint abre más la salida correspondiente, porque una mayor apertura baja ese nivel.",
  },

  gain: {
    kp: {
      friendlyName: "Fuerza de la respuesta",
      technicalName: "Ganancia proporcional — Kp",
      summary: "Más Kp → respuesta más rápida, pero menos margen de estabilidad.",
      description:
        "Kp define con cuánta fuerza reacciona el controlador al error actual. Un Kp mayor produce un cambio mayor en el comando de la válvula ante la misma desviación respecto del setpoint.",
      increaseWhen: [
        "La respuesta es claramente demasiado lenta.",
        "Una perturbación produce un error grande pero poca acción correctiva.",
        "El proceso tarda demasiado en empezar a recuperarse.",
      ],
      tooMuchCanCause: [
        "Sobrepaso.",
        "Cruces repetidos del setpoint.",
        "Oscilación sostenida.",
        "Recorrido excesivo de la válvula.",
        "Saturación del actuador.",
      ],
      reduceWhen: [
        "El proceso cruza el setpoint una y otra vez.",
        "Cada corrección genera otra corrección en sentido contrario.",
        "El movimiento de la válvula es innecesariamente agresivo.",
      ],
      importantNote:
        "La acción proporcional sola puede dejar un offset persistente después de una perturbación.",
    },
    ki: {
      friendlyName: "Eliminación del offset",
      technicalName: "Ganancia integral — Ki",
      summary: "Más Ki → menos offset persistente, pero más sobrepaso y más riesgo de windup.",
      description:
        "Ki acumula el error en el tiempo. Incluso un error chico pero persistente sigue aumentando el aporte integral hasta que el controlador elimina el offset.",
      increaseWhen: [
        "El proceso se estabiliza lejos del setpoint.",
        "Queda un error chico durante mucho tiempo.",
        "La acción proporcional recupera casi toda la perturbación pero no vuelve del todo al objetivo.",
      ],
      tooMuchCanCause: [
        "Sobrepaso.",
        "Oscilación lenta y repetida.",
        "Windup integral.",
        "Recuperación lenta después de saturar el actuador.",
        "Movimiento excesivo de la válvula.",
      ],
      reduceWhen: [
        "El controlador queda buscando el setpoint sin encontrarlo.",
        "La válvula se mantiene saturada.",
        "El proceso sobrepasa y tarda mucho en recuperarse.",
      ],
      importantNote:
        "Conviene agregar acción integral recién después de conseguir una respuesta razonable con Kp.",
    },
    kd: {
      friendlyName: "Amortiguación y anticipación",
      technicalName: "Ganancia derivativa — Kd",
      summary: "Más Kd → más amortiguación, pero más sensibilidad al ruido.",
      description:
        "Kd reacciona a la velocidad con la que cambia la medición (PV). Puede amortiguar la respuesta y reducir el sobrepaso oponiéndose a los cambios rápidos.",
      increaseWhen: [
        "La sintonía proporcional e integral ya funciona razonablemente bien.",
        "El sobrepaso sigue siendo excesivo.",
        "La respuesta necesita más amortiguación.",
      ],
      tooMuchCanCause: [
        "Sensibilidad al ruido de medición.",
        "Comandos erráticos de válvula.",
        "Movimiento innecesario del actuador.",
        "Salto derivativo (derivative kick) si se implementa directamente sobre el error.",
      ],
      reduceWhen: [
        "El ruido de medición hace mover rápido a la válvula.",
        "La acción derivativa no mejora la respuesta completa.",
      ],
      importantNote:
        "Dejá Kd en cero durante los primeros pasos de sintonía. Este controlador deriva la medición, no el error respecto del setpoint, para evitar el salto derivativo. Con mediciones industriales ruidosas, un PI suele ser preferible a un PID completo.",
    },
  } satisfies Record<GainId, GainHelpCopy>,

  gainHelp: {
    increaseWhen: "Aumentá cuando",
    tooMuchCanCause: "Demasiado puede causar",
    reduceWhen: "Reducí cuando",
    trigger: (gainName) => `Ayuda sobre ${gainName}`,
    close: (gainName) => `Cerrar la ayuda de ${gainName}`,
  },

  diagnosisPattern: {
    "sluggish": {
      title: "Respuesta lenta",
      symptoms: [
        "La recuperación arranca despacio.",
        "El tiempo de establecimiento es largo.",
        "La acción de la válvula es débil.",
        "Hay poco o nada de sobrepaso.",
      ],
      suggestion: "Probá aumentar Kp un poco.",
    },
    "offset": {
      title: "Offset persistente",
      symptoms: [
        "La respuesta se vuelve estable.",
        "La PV queda por encima o por debajo del SP.",
        "El error no desaparece.",
      ],
      suggestion: "Con Kp ya razonablemente sintonizado, aumentá Ki un poco.",
    },
    "overshoot": {
      title: "Sobrepaso (overshoot)",
      symptoms: [
        "La PV cruza el setpoint de forma significativa.",
        "La corrección sigue actuando cuando el proceso ya debería frenar.",
      ],
      suggestion: "Reducí Kp o Ki. Si la sintonía PI ya es razonable, probá un Kd chico.",
    },
    "sustained-oscillation": {
      title: "Oscilación sostenida",
      symptoms: [
        "Los cruces se repiten y no se amortiguan.",
        "La válvula abre y cierra una y otra vez.",
        "El proceso nunca se estabiliza.",
      ],
      suggestion: "Reducí primero Kp. Si la oscilación es lenta, reducí también Ki.",
    },
    "hunting": {
      title: "Oscilación lenta o hunting",
      symptoms: [
        "Aparecen ondas de período largo alrededor del setpoint.",
        "La acción integral acumulada invierte la válvula una y otra vez.",
      ],
      suggestion: "Reducí Ki.",
    },
    "valve-saturation": {
      title: "Saturación de válvula",
      symptoms: [
        "La válvula queda cerca del 0% o del 100%.",
        "El error se sigue acumulando.",
        "La recuperación se demora al salir de la saturación.",
      ],
      suggestion: "Bajá las ganancias agresivas y revisá el windup integral.",
    },
    "noisy-command": {
      title: "Comando de válvula ruidoso",
      symptoms: [
        "Hay movimientos chicos y rápidos de la válvula.",
        "La propia PV no justifica cada movimiento.",
      ],
      suggestion: "Reducí Kd o filtrá la acción derivativa.",
    },
  } satisfies Record<DiagnosisPatternId, DiagnosisPatternCopy>,

  gainAdvisoryFallback:
    "Bajar el error es solo la mitad del trabajo: mirá también el recorrido real de las válvulas y la saturación.",

  repeatableExperimentGoldenRule:
    "Cambiá un solo parámetro por vez y repetí el mismo escenario determinista. Si no, no podés saber qué cambio mejoró o empeoró la respuesta.",

  manualTuning: {
    reminder:
      "Un parámetro por vez. Mismo escenario. Misma semilla. Compará la respuesta completa.",
    step: {
      "repeatable-experiment": {
        title: "Armá un experimento repetible",
        body: [
          "Elegí un escenario de perturbación y mantené la semilla determinista sin cambios.",
          "Usá los mismos niveles iniciales, condiciones de alimentación, duración y velocidad de reproducción en cada comparación.",
        ],
      },
      "disable-integral-derivative": {
        title: "Desactivá la acción integral y la derivativa",
        body: ["Poné Ki = 0 y Kd = 0.", "Empezá sintonizando solo la acción proporcional."],
      },
      "increase-proportional": {
        title: "Aumentá Kp de a poco",
        body: [
          "Arrancá con un Kp bajo.",
          "Corré el escenario completo.",
          "Aumentá Kp en incrementos chicos hasta que el lazo responda con prontitud.",
          "Dejá de aumentar Kp antes de que aparezca oscilación sostenida o saturación excesiva de la válvula.",
          "No sintonices mirando solo los primeros segundos. Esperá lo suficiente para ver la recuperación completa.",
        ],
      },
      "add-integral": {
        title: "Agregá acción integral",
        body: [
          "Cuando Kp da una respuesta estable y razonablemente rápida, agregá un Ki chico.",
          "Aumentá Ki de a poco hasta que desaparezca el offset persistente.",
          "Dejá de aumentar Ki si el sobrepaso, la oscilación lenta o la saturación del actuador se vuelven significativos.",
        ],
      },
      "add-derivative": {
        title: "Agregá derivativa solo si se justifica",
        body: [
          "Si el controlador PI queda demasiado poco amortiguado, agregá un Kd chico.",
          "Compará el resultado contra el mismo escenario.",
          "Conservá Kd solo si reduce el sobrepaso o el tiempo de establecimiento sin aumentar el movimiento de válvula por ruido.",
        ],
      },
    } satisfies Record<ManualTuningStepId, TuningStepCopy>,
  },

  piNote:
    "Los lazos de control de nivel se implementan muchas veces como PI y no como PID completo. La acción derivativa no es beneficiosa por defecto. Las mediciones de nivel pueden ser ruidosas y la dinámica del separador suele ser lenta, así que conviene agregar derivativa solo cuando la simulación muestra un beneficio claro.",
  antiWindupNote:
    "El windup integral aparece cuando el controlador sigue acumulando error mientras la válvula ya está en su límite físico. El anti-windup evita que esa acción integral acumulada demore la recuperación.",
  derivativeNoiseNote:
    "La acción derivativa amplifica el ruido de medición de alta frecuencia. Las implementaciones industriales de PID normalmente filtran el término derivativo.",

  classicalTuning: {
    title: "Métodos clásicos de sintonía",
    body: "Métodos como Ziegler–Nichols, Cohen–Coon, autosintonía por relé o sintonía basada en modelo pueden dar parámetros iniciales del controlador. No son soluciones óptimas universales. Algunos ajustes clásicos son deliberadamente agresivos y pueden producir un sobrepaso importante. En este simulador preferimos la sintonía manual y la comparación por métricas, porque el objetivo didáctico es entender la respuesta y no copiar una fórmula.",
  },

  loopExplanation: {
    total: {
      title: "Lazo de nivel total / válvula de petróleo",
      paragraphs: [
        "El controlador de nivel total de líquido manipula la válvula de salida de petróleo.",
        "Cuando el nivel total de líquido sube por encima de su setpoint, el controlador debe abrir más la válvula de petróleo para sacar más líquido.",
        "Cuando el nivel total cae por debajo de su setpoint, debe reducir la salida de petróleo.",
        "La variable controlada es el nivel total de líquido. La variable manipulada es la apertura de la válvula de petróleo.",
        "Una apertura mayor debería bajar el nivel total, aunque el efecto llega demorado por la dinámica del separador.",
      ],
      caution:
        "La respuesta del proceso no es instantánea. Aumentar la ganancia porque no pasa nada de inmediato puede producir sobrepaso cuando la respuesta demorada se hace visible.",
    },
    interface: {
      title: "Lazo de interfase petróleo/agua / válvula de agua",
      paragraphs: [
        "El controlador de interfase manipula la válvula de salida de agua.",
        "Cuando la interfase petróleo/agua sube por encima de su setpoint, el controlador debe abrir más la válvula de agua.",
        "Cuando la interfase cae por debajo de su setpoint, debe reducir la salida de agua.",
        "La variable controlada es el nivel de la interfase petróleo/agua. La variable manipulada es la apertura de la válvula de agua.",
        "El lazo de interfase puede responder distinto al de nivel total, porque los caudales de cada fase, la geometría del recipiente y las capacidades de salida no son iguales.",
      ],
      caution: "No supongas que los dos lazos necesitan las mismas ganancias PID.",
    },
    pressure: {
      title: "Lazo de presión del domo de gas / válvula de gas",
      paragraphs: [
        "El controlador de presión maniobra la válvula de contrapresión de gas en la salida del recipiente.",
        "El gas liberado por la alimentación se acumula en el espacio sobre el líquido y sube la presión; abrir la válvula de gas lo ventea.",
        "La variable controlada es la presión del domo de gas. La variable manipulada es la apertura de la válvula de gas.",
        "Este lazo es mucho más rápido que los de nivel. La presión responde en segundos donde el nivel tarda minutos, así que ganancias que en un lazo de nivel parecen suaves acá son violentas.",
        "Los tres lazos están acoplados a través del domo: drenar líquido agranda el espacio de gas y baja la presión, y a su vez una excursión de presión repercute sobre las salidas de líquido.",
      ],
      caution:
        "Un lazo de presión sintonizado como uno de nivel va a oscilar. Arrancá con un Kp menor al que usarías en nivel, y agregá derivativa solo si la medición está limpia.",
    },
  } satisfies Record<LoopId, LoopExplanationCopy>,

  referenceDescription: {
    "feedback-systems":
      "Libro abierto sobre realimentación, estabilidad, control PID, loop shaping y diseño práctico de sistemas de control.",
    "control-tutorials-pid":
      "Explicaciones prácticas y ejemplos interactivos de acción proporcional, integral y derivativa.",
    "mathworks-pid-tuning":
      "Material práctico sobre respuesta del PID, sintonía automática y los compromisos entre velocidad, robustez y comportamiento transitorio.",
    "controlguru-pid":
      "Artículos orientados a control de procesos sobre sintonía de controladores, dinámica de proceso, acción integral e implementación práctica.",
    "pid-controllers-theory-design-tuning":
      "Referencia clásica sobre estructura, sintonía, robustez e implementación del PID.",
    "advanced-pid-control":
      "Tratamiento avanzado de diseño industrial de PID, sintonía, anti-windup, ponderación del setpoint e implementación práctica.",
    "practical-guide-pid-implementation":
      "Guía práctica moderna sobre límites de actuador, ruido, anti-windup, transferencia sin salto, muestreo y detalles de implementación.",
    "process-dynamics-and-control":
      "Libro de texto estándar de control de procesos: modelos dinámicos, control por realimentación, sintonía de PID y sistemas multilazo.",
  } satisfies Record<ReferenceId, string>,

  coach: {
    ariaLabel: "Coach de sintonía posterior a la corrida",
    eyebrow: "Coach de control",
    title: "Qué te está diciendo esta corrida",
    empty: "Terminá un intento y el coach te lee la respuesta.",
    headline: (loop: string, pattern: string) => `${loop}: ${pattern.toLowerCase()}`,
    headlineClean: "No hay una falla que domine esta respuesta.",
    loopHeading: (loop: string, valve: string) => `Lazo de ${loop} · ${valve}`,
    noPattern: "En este lazo no se destaca nada que convenga corregir ahora.",

    gainName: {
      kp: "Kp",
      ki: "Ki",
      kd: "Kd",
    } satisfies Record<GainId, string>,

    move: {
      raise: (gain: string, from: string, to: string) => `Subí ${gain} de ${from} a ${to}.`,
      lower: (gain: string, from: string, to: string) => `Bajá ${gain} de ${from} a ${to}.`,
      remove: (gain: string) => `Poné ${gain} en 0 y volvé a correr antes de tocar otra cosa.`,
      hold: "Dejá estas ganancias y cambiá de escenario: este lazo está haciendo su trabajo.",
    },

    nextMove: "Próximo movimiento",
    evidence: "En qué se basa",
    evidenceLine: (overshoot: string, settling: string, travel: string) =>
      `Sobrepaso ${overshoot} · establecimiento ${settling} · recorrido comandado ${travel}`,
    reminder:
      "Cambiá solo la ganancia que se nombra arriba, repetí el mismo escenario con la misma semilla y compará el balance.",

    experiment: "Probá el experimento",
    preset: {
      "p-only": {
        label: "P solo, sin sintonizar",
        guidance:
          "El mismo Kp que Balanceado, con Ki y Kd apagados. El lazo corrige igual y igual se queda corto: la acción proporcional necesita un error permanente para sostener una corrección permanente, así que el offset no se va solo.",
      },
    } satisfies Record<TeachingPresetId, CoachPresetCopy>,
    applyPreset: (label: string) => `Cargar las ganancias ${label}`,
  },

  analysis: {
    ariaLabel: "Balance de sintonía",
    eyebrow: "Balance de sintonía",
    title: "Este intento contra el anterior",
    firstAttempt:
      "Primer intento en este escenario. Cambiá una sola ganancia, corrélo de nuevo y este panel te muestra qué se movió.",
    baseline: "Anterior",
    current: "Esta corrida",
    change: "Cambio",
    metricColumn: "Métrica",

    metric: {
      iae: "IAE",
      ise: "ISE",
      itae: "ITAE",
      overshoot: "Sobrepaso",
      settlingTime: "Tiempo de establecimiento",
      riseTime: "Tiempo de subida",
      steadyOffset: "Offset permanente",
      totalVariation: "Recorrido comandado de válvula (TV)",
      reversals: "Inversiones del comando",
    },

    metricHint: {
      iae: "Error total, el área bajo |PV − SP|. La medida directa de cuán lejos del objetivo estuvo la corrida.",
      ise: "Eleva el error al cuadrado, así una excursión grande cuesta mucho más que una chica y larga.",
      itae: "Pondera el error por lo tarde que ocurrió, así el error que se queda pega más fuerte.",
      overshoot: "Cuánto se pasó del setpoint al volver, en relación con lo que la perturbación lo corrió.",
      settlingTime: "Tiempo desde la perturbación hasta que el lazo entró en su banda objetivo y se quedó.",
      riseTime: "Tiempo para ir del 90% de la desviación máxima al 10%.",
      steadyOffset: "Dónde quedó el lazo respecto del setpoint. Solo la acción integral saca este error.",
      totalVariation: "Cuánto movimiento le pidió el controlador a la válvula, Σ|Δu|. El ruido del sensor aparece acá antes que en ningún lado.",
      reversals: "Cuántas veces el comando cambió de sentido. Un número alto es chattering, no control.",
    },

    unit: {
      level: "%",
      pressure: "bar",
    },

    integralValue: (value: string, unit: string) => `${value} ${unit}·s`,
    squaredIntegralValue: (value: string, unit: string) => `${value} ${unit}²·s`,
    timeIntegralValue: (value: string, unit: string) => `${value} ${unit}·s²`,
    secondsValue: (value: string) => `${value} s`,
    percentValue: (value: string) => `${value}%`,
    deviationValue: (value: string, unit: string) => `${value} ${unit}`,
    countValue: (value: string) => value,
    unavailable: "no se alcanzó",

    verdict: {
      better: "mejor",
      worse: "peor",
      unchanged: "sin cambio",
    },
    verdictLabel: (metric: string, verdict: string) => `${metric}: ${verdict}`,

    gainsChanged: "Qué cambiaste",
    gainChange: (loop: string, gain: string, from: string, to: string) =>
      `${loop}: ${gain} ${from} → ${to}`,
    gainsUnchanged: "Las ganancias fueron idénticas a las del intento anterior.",
    tooManyChanges:
      "Cambió más de una ganancia, así que esta comparación no te puede decir qué hizo cada cambio. Cambiá de a una.",
  },
};
