import type { LessonCopy, TrainingMessages } from "../en/training";
import type { LessonId, LessonLevel } from "@/lib/training/types";

const LESSON_COPY: Record<LessonId, LessonCopy> = {
  "what-is-a-separator": {
    title: "Qué hace un separador trifásico",
    summary:
      "Arranque en frío: llenar el recipiente, observar cómo los lazos toman el control y entender qué protegen.",
    visualAlt: "Diagrama de un separador horizontal con gas sobre petróleo y agua, con válvulas de entrada y salida.",
    theory: [
      "Un separador es un recipiente a presión cuya función es retener la corriente del pozo el tiempo suficiente para que la gravedad separe las fases por diferencia de densidad: el gas asciende, el petróleo flota sobre el agua y el agua decanta. Los internos del recipiente existen para proteger ese proceso de asentamiento.",
      "La variable que gobierna la separación es el tiempo de residencia: el tiempo que el fluido permanece dentro del recipiente, igual al volumen ocupado dividido por el caudal. Un crudo liviano en un recipiente templado puede requerir de tres a cinco minutos; un crudo pesado y frío, de veinte a treinta. Si el caudal de entrada aumenta, el tiempo de residencia disminuye, las gotas dispersas no alcanzan a migrar hacia su propia fase y la eficiencia de separación se degrada con rapidez.",
      "Entre el petróleo y el agua rara vez existe una frontera nítida. Sólidos finos, surfactantes y emulsiones pueden formar una capa intermedia estable, conocida en la industria como rag layer (capa de emulsión), que no obedece las leyes de asentamiento gravitacional y puede crecer hasta bloquear los vertederos internos.",
      "La separación falla en dos direcciones, y ambas son problemas de nivel. Si el nivel de líquido sube demasiado, el gas que sale por el domo arrastra gotas de líquido: es el liquid carry-over (arrastre de líquido en la corriente de gas). Si baja demasiado, el gas escapa por la salida de líquido: es el gas carry-under (arrastre de gas en la fase líquida). El control de nivel existe para mantener el recipiente entre esas dos condiciones de falla.",
      "Cada corrida comienza como comienza un ensayo de pozo real: recipiente vacío, pozo cerrado y válvulas cerradas. Presionar Iniciar abre el pozo. Mientras el recipiente se llena, los controladores mantienen sus válvulas cerradas porque todavía no hay inventario que descargar, y comienzan a abrirlas cuando el nivel se aproxima a su setpoint (el valor objetivo del lazo de control). Observa ese momento: es la transferencia del llenado al control automático.",
      "Durante el llenado el recipiente opera por debajo de todos los límites de nivel bajo, y eso no constituye una falla: las protecciones de nivel bajo permanecen inhibidas hasta que cada nivel alcanza por primera vez su rango normal de operación, igual que en la práctica de campo. A partir de ese momento quedan armadas, y un descenso de nivel pasa a ser un evento real.",
    ],
    fieldNote:
      "El controlador de nivel no existe para fijar un número exacto: existe para proteger el tiempo de residencia y conservar el sello de líquido en la salida, la columna de líquido que impide que el gas escape por ahí. El setpoint es solo la forma de pedir esas dos cosas.",
    briefing: [
      "Presiona Iniciar y observa el llenado del recipiente. Las válvulas permanecen cerradas: es el comportamiento correcto, no una falla del actuador.",
      "Observa la válvula de petróleo cuando el nivel total se aproxima al 50%: comienza a abrir justo antes del setpoint y el nivel se establece tras un sobrepaso pequeño.",
      "Con el proceso estabilizado, prueba Cerrar pozo y observa cómo los lazos cierran las válvulas antes de que el recipiente se vacíe. Vuelve a abrirlo y deja que el proceso se recupere.",
    ],
    debriefPassed: [
      "Completaste una puesta en marcha: llenado, transferencia al control automático y un recipiente estabilizado con ambas válvulas cerca de media carrera y margen de regulación disponible.",
      "A partir de aquí siempre habrá una perturbación empujando al recipiente fuera de este estado. Las lecciones siguientes tratan sobre cómo responder cuando eso ocurre.",
    ],
    debriefFailed: [
      "El recipiente salió de su envolvente de seguridad, los límites de nivel y presión que activan alarmas y disparos. Sin ninguna perturbación activa, eso indica que las ganancias mueven las válvulas con más fuerza de la que el proceso requiere.",
      "Reinicia, vuelve a arrancar y observa cuál de los niveles se desvía primero.",
    ],
  },

  "level-and-proportional-action": {
    title: "La acción proporcional y el offset que deja",
    summary: "La alimentación sube en escalón. El control proporcional responde, pero nunca por completo.",
    visualAlt: "Gráfico de respuesta donde el control proporcional se estabiliza por debajo del setpoint después de un escalón de alimentación.",
    theory: [
      "La acción proporcional mueve la válvula en proporción al error presente, la diferencia entre la variable de proceso (PV) y el setpoint (SP). El doble de error produce el doble de corrección. Es la componente más rápida y directa del controlador, y la primera que se percibe al aumentar la ganancia.",
      "También es incapaz de completar la tarea. Un controlador proporcional solo genera corrección mientras existe error: en cuanto el nivel regresa al setpoint, la apertura adicional desaparece. Si la alimentación quedó permanentemente más alta que antes, la válvula debe permanecer más abierta, y la única forma en que este controlador puede sostener esa apertura es conservar un error permanente.",
      "Ese error residual se denomina offset o error en estado estacionario. No es un defecto de la sintonía: es una propiedad estructural del control proporcional puro.",
      "Aumentar Kp, la ganancia proporcional, reduce el offset sin eliminarlo, y paga esa reducción con movimientos de válvula más agresivos. Ese compromiso es la razón por la que existe la lección siguiente.",
    ],
    briefing: [
      "Las acciones integral y derivativa están bloqueadas en esta lección; solo puedes ajustar Kp.",
      "Ejecuta el escalón de alimentación y observa en qué valor se estabiliza el nivel total después de la perturbación.",
      "Prueba con un Kp mayor y repite la corrida. Compara dónde queda el nivel y cuánto tuvo que trabajar la válvula para llegar ahí.",
    ],
    debriefPassed: [
      "El nivel se estabilizó, pero no en el setpoint. Esa diferencia es el offset, y ningún valor de Kp la elimina.",
      "Observa qué obtuviste realmente al subir Kp: un offset menor y una válvula más exigida. Registra ese compromiso; reaparece en todas las lecciones.",
    ],
    debriefFailed: [
      "La corrida terminó antes de poder mostrar el efecto. O el recipiente disparó (activó su parada de protección), o el nivel nunca se mantuvo estable el tiempo suficiente para medir el offset.",
      "Un Kp demasiado alto hace que el nivel oscile en lugar de estabilizarse. Redúcelo hasta obtener una respuesta estable y entonces busca la diferencia respecto del setpoint.",
    ],
  },

  "integral-action-and-windup": {
    title: "La acción integral y el windup",
    summary: "Eliminar el offset sin pagarlo con sobrepaso.",
    visualAlt: "Diagrama del término integral acumulándose mientras una válvula de salida permanece saturada.",
    theory: [
      "La acción integral acumula el error en el tiempo. Por pequeña que sea la diferencia restante, el integrador sigue sumando al comando de la válvula hasta que el error desaparece. Eso es lo que elimina el offset que deja la acción proporcional.",
      "El costo es tiempo. El integrador solo conoce el historial del proceso, no su tendencia, de modo que sigue empujando cuando el nivel ya está regresando. Con demasiada acción integral, el nivel supera el setpoint y debe ser traído de vuelta: eso es el sobrepaso (overshoot).",
      "Existe una falla peor. Si la válvula alcanza su límite físico y el error persiste, el integrador continúa acumulando contra un actuador que ya no puede responder. Cuando el proceso finalmente revierte, todo ese comando almacenado debe descargarse antes de que la válvula vuelva a moverse: durante ese intervalo el controlador no responde. Ese fenómeno se llama windup integral (saturación del término integral).",
      "Este simulador limita el integrador para que el windup sea recuperable y lo congela mientras la válvula está saturada, una estrategia conocida como anti-windup. Los controladores industriales hacen lo mismo, y por la misma razón.",
      "El orden de sintonía que funciona es Kp primero, Ki después, y Kd solo si aporta un beneficio verificable. Ajusta Kp hasta obtener una respuesta rápida pero estable, y luego agrega la acción integral justa para cerrar el offset.",
    ],
    briefing: [
      "Ahora dispones de Kp y Ki. La acción derivativa sigue bloqueada.",
      "Parte de la sintonía proporcional que encontraste en la lección anterior y agrega acción integral de forma gradual.",
      "El objetivo es un nivel que regrese al setpoint sin offset permanente y sin un sobrepaso significativo.",
    ],
    debriefPassed: [
      "El offset desapareció y el nivel regresó sin superar el setpoint de forma apreciable. Ese equilibrio entre Kp y Ki es el que utiliza la mayoría de los lazos de nivel en operación.",
      "Observa qué poca acción integral fue necesaria. Ki es la ganancia que con más frecuencia se sobredimensiona.",
    ],
    debriefFailed: [
      "O el offset persiste, o eliminarlo costó demasiado sobrepaso.",
      "Si el nivel cruza el setpoint y regresa repetidamente, Ki es demasiado alto. Si se aproxima al setpoint sin alcanzarlo nunca, Ki es demasiado bajo. Modifica una ganancia por vez.",
    ],
  },

  "interface-noise-and-derivative": {
    title: "Una interfase ruidosa y el efecto de la acción derivativa",
    summary: "La derivativa anticipa. Sobre una medición ruidosa, amplifica el ruido.",
    visualAlt: "Una señal ruidosa de la interfase petróleo-agua que provoca movimientos rápidos de la válvula de agua.",
    theory: [
      "La interfase petróleo/agua es la medición más difícil del recipiente. La frontera entre fases no es una línea definida: el instrumento ve una banda de transición más que un nivel.",
      "La acción derivativa responde a la velocidad de cambio de la medición, lo que le permite iniciar la corrección antes de que el error crezca. Sobre una medición limpia, esa anticipación es genuinamente útil.",
      "Sobre una medición ruidosa es contraproducente. El ruido es, por definición, cambio rápido. La acción derivativa amplifica precisamente eso y convierte el ruido del sensor en movimiento de válvula: el actuador trabaja de forma continua mientras la interfase real permanece quieta. El desgaste mecánico es real; el control, no.",
      "Por eso el término derivativo de este simulador actúa sobre una medición filtrada y no sobre la señal cruda, y por eso la respuesta correcta en un lazo ruidoso suele ser una ganancia derivativa pequeña o nula. En la práctica industrial, muchos lazos de nivel operan como PI, es decir, sin acción derivativa.",
    ],
    fieldNote:
      "Si la válvula se mueve y el proceso no, la referencia válida es el proceso. Una válvula en movimiento constante es un costo de mantenimiento, no un indicador de buen control.",
    briefing: [
      "El transmisor de interfase tiene ±1,5% de ruido y retiene cada muestra durante medio segundo.",
      "Sintoniza el lazo de interfase para que siga su setpoint sin que la válvula de agua presente chattering (movimientos rápidos y repetidos del actuador).",
      "Prueba aumentar Kd, observa el indicador de recorrido de válvula (la distancia total acumulada por el actuador) y evalúa si el cambio se justificó.",
    ],
    debriefPassed: [
      "Mantuviste la interfase sin desgastar la válvula en el intento. En un lazo ruidoso, esa contención es precisamente la habilidad que se evalúa.",
      "Compara tu recorrido de válvula con el que produce un Kd alto. El seguimiento apenas mejora; el movimiento del actuador crece de forma notable.",
    ],
    debriefFailed: [
      "O la interfase se desvió demasiado del setpoint, o mantenerla costó más recorrido de válvula del que la lección admite.",
      "Si la válvula se mueve continuamente en pasos pequeños, el controlador está siguiendo el ruido y no el proceso. Reduce Kd primero y evalúa Kp después.",
    ],
  },

  "slugs-and-the-limits-of-feedback": {
    title: "Slugs y los límites de la realimentación",
    summary: "Un controlador reactivo siempre llega tarde. Aprende a administrar esa limitación.",
    visualAlt: "Un slug de líquido entrando al separador y consumiendo el volumen de amortiguación disponible.",
    theory: [
      "Un slug (tapón de líquido) es un volumen de líquido que llega de una sola vez, acumulado en la línea de producción, y no el resultado del caudal promedio del pozo. La alimentación total salta y el corte de agua, la fracción de agua en el líquido producido, salta con ella.",
      "El control por realimentación no puede anticipar. Un PID solo actúa sobre un error que ya se manifestó: cuando el nivel subió lo suficiente para comandar la apertura de la válvula, el slug ya está dentro del recipiente. Un controlador por realimentación siempre llega tarde a un slug, no por mala sintonía, sino por la naturaleza misma de la realimentación.",
      "El resultado lo deciden dos capacidades físicas: el volumen de amortiguación (surge volume) disponible para absorber el líquido que llegó, y la capacidad de la válvula para evacuarlo antes de que el nivel alcance el disparo. La sintonía determina con cuánta eficiencia se usa ese margen; no lo aumenta.",
      "Aquí hay una decisión de operación genuina. Mantener el nivel con rigidez transfiere el slug directamente aguas abajo; permitir que el nivel se mueva lo absorbe y protege los equipos siguientes del tren de proceso. La práctica de campo suele preferir lo segundo: usar el recipiente como amortiguador y no como un valor a sostener con exactitud. Esta estrategia se conoce como control de nivel promediante (averaging level control), y es la respuesta correcta con más frecuencia de lo que los alumnos esperan.",
    ],
    briefing: [
      "El slug llega a los 35 segundos y dura alrededor de veinte.",
      "Supéralo sin disparar el recipiente. Un nivel perfectamente plano no es alcanzable; no lo persigas.",
      "Observa la válvula de petróleo durante el slug: si satura, es decir, si llega al 100% de apertura, la diferencia la está absorbiendo el recipiente, no el controlador.",
    ],
    debriefPassed: [
      "Superaste el slug sin disparo. Ese es el criterio de aprobación aquí, y también en el campo.",
      "Revisa la traza del nivel: se movió, y debía moverse. Usar el volumen del recipiente es lo que mantuvo la corrida lejos del disparo.",
    ],
    debriefFailed: [
      "El recipiente disparó. O el nivel ya estaba alto cuando llegó el slug, o el lazo estaba sintonizado con tanta rigidez que agotó la carrera de la válvula demasiado pronto.",
      "Deja más margen de nivel antes de que llegue el slug y permite que el nivel se mueva durante el evento, en lugar de corregir cada desviación.",
    ],
  },

  "the-third-loop-pressure": {
    title: "El tercer lazo: presión e interacción entre lazos",
    summary: "La presión responde en segundos; el nivel, en minutos. Comparten un mismo recipiente.",
    visualAlt: "La presión del domo de gas actuando sobre la válvula de salida de gas por encima de los niveles de líquido.",
    theory: [
      "Al activar el domo de gas aparece un tercer controlador: el de presión, que actúa sobre la válvula de salida de gas. El gas que libera la alimentación se acumula sobre el líquido y eleva la presión; abrir la válvula lo ventea.",
      "Lo primero que hay que conocer es la escala de tiempo. La presión responde en segundos donde el nivel tarda minutos. Ganancias que en un lazo de nivel resultan suaves aquí son agresivas; por eso este lazo parte con un Kp menor y sin acción derivativa.",
      "Lo segundo es que los tres lazos no son independientes. El domo de gas ocupa el volumen que el líquido deja libre: drenar líquido agranda el espacio de gas y reduce la presión, y una excursión de presión modifica la facilidad con que descargan las salidas de líquido. Tres controladores monolazo están resolviendo, cada uno, una parte de un mismo problema acoplado.",
      "Existe una razón de proceso para mantener la presión estable, más allá del límite mecánico del equipo. Una despresurización brusca hace que el gas disuelto se libere del líquido dentro del recipiente, fenómeno conocido como flashing (vaporización súbita), que agita el líquido e invalida las mediciones volumétricas de las que depende todo el ensayo de pozo.",
    ],
    fieldNote:
      "Un ensayo de pozo es, ante todo, una medición. Una presión inestable no solo exige al recipiente: le quita confiabilidad a los números que el ensayo debía producir.",
    briefing: [
      "El domo de gas está activado y a los 40 segundos el pozo comienza a producir bastante más gas por metro cúbico de petróleo: un aumento del GOR, la relación gas-petróleo.",
      "Mantén la presión durante el salto sin activar el disparo por presión muy alta.",
      "Observa los lazos de nivel mientras tanto. Si la presión oscila, verifica si los niveles de líquido se movieron con ella.",
    ],
    debriefPassed: [
      "Mantuviste la presión durante el salto. Observa la válvula de gas: tuvo que abrir de forma considerable, y pudo hacerlo porque está correctamente dimensionada.",
      "Ahora revisa las trazas de nivel durante el salto. El acoplamiento entre lazos es visible, y es la razón por la que un operador vigila los tres lazos y no solo el que está en alarma.",
    ],
    debriefFailed: [
      "La presión se salió de control. O el lazo abrió la válvula demasiado despacio a medida que llegaba el gas, o fue tan agresivo que osciló y perdió el setpoint de todos modos.",
      "Recuerda la escala de tiempo: este lazo requiere menos ganancia proporcional que uno de nivel, no más. La acción derivativa aquí casi siempre empeora el resultado.",
    ],
  },

  "systematic-tuning": {
    title: "Sintonizar desde cero, con método",
    summary: "Sin presets. Un procedimiento repetible y un compromiso que deberás justificar.",
    visualAlt: "Una secuencia de sintonía desde la acción proporcional hasta la integral y la derivativa opcional, que termina en una respuesta estable.",
    theory: [
      "Todo lo anterior fue una idea por vez. Esto es el trabajo completo: un lazo sin sintonizar, una perturbación que no elegiste y un resultado que tienes que justificar.",
      "Usa un procedimiento, no la intuición. Define un experimento repetible para que dos corridas sean comparables. Fija Ki y Kd en cero. Aumenta Kp hasta que la respuesta sea rápida pero todavía estable. Agrega la Ki mínima necesaria para eliminar el offset. Incorpora Kd solo si la medición es limpia y la respuesta realmente requiere amortiguación adicional.",
      "Evalúa el resultado con más de una métrica. Un controlador que sigue el setpoint a la perfección moviendo la válvula sin pausa no es mejor: está intercambiando vida útil del equipo por una traza más prolija. Lee juntos el error de seguimiento y el recorrido de válvula, y debes poder decir cuál de los dos decidiste privilegiar y por qué.",
      "Las reglas de sintonía publicadas (Ziegler-Nichols, Cohen-Coon, autosintonía por relé) entregan un punto de partida calculado a partir de una respuesta medida del proceso, no una respuesta definitiva. Son una primera propuesta a refinar.",
    ],
    briefing: [
      "Ambos lazos parten solo con acción proporcional y con ganancia baja.",
      "La válvula de petróleo pierde el 40% de su capacidad a los 45 segundos. Nadie lo anuncia durante la corrida; lo vas a detectar en el nivel.",
      "Sintoniza ambos lazos para sostener sus setpoints durante la restricción, sin desgastar las válvulas en el intento.",
    ],
    debriefPassed: [
      "Sintonizaste desde cero, absorbiste una pérdida de capacidad y mantuviste el movimiento de válvulas en un rango razonable. Ese es el trabajo.",
      "Registra las ganancias finales y la justificación de cada una. Poder defender una sintonía vale más que la sintonía misma.",
    ],
    debriefFailed: [
      "El resultado falló en seguimiento, en recorrido de válvula o en ambos.",
      "Trabaja en orden: Kp hasta lograr una respuesta rápida pero estable, luego Ki para el offset, y Kd solo si aporta un beneficio verificable. Cambia una ganancia por corrida para poder atribuir cada efecto.",
    ],
  },
};

export const training: TrainingMessages = {
  index: {
    eyebrow: "Entrenamiento guiado",
    title: "Aprende control de separadores operando uno",
    intro:
      "Siete lecciones breves. Cada una aísla un solo concepto, ofrece un separador donde observarlo e indica qué mirar. Nada de lo que hagas aquí puede dañar un equipo.",
    progress: (completed, total) => `${completed} de ${total} lecciones aprobadas`,
    estimatedMinutes: (minutes) => `unos ${minutes} min`,
    start: "Empezar lección",
    review: "Repasar lección",
    locked: "Completa primero la lección anterior",
    passed: "Aprobada",
    backToIndex: "Todas las lecciones",
    exportProgress: "Exportar progreso",
    importProgress: "Importar progreso",
    exportHint:
      "El progreso se guarda solo en este navegador y no se envía a ningún servidor. Expórtalo si un instructor solicita tus resultados.",
    importFailed: "Ese archivo no es un progreso exportado de este curso.",
    resetProgress: "Borrar progreso",
  },

  level: {
    foundation: "Fundamentos",
    practice: "Práctica",
    advanced: "Avanzado",
  } satisfies Record<LessonLevel, string>,

  player: {
    theoryHeading: "Antes de empezar",
    readTheory: "Leer teoría",
    hideTheory: "Ocultar teoría",
    briefingHeading: "Tu tarea",
    fieldNoteHeading: "Desde el campo",
    runHeading: "El separador",
    debriefHeading: "Cierre",
    checksHeading: "Qué se midió",
    nextLesson: "Siguiente lección",
    retry: "Reintentar",
    attempt: (attempts) => `Intento ${attempts}`,
    notAttempted: "Ejecuta el ejercicio para ver los resultados.",
    passedBanner: "Lección aprobada",
    failedBanner: "Todavía no: lee el cierre e intenta de nuevo",
  },

  check: {
    "no-trip": "El recipiente se mantuvo dentro de su envolvente de seguridad",
    "expected-trip": "Llegaste a la falla de la que trata esta lección",
    "total-iae": "Error de seguimiento del nivel total",
    "interface-iae": "Error de seguimiento de la interfase",
    "pressure-iae": "Error de seguimiento de la presión",
    "overshoot": "Sobrepaso máximo",
    "settling-time": "Tiempo de establecimiento",
    "valve-travel": "Recorrido total de válvulas",
    "score": "Puntaje",
    "offset-removed": "El offset permanente fue eliminado",
    "steady-state-offset": "Quedó un offset permanente, como se esperaba",
  },

  instructor: {
    enter: "Modo presentación",
    exit: "Salir del modo presentación",
    hint: "Tipografía grande, sin distracciones. Usa las flechas para moverte entre lecciones.",
    revealTask: "Mostrar la tarea",
    hideTask: "Ocultar la tarea",
  },

  lesson: LESSON_COPY,
};
