import type { FeedbackCopy, ScenarioCopy, SimulationMessages } from "../en/simulation";
import type {
  DisturbanceId,
  LoopId,
  PhaseId,
  RankId,
  SafetyConditionId,
  ScenarioId,
  ScoreModifierId,
  TripKind,
} from "@/lib/simulation/types";

export const simulation: SimulationMessages = {
  loop: {
    total: "Nivel total",
    interface: "Interfase",
    pressure: "Presión",
  } satisfies Record<LoopId, string>,

  loopInSentence: {
    total: "nivel total",
    interface: "interfase",
    pressure: "presión",
  } satisfies Record<LoopId, string>,

  phase: {
    oil: "Petróleo",
    water: "Agua",
  } satisfies Record<PhaseId, string>,

  phaseInSentence: {
    oil: "petróleo",
    water: "agua",
  } satisfies Record<PhaseId, string>,

  valve: {
    oil: "válvula de petróleo",
    water: "válvula de agua",
  } satisfies Record<PhaseId, string>,

  loopValve: {
    total: "válvula de petróleo",
    interface: "válvula de agua",
    pressure: "válvula de gas",
  } satisfies Record<LoopId, string>,

  effort: {
    travel: "recorrido",
    saturation: "saturación",
  } satisfies Record<"travel" | "saturation", string>,

  scenario: {
    "normal": {
      name: "Operación normal",
      shortName: "Normal",
      description: "Alimentación estable de petróleo y agua, con sensores y válvulas nominales.",
    },
    "feed-step": {
      name: "Escalón de alimentación",
      shortName: "Escalón",
      description: "La alimentación total sube de 50 a 70 m³/h a los 30 segundos.",
    },
    "water-rich-slug": {
      name: "Slug con alto corte de agua",
      shortName: "Slug de agua",
      description: "Un slug de líquido eleva la alimentación total y el corte de agua de entrada.",
    },
    "oil-outlet-restriction": {
      name: "Restricción en la salida de petróleo",
      shortName: "Restricción",
      description: "La capacidad disponible de la válvula de petróleo cae al 60% a los 45 segundos.",
    },
    "slow-water-dump": {
      name: "Actuador de agua lento",
      shortName: "Agua lenta",
      description: "Una válvula de agua lenta debe controlar un corte de agua más alto.",
    },
    "noisy-interface": {
      name: "Sensor de interfase ruidoso",
      shortName: "Interfase ruidosa",
      description: "El sensor de interfase tiene ±1,5% de ruido y retención de muestra de 0,5 s.",
    },
    "gor-surge": {
      name: "Salto de relación gas-petróleo",
      shortName: "Salto de GOR",
      description: "A los 40 segundos el pozo empieza a producir mucho más gas por metro cúbico de petróleo. Requiere el domo de gas activado.",
    },
  } satisfies Record<ScenarioId, ScenarioCopy>,

  disturbance: {
    "steady": "Alimentación estable de petróleo y agua",
    "feed-step-active": "Escalón de alimentación activo",
    "slug-active": "Slug con alto corte de agua activo",
    "slug-ended": "Slug con alto corte de agua finalizado",
    "oil-restriction-active": "Restricción en la salida de petróleo activa",
    "slow-water-dump": "Actuador de agua lento",
    "slow-water-dump-high-cut": "Mayor corte de agua con actuador de agua lento",
    "noisy-interface": "Sensor de interfase ruidoso",
    "gor-surge-active": "Salto de GOR activo",
  } satisfies Record<DisturbanceId, string>,

  safetyCondition: {
    "normal": "Envolvente normal de operación",
    "pressure-low-low": "Disparo por presión muy baja",
    "pressure-low": "Alarma por presión baja",
    "pressure-high": "Alarma por presión alta",
    "pressure-high-high": "Disparo por presión muy alta",
    "total-low-low": "Disparo por nivel total muy bajo",
    "total-low": "Alarma por nivel total bajo",
    "total-high": "Alarma por nivel total alto",
    "total-high-high": "Disparo por nivel total muy alto",
    "interface-low-low": "Disparo por interfase muy baja",
    "interface-low": "Alarma por interfase baja",
    "interface-high": "Alarma por interfase alta",
    "interface-high-high": "Disparo por interfase muy alta",
    "oil-layer-low-low": "Disparo por capa de petróleo muy baja",
  } satisfies Record<SafetyConditionId, string>,

  rank: {
    master: "Especialista en control de separadores",
    specialist: "Especialista en sintonía de lazos",
    engineer: "Ingeniero de procesos",
    technician: "Técnico de control",
    trainee: "Operador en formación",
  } satisfies Record<RankId, string>,

  tripModifierLabel: {
    TOTAL_LL: "Tope por disparo de nivel total muy bajo",
    TOTAL_HH: "Tope por disparo de nivel total muy alto",
    INTERFACE_LL: "Tope por disparo de interfase muy baja",
    INTERFACE_HH: "Tope por disparo de interfase muy alta",
    OIL_LAYER_LL: "Tope por disparo de capa de petróleo muy baja",
    PRESSURE_LL: "Tope por disparo de presión muy baja",
    PRESSURE_HH: "Tope por disparo de presión muy alta",
  } satisfies Record<Exclude<TripKind, null>, string>,

  modifierLabel: {
    "total-oscillation": "Oscilación sostenida del nivel total",
    "interface-oscillation": "Oscilación sostenida de la interfase",
    "oil-saturation": "Saturación prolongada de la válvula de petróleo",
    "water-saturation": "Saturación prolongada de la válvula de agua",
    "oil-travel": "Recorrido excesivo de la válvula de petróleo",
    "water-travel": "Recorrido excesivo de la válvula de agua",
    "total-windup": "Límite integral del nivel total",
    "interface-windup": "Límite integral de la interfase",
    "pressure-oscillation": "Oscilación sostenida de la presión",
    "gas-saturation": "Saturación prolongada de la válvula de gas",
    "gas-travel": "Recorrido excesivo de la válvula de gas",
    "pressure-windup": "Límite integral de la presión",
  } satisfies Record<Exclude<ScoreModifierId, "trip">, string>,

  tripFeedback: {
    TOTAL_LL: {
      diagnosis: "Disparo por nivel total muy bajo",
      suggestion: "Resintonizá el lazo de nivel total para que la válvula de petróleo cierre antes sin oscilar.",
    },
    TOTAL_HH: {
      diagnosis: "Disparo por nivel total muy alto",
      suggestion: "Resintonizá el lazo de nivel total para que la válvula de petróleo abra antes y conserve margen.",
    },
    INTERFACE_LL: {
      diagnosis: "Disparo por interfase muy baja",
      suggestion: "Resintonizá el lazo de interfase para que la válvula de agua cierre antes y sin windup.",
    },
    INTERFACE_HH: {
      diagnosis: "Disparo por interfase muy alta",
      suggestion: "Resintonizá el lazo de interfase para que la válvula de agua abra antes y recupere margen.",
    },
    OIL_LAYER_LL: {
      diagnosis: "Disparo por capa de petróleo muy baja",
      suggestion: "Usá el lazo de interfase y la válvula de agua para bajar la interfase antes de que colapse la capa de petróleo.",
    },
    PRESSURE_LL: {
      diagnosis: "Disparo por presión muy baja",
      suggestion: "Frená el lazo de presión: la válvula de gas está venteando el domo más rápido de lo que la alimentación lo repone.",
    },
    PRESSURE_HH: {
      diagnosis: "Disparo por presión muy alta",
      suggestion: "Resintonizá el lazo de presión para que la válvula de gas abra antes; la presión se mueve mucho más rápido que el nivel.",
    },
  } satisfies Record<Exclude<TripKind, null>, FeedbackCopy>,

  modifierFeedback: {
    "total-oscillation": {
      diagnosis: "Oscilación sostenida del nivel total",
      suggestion: "Bajá Kp o Ki en el lazo de nivel total antes de agregar acción derivativa filtrada.",
    },
    "interface-oscillation": {
      diagnosis: "Oscilación sostenida de la interfase",
      suggestion: "Bajá Kp o Ki en el lazo de interfase y mantené suave la respuesta de la válvula de agua.",
    },
    "oil-saturation": {
      diagnosis: "Saturación prolongada de la válvula de petróleo",
      suggestion: "Resintonizá el lazo de nivel total para que la válvula de petróleo se mantenga dentro de su autoridad útil.",
    },
    "water-saturation": {
      diagnosis: "Saturación prolongada de la válvula de agua",
      suggestion: "Resintonizá el lazo de interfase para que la válvula de agua se mantenga dentro de su autoridad útil.",
    },
    "oil-travel": {
      diagnosis: "Recorrido excesivo de la válvula de petróleo",
      suggestion: "Reducí la agresividad del lazo de nivel total para bajar el desgaste de la válvula sin perder seguridad.",
    },
    "water-travel": {
      diagnosis: "Recorrido excesivo de la válvula de agua",
      suggestion: "Reducí la agresividad del lazo de interfase para bajar el desgaste de la válvula sin perder seguridad.",
    },
    "total-windup": {
      diagnosis: "La acción integral del nivel total quedó pegada al límite",
      suggestion: "Bajá Ki en el lazo de nivel total y verificá que la válvula de petróleo tenga autoridad suficiente.",
    },
    "interface-windup": {
      diagnosis: "La acción integral de la interfase quedó pegada al límite",
      suggestion: "Bajá Ki en el lazo de interfase y verificá que la válvula de agua tenga autoridad suficiente.",
    },
    "pressure-oscillation": {
      diagnosis: "Oscilación sostenida de la presión",
      suggestion: "Bajá Kp en el lazo de presión: el domo de gas responde en segundos, así que las ganancias que sirven para un lazo de nivel acá son enormes.",
    },
    "gas-saturation": {
      diagnosis: "Saturación prolongada de la válvula de gas",
      suggestion: "La válvula de gas se quedó sin autoridad. Fijate si el GOR de la alimentación supera lo que esa válvula puede pasar.",
    },
    "gas-travel": {
      diagnosis: "Recorrido excesivo de la válvula de gas",
      suggestion: "Suavizá el lazo de presión; el movimiento constante desgasta el trim sin mejorar el control.",
    },
    "pressure-windup": {
      diagnosis: "La acción integral de la presión quedó pegada al límite",
      suggestion: "Bajá Ki en el lazo de presión y verificá que la válvula de gas pueda pasar el gas entrante.",
    },
  } satisfies Record<Exclude<ScoreModifierId, "trip">, FeedbackCopy>,

  balancedFeedback: {
    diagnosis: "Respuesta equilibrada entre nivel total e interfase",
    suggestion: "Probá un escenario más difícil o recortá el recorrido de las válvulas sin sacrificar seguridad.",
  } satisfies FeedbackCopy,

  pressureFeedback: {
    diagnosis: "El control de presión domina el puntaje",
    suggestion: "Estabilizá primero el lazo de presión: es el más rápido, y sus vaivenes mueven los niveles de líquido a través del domo de gas.",
  } satisfies FeedbackCopy,

  lossFeedback: {
    safety: (loop, valve): FeedbackCopy => ({
      diagnosis: `La exposición a alarmas de ${loop} / ${valve} domina el puntaje`,
      suggestion: `Resintonizá primero el lazo de ${loop} y su ${valve} para recuperar margen de seguridad.`,
    }),
    tracking: (_loop, loopInSentence): FeedbackCopy => ({
      diagnosis: `El error de seguimiento de ${loopInSentence} domina el puntaje`,
      suggestion: `Subí Kp de a poco en el lazo de ${loopInSentence} y después agregá algo de Ki para el offset.`,
    }),
    stability: (_loop, loopInSentence): FeedbackCopy => ({
      diagnosis: `La variabilidad de ${loopInSentence} domina el puntaje`,
      suggestion: `Bajá Kp o Ki en el lazo de ${loopInSentence} y agregá derivativa solo con una medición limpia.`,
    }),
    recovery: (loop, valve): FeedbackCopy => ({
      diagnosis: `La recuperación de ${loop} / ${valve} limita la respuesta conjunta`,
      suggestion: `Resintonizá el lazo de ${loop} y su ${valve} para recuperar antes sin perder estabilidad.`,
    }),
    valve: (phase, effort, loopInSentence, phaseInSentence): FeedbackCopy => ({
      diagnosis: `El ${effort} de la válvula de ${phase.toLocaleLowerCase("es")} domina el puntaje`,
      suggestion: `Resintonizá el lazo de ${loopInSentence} para reducir el ${effort} de la válvula de ${phaseInSentence}.`,
    }),
  },
};
