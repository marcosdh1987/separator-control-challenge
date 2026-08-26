# Guía para instructores

> **Idioma**: español (guía de uso). Los documentos técnicos canónicos a los que
> enlaza están en inglés: [model card](model-card.md), [modelo físico](physical-model.md),
> [puntaje](scoring.md).

Esta guía es para quien va a usar el simulador con gente: en un curso presencial, en
una capacitación interna, o acompañando a alguien que aprende por su cuenta.

## Qué es y qué no es

Es un **entorno de entrenamiento**. Sirve para que alguien vea por qué un lazo se
comporta como se comporta, y para que llegue a una falla sin consecuencias. El
comportamiento transfiere; los números no. No sirve para dimensionar, ni para
decidir una sintonía real, ni para nada relacionado con seguridad. Eso está dicho sin
vueltas en el [model card](model-card.md), y conviene decirlo también en voz alta al
empezar: un alumno que cree que está viendo su separador va a sacar conclusiones
equivocadas.

Hay dos cosas que el simulador **no** modela y que conviene aclarar temprano, porque
son justo las que un operador con experiencia va a extrañar: no hay emulsión ni rag
layer entre el petróleo y el agua, y no hay arrastre (ni carry-over ni carry-under).
Los niveles llegan a las zonas donde eso pasaría, y las alarmas marcan esas zonas,
pero la consecuencia no está simulada.

## El recorrido

Siete lecciones, unos 110 minutos en total (con llenados incluidos). Cada una aísla una idea:

| # | Lección | La idea | Escenario | Duración (min) |
|---|---|---|---|---|
| 1 | Puesta en marcha | Arranque en frío, llenado, entrega a los lazos, cierre de pozo | Operación normal | 15 |
| 2 | Acción proporcional | El offset que la P sola no puede cerrar | Escalón de alimentación | 15 |
| 3 | Acción integral | Sacar el offset sin pagarlo en sobrepaso; windup | Escalón de alimentación | 15 |
| 4 | Interfase ruidosa | La derivativa amplifica ruido y gasta válvula | Sensor de interfase ruidoso | 15 |
| 5 | Slugs | La realimentación siempre llega tarde; usar el volumen | Slug con alto corte de agua | 20 |
| 6 | El tercer lazo | Presión: escala de tiempo y acople entre lazos | Salto de GOR | 20 |
| 7 | Sintonizar con método | Procedimiento, y un canje que hay que defender | Restricción en la salida | 18 |

La lección 1 ahora enseña la puesta en marcha completa: recipiente vacío, apertura del pozo con
su rampa de alimentación (15 segundos), las válvulas cerradas durante el llenado hasta que los
lazos toman el control cerca del setpoint, y después el ejercicio clásico de cerrar el pozo
(botón "Abrir pozo / Cerrar pozo" en la consola) para ver si los lazos cierran sus válvulas antes
de que el nivel caiga al disparo. Es el punto más honesto del simulador: cada corrida empieza como
empieza un ensayo de pozo real.

Dos lecciones están diseñadas para que el resultado "perfecto" no exista. La lección
2 termina con un offset que no se puede cerrar, y la 5 no se puede sostener plana.
En las dos, **el objetivo es observar el efecto, no vencerlo**, y así están
calificadas. Si un alumno insiste en pelearlas, esa insistencia es material de
conversación: es exactamente lo que pasa en el campo cuando alguien sube la ganancia
para arreglar algo que la ganancia no arregla.

## Cómo dar una lección

Cada lección tiene **modo presentación** (botón arriba a la derecha): tipografía
grande, sin distracciones, y un control para revelar la tarea cuando quieras. Sirve
para proyectar mientras la clase mira.

Una secuencia que funciona:

1. Leé la teoría con el grupo. Son cuatro o cinco párrafos, no más.
2. Ocultá la tarea y preguntá qué creen que va a pasar. Que se comprometan con una
   predicción antes de ver el resultado.
3. Revelá la tarea y corré el escenario una vez, con la sintonía que viene puesta.
4. Que cada uno lo intente en su máquina. El cierre les dice qué se midió y contra qué.
5. Comparen resultados. La conversación interesante casi nunca es quién sacó más
   puntaje, sino qué canje eligió cada uno.

### Control de pozo durante la corrida

En cualquier corrida en vivo el operador puede abrir o cerrar el pozo con el botón
**"Abrir pozo / Cerrar pozo"** de la consola. Es el ejercicio clásico de well
testing: si el pozo empieza a producir de forma anormal, lo cerrás y dejás que el
separador se recupere. La pregunta que el ejercicio hace es concreta: **con esta
sintonía, ¿las válvulas cierran a tiempo, o el recipiente se vacía hasta el disparo
por nivel bajo?**

Con los lazos bien sintonizados, las dos válvulas de líquido acompañan la caída y
cierran antes de que el nivel llegue al disparo — que a esa altura ya está armado,
porque el recipiente ya operó en su rango normal. Con una sintonía floja, los lazos
llegan tarde. Es una prueba mejor que cualquier puntaje, y dura treinta segundos.

## Los números que reporta el cierre

El cierre no dice "bien" o "mal": dice qué se midió y contra qué límite. Los límites
no son inventados — se fijaron corriendo el simulador con distintas sintonías y
eligiendo el valor que separa "hizo lo que la lección enseña" de "no lo hizo". Los
comentarios en `lib/training/lessons.ts` dejan por escrito la medición detrás de cada
umbral.

Dos criterios merecen explicación en clase:

- **Error de seguimiento (IAE)**: la integral del error absoluto. Un número más
  chico es mejor seguimiento, pero por sí solo no dice nada del costo.
- **Recorrido de válvula**: cuánto se movió el actuador en total. Es el costo. En la
  lección 4 se ve clarísimo: con derivativa alta el error no mejora nada y el
  recorrido se multiplica por seis.

Si un alumno pregunta por qué la lección 7 no califica el recorrido: porque en ese
escenario el recorrido no discrimina — ninguna sintonía razonable lo dispara. Un
criterio que no puede fallar no es un criterio, y preferimos no fingir que lo es.

## Recolectar resultados

El progreso se guarda **solo en el navegador de cada persona** y no se envía a ningún
lado. La aplicación no tiene backend ni telemetría.

Si querés juntar resultados, pediles que usen **Exportar progreso** en la página del
curso. Baja un JSON chico con, por lección: intentos, si la aprobaron, mejor puntaje,
tiempo hasta el primer intento y tiempo hasta aprobar.

El tiempo hasta el primer intento es el más interesante de los cuatro: mide cuánto
tardaron en decidir qué cambiar. Un alumno que tarda mucho no está siendo lento;
está pensando, o está perdido, y la diferencia se nota preguntando.

## Idioma

La aplicación detecta el idioma del navegador y se puede cambiar en cualquier momento
con el selector EN/ES, incluido todo el material de las lecciones. Los tags de
instrumentos (LT-101, PIC-101) no se traducen, porque en el campo tampoco.

## Antes de la clase

- Probá el recorrido completo una vez en la máquina que vas a usar. La vista 3D
  necesita WebGL; si no está disponible, la aplicación cae sola al diagrama, pero
  mejor saberlo antes.
- Si vas a proyectar, entrá al modo presentación y verificá que se lea desde el fondo
  del aula.
- Si el grupo es de operadores con experiencia, arrancá por la notación: el selector
  **BP / Ti / Td** muestra las mismas ganancias como las ve un panel de campo, y eso
  suele ordenar la conversación desde el primer minuto.
