import type { LessonCopy, TrainingMessages } from "../en/training";
import type { LessonId, LessonLevel } from "@/lib/training/types";

const LESSON_COPY: Record<LessonId, LessonCopy> = {
  "what-is-a-separator": {
    title: "Qué hace un separador trifásico",
    summary: "Tiempo de residencia, las dos interfases, y las dos formas en que falla la separación.",
    theory: [
      "Un separador es un recipiente a presión cuyo único trabajo es tener quieta la corriente del pozo el tiempo suficiente para que la gravedad haga lo suyo. El gas sube, el petróleo flota, el agua decanta. Todo lo demás adentro del recipiente existe para proteger eso.",
      "La magnitud que manda es el tiempo de residencia: cuánto tiempo permanece el fluido adentro, que es simplemente volumen sobre caudal. Un crudo liviano en un recipiente templado puede necesitar de tres a cinco minutos; un crudo pesado y frío puede necesitar veinte o treinta. Si sube el caudal de entrada, el tiempo de residencia baja, las gotas dispersas nunca alcanzan a llegar a su propia fase, y la eficiencia de separación cae en picada.",
      "Entre el petróleo y el agua rara vez hay una línea limpia. Sólidos finos, surfactantes y emulsiones pueden formar una capa estable entre ambos — la rag layer — que no obedece a las leyes de asentamiento y puede crecer hasta bloquear los vertederos internos.",
      "La separación falla en dos direcciones, y las dos son problemas de nivel. Si el líquido sube demasiado, el gas que sale por arriba se lleva gotas con él: liquid carry-over. Si baja demasiado, el gas se escapa por la salida de líquido: gas carry-under. El control de nivel existe para mantener el recipiente entre esas dos fallas.",
    ],
    fieldNote:
      "El controlador de nivel no está para clavar un número. Está para proteger el tiempo de residencia y mantener el sello de líquido en la salida. El número es solo la forma de pedir eso.",
    briefing: [
      "Arrancá la corrida y miralá un rato. Nada está perturbando este separador.",
      "Ubicá el nivel total y la interfase petróleo/agua en las lecturas, y seguilos en las tendencias.",
      "Fijate que las dos válvulas quedan cerca de media carrera: eso es un recipiente en equilibrio, no un recipiente sin hacer nada.",
    ],
    debriefPassed: [
      "Así se ve un separador asentado: niveles planos, válvulas quietas, y los dos lazos con autoridad de sobra.",
      "De acá en adelante siempre va a haber algo empujando al recipiente fuera de este estado. Todas las lecciones son sobre qué hacés cuando eso pasa.",
    ],
    debriefFailed: [
      "El recipiente se salió de su envolvente de seguridad. Sin ninguna perturbación actuando, eso significa que las ganancias están moviendo las válvulas más fuerte de lo que el proceso necesita.",
      "Reiniciá y volvé a arrancar, y mirá cuál nivel se mueve primero.",
    ],
  },

  "level-and-proportional-action": {
    title: "Acción proporcional, y el offset que deja",
    summary: "La alimentación sube de golpe. El control proporcional responde, pero nunca del todo.",
    theory: [
      "La acción proporcional mueve la válvula en proporción al error de este instante. El doble de error, el doble de corrección. Es rápida y es honesta, y es lo primero que se siente cuando subís un controlador.",
      "También es incapaz de terminar el trabajo. Un controlador proporcional solo produce corrección mientras existe error, así que en el momento en que el nivel vuelve al setpoint, esa apertura extra desaparece. Si la alimentación quedó permanentemente más alta que antes, la válvula tiene que quedar permanentemente más abierta — y la única manera que tiene este controlador de sostenerla ahí es mantener un error permanente.",
      "A ese error que queda parado se lo llama offset. No es un defecto de tu sintonía. Es lo que el control proporcional puro es.",
      "Subir Kp achica el offset sin eliminarlo, y paga esa reducción con una válvula más violenta. Ese canje es la razón entera por la que existe la lección siguiente.",
    ],
    briefing: [
      "La integral y la derivativa están bloqueadas en esta lección; solo Kp es tuyo.",
      "Corré el escalón de alimentación y mirá dónde se estabiliza el nivel total después de la perturbación.",
      "Probá con un Kp más alto y volvé a correr. Compará dónde queda el nivel, y qué hizo la válvula para llegar ahí.",
    ],
    debriefPassed: [
      "El nivel se estabilizó, pero no en el setpoint. Esa diferencia es el offset, y ningún valor de Kp la cierra.",
      "Mirá qué te compró realmente subir Kp: una diferencia más chica y una válvula más ocupada. Guardate ese canje; vuelve en todas las lecciones.",
    ],
    debriefFailed: [
      "La corrida terminó antes de poder mostrar el efecto. O el recipiente disparó, o el nivel nunca se quedó quieto lo suficiente como para leer el offset.",
      "Un Kp muy alto hace que el nivel oscile en vez de estabilizarse. Bajalo hasta que la respuesta quede tranquila, y ahí buscá la diferencia.",
    ],
  },

  "integral-action-and-windup": {
    title: "Acción integral, y cómo se traba",
    summary: "Sacar el offset sin pagarlo en sobrepaso.",
    theory: [
      "La acción integral acumula el error en el tiempo. Por chica que sea la diferencia que queda, el integrador sigue sumando al comando de la válvula hasta que la diferencia desaparece. Eso es lo que elimina el offset que deja la acción proporcional.",
      "Lo paga con tiempo. El integrador solo sabe dónde estuvo el proceso, no hacia dónde va, así que sigue empujando cuando el nivel ya está volviendo. Con demasiada acción integral el nivel se pasa del setpoint y hay que traerlo de vuelta: sobrepaso.",
      "Hay una falla peor. Si la válvula llega a su límite y el error persiste, el integrador sigue acumulando contra una válvula que ya no puede moverse más. Cuando el proceso finalmente da vuelta, todo ese comando guardado tiene que desarmarse antes de que la válvula responda: el controlador queda sordo un rato. Eso es windup integral.",
      "Este simulador limita el integrador para que el windup sea sobrevivible, y lo congela mientras la válvula está saturada. Los controladores reales hacen lo mismo, y por la misma razón.",
      "El orden que funciona es Kp primero, después Ki, y Kd solo si se gana el lugar. Sintonizá Kp hasta que la respuesta sea rápida pero tranquila, y después agregá la integral justa para cerrar el offset.",
    ],
    briefing: [
      "Ahora tenés Kp y Ki. La derivativa sigue bloqueada.",
      "Partí de la sintonía proporcional que encontraste en la lección anterior y agregá acción integral de a poco.",
      "El objetivo es un nivel que vuelva al setpoint sin offset permanente y sin un sobrepaso grande.",
    ],
    debriefPassed: [
      "El offset se fue y el nivel volvió sin pasarse de largo. Ese equilibrio entre Kp y Ki es lo que están corriendo la mayoría de los lazos en el campo.",
      "Fijate qué poca acción integral hizo falta. Ki es la ganancia que más se exagera.",
    ],
    debriefFailed: [
      "O el offset sigue ahí, o sacarlo costó demasiado sobrepaso.",
      "Si el nivel se pasa del setpoint y vuelve una y otra vez, Ki está muy alto. Si se arrastra hacia el setpoint y nunca llega del todo, Ki está muy bajo. Cambiá una ganancia por vez.",
    ],
  },

  "interface-noise-and-derivative": {
    title: "Una interfase ruidosa, y qué le hace la derivativa",
    summary: "La derivativa anticipa. Sobre una medición ruidosa, más bien inventa.",
    theory: [
      "La interfase petróleo/agua es la medición más difícil del recipiente. La frontera no es una línea limpia, y el instrumento ve una banda más que un nivel.",
      "La acción derivativa responde a qué tan rápido cambia la medición, lo que le permite empezar a corregir antes de que el error crezca. Sobre una medición limpia eso sirve de verdad.",
      "Sobre una ruidosa es casi veneno. El ruido es, por definición, cambio rápido. La derivativa amplifica exactamente eso y convierte el ruido del sensor en movimiento de válvula, así que la válvula trabaja sin parar mientras la interfase real no va a ningún lado. El desgaste es real; el control no.",
      "Por eso acá el término derivativo actúa sobre una medición filtrada y no sobre la cruda, y por eso la respuesta honesta en un lazo ruidoso suele ser una ganancia derivativa chica, o directamente ninguna.",
    ],
    fieldNote:
      "Si la válvula se mueve y el proceso no, creele al proceso. Una válvula ocupada es un costo, no un logro.",
    briefing: [
      "El transmisor de interfase tiene ±1,5% de ruido y retiene cada muestra medio segundo.",
      "Sintonizá el lazo de interfase para que siga su setpoint sin que la válvula de agua zapatee.",
      "Probá subir Kd y mirá el número de recorrido de válvula, y después decidí si valió la pena.",
    ],
    debriefPassed: [
      "Sostuviste la interfase sin gastar la válvula para lograrlo. En un lazo ruidoso esa contención es la habilidad.",
      "Compará tu recorrido de válvula con el que produjo un Kd grande. El seguimiento casi no mejoró; el movimiento sí.",
    ],
    debriefFailed: [
      "O la interfase se alejó demasiado del setpoint, o sostenerla costó más recorrido de válvula del que la lección permite.",
      "Si la válvula se mueve todo el tiempo en pasitos chicos, el controlador está persiguiendo ruido. Bajá Kd primero, y después mirá Kp.",
    ],
  },

  "slugs-and-the-limits-of-feedback": {
    title: "Slugs, y los límites de la realimentación",
    summary: "Un controlador reactivo siempre llega tarde. Aprendé qué hacer con eso.",
    theory: [
      "Un slug es un cuerpo de líquido que llega todo junto, desde la línea y no desde el caudal promedio del pozo. La alimentación total salta y el corte de agua salta con ella.",
      "El control realimentado no puede anticipar. Un PID solo actúa sobre un error que ya apareció, así que para cuando el nivel subió lo suficiente como para mandar abrir la válvula, el slug ya está adentro del recipiente. Un controlador reactivo siempre llega tarde a un slug — no porque esté mal sintonizado, sino por lo que la realimentación es.",
      "Lo que decide el resultado es si el recipiente tiene el volumen de amortiguación para absorber lo que llegó, y si la válvula tiene capacidad para pasarlo antes de que el nivel llegue al disparo. La sintonía cambia con cuánta elegancia usás ese margen. No crea más margen.",
      "Acá hay una decisión genuina. Sostener el nivel con firmeza manda el slug derecho aguas abajo; dejar que el nivel se mueva lo absorbe y protege a lo que venga después en el tren. La práctica de campo muchas veces prefiere lo segundo: usar el recipiente como amortiguador en vez de como setpoint. Se llama averaging level control, y es la respuesta correcta más seguido de lo que los alumnos esperan.",
    ],
    briefing: [
      "El slug llega a los 35 segundos y dura unos veinte.",
      "Pasalo sin disparar. Un nivel perfectamente plano no está disponible; no lo persigas.",
      "Mirá la válvula de petróleo durante el slug: si satura, el que está absorbiendo la diferencia es el recipiente, no el controlador.",
    ],
    debriefPassed: [
      "Sobreviviste al slug. Esa es la nota de aprobación acá, y en el campo también.",
      "Volvé a mirar la traza del nivel: se movió, y tenía que moverse. Usar el volumen del recipiente es lo que mantuvo lejos el disparo.",
    ],
    debriefFailed: [
      "El recipiente disparó. O el nivel ya estaba alto cuando llegó el slug, o el lazo estaba tan ajustado que se quedó sin válvula temprano.",
      "Probá dejar más margen antes de que llegue el slug, y dejá que el nivel se mueva durante el evento en vez de pelear cada centímetro.",
    ],
  },

  "the-third-loop-pressure": {
    title: "El tercer lazo: presión, y cómo interactúan los lazos",
    summary: "La presión se mueve en segundos. El nivel en minutos. Comparten un recipiente.",
    theory: [
      "Activá el domo de gas y aparece un tercer controlador: presión, actuando sobre la válvula de salida de gas. El gas que libera la alimentación se junta arriba del líquido y sube la presión; abrir la válvula lo ventea.",
      "Lo primero que hay que saber es la escala de tiempo. La presión responde en segundos donde el nivel tarda minutos. Ganancias que en un lazo de nivel parecen suaves acá son violentas, y por eso este lazo arranca con un Kp más chico y sin derivativa.",
      "Lo segundo es que los tres lazos no son independientes. El domo de gas es el volumen que el líquido deja libre, así que drenar líquido agranda el espacio de gas y baja la presión, y una excursión de presión repercute sobre lo fácil que le resulta descargar a las salidas de líquido. Tres controladores monolazo separados están resolviendo, cada uno, una parte de un mismo problema acoplado.",
      "Hay una razón de proceso para mantener la presión quieta más allá del rating del equipo. Una caída brusca de presión hace que el gas se libere del líquido adentro del recipiente — flashing — lo que agita el líquido y arruina las mediciones volumétricas de las que depende toda la prueba de pozo.",
    ],
    fieldNote:
      "Una prueba de pozo es una medición. Una presión que no se queda quieta no solo exige al recipiente: vuelve poco confiables los números que fuiste a buscar.",
    briefing: [
      "El domo de gas está activado y a los 40 segundos el pozo empieza a producir mucho más gas por metro cúbico de petróleo.",
      "Sostené la presión durante el salto sin disparar por presión muy alta.",
      "Mirá los lazos de nivel mientras lo hacés. Si la presión oscila, fijate si los niveles de líquido se movieron con ella.",
    ],
    debriefPassed: [
      "Sostuviste la presión durante el salto. Mirá la válvula de gas: tuvo que abrir bastante, y pudo hacerlo porque está bien dimensionada.",
      "Ahora mirá las trazas de nivel durante el salto. El acople se ve — y es por eso que un operador mira los tres lazos, no el que está alarmando.",
    ],
    debriefFailed: [
      "La presión se te escapó. O el lazo fue muy lento para abrir la válvula a medida que llegaba el gas, o fue tan agresivo que osciló y perdió el setpoint igual.",
      "Acordate de la escala de tiempo: este lazo necesita menos ganancia proporcional que uno de nivel, no más. La derivativa acá casi siempre empeora las cosas.",
    ],
  },

  "systematic-tuning": {
    title: "Sintonizar desde cero, con método",
    summary: "Sin presets. Un procedimiento repetible, y un canje que vas a tener que defender.",
    theory: [
      "Todo lo anterior fue una idea por vez. Esto es el trabajo completo: un lazo sin sintonizar, una perturbación que no elegiste, y un resultado que tenés que justificar.",
      "Usá un procedimiento, no intuición. Armá un experimento repetible para que dos corridas se puedan comparar. Poné Ki y Kd en cero. Subí Kp hasta que la respuesta sea rápida pero todavía tranquila. Agregá la Ki justa para sacar el offset. Agregá Kd solo si la medición está limpia y la respuesta realmente necesita amortiguación.",
      "Juzgá el resultado por algo más que el error. Un controlador que sigue el setpoint hermoso moviendo la válvula sin parar no es mejor: está cambiando vida útil del equipo por una traza más linda. Leé el error de seguimiento y el recorrido de válvula juntos, y sabé decir cuál de los dos elegiste favorecer y por qué.",
      "Las reglas publicadas — Ziegler-Nichols, Cohen-Coon, autosintonía por relé — te dan un punto de partida a partir de una respuesta medida, no una respuesta final. Son una oferta inicial.",
    ],
    briefing: [
      "Los dos lazos arrancan solo con acción proporcional, y con ganancia baja.",
      "La válvula de petróleo pierde el 40% de su capacidad a los 45 segundos. Durante la corrida nadie te lo avisa; te lo va a decir el nivel.",
      "Sintonizá los dos lazos para sostener sus setpoints durante la restricción, sin gastar las válvulas para lograrlo.",
    ],
    debriefPassed: [
      "Sintonizaste desde cero, absorbiste una pérdida de capacidad, y mantuviste razonable el movimiento de válvulas. Ese es el trabajo.",
      "Anotá con qué ganancias terminaste y por qué. Poder defender una sintonía vale más que la sintonía.",
    ],
    debriefFailed: [
      "El resultado falló en seguimiento, en recorrido de válvula, o en los dos.",
      "Trabajá en orden: Kp hasta que la respuesta sea rápida pero tranquila, después Ki para el offset, y Kd solo si se gana el lugar. Cambiá una ganancia por corrida para saber qué hizo cada una.",
    ],
  },
};

export const training: TrainingMessages = {
  index: {
    eyebrow: "Entrenamiento guiado",
    title: "Aprendé control de separadores operando uno",
    intro:
      "Siete lecciones cortas. Cada una aísla una sola idea, te da un separador donde se ve, y te dice qué mirar. Nada de lo que hagas acá puede romper algo.",
    progress: (completed, total) => `${completed} de ${total} lecciones aprobadas`,
    estimatedMinutes: (minutes) => `unos ${minutes} min`,
    start: "Empezar lección",
    review: "Repasar lección",
    locked: "Terminá primero la lección anterior",
    passed: "Aprobada",
    backToIndex: "Todas las lecciones",
    exportProgress: "Exportar progreso",
    importProgress: "Importar progreso",
    exportHint:
      "El progreso se guarda solo en este navegador y no se envía a ningún lado. Exportalo si un instructor te pide tus resultados.",
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
    briefingHeading: "Tu tarea",
    fieldNoteHeading: "Desde el campo",
    runHeading: "El separador",
    debriefHeading: "Cierre",
    checksHeading: "Qué se midió",
    nextLesson: "Siguiente lección",
    retry: "Reintentar",
    attempt: (attempts) => `Intento ${attempts}`,
    notAttempted: "Corré el ejercicio para ver cómo te fue.",
    passedBanner: "Lección aprobada",
    failedBanner: "Todavía no: leé el cierre y probá de nuevo",
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
    "steady-state-offset": "Quedó un offset permanente, como se esperaba",
  },

  instructor: {
    enter: "Modo presentación",
    exit: "Salir del modo presentación",
    hint: "Tipografía grande, sin distracciones. Usá las flechas para moverte entre lecciones.",
    revealTask: "Mostrar la tarea",
    hideTask: "Ocultar la tarea",
  },

  lesson: LESSON_COPY,
};
