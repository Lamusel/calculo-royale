# Cálculo Royale

Battle royale **militar** multijugador para **Cálculo Multivariable (corte 3)**, UTS Bucaramanga.
Hasta 40 jugadores en la misma partida (≈36 en celular, ≈4 en PC), directo desde el navegador.
Primero es un battle royale de verdad; **el cálculo es la llave del poder**: las cajas de suministro tienen candado de código (una pregunta ABCD), el centro de mando habla en desigualdades y los caídos siguen peleando como operadores de radio.

> Este README es el documento vivo del proyecto. Se actualiza al cerrar cada fase (ver **Estado del proyecto** al final).
> Sucesor de *Blackjack de Cálculo* (corte 2): igual que allá, un juego real adaptado al cálculo, no al revés.

---

## 1. Concepto de juego

- **Vista:** 3D low-poly con cámara 3/4 en perspectiva que sigue al soldado. No hay primera persona.
- **Controles celular:** joystick izquierdo = moverse, joystick derecho = apuntar y disparar (twin-stick). Pantalla horizontal. Toque rápido = disparo con auto apuntado; arrastrar = apuntar y disparar fuera de la zona de cancelación (30 % del radio). Una flecha en el suelo bajo el soldado marca hacia dónde apunta. Francotirador y granada se disparan al soltar; volver al centro cancela.
- **Controles PC:** WASD = moverse, mouse = apuntar, clic izquierdo = disparar, clic derecho mantenido = mira (con el francotirador la cámara se desplaza hacia el objetivo), R = recargar, 1/2 = cambiar arma, G mantenida = arco de la granada (soltar lanza), E = interactuar.
- **Partida:** el profe (host) crea una sala, elige temas y modo; los estudiantes entran con un código de 4 letras (o QR). Duración objetivo: 8 a 12 minutos.

### Dirección de arte

- **3D low-poly estilizado y propio**, que no parezca surviv.io. Todos los modelos (soldados, armas, cajas, escenario) se generan por código, sin paquetes externos.
- **Cámara 3/4 en perspectiva** (≈45°), luz direccional de sol con sombras (soldados y edificios), niebla atmosférica.
- **Terreno natural:** pasto, tierra y caminos, con colinas suaves que salen de una función `z = f(x, y)` usada solo por dentro.
- **Zonas del mapa:** pueblo abandonado y patio de contenedores (fase 3); base militar, bosque y trincheras de sacos de arena (fase 7). Paredes con altura visible; si una pared tapa a tu soldado se vuelve semitransparente y ves tu silueta. Al entrar a una casa, su techo se oculta.
- **Efectos:** fogonazo, trazadoras, casquillos, polvo, humo, sacudida de cámara al recibir daño, hit markers y números de daño.
- **Soldado modular:** casco, chaleco que cambia con el nivel, color por jugador; animación procedural de caminar, apuntar, retroceso y caer.
- **Rendimiento celular primero:** instancing, sombras limitadas y modo de calidad baja automático.

### Mecánicas centrales

| Mecánica | Descripción |
|---|---|
| **Cajas de suministro con candado** | Cada caja tiene un candado de código: la pregunta ABCD. Rareza (franja gris, azul, morada o dorada) = dificultad de la pregunta = calidad del botín. |
| **Riesgo al forzar el candado** | Mientras respondes estás quieto y los demás ven un icono sobre ti. Moverte cancela la pregunta. |
| **Fallar** | La caja se bloquea 15 s y suena una alarma visible en el minimapa de todos durante 3 s. |
| **Transmisiones del centro de mando** | La zona segura se anuncia por radio como desigualdad: *"Aquí Mando. Zona segura: (x − 12)² + (y + 5)² ≤ 400. Tienen 60 s."* También los lanzamientos aéreos. |
| **Mapa táctico** | Minimapa y mapa grande con ejes y coordenadas, y GPS en el HUD (`POS 12, −4`). Ahí se leen las desigualdades del mando; el piso es natural. |
| **Interceptar transmisión enemiga** | Cada 2 min llega a todos un mensaje cifrado (pregunta rápida que se responde sin detenerse). Los 5 primeros en acertar conocen el centro de la próxima zona 15 s antes. |
| **Racha** | 3 aciertos seguidos en cajas = radar de 10 s (ves a todos en el minimapa). |
| **Todo o nada** | Cajas doradas: pregunta legendaria; si aciertas, botín doble; si fallas, pierdes tu chaleco. |
| **Preguntas paramétricas** | Mismo tipo de ejercicio con números distintos por jugador, opciones barajadas. Nadie puede soplar "es la C". |
| **Campo de entrenamiento** | El lobby es jugable: mientras esperan, todos se mueven, prueban las armas de los armeros y disparan a blancos de práctica. Es el tutorial sin tutorial. |

### Operadores de radio (los caídos siguen jugando)

Al morir pasas a vista espectador y recibes **transmisiones** (preguntas):

- **Si caíste en las fases 1 o 2 de la zona y no has usado tu reanimación:** 3 aciertos seguidos = te reaniman **una vez**, con pistola y venda, en paracaídas a un punto al azar dentro de la zona.
- **Si caíste después o ya usaste tu reanimación:** cada acierto da **un voto** para un sector del mapa (cuadrícula militar 6×6, de A1 a F6). Cada 60 s el sector más votado recibe un **bombardeo** (5 s de aviso con marca roja y sirena, luego daño en área).
  - No se puede bombardear el mismo sector dos veces seguidas (gana el siguiente más votado).
  - Los bombardeos se desactivan cuando quedan 5 vivos o menos.
- **Siempre:** los aciertos como operador suman al ranking final.

### Rarezas y botín

| Rareza | Dificultad | Tiempo para responder | Botín posible |
|---|---|---|---|
| Común (gris) | 1 | 25 s | Munición, venda (+25 vida), granada |
| Raro (azul) | 2 | 35 s | Escopeta, rifle de asalto, chaleco nivel 1 o 2 |
| Épico (morado) | 3 | 45 s | Francotirador, chaleco nivel 3, botiquín (+100) |
| Legendario (dorado) | 4 | 60 s | Todo o nada (botín doble o pierdes el chaleco) |

### Arsenal

| Arma | Rareza | Rol |
|---|---|---|
| **Pistola** | Inicial | Munición infinita, daño bajo |
| **Escopeta** | Raro | Abanico de 8 perdigones, letal de cerca |
| **Rifle de asalto** | Raro | Automático, cadencia alta, cargador de 30 |
| **Francotirador** | Épico | Mucho daño, cerrojo lento, largo alcance; al apuntar la cámara se aleja |
| **Granada** | Común | Se lanza, explota a los 2 s, daño en área. **Máximo 2 en el inventario** |

Los números exactos (daño, cadencia, cargador, alcance) viven en `shared/src/constants.js` y se ajustan jugando.

**Chaleco:** niveles 1 a 3, absorbe 25 / 50 / 75 de daño antes de la vida, y se ve en el modelo del soldado.

### Matemáticas dentro del juego (ideas aprobadas)

Principio: quien entiende el cálculo juega mejor, y quien no, lo aprende jugando.

| # | Idea | Descripción | Fase |
|---|---|---|---|
| 1 | **Terreno z = f(x, y)** | Colinas suaves de una sola función fija, `z = 2·sin(x/10)·cos(y/10)`, usada **solo por dentro**. La pendiente (derivada direccional `∇f · û`) modifica la velocidad **solo entre 80 % y 115 %**. La altura no da ventaja de alcance. | Altura: 1 ✅ · velocidad: 2 |
| 2 | **Mapa táctico con coordenadas** | Minimapa y mapa grande con ejes; GPS `POS x, y` en el HUD. Quien lee la desigualdad del mando llega primero. | GPS: 2 · mapa: 5 |
| 5 | **Operadores de radio** | Ver sección anterior. | 6 |
| 7 | **Interceptar transmisión enemiga** | Ver mecánicas. | 6 |
| 8 | **Campo de entrenamiento** | Lobby jugable *(1 ✅)*; armeros y blancos de práctica *(2)*. | 1, 2 |
| 9 | **Detalles pro** | Reconexión, QR, aviso de girar el celular *(1 ✅)*; vibración y killfeed con icono del arma *(2)*; resultados con tus errores resueltos en KaTeX *(5)*; mapa de calor de temas en el panel del profe *(6)*. | 1, 2, 5, 6 |
| 3 | *Opcional:* **zonas con otras regiones** | Además del círculo: elipses, cardioide en polares `r ≤ 4(1 + cos θ)`, rectángulos `\|x\| ≤ a, \|y\| ≤ b`, anunciadas por el mando. | 5 |

**Backlog:** #4 campos vectoriales (no encaja con la identidad militar) y #6 lanzamiento aéreo en el centro de masa de una región con densidad dada.

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Cliente | React + Vite + Tailwind, **React Three Fiber** + drei (Three.js), nipplejs (joysticks), KaTeX (fórmulas), qrcode.react (QR de la sala) |
| Servidor | Node + Express + **Socket.io**, servidor autoritativo |
| Datos | Banco de preguntas en JSON dentro del repo; resultados en Supabase (opcional) o en JSON local |
| Despliegue | Cliente en Vercel, servidor en Render (+ UptimeRobot para evitar que se duerma) |
| Modelos 3D | **100 % procedurales por código** (geometría low-poly, colores por vértice, texturas de canvas). Sin paquetes externos |

---

## 3. Estructura del proyecto (objetivo)

```
calculo-royale/
├── CLAUDE.md                  # reglas para el asistente de código
├── README.md                  # este documento
├── package.json               # workspaces: client, server, shared
├── scripts/tunnel.js          # túnel de Cloudflare para el celular (npm run tunnel)
├── tests/                     # pruebas con node:test (npm test)
├── shared/
│   └── src/
│       ├── constants.js       # tamaño del mapa, tick rate, stats de armas, rarezas
│       ├── protocol.js        # nombres de eventos de Socket.io
│       ├── codec.js           # codificación compacta de inputs y snapshots
│       ├── movement.js        # movimiento compartido (servidor = verdad, cliente = predicción)
│       ├── collision.js       # círculo vs rectángulo/círculo y rayos contra el mapa
│       ├── combat.js          # ángulos de las balas y auto apuntado (servidor y cliente)
│       ├── mapLayout.js       # edificios, muros, contenedores, árboles (colisión + dibujo)
│       └── terrain.js         # z = f(x, y) y su gradiente (solo interno)
├── server/
│   ├── scripts/bots.js        # bots de prueba (npm run bots, --armados)
│   └── src/
│       ├── index.js           # Express + Socket.io
│       ├── rooms/
│       │   ├── RoomManager.js # códigos, unirse, reconexión
│       │   └── Room.js        # jugadores, host, fase lobby/partida
│       ├── game/
│       │   ├── Game.js        # loop de la partida (tick 20 Hz)
│       │   ├── World.js       # mapa, obstáculos, colisiones
│       │   ├── Player.js
│       │   ├── combat.js      # disparos, daño, granadas
│       │   ├── crates.js      # cajas de suministro, botín, racha y radar
│       │   ├── Zone.js        # fases de la zona (elipses), cierre y daño
│       │   ├── match.js       # transmisiones del mando, lanzamiento aéreo y victoria
│       │   ├── radio.js       # operadores de radio, votos, bombardeos e intercepciones
│       ├── storage.js         # resultados: Supabase si hay variables, si no JSON local
│       │   └── loot.js
│       └── questions/
│           ├── QuestionBank.js
│           ├── generators/    # preguntas paramétricas
│           └── bank/          # JSON por tema
└── client/
    └── src/
        ├── net/               # socket, session (salas y reconexión), GameClient,
        │                      # interpolation (otros jugadores), prediction (jugador propio)
        ├── screens/           # Home, Lobby, Game, Results, Spectator, Host
        ├── game/
        │   ├── Scene.jsx      # Canvas R3F, cámara, luces, niebla
        │   ├── Players.jsx
        │   ├── MapMesh.jsx    # terreno natural con caminos
        │   ├── Buildings.jsx  # casas, contenedores y utilería (con desvanecido por oclusión)
        │   ├── Scenery.jsx    # matorrales y cerca del borde
        │   ├── AimPreview.jsx # flecha de dirección, mira del francotirador, arco de granada
        │   ├── occlusion.js, paths.js
        │   ├── Training.jsx   # armeros y blancos del campo de entrenamiento
        │   ├── Effects.jsx    # trazadoras, fogonazo, explosiones, números de daño
        │   ├── Grenades.jsx
        │   ├── models/        # soldado, skins (estilos y accesorios), armas y utilidades de construcción
        │   ├── effects/       # fogonazo, trazadoras, casquillos, polvo, humo
        │   ├── quality.js     # calidad automática según FPS
        │   └── labels.js      # textos como texturas de canvas
        ├── input/             # inputState, TouchControls (nipplejs), KeyboardMouse
        └── ui/                # HUD, CombatHUD, Killfeed, WeaponIcon, RotateDevice, LockModal (KaTeX), Minimap, Radio
```

---

## 4. Arquitectura de red

- **Servidor autoritativo:** el cliente solo envía intenciones; el servidor mueve, dispara, calcula impactos, valida respuestas y reparte botín.
- **Tick del servidor:** 20 Hz. **Snapshots** a los clientes: 20 Hz, formato compacto (arrays, no objetos con claves largas).
- **Cliente:** interpola posiciones de los demás con ~100 ms de retraso; predice su propio movimiento y se corrige con el servidor.
- **El mapa es 2D por dentro.** Servidor y `shared` usan las coordenadas matemáticas `(x, y)` del plano cartesiano (las mismas del GPS, el mapa táctico y las desigualdades del mando). Three.js las dibuja como `(x, f(x, y), −y)`, así y crece hacia arriba en la pantalla. Colisiones círculo vs círculo y círculo vs rectángulo. El 3D es solo visual.
- **Inputs a 20 Hz** con número de secuencia; si el jugador está quieto y no gira, no se envía nada. El servidor acepta ráfagas de hasta 3 inputs pero en promedio solo 1 por tick (anti speed hack).
- **Reconexión:** cada jugador tiene un token (guardado en `sessionStorage`, por pestaña). Si se cae la conexión o se recarga la página, vuelve como el mismo jugador durante 60 s.
- **Disparos hitscan con compensación de lag:** el cliente envía el tick que estaba viendo; el servidor guarda ~300 ms de historia de posiciones, retrocede a los objetivos a ese instante y traza el rayo contra el mapa y los jugadores. La trazadora es cosmética y termina donde el servidor dice que pegó. El auto apuntado del toque rápido usa la misma compensación.
- **Las respuestas correctas nunca viajan al cliente.** El cliente recibe enunciado y opciones; el servidor valida el índice elegido.

### Eventos principales (ver `shared/src/protocol.js`)

| Dirección | Evento | Datos |
|---|---|---|
| C → S | `room:create` / `room:join` (ack) | nombre, código, token de reconexión |
| C → S | `room:leave` / `game:start` | — (iniciar: solo host) |
| S → C | `room:info` | código, fase, host, lista de jugadores |
| S → C | `room:kicked` | la sesión se abrió en otra pestaña |
| C → S | `input` | `[seq, mx, my, aim, botones, tickVisto, distApuntado]` (botones: disparar, auto apuntado, recargar, granada) |
| C → S | `weapon:switch` / `interact` | ranura 1 o 2 / tomar del armero (luego, cajas) |
| S → C | `player:self` | solo al dueño: vida, chaleco, munición, granadas (cuando cambia) |
| S → C | `combat:hit` / `combat:kill` | a quien disparó: daño y posición / a todos: killfeed |
| C → S | `game:reset` | el host devuelve a todos al lobby |
| C → S | `crate:open` / `crate:answer` / `crate:cancel` | id de la caja, índice elegido |
| S → C | `state` | `[tick, jugadores, granadas, blancos, disparos, explosiones]` (ver `shared/src/codec.js`); luego cajas y zona |
| S → C | `crate:question` | enunciado, opciones, tiempo límite |
| S → C | `crate:result` | correcto o no, botín, explicación |
| S → C | `radio:message` | transmisión del mando (zona, lanzamiento aéreo, bombardeo) |
| S → C | `game:over` | ranking y estadísticas por tema |

---

## 5. Banco de preguntas

Formato fijo para poder alimentarlo copiando y pegando (incluso con otra IA):

```json
{
  "id": "int-dobles-001",
  "tema": "integrales_dobles",
  "dificultad": 2,
  "enunciado": "Evalúe $\\int_0^1 \\int_0^2 xy \\, dy \\, dx$",
  "opciones": ["$1$", "$2$", "$\\frac{1}{2}$", "$4$"],
  "correcta": 0,
  "explicacion": "Integrando en y: $2x$; luego en x: $1$."
}
```

> ⚠️ **Banco PROVISIONAL.** Las 40 preguntas actuales cubren temas típicos de Cálculo Multivariable mientras llegan los temas reales del corte 3. Cada respuesta correcta se recalcula numéricamente en `tests/questions.test.js` (cuadraturas, muestreo y derivadas numéricas); al cambiar el banco, agregar su verificación ahí.

- `tema`: slug del tema (ver `TOPICS` en `shared/src/constants.js`; lista definitiva pendiente de los temas del corte 3).
- `dificultad`: 1 a 4 (coincide con la rareza de la caja).
- Fórmulas en LaTeX entre `$...$`, renderizadas con KaTeX.
- **Paramétricas:** archivos en `server/src/questions/generators/` que exportan `{ name, tema, dificultad, generar(rand) }` y devuelven el mismo formato con números aleatorios (más `valor`, el número correcto, que usan las pruebas y nunca se envía). Hay 4: integral doble sobre rectángulo, gradiente en un punto, derivada direccional y polar a cartesiano, con distractores de errores típicos (olvidar el ½, no normalizar el vector, invertir componentes, cuadrante equivocado).
- **Para agregar preguntas:** editar o crear `server/src/questions/bank/<tema>.json` (mismo formato) y agregar su verificación en `tests/questions.test.js`. `npm test` revisa formato, que KaTeX las pueda dibujar y que la marcada sea la correcta.
- El host elige qué temas entran en la sala; si un tema no tiene preguntas de cierta dificultad, se usa la más cercana.
- Las mismas preguntas alimentan candados, transmisiones de operadores de radio e intercepciones.

---

## 6. Plan por fases

**Prioridad si el tiempo aprieta:** 1) combate, 2) cajas con preguntas, 3) zona. El arte nunca bloquea esas tres: lo que no quepa pasa a la fase 15 (pulido).

| Fase | Objetivo | Resultado verificable |
|---|---|---|
| **0. Base** ✅ | Monorepo, cliente y servidor corriendo, conexión Socket.io | Cliente muestra "conectado" |
| **1. Movimiento multijugador** ✅ | Salas con código y QR, lobby jugable, escena 3D con terreno z = f(x, y), interpolación y predicción, controles táctiles y teclado, reconexión, bots de prueba | 2 pestañas + 1 celular se ven moverse |
| **2. Combate** ✅ | Túnel para probar desde el celular. Piso neutro natural (fuera la pizarra). Pistola, escopeta, rifle de asalto, francotirador y granadas (máx. 2); balas, vida, chaleco, muerte. Obstáculos de `mapLayout` con colisión que bloquean balas. Velocidad por pendiente. Hit markers, números de daño, vibración, killfeed con icono. Campo de entrenamiento con armeros y blancos. Modelos simples todavía | Se pueden eliminar entre jugadores con todas las armas |
| **3. Arte base** (alcance mínimo) ✅ | Soldado procedural completo con animaciones, terreno natural, cámara 3/4, sol con sombras, niebla, efectos, paredes semitransparentes, calidad automática. Solo dos zonas: **pueblo** y **patio de contenedores** | El juego ya "se ve" final en PC y celular |
| **4. Cajas de suministro** ✅ | Banco JSON, modal de candado con KaTeX, validación en servidor, rarezas, botín, racha y radar, Todo o nada | Abrir caja, responder y recibir botín |
| **5. Zona y victoria** ✅ | Transmisiones del mando con la desigualdad, mapa táctico con coordenadas, daño fuera de zona, lanzamientos aéreos, último en pie gana, resultados con tus errores resueltos. *Opcional: #3* | Partida completa de principio a fin |
| **6. Operadores de radio y clase** ✅ | Vista espectador, reanimación, votos y bombardeo por sector, interceptar transmisión, ranking, panel del profe con mapa de calor, reporte (Supabase) | El profe ve estadísticas al final |
| **7. Despliegue** ✅ | Servidor en Render (gratis) y cliente en Vercel desde el monorepo, CORS por variable, `/health` para UptimeRobot, "Despertando el servidor…", guía paso a paso, `npm run stop` | Jugar desde internet con la URL de Vercel |
| **8. Skins propias** ✅ | Skins 100 % procedurales en colecciones (Leyendas de las Matemáticas, Santander, Fantasía, Locuras, De honor por logros de cálculo), selector 3D en el lobby, color del jugador como acento | Elegir skin y verla en partida sin perder rendimiento |
| **9. Mecánicas épicas** ✅ | Recompensa al líder (corona y botín épico), clima por partida (lluvia, niebla, tormenta de arena, atardecer/noche con linternas), jeeps con "código del motor" | Partida con líder, clima y vehículos |
| **10. Cine** ✅ | Duelo final con cinemática y zona final; repetición de la mejor jugada antes de los resultados | Final de dos y repetición |
| **11. Master Rig y skins externas** ✅ | Esqueleto común con huesos y sockets para todas las skins (las animaciones operan sobre huesos), 5 espacios para skins externas en GLB (cargador con caché, normalización, animación por alias de huesos incluido Mixamo, fallback), información de juego siempre visible, galería `/skins`, `?debugSkins=1` y stress test de 40, carga diferida. 4 skins nuevas | Montar un GLB propio y verlo animar en partida |
| **12. Correcciones de la prueba real** ✅ | Granada en PC, brillo en celular con ajuste de Brillo, sin "Profe" por defecto (anfitrión), munición finita con "Obtener balas" (pregunta rápida), 2 o 3 opciones según la dificultad | Jugar en PC y celular sin esos tropiezos |
| **13. Mapa con más cariño** ✅ | Mapa ~2,5 veces más grande, base militar, bosque y trincheras con caminos, casas amuebladas con cuartos, cajas dentro de los edificios y en lugares disputados | Partida de 40 con lugares para buscar botín |
| **14. Despliegue en bus** ✅ | Bus volador amarillo y verde que cruza el mapa; cada uno salta cuando quiere, caída libre y paracaídas dirigibles; alternativa "elegir punto" en el lobby | Todos caen desde el bus |
| **15. Pulido y carga** ✅ | Sonidos por código con volumen, revisar el bot acostado, prueba de carga con 40 bots contra Render, rendimiento en celular con el mapa grande | Prueba de carga estable con 40 conexiones |
| **16. Selector de skins con retratos** ✅ | Registro único, skins externas guiadas por las carpetas reales (manifiesto en el build), retratos 2D con respaldo, selector sin GLB, precarga y respaldo en partida | Elegir una externa por su retrato y verla en partida |
| **17. Gráficos estables y responsive** | Calidad automática que recorta en orden (resolución, sombras, decoración, niebla) con histéresis, calidad manual y escala de interfaz en Opciones, toda la interfaz con `clamp()` y zonas seguras, cola de mensajes | Se ve digno en un celular antiguo y nada se sale de la pantalla |
| **18. Botín de battle royale y mapa más grande** | Mapa de ~280 m con terminal, mercado, estadio, cañón y aeródromo; botín en el suelo, inventario, miras, curación con tiempo, accesorios, mochila, casco y caja de botín al morir | Saquear y equiparse como en un battle royale |
| **19. Audio total** | Canales Música, Efectos y Voz, ducking, efectos ampliados, archivos propios opcionales, música por momento y voz del Mando | La partida suena completa |
| **20. Modo presentación y modo fácil** | Preguntas fáciles para probar, intro y créditos, director de cámara en el proyector, completar con bots, medallas, frases rápidas, exportar CSV | Presentar el día D |
| **21. Modo Profe Jefe Final** | Modo aparte: un jefe gigante con escudo matemático que solo baja con aciertos del equipo | Partida de jefe de 8 min |
| **22. Revisión final** | Calidad y brillo en celular, servidor en Virginia (más cerca), carga con el mapa grande, checklist del día D | Todo listo para la presentación |
| *Backlog* | Modo "Profe jefe final" (el profe es un jefe gigante y el salón coopera respondiendo para derribarlo), #4 campos vectoriales, #6 centro de masa | |

### Planes por fase (modo maratón: el plan se escribe aquí antes de ejecutar cada fase)

#### Fase 3: arte base
- **Cámara** 3/4 a 50° (constante `CAMERA_PITCH_DEG` en `Scene.jsx`), con un leve adelanto hacia la mira.
- **Luz:** sol direccional con sombras que siguen al jugador (solo soldados, casas y contenedores las proyectan), cielo y niebla atmosférica.
- **Soldado procedural** (`models/soldier.js`): uniforme verde oliva para todos; color del jugador en la banda del casco, el brazalete y la mochila. Chaleco visible por nivel (0 a 3). Piernas siguen el movimiento y torso la mira; animación de caminar, brazos arriba al disparar o apuntar, retroceso, recarga y caída. Silueta del jugador propio cuando queda detrás de algo.
- **Armas procedurales** (`models/weapons.js`) en las manos y en los armeros.
- **Terreno natural:** caminos de tierra (`PATHS` en `mapLayout`), mezcla de pasto y tierra, matorrales decorativos con instancing, cerca baja en el borde.
- **Pueblo y contenedores:** casas con zócalo, dintel, piso y techo a dos aguas que se oculta al entrar (`HOUSES` en `mapLayout`); contenedores corrugados con puertas; cajas, barriles y rocas detallados. Lo que tapa al jugador desde la cámara se vuelve semitransparente.
- **Efectos:** casquillos, chispas en paredes, polvo al caminar, humo de granada, sacudida de cámara al recibir daño, hit marker.
- **Calidad automática** (`quality.js`): alta, media o baja según FPS; `?calidad=baja` la fuerza y `?debug=1` muestra FPS, llamadas de dibujo y triángulos.
- **Pruebas:** controlador de calidad, oclusión y distancia a caminos. Sin cambios en la lógica del servidor.

#### Fase 4: cajas de suministro
- **Banco provisional** (`server/src/questions/bank/*.json`): ~40 preguntas ABCD en 9 temas (integrales dobles y triples, cambio de orden, polares, cilíndricas y esféricas, jacobiano, máximos y mínimos, Lagrange, gradiente y derivada direccional), dificultades 1 a 4. Una prueba recalcula numéricamente cada respuesta correcta.
- **4 generadores paramétricos** (`generators/`): integral doble sobre rectángulo, gradiente en un punto, derivada direccional, polar a cartesiano; distractores con errores típicos.
- **`QuestionBank`:** elige por temas de la sala y dificultad (la más cercana si falta), mezcla generadores, baraja opciones por jugador; la respuesta correcta queda solo en el servidor.
- **Cajas** en posiciones fijas de `mapLayout` (`SUPPLY_CRATES`) con rareza fija por lugar (más valiosas dentro de casas y contenedores); una caja de práctica en el campo de entrenamiento.
- **Flujo:** E / botón Abrir → modal de candado con KaTeX (rareza, tema, tiempo, 4 opciones grandes, botín posible). Mientras respondes: quieto e icono de expuesto sobre tu soldado; moverte o morir cancela. Acierto: botín y explicación. Fallo o tiempo agotado: caja bloqueada 15 s y alarma visible 3 s para todos (baliza roja; el minimapa llega en la fase 5).
- **Botín:** venda (+25), botiquín (vida completa), munición, granada (máx. 2), armas y chaleco por rareza. Racha de 3 aciertos = radar 10 s (flechas en el borde hacia todos los enemigos). Doradas = Todo o nada (botín doble o pierdes el chaleco).
- **Host:** elige en el lobby qué temas entran en la sala.
- **Pruebas:** banco (formato y cálculo), generadores, flujo de cajas en el servidor (acierto, fallo, bloqueo, cancelar al moverse, Todo o nada, racha), que la respuesta correcta nunca se envía.

#### Fase 5: zona y victoria
- **Zona** (`server/src/game/Zone.js`): 5 fases en ~9 minutos (aviso de 60 s, cierre de 45 s). Cada zona nueva queda dentro de la anterior. Todas se modelan como elipses (el círculo es el caso p = q): la fase 3 es una elipse (idea #3).
- **Transmisiones del mando** (`radio:message`): la zona se anuncia con su desigualdad en KaTeX, `(x − a)² + (y − b)² ≤ r²` o `(x − a)²/p² + (y − b)²/q² ≤ 1`, con 60 s de aviso; también el cierre y el lanzamiento aéreo.
- **Daño fuera de la zona**, creciente por fase (no lo absorbe el chaleco); muerte por zona en el killfeed.
- **Mapa táctico:** minimapa con ejes, coordenadas, cuadrícula de sectores A1–F6, zona actual y siguiente, alarmas, lanzamiento aéreo y enemigos del radar; al tocarlo se abre el mapa grande. GPS con sector en el HUD.
- **Lanzamiento aéreo** a mitad de partida: el mando anuncia las coordenadas; una caja dorada (Todo o nada) cae en paracaídas en 20 s dentro de la zona.
- **Victoria:** último en pie gana (con 2 o más jugadores). Pantalla de resultados: posición, bajas, aciertos por tema y cada pregunta fallada con su solución en KaTeX (solo la ve su dueño). El host vuelve al lobby.
- **Pruebas:** zona (contención, interpolación, daño, desigualdad), sectores, lanzamiento aéreo, victoria, posiciones y resultados privados.

#### Fase 6: operadores de radio y clase
- **Al morir en partida:** vista espectador (sigue a quien te eliminó, o a otro vivo; se puede cambiar) y panel de operador de radio con transmisiones (preguntas de 30 s, una tras otra).
- **Reanimación:** si caíste en las fases 1 o 2 de la zona y no la has usado, 3 aciertos seguidos te reaniman una vez dentro de la zona con pistola y 75 de vida (50 + venda). Un fallo reinicia la cuenta.
- **Bombardeo por votos:** si no puedes reanimar, eliges un sector en la cuadrícula A1–F6 y cada acierto le suma un voto. Cada 60 s el sector más votado recibe un bombardeo (aviso de 5 s con el sector marcado en rojo, luego daño en todo el sector). Nunca el mismo sector dos veces seguidas; desactivado con 5 vivos o menos.
- **Interceptar transmisión enemiga:** cada 2 minutos, pregunta rápida para todos los vivos sin detenerse (panel pequeño). Los 5 primeros en acertar reciben en privado el centro de la próxima zona antes del anuncio público.
- **Ranking final:** puntos = 10 por puesto superado + 15 por baja + 5 por acierto (incluidos los de operador e intercepciones).
- **Vista para proyector:** `/espectador?code=ABCD` muestra el mapa completo, vivos, killfeed, transmisiones y aciertos por tema en vivo. **Panel del host** con el porcentaje de acierto por tema de la clase en vivo.
- **Resultados guardados:** con `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` se guardan en Supabase; sin ellas, en `server/data/resultados/*.json`. El juego funciona igual en ambos casos.
- **Pruebas:** reanimación, votos y bombardeo, intercepción, puntaje, estadísticas de clase y guardado local.

#### Fase 7: despliegue
- **Vercel** (cliente) desde la raíz del monorepo con `vercel.json`: instala los workspaces (`--ignore-scripts`), compila `client` con `shared` y publica `client/dist`; todas las rutas van a `index.html` (para `/espectador`).
- **Render** (servidor, plan gratis) con `render.yaml`: instala solo `server` y `shared` sin dependencias de desarrollo, `npm start`, Node 22+, health check en `/health`.
- **Variables:** `VITE_SERVER_URL` en Vercel (URL de Render); `CLIENT_ORIGIN` en Render (URL de Vercel; admite comodines como `https://*.vercel.app` para las vistas previas).
- **Inicio:** si el servidor no responde en 2 s, "Despertando el servidor…" con contador (Render gratis tarda ~50 s en despertar).
- **QR:** en producción usa la URL de Vercel (el origen de la página).
- **`npm run stop`:** libera los puertos 3001 y 5173 (Windows, macOS y Linux).
- **Guía paso a paso** en este README para Vercel, Render y UptimeRobot. Las pruebas de despliegue se hacen en una copia limpia del repo con los mismos comandos que usarán Render y Vercel.

#### Fase 8: skins propias
- **Catálogo** en `shared/src/skins.js` (id, nombre, colección, rareza visual y logro si es de honor). El servidor solo acepta skins del catálogo y las de honor solo si el cliente dice tenerlas desbloqueadas (el progreso vive en el navegador, sin base de datos).
- **Modelos** en `client/src/game/models/skins.js`: cada skin cambia colores del uniforme y suma piezas procedurales grandes (pelucas, sombreros, capas, máscaras, cascos, accesorios), fusionadas y en caché por skin y color. El color del jugador queda como acento (banda, brazalete o detalle) en todas.
- **Colecciones:** Leyendas de las Matemáticas (Newton, Gauss, Euler, Hipatia, Ada Lovelace), Santander (Comando Culona, Guardián del Chicamocha, Arriero), Fantasía (Princesa de Gala, Caballero Medieval, Hechicera de Fuego, Samurái, Ninja Sombra), Locuras (Astronauta, Luchador, Dinosaurio inflable, Robot Retro, Momia, Mariachi Táctico) y De honor.
- **De honor** (bloqueadas): se desbloquean con logros de cálculo guardados en `localStorage`: 10 cajas legendarias acertadas, ganar una partida sin fallar ninguna pregunta, 5 aciertos seguidos como operador de radio, 50 aciertos en total.
- **Selector** en el lobby: vista 3D girando, rareza con color, candado y cómo desbloquear. La skin elegida se guarda en el navegador y se envía al servidor (`player:skin`), que la reparte en `room:info`.
- **Pruebas:** catálogo y validación en el servidor, logros (progreso y desbloqueo) y que cada skin construya su modelo.

#### Fase 9: mecánicas épicas
- **Recompensa al líder:** desde la fase 2 de la zona, el vivo con más puntos (15 por baja, 5 por acierto) queda marcado en el minimapa de todos y con una corona sobre la cabeza. El mando anuncia cada cambio de líder. Quien lo elimine recibe botín épico al instante.
- **Clima por partida** (el host lo elige en el lobby o queda aleatorio): despejado; lluvia (gotas, charcos brillantes, menos visibilidad); niebla densa (se ve muy poco: el radar vale oro); tormenta de arena (polvo volando y un viento que desvía las granadas); noche (todo oscuro, cada soldado con linterna y cono de luz, y disparar revela tu posición en el minimapa de todos 2 s). La cantidad de partículas respeta la calidad automática.
- **Jeeps:** 4 en el mapa. Para encenderlos hay que responder el "código del motor" (pregunta de dificultad 2; si fallas, el motor se traba 10 s). Conductor (el joystick izquierdo maneja, no dispara) y un pasajero que sí dispara. Más rápidos que a pie; con el motor encendido aparecen en el minimapa de quien esté cerca (ruido). Vida propia (las balas y granadas les pegan; protegen a los de adentro) y explotan dañando alrededor. Atropellar hace daño según la velocidad. Física compartida (`shared/vehicle.js`): el servidor manda y el conductor predice su jeep.
- **Pruebas:** líder (cálculo, cambio, recompensa), viento en granadas, física del jeep (aceleración, giro, choque), encender con pregunta, subir y bajar, atropello, daño y explosión, pasajero dispara sin pegarle a su propio jeep.

#### Fase 10: cine
- **Duelo final:** cuando en la partida quedan 2 vivos (venían de más), el servidor anuncia `match:duel`. Durante 4 s nadie se mueve ni recibe daño (presentación): barras de cine arriba y abajo, "DUELO FINAL", y la cámara gira alrededor de cada finalista (2 s cada uno) con su nombre y su skin. Luego la zona salta a un último círculo (radio 9) entre los dos, que se cierra en 25 s con el daño final. El mando lo anuncia por radio.
- **Proyector:** durante el duelo la vista `/espectador` se parte en dos (una cámara siguiendo a cada finalista, con su nombre).
- **Repetición:** el servidor guarda en memoria los últimos ~10 s de snapshots (los mismos que ya envía). Cada baja se puntúa como jugada candidata: multi-baja (2+ del mismo en 5 s), francotirador de larga distancia (más de 30 m), atropello con jeep y baja final (la que gana la partida). Al elegir una mejor, se guarda su clip (4,5 s antes y 1,5 s después). Al terminar la partida, antes de los resultados, todos ven la repetición: ~8 s con cámara lenta en el momento clave, barras de cine, título de la jugada ("Atropello de Ana a Luis") y botón **Saltar**. El clip va a 10 Hz (los disparos y explosiones del snapshot omitido se suman al siguiente) para que pese poco.
- **Pruebas:** detección del duelo (una sola vez, congelado y zona final), puntaje de jugadas (multi-baja, francotirador, atropello, final), clip con el rango correcto de ticks y eventos conservados al reducir a 10 Hz, y reproductor del cliente (cámara lenta y fin).

#### Fase 11: Master Rig y skins externas
- **Inspección:** el soldado está en `client/src/game/models/soldier.js` (geometrías fusionadas por pieza: piernas con pivote en la cadera, torso con cabeza/casco/chaleco/mochila, brazos con el arma, en caché por skin, color y chaleco); los estilos de la fase 8 en `models/skins.js` (`styleOf`, `extra` y `armExtra`). Cada jugador se crea en `game/Players.jsx` (`SoldierAvatar`) y se anima ahí (`animate`: grupos `lower`, `upper`, `shoulders`, `legL/legR`, `body`; el arma se elige entre 4 mallas). La hitbox vive solo en el servidor (`PLAYER_RADIUS` 0,6 en `shared/constants.js`); el cliente no la toca. La skin viaja en `room:info` (`player:skin` validado contra `shared/skins.js`), nunca en los snapshots. Calidad en `game/quality.js`. Pose de jeep: `IN_VEHICLE` esconde las piernas; duelo: `client.duel` y la cámara de cine. `SoldierModel.jsx` repite el soldado quieto para el selector y `/galeria`.
- **Master Rig** (`client/src/game/character/`): jerarquía de huesos con nombre (Root, Hips, Spine, Chest, Neck, Head, hombros, brazos, piernas, pies) y sockets (`WeaponSocket_R` y los demás). Las piezas procedurales de la fase 8 se montan sobre los huesos (los brazos se separan en derecho e izquierdo; el resto igual) y `animate` pasa a escribir rotaciones de huesos: caminar, apuntar, retroceso, recarga, caída, conducir, pasajero y victoria (finalistas en la presentación del duelo y ganador en los resultados). La animación se calcula como rotaciones en el espacio del personaje, relativas a la pose de reposo, para poder aplicarla igual a otros esqueletos.
- **Skins externas** (`character/skins/registry.js`, `character/loaders/skinLoader.js`): desde la fase 16, una por carpeta real de `client/public/assets/skins/external/` (manifiesto generado en el build). GLTFLoader + SkeletonUtils de `three/examples/jsm`, caché con conteo de referencias, normalización a 1,8 m con pies en 0, modos A (estático con balanceo), B (esqueleto propio, clips si los trae) y C (alias de huesos, incluido Mixamo: mismas animaciones procedurales sobre sus huesos). El arma queda en el socket del Master Rig. Fallback (soldado gris) ante cualquier error. `preloadMatchSkins` al iniciar la partida; mientras carga se ve el fallback. Sombras y LOD según calidad (de noche y en baja, el LOD más bajo sin sombras); avisos si un GLB pasa de 3 MB, 15 000 triángulos o texturas de 1024.
- **Siempre visible** sobre cualquier skin: anillo del color del jugador, nombre, vida, chaleco con su nivel y corona del líder.
- **Galería `/skins`, `?debugSkins=1` y `/skins/stress`** (40 personajes, noche y lluvia, FPS con `renderer.info`), cargados con `import()` dinámico junto con el sistema GLB. `vercel.json` con caché para los GLB. Sección "Cómo agregar skins externas".
- **Skins nuevas:** Mecha Integral, Dragón de Jade, Rey Pirata Fantasma y Hechicero del Gradiente (procedurales).
- **Pruebas:** Master Rig (huesos, sockets, misma pose que antes en reposo), animación relativa al reposo sobre un esqueleto tipo Mixamo, registro y validación en el servidor, normalización, caché y conteo de referencias, fallback ante 404.

#### Fase 12: correcciones de la prueba real
- **Granada en PC:** no se pudo reproducir (funciona en local y en el sitio desplegado con teclado simulado). Se endurece la causa más probable: si la primera pulsación de G se pierde (foco, extensión, IME) y llegan solo repeticiones, igual se arma el arco; se acepta `e.key` además de `e.code`; las teclas solo se ignoran al escribir en un campo de texto. Además, en PC un clic en el botón de granada del HUD arma el lanzamiento y el siguiente clic lanza. Prueba del flujo de teclado completo (G mantenida → arco → soltar → el servidor la lanza y explota) y de R, 1/2, E, B, clic derecho y G.
- **Brillo:** más luz ambiental y exposición en celular, terreno un poco más claro, que calidad baja/media no oscurezca (revisar la causa) y menú **Opciones** con deslizador de **Brillo** guardado en el navegador. Capturas en `?calidad=baja`, `media` y `alta` para comparar.
- **Sin "Profe":** cualquiera crea la sala y queda como **anfitrión** ("Crear sala", "Anfitrión", "Panel del anfitrión"); sin nombres por defecto de profe.
- **Munición finita:** todas las armas con cargador y reserva limitada (pistola con 3 cargadores de reserva). Botón **Obtener balas** sobre Recargar (celular) y tecla **B** (PC): pregunta rápida de dificultad 1 en tarjeta compacta (generadores nuevos: derivada de un polinomio en un punto, regla de la potencia, límite por sustitución directa), 15 s, te puedes mover pero no disparar; acierto = un cargador de reserva para el arma en mano, fallo = 10 s de espera. Las cajas siguen dando munición (botín ajustado). Todo validado en el servidor.
- **Opciones por dificultad:** dificultad 1 y 2 (común, raro, balas, intercepción, operadores, código del motor) con 2 opciones; 3 y 4 (épico, legendario, Todo o nada) con 3. Se conservan la correcta y los primeros distractores (los generadores ya ponen primero los de errores típicos; en el banco, el orden en que están escritos o el campo opcional `plausibles`). Modal con botones más grandes.
- **Pruebas:** teclado de PC, munición finita y "Obtener balas" (sin respuesta en el cliente, no dispara mientras responde, espera tras fallar), generadores nuevos verificados numéricamente, número de opciones por dificultad.

#### Fase 13: mapa con más cariño
- **Mapa más grande:** lado de 190 m (antes 120: ~2,5 veces el área). Zona en proporción (radios ×1,58; tiempos un poco más largos, ~9,5 min de zona más el final), sectores A1–F6 y bombardeo según el tamaño, lanzamiento aéreo a los 4 min 40 s, 6 jeeps, bus más rápido. Colisiones con rejilla espacial (más obstáculos sin más costo por consulta).
- **Zonas:** pueblo (noroeste, 8 casas), patio de contenedores (sureste, ampliado), **base militar** (noreste: hangar con portón ancho, 2 barracas, 4 torres de vigilancia, cerca con portones y sacos de arena), **bosque** (suroeste: ~150 árboles con instancing, rocas, claros y una cabaña) y **trincheras** (sur: zanjas en zigzag de sacos de arena y un búnker). Caminos de tierra que las conectan desde el centro y entre sí. Cada zona con nombre en el mapa táctico.
- **Interiores:** casas con 1 a 3 cuartos (tabiques con vano) amuebladas por código según el tipo de cuarto (sala: sofá, estante, mesa de centro, alfombra, cuadro; cuarto: cama, ropero, mesa de noche, cuadro; cocina: cocina con mesón, nevera, mesa y sillas; bodega: cajas y barriles). Hangar con estanterías y pilas de cajas, barracas con literas y casilleros. Muebles grandes con colisión en `mapLayout` (cobertura); los pequeños son decorativos. Muebles con instancing por tipo y solo los de las casas cercanas a la cámara.
- **Cajas estratégicas:** ~80 puntos posibles; la mayoría dentro de casas, bodega, hangar, barracas, bajo las torres, contenedores, trincheras y búnker; pocas comunes en campo abierto. Las de mayor rareza en lo más disputado (plaza y centro del pueblo, hangar, torres, centro del patio de contenedores, búnker). En cada partida se elige una parte al azar con semilla respetando esas reglas (las de los puntos calientes siempre están).
- **Pruebas:** el mapa sin obstáculos superpuestos, cajas y jeeps en lugares libres, cada casa con salida (se llega a la puerta desde dentro), selección de cajas por partida con las reglas, zona que cabe en el mapa y dura lo previsto, rejilla de colisión equivalente a la búsqueda completa.

#### Fase 14: despliegue en bus
- **Bus de batalla** (servidor autoritativo, `server/src/game/deploy.js`): al iniciar, todos van dentro de un bus volador amarillo y verde (tipo intermunicipal, procedural, colgado de un globo con hélice) que cruza el mapa en línea recta con dirección al azar, pasando cerca del centro. La ruta se ve en el mapa táctico 4 s antes de salir. Cada uno salta cuando quiere (**Espacio** en PC, botón grande **¡Saltar!** en celular); al final de la ruta saltan los que queden. Los bots saltan en momentos al azar.
- **Caída:** caída libre dirigible con el joystick izquierdo o WASD (movimiento compartido en `shared/movement.js`, sin colisiones en el aire), paracaídas automático cerca del suelo, también dirigible; se aterriza solo con la pistola. En el aire no se dispara ni se recibe daño (ni de la zona ni del bombardeo). La altura viaja en el snapshot solo mientras se está en el aire; banderas `IN_BUS`, `FALLING` y `PARACHUTE`.
- **Cámara:** en el bus, el bus y el mapa desde arriba; cayendo, se aleja según la altura. Se ven los demás saltando con su skin, con pose de caída libre y de paracaídas (Master Rig).
- **Paracaídas compartido:** el mismo modelo lo usan el despliegue, la reanimación de operadores (ahora cae en paracaídas) y el lanzamiento aéreo.
- **Imagen propia:** el bus carga `client/public/assets/bus/costado.png` en sus costados si existe; si no, queda con sus colores.
- **Respaldo elegible:** el anfitrión elige en el lobby "Despliegue: bus / elegir punto". En "elegir punto", 10 s con el mapa táctico abierto para tocar dónde caer (si no eliges, uno al azar) y se cae ahí en paracaídas.
- **Pruebas:** ruta dentro de los límites y que cruza el mapa, salto manual y automático, caída y paracaídas hasta aterrizar, nada de daño ni disparos en el aire, reanimación en paracaídas, modo elegir punto, movimiento en el aire compartido.


#### Fase 15: pulido y carga
- **Sonidos sintetizados** con Web Audio (sin archivos): disparo por arma, recarga, lanzar granada, explosión, motor del jeep (según la velocidad), pasos, candado abierto y fallado, sirena del bombardeo, radio del mando (estática y pitido), salto del bus y paracaídas. Volumen y paneo según la distancia al jugador. Deslizador de **Volumen** en Opciones (guardado en el navegador). El audio arranca con el primer toque o clic (regla de los navegadores).
- **Bot acostado:** reproducirlo con bots caminando de lado y corregirlo si aparece.
- **Prueba de carga contra Render:** script que crea una sala y conecta 40 clientes (39 bots y el anfitrión) a \`calculo-royale-server.onrender.com\`, inicia la partida y mide latencia (ping) durante unos minutos. \`/health\` agrega memoria y uso de CPU del proceso para leerlos desde afuera. Reporte en la bitácora.
- **Rendimiento con el mapa grande:** llamadas de dibujo y triángulos en \`?calidad=baja\`, \`media\` y \`alta\` en distintos lugares del mapa; si algo se dispara, ajustar distancia de muebles, niebla, matorrales o sombras.
- **Pruebas:** mezcla de sonidos (volumen y distancia) sin navegador, métricas de \`/health\`.


#### Fase 16: selector de skins con retratos
- **Inspección:** procedurales reales = las 28 de `shared/src/skins.js` (Básicas, Leyendas de las Matemáticas, Santander, Fantasía, Locuras, De honor y Leyendas del Cálculo); no se tocan. Externas reales en `client/public/assets/skins/external/`: `2b`, `furina`, `ghost` (`character.glb`) y `luffy` (su archivo se llama `luffy.glb`: no se renombra, el manifiesto acepta `character.glb` o el único `.glb` de la carpeta); `externa_05` está vacía. Las cuatro son mallas estáticas sin esqueleto (~5 000 triángulos, 3 texturas, 1,9–2,8 MB): animan en modo A. Retratos en `client/public/assets/skins/portraits/<id>.png` para las cuatro.
- **Manifiesto:** `scripts/skins-manifest.js` (antes de `npm run dev` y `npm run build`) lee esas carpetas y escribe `client/src/game/character/skins/external-manifest.json` y `shared/src/externalSkins.js` (módulo JS: este lo usa el servidor para validar: Render no corre el build del cliente). Se quitan los espacios `externa_01`…`externa_05`.
- **Registro único:** procedurales del catálogo + externas del manifiesto, con una línea editable por externa (nombre, escala, rotación, offset, weaponOffset); sin línea, el id con mayúscula inicial.
- **Retratos:** `<id>.png`; si falta, tarjeta con el color de la rareza e iniciales.
- **Selector sin GLB:** tarjetas grandes con retrato y nombre, secciones "Skins del juego" y "Personajes especiales", candado y logro en las de honor, selección guardada en el navegador.
- **Partida:** solo viaja `skinId` (validado en el servidor); al iniciar se precargan los GLB de la sala con caché; si uno falla, la skin procedural base al instante y `console.warn`.
- **Ajuste:** cada externa revisada en `/skins` (caminar, apuntar, conducir, bus, paracaídas y victoria) y su línea ajustada; en modo A se sienta en el jeep (baja) y se inclina en la caída.
- **Pruebas:** manifiesto (character.glb, otro .glb, carpeta vacía), registro sin espacios vacíos, validación del servidor, respaldo de retrato y de GLB, que el selector no pida ningún GLB.

**Meta semana 1:** fases 0 a 5 (núcleo jugable con su look).
**Semanas 2 y 3:** fases 6 y 7, y cargar las preguntas reales del corte 3.

---

## 7. Cómo correr

Requisitos: **Node 22+** (se usa `node --env-file-if-exists`; probado con Node 24).

```bash
npm install        # instala client, server y shared (workspaces)
npm run dev        # cliente y servidor a la vez
npm run dev:server # solo servidor
npm run dev:client # solo cliente
npm run build      # build de producción del cliente (client/dist)
npm run bots -- ABCD 5   # 5 bots caminando al azar en la sala ABCD (Ctrl+C para sacarlos)
npm run bots -- ABCD 5 --armados   # bots que disparan al jugador visible más cercano
npm run bots -- ABCD 5 --cazar     # además caminan hacia el jugador vivo más cercano
npm run tunnel     # URL pública para el celular (con npm run dev corriendo)
npm test           # pruebas (node:test)
npm run stop       # libera los puertos 3001 y 5173 (si quedó otro npm run dev abierto)
```

| Servicio | Puerto | Comprobación |
|---|---|---|
| Cliente (Vite) | 5173 | `http://localhost:5173` muestra la pantalla de inicio con "Conectado" |
| Servidor (Express + Socket.io) | 3001 | `http://localhost:3001/health` (incluye cuántas salas hay) |

Vite redirige `/socket.io`, `/health` y `/net-info` al servidor: en desarrollo **todo pasa por el puerto 5173**.

### Probar una partida completa rápido

En dos terminales, una copia acelerada sin tocar la normal:

```bash
# servidor de prueba (zona 12 veces más rápida)
cd server && PORT=3002 CR_TIME_SCALE=12 node src/index.js
# cliente de prueba apuntando a ese servidor
cd client && CR_SERVER_URL=http://localhost:3002 npx vite --port 5175
# bots armados para esa copia
SERVER_URL=http://localhost:3002 npm run bots -- <CÓDIGO> 3 --armados
```

### Probar solo, sin más dispositivos

1. Abrir `http://localhost:5173`, escribir un nombre y **Crear sala (profe)**.
2. En otra terminal: `npm run bots -- <CÓDIGO> 5` (agregar `--armados` para que disparen).
3. Abrir una segunda pestaña y entrar con el mismo código (cada pestaña es un jugador distinto).
4. **Controles PC:** WASD o flechas = moverse, mouse = apuntar, clic = disparar (mantener con el rifle), R = recargar, 1/2 = cambiar arma, G = granada hacia el mouse, E = tomar del armero.
   **Celular:** mitad izquierda = moverse; mitad derecha (el joystick aparece donde tocas):
   - **Toque rápido:** dispara solo al enemigo visible más cercano.
   - **Arrastrar:** pistola, escopeta y rifle disparan al salir de la zona de cancelación (30 % del radio, anillo visible). La flecha bajo el soldado marca la dirección (sin línea de mira).
   - **Francotirador:** arrastrar apunta (línea roja larga, la cámara se desplaza hacia la mira y el soldado camina a la mitad de velocidad); **soltar** dispara; volver al centro (anillo rojo con ✕) cancela.
   - **Granada:** tocar el botón de granada activa el modo; arrastrar dibuja el arco y el círculo de explosión donde cae (más lejos = más arrastre); soltar lanza; volver al centro cancela; tocar el botón otra vez sale.
   - Al soltar, el soldado conserva la última dirección de mira.
   - Los botones del juego responden al tocar aunque otro dedo esté en el joystick.
5. En el campo de entrenamiento hay armeros (escopeta, rifle, francotirador, granadas, chaleco) y blancos de práctica. Lo que se toma ahí no pasa a la partida.
6. Recargar una pestaña: vuelve al mismo jugador, en la misma posición.

### Vista para proyector y panel del profe

- **Galería de skins:** `/galeria` muestra las 24 skins juntas desde la cámara 3/4.
- **Proyector:** abrir `/espectador?code=ABCD` (por ejemplo `http://localhost:5173/espectador?code=ABCD` o con la URL del túnel). Muestra todo el mapa, vivos, killfeed, transmisiones y el acierto de la clase por tema; se puede seguir a un jugador con ◀ ▶.
- **Panel del profe:** botón **Panel** arriba a la derecha durante la partida (solo el host): acierto por tema de menor a mayor, vivos y operadores, y el enlace del proyector.

### Guardar resultados en Supabase (opcional)

Sin configurar nada, cada partida terminada se guarda en `server/data/resultados/<fecha>-<código>.json` (ignorado por git). Para usar Supabase:

1. Crear la tabla en el editor SQL de Supabase:

```sql
create table partidas (
  id bigint generated always as identity primary key,
  codigo text not null,
  fecha timestamptz not null,
  temas text[],
  ganador text,
  ranking jsonb,     -- [{ id, name, place, kills, correct, answered, score }]
  por_tema jsonb,    -- { tema: { ok, total } } de toda la clase
  jugadores jsonb    -- [{ nombre, puesto, bajas, aciertos, respuestas, por_tema, falladas }]
);
```

2. En `server/.env`: `SUPABASE_URL=https://<proyecto>.supabase.co` y `SUPABASE_SERVICE_KEY=<service role key>` (la clave de servicio va solo en el servidor, nunca en el cliente).
3. Si Supabase falla, la partida se guarda igual en el JSON local y el juego sigue.

### Variables de entorno (opcionales en desarrollo)

Copiar `server/.env.example` a `server/.env` y `client/.env.example` a `client/.env` solo si hace falta cambiar algo.

| Variable | Dónde | Uso |
|---|---|---|
| `PORT` | server | Puerto del servidor (por defecto 3001; Render lo asigna) |
| `CLIENT_ORIGIN` | server | Orígenes CORS permitidos, separados por coma. Vacío = cualquiera |
| `VITE_SERVER_URL` | client | URL del servidor en producción. Vacío = mismo origen (proxy de Vite) |
| `CR_SERVER_URL` | client (Vite) | A dónde apunta el proxy de desarrollo. Vacío = `http://localhost:3001` |
| `CR_TIME_SCALE` | server | **Solo pruebas.** Acelera la zona, el lanzamiento aéreo, bombardeos e intercepciones (ej. `12` = partida de ~1 min) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | server | Opcional: guardar resultados en Supabase (ver arriba) |

### Cómo agregar skins externas

Las skins externas ("Personajes especiales" en el selector) salen de las carpetas reales: **una carpeta = una skin**. No hay espacios vacíos.

1. **Pon el modelo** en `client/public/assets/skins/external/<id>/` con el nombre `character.glb` (o cualquier nombre si es el único `.glb` de la carpeta, como `luffy/luffy.glb`). El `<id>` es el nombre de la carpeta (minúsculas, sin espacios). Se publica con el build de Vercel (caché de 1 día).
2. **Pon su retrato** (opcional) en `client/public/assets/skins/portraits/<id>.png` (vertical, 3:4, ~600×800 px). Sin retrato, el selector muestra una tarjeta con el color de la rareza y las iniciales. Sirve también para las skins procedurales (`soldado.png`, `newton.png`…).
3. **Corre `npm run skins:manifest`** (o simplemente `npm run dev` / `npm run build`, que lo corren antes). Genera `client/src/game/character/skins/external-manifest.json`, `client/src/game/character/skins/portraits.json` y `shared/src/externalSkins.js` (con este el servidor valida el `skinId`; **súbelos al repo**, Render no corre el build del cliente).
4. **Ajusta su línea** (opcional) en `EXTERNAL_OVERRIDES` de `client/src/game/character/skins/registry.js`. Sin línea, el nombre es el id con mayúscula inicial y los ajustes por defecto:
   ```js
   luffy: { name: 'Luffy', scale: 1, rotation: [0, 0, 0], offset: [0, 0, 0], weaponOffset: { position: [-0.16, -0.1, -0.07], rotation: [0, 0, 0] } },
   ```
   `scale` multiplica la altura normalizada (1,8 m), `offset` en metros, `rotation` en grados extra (el estándar de glTF es mirar a +Z y ya se corrige solo), `weaponOffset` mueve el arma (los modelos delgados la necesitan más cerca del cuerpo), `victoryAnimation` si el archivo trae un clip de victoria con otro nombre, y `rarity` si no quieres que sea legendaria.
5. **Ábrelo en `/skins`** y ajústalo: animaciones (Idle, Walk, Run, Aim, Shoot, Reload, Death, Victory, Drive y Pasajero con el jeep de referencia, Caída y Paracaídas), LOD, calidad, esqueleto, caja, sockets y nombres de huesos. Ahí se ve el modo con el que anima, los triángulos, el peso y los avisos.
6. **Para que anime como los demás** (modo C), el modelo necesita un esqueleto con nombres conocidos (los de Mixamo sirven):
   1. Sube el modelo (FBX u OBJ) a [Mixamo](https://www.mixamo.com) y deja que haga el auto-rig (marca barbilla, muñecas, codos, rodillas e ingle).
   2. Descárgalo en FBX ("T-pose" o cualquier animación, con skin).
   3. Ábrelo en Blender (Archivo → Importar → FBX) y expórtalo como glTF binario (Archivo → Exportar → glTF 2.0, formato `.glb`).
   4. Comprímelo sin instalar nada en el proyecto:
      ```bash
      npx @gltf-transform/cli optimize entrada.glb character.glb --texture-size 1024
      ```
   Si el archivo trae un clip de baile o celebración, se usa para la victoria; el resto de la animación la pone el juego.

**Modos:** C (esqueleto con alias: las mismas animaciones del juego sobre sus huesos), B (esqueleto propio sin alias: usa sus clips por nombre, como "Idle", "Walk", "Run", o queda en pose neutra) y A (sin esqueleto: se monta entero, mira hacia donde apunta, se balancea al caminar, va de pie en la cabina del jeep, se inclina en la caída y en la muerte y se mece en la victoria; en el aire no muestra el arma). El arma, la hitbox y el resto del juego no cambian con la skin. Solo viaja el `skinId`; el selector nunca descarga un GLB (solo retratos) y en la partida se precargan solo los GLB de las skins de la sala. Si uno falla, se ve la skin procedural base (Soldado) y la consola avisa una vez.

**Para celular:** menos de 3 MB, menos de 15 000 triángulos y texturas de hasta 1024 px (la galería y la consola avisan si se pasa). Si el archivo trae objetos `LOD0`, `LOD1` y `LOD2`, se usan por distancia; de noche y en calidad baja va el LOD más bajo y sin sombras.

**Draco** (opcional, apagado): para usar modelos comprimidos con Draco, copia `node_modules/three/examples/jsm/libs/draco/` a `client/public/draco/` y pon `USE_DRACO = true` en `client/src/game/character/loaders/skinLoader.js`.

**Probar rendimiento:** `/skins/stress?calidad=media&clima=noche` muestra 40 personajes (una de cada tres con skin externa) con FPS, llamadas de dibujo, triángulos, geometrías y texturas. `?debugSkins=1` en el juego muestra esqueletos, cajas y sockets, y un panel con la skin, el modo y los triángulos de cada jugador.

### Probar desde el celular (recomendado: túnel)

1. Con `npm run dev` corriendo, en otra terminal: `npm run tunnel`. La primera vez descarga `cloudflared`; luego imprime una URL `https://….trycloudflare.com` (cambia cada vez).
2. Crear la sala en el PC y tocar **QR**: mientras el túnel esté activo, el QR usa la URL pública. Funciona con datos móviles o cualquier Wi-Fi.
3. El túnel suma ~50–150 ms de latencia: sirve para probar, no para medir rendimiento.

**Sin túnel (misma red Wi-Fi):** el QR usa la IP local (`http://192.168.x.x:5173`). Si no carga, permitir Node.js en el Firewall de Windows (red privada) para el puerto 5173, o revisar si la red aísla a los dispositivos (común en redes de universidad).

---

## 8. Despliegue (jugar desde internet)

Servidor en **Render** (plan gratis), cliente en **Vercel** y **UptimeRobot** para que el servidor no se duerma. Todo lo que necesitan ya está en el repo: `render.yaml` (servidor), `vercel.json` (cliente) y `/health`. Cada `git push` a `main` vuelve a desplegar los dos solos.

### Paso 0: subir el código a GitHub

En la terminal, dentro del proyecto: `git push`. El repositorio es `github.com/Lamusel/calculo-royale`.

### Paso 1: servidor en Render

1. Entra a **render.com** y haz clic en **Get Started** / **Sign in** → **GitHub** (autoriza a Render).
2. En el panel, botón **New +** (arriba a la derecha) → **Blueprint**.
3. En **Connect a repository** busca **calculo-royale** y haz clic en **Connect**. Si no aparece, haz clic en **Configure account** y dale acceso a ese repositorio.
4. **Blueprint Name:** `calculo-royale`. Render lee `render.yaml` y muestra el servicio **calculo-royale-server** (plan *Free*).
5. Te pide las variables marcadas como secretas:
   - **CLIENT_ORIGIN:** déjala **vacía** por ahora (se completa en el paso 3).
   - **SUPABASE_URL** y **SUPABASE_SERVICE_KEY:** vacías (opcionales, ver "Guardar resultados en Supabase").
6. Clic en **Apply**. El primer despliegue tarda 2 a 5 minutos (pestaña **Logs**: termina con `[server] escuchando en …`).
7. Copia la URL del servicio (arriba, debajo del nombre), por ejemplo `https://calculo-royale-server.onrender.com`. Si el nombre estaba ocupado, Render le agrega letras al final: usa la que te muestre.
8. Prueba: abre `<esa URL>/health` en el navegador. Debe decir `{"ok":true,...}`.

### Paso 2: cliente en Vercel

1. Entra a **vercel.com** → **Sign Up / Log In** → **Continue with GitHub**.
2. Botón **Add New…** → **Project**.
3. En **Import Git Repository**, junto a **calculo-royale**, clic en **Import** (si no aparece: **Adjust GitHub App Permissions** y dale acceso).
4. En **Configure Project**:
   - **Root Directory:** déjalo en `./` (la raíz del repo; **no** elijas `client`).
   - **Framework Preset:** Vite (lo toma de `vercel.json`). No cambies **Build and Output Settings**: `vercel.json` ya dice cómo compilar el monorepo.
   - Abre **Environment Variables** y agrega: **Key** `VITE_SERVER_URL`, **Value** la URL de Render del paso 1 (sin `/` al final). Clic en **Add**.
5. Clic en **Deploy** (1 a 2 minutos).
6. Copia el dominio que te da (botón **Continue to Dashboard** → **Domains**), por ejemplo `https://calculo-royale.vercel.app`.

### Paso 3: volver a Render y permitir solo tu cliente (CORS)

1. En Render, abre **calculo-royale-server** → menú izquierdo **Environment**.
2. En **CLIENT_ORIGIN** clic en **Edit** y pon tu dominio de Vercel y, separado por coma, el patrón de las vistas previas:
   `https://calculo-royale.vercel.app,https://calculo-royale-*.vercel.app`
   (cambia `calculo-royale` por el nombre real si Vercel te dio otro).
3. **Save Changes** → Render vuelve a desplegar solo (1 a 2 minutos).

### Paso 4: UptimeRobot (que el servidor no se duerma)

El plan gratis de Render duerme el servidor tras 15 minutos sin visitas; al despertar tarda ~50 s (el juego muestra "Despertando el servidor…").

1. Entra a **uptimerobot.com** → **Register for FREE** (o **Login**).
2. Botón **+ New monitor** (o **Add New Monitor**).
3. **Monitor Type:** `HTTP(s)`. **Friendly Name:** `Cálculo Royale servidor`.
4. **URL (or IP):** `https://<tu-servidor>.onrender.com/health`.
5. **Monitoring Interval:** 5 minutes. Clic en **Create Monitor**.
6. Nota: 24/7 son ~730 h/mes y el plan gratis de Render da 750 h/mes para un servicio: alcanza justo. Si algún mes necesitas ahorrar, pausa el monitor fuera de clase (**Pause**).

### Paso 5: probar

- Abre la URL de Vercel en el PC y crea una sala: el **QR** ya apunta a la URL de Vercel. Escanéalo con el celular (datos móviles o cualquier Wi-Fi).
- Proyector: `https://<tu-cliente>.vercel.app/espectador?code=ABCD`.

### Si algo falla

| Síntoma | Qué revisar |
|---|---|
| Se queda en "Despertando el servidor…" más de 2 minutos | Que el servicio de Render esté *Live* (pestañas **Events** y **Logs**) y que `VITE_SERVER_URL` sea exactamente su URL. Si cambias `VITE_SERVER_URL`, en Vercel hay que **Redeploy** (se incrusta al compilar). |
| En la consola del navegador aparece un error de CORS | `CLIENT_ORIGIN` en Render debe contener la URL exacta de Vercel (con `https://`, sin `/` final). |
| El build de Render falla por la versión de Node | La variable `NODE_VERSION` (22.12.0) está en `render.yaml`; si la borraste, vuelve a ponerla. |
| `/espectador` da 404 en Vercel | `vercel.json` en la raíz debe tener la regla `rewrites`; el proyecto debe usar la raíz como **Root Directory**. |

## 9. Estado del proyecto

| Fase | Estado | Notas |
|---|---|---|
| 0 | ✅ Completa | Monorepo con workspaces, Express + Socket.io, Vite + React + Tailwind, indicador de conexión con ping |
| 1 | ✅ Completa | Salas con código y QR, lobby jugable, terreno z = f(x, y), predicción + interpolación, joysticks y teclado, reconexión, bots. El piso tipo pizarra se reemplaza al empezar la fase 2. Falta probar en un celular real |
| 2 | ✅ Completa | Probado en celular real por el túnel. Túnel, piso natural, mapa con pueblo y contenedores, colisiones, pendiente, 5 armas + chaleco, hitscan con compensación de lag, auto apuntado por toque, granadas con arco, francotirador de soltar con cámara desplazada, línea de mira, campo de entrenamiento, killfeed, bots armados, 26 pruebas |
| 3 | ✅ Completa | Cámara 3/4 a 50°, sol con sombras que siguen al jugador, niebla, soldado procedural animado (chaleco visible por nivel), armas procedurales, caminos, matorrales, cerca del borde, casas con techo que se oculta, contenedores corrugados, oclusión con silueta, casquillos/chispas/sangre/polvo/humo, sacudida de cámara, hit marker, calidad automática y `?debug=1`. Falta verlo en un celular real |
| 4 | ✅ Completa | Banco provisional de 40 preguntas verificadas numéricamente, 4 generadores, 27 cajas con candado (KaTeX), botín por rareza, bloqueo y alarma, racha y radar, Todo o nada, temas por sala. Falta probar en celular |
| 5 | ✅ Completa | Zona en 5 fases (una elíptica) anunciada por el mando con su desigualdad, daño fuera, mapa táctico con ejes y sectores, GPS con sector, lanzamiento aéreo en paracaídas, último en pie gana, resultados con preguntas falladas resueltas. Falta probar en celular |
| 6 | ✅ Completa | Operadores de radio (reanimación y votos), bombardeo por sectores, intercepción, ranking por puntos, vista de proyector, panel del profe y resultados guardados (Supabase o JSON local). Falta probar en celular |
| 7 | ✅ Lista en el repo | Render (render.yaml), Vercel (vercel.json), CORS por variable con comodines, "Despertando el servidor…", guía paso a paso, `npm run stop`. Falta que hagas los pasos en los paneles |
| 8 | ✅ Completa | 24 skins procedurales en 6 colecciones (4 de honor por logros), selector 3D en el lobby, galería en `/galeria`. Falta verlas en celular |
| 9 | ✅ Completa | Líder con corona y botín, 5 climas (el host elige o al azar), 4 jeeps con código del motor, reversa, pasajero que dispara, atropellos y explosión. Falta probar en celular (sobre todo manejar con el joystick y la noche en gama baja) |
| 10 | ✅ Completa | Duelo final con presentación de cine, último círculo y pantalla partida en el proyector; repetición de la mejor jugada (~8 s, cámara lenta, Saltar) antes de los resultados. Falta verlo en celular |
| 11 | ✅ Completa | Master Rig con huesos y sockets, 5 espacios para skins externas GLB (modos A, B y C con alias de Mixamo), fallback, galería `/skins`, `?debugSkins=1`, stress test de 40, bundle dividido, 4 skins nuevas. Falta poner modelos reales y medir FPS en celular |
| 12 | ✅ Completa | Teclado de PC endurecido (G también con repeticiones y con la letra, granada desde el botón del HUD), brillo +36 % parejo en las tres calidades con ajuste en Opciones, anfitrión en vez de profe, munición finita con "Obtener balas" (B o botón), 2 o 3 opciones por dificultad. Falta confirmar la granada en tu PC |
| 13 | ✅ Completa | Mapa de 190 m (~2,5×), pueblo, base militar, bosque, trincheras y contenedores con caminos; casas amuebladas con cuartos; 64 puntos de caja elegidos por partida; 6 jeeps; rejilla de colisiones. Falta medir FPS en celular con el mapa grande (fase 15) |
| 14 | ✅ Completa | Bus volador amarillo y verde con globo y hélice, ruta en el mapa, salto con Espacio o ¡Saltar!, caída libre y paracaídas dirigibles, reanimación en paracaídas, modo "elegir punto" en el lobby. Falta tu imagen en `client/public/assets/bus/costado.png` |
| 15 | ✅ Completa | Sonidos sintetizados con volumen, "bot acostado" resuelto (era la perspectiva), muebles fantasma en el centro corregidos, `/health` con métricas, prueba de carga de 40 clientes contra Render estable. Falta medir FPS en un celular real |
| 16 | ✅ Completa | Externas leídas de las carpetas reales (2B, Furina, Ghost, Luffy), selector con retratos y sin GLB, respaldo a la skin base, ajustes revisados en `/skins`. Falta probar en un celular real |
| 17 | Pendiente | |
| 18 | Pendiente | |
| 19 | Pendiente | |
| 20 | Pendiente | |
| 21 | Pendiente | |
| 22 | Pendiente | |

### Bitácora

- 2026-10-22: definido el concepto, stack y plan por fases.
- 2026-10-22: **fase 0 completa.** Workspaces `shared`, `server` y `client`. El servidor responde `/health` y `ping`/`pong` por Socket.io; el cliente muestra conectado/desconectado y la latencia. Dependencias extra aprobadas: `concurrently` (raíz) y `cors` (servidor). Sin `dotenv`: se usa `--env-file-if-exists` de Node.
- 2026-10-22: aprobadas las ideas #1, #2, #5, #7, #8 y #9 (base), #3 y #4 (opcionales) y #6 (backlog). Ajustes a #1: colinas suaves que no tapen jugadores, pendiente solo entre 80 % y 115 % de velocidad, sin ventaja de alcance por altura y una sola f(x, y) fija.
- 2026-10-22: **fase 1 completa.** Salas de 4 letras (sin I ni O) hasta 40 jugadores, host que inicia, QR con IP de la red local, reconexión por token (60 s) y "toma de control" si se abre en otra pestaña. Loop de 20 Hz también en el lobby (lobby jugable). Movimiento compartido en `shared/movement.js`: predicción del jugador propio con reconciliación suavizada e interpolación de los demás a 100 ms. Terreno con shader tipo pizarra que calcula f(x, y) y su gradiente por píxel. Controles: nipplejs dinámico en celular y WASD/flechas + mouse en PC; aviso de girar el celular y pantalla completa. Script `npm run bots`. Dependencias nuevas: `three`, `@react-three/fiber`, `nipplejs` (del stack) y `qrcode.react` (aprobada). Verificado con prueba de servidor (20 casos) y prueba visual en Edge headless.
- 2026-10-22: **cambio de dirección.** El juego pasa a ser primero un battle royale militar; el cálculo es la llave del poder. Fuera la estética de pizarra (la f(x, y) queda solo interna). Arte 3D low-poly propio y procedural (adiós primitivas y glTF externos), cámara 3/4, sol con sombras, niebla y efectos. Armas reales (pistola, escopeta, rifle de asalto, francotirador, granada con máximo 2), chaleco nivel 1 a 3, cajas de suministro con candado, transmisiones del centro de mando, interceptar transmisión, operadores de radio con reanimación y bombardeo por votos (cuadrícula 6×6, sin repetir sector seguido, desactivado con 5 vivos o menos). Nueva fase 3 de arte base con alcance mínimo (solo pueblo y contenedores); base militar, bosque y trincheras pasan a la fase 7. Prioridad: combate > cajas > zona; el arte nunca las bloquea. #4 pasa al backlog.
- 2026-10-23: **fase 2 completa.** Túnel de Cloudflare (`npm run tunnel`, dependencia `cloudflared`) con proxy de Vite: un solo puerto (5173) para cliente y servidor, y el QR usa la URL pública. Piso de pasto, tierra y grava low-poly (fuera la pizarra); GPS `POS x, y` en el HUD. `shared/mapLayout.js` con pueblo (6 casas con puertas), patio de contenedores, cobertura dispersa con semilla fija y campo de entrenamiento; `shared/collision.js` (círculo contra rectángulo/círculo y rayos) usado por servidor y predicción. Velocidad por pendiente 80–115 %. Armas en `constants.js` (pistola, escopeta, rifle, francotirador, granada máx. 2) y chaleco 25/50/75. Disparo hitscan con compensación de lag (~300 ms de historia), recarga, cadencia, auto apuntado del toque rápido decidido por el servidor; granadas simuladas en el servidor que rebotan y explotan con daño en área bloqueado por paredes. Feedback: trazadoras, fogonazo, explosión, números de daño, destello rojo, vibración, killfeed con iconos propios, pantalla de eliminado. Campo de entrenamiento: armeros, blancos que se regeneran y reaparición a los 3 s; al iniciar todos vuelven a pistola. Host puede volver al lobby. Bots `--armados`. `npm test` con 15 pruebas (`node:test`, sin dependencias). Corregido en pruebas: el primer estado privado podía perderse (el cliente ahora lo pide al arrancar) y el clic sobre textos de la interfaz no disparaba. La cámara se alejó un poco (offset 20/13.5) para ver a quien dispara con el celular en horizontal; la cámara 3/4 final es de la fase 3.
- 2026-10-23: **ajustes de la fase 2 tras probar en celular.** Granadas en celular: los botones del juego usaban `click`, que el navegador no envía si hay otro dedo en la pantalla (el del joystick); ahora responden a `pointerdown`. Nuevo flujo de granada (botón → arrastrar con arco y círculo de explosión → soltar lanza; centro cancela; botón otra vez sale) y en PC G mantenida. Francotirador rediseñado: línea roja hasta el alcance real, cámara desplazada hacia la mira, mitad de velocidad mientras apunta (bit `AIM`, aplicado en el movimiento compartido), soltar dispara y la zona de cancelación visible lo cancela; en PC clic derecho = mira. Línea de mira para todas las armas (cono en la escopeta), zona muerta del 30 % y conserva la mira al soltar. El gesto vive en `client/src/input/aimGesture.js`, separado de nipplejs, con 10 pruebas del flujo táctil completo (incluida la granada hasta que cae y explota en el servidor). También: el servidor reintenta el puerto si `node --watch` lo reinicia antes de que el proceso anterior lo libere (causaba caídas con EADDRINUSE), y el armero que se toma es el más cercano.
- 2026-10-23: tras probar en el celular, la línea de mira queda solo para el francotirador (y el arco de la granada); pistola, rifle y escopeta llevan una flecha de dirección en el suelo bajo el soldado. Arranque más claro: Vite usa `strictPort` (no salta al 5174, que dejaba el túnel apuntando a otro lado) y el servidor explica cuándo el puerto 3001 lo tiene otro `npm run dev` abierto.
- 2026-10-23: **fase 3 completa (arte base).** Cámara 3/4 a 50° (`CAMERA_PITCH_DEG` en `Scene.jsx`) con leve adelanto hacia la mira. Sol direccional con sombras cuya caja sigue al jugador (proyectan soldados, casas, contenedores y granadas), cielo y niebla. Modelos 100 % por código con `models/build.js` (piezas con color por vértice fusionadas con `mergeGeometries` de Three.js, sin dependencias nuevas): soldado con piernas, torso, brazos y arma separados (unas 5 llamadas de dibujo), uniforme oliva y color del jugador en banda del casco, brazalete y parche de la mochila; chaleco 1–3 visible (placas, bolsillos, cuello y hombreras). Animación procedural: piernas hacia donde camina, torso hacia la mira, zancada y balanceo según la velocidad, brazos arriba al disparar o apuntar, retroceso por arma, recarga y caída al morir; silueta amarilla del jugador propio cuando algo lo tapa. Armas procedurales en manos, armeros y granadas. Terreno con caminos (`PATHS`), pasto seco, matorrales con instancing y cerca baja en el borde. Casas desde `HOUSES` con zócalo, cornisa, dintel y techo a dos aguas que se oculta al entrar; contenedores corrugados con puertas y franjas; cajas con listones, barriles con aros, rocas facetadas, cercas. Oclusión: lo que tapa al jugador desde la cámara se desvanece. Efectos: casquillos (cartuchos rojos en la escopeta), chispas en paredes, sangre al impactar, polvo al caminar, humo de granada, sacudida de cámara por daño y explosiones, hit marker ✕. Calidad automática (alta/media/baja según FPS; `?calidad=baja` la fuerza, `?debug=1` muestra FPS, llamadas de dibujo y triángulos): en Edge headless con render por software (13–18 fps) bajó sola a "baja" con ~70 llamadas de dibujo y ~29 mil triángulos. 6 pruebas nuevas (oclusión, caminos, calidad). Decisiones menores: sin pisos de madera en las casas (el terreno inclinado los atravesaba), sin ventanas (serían solo decorativas y confundirían: las balas no pasan), sin mechones de pasto (rendimiento). Corregido: entrar a una sala borraba `?debug` y `?calidad` de la URL. Pendiente de verificar en celular: en una captura un bot que caminaba de lado pareció acostado; el código no rota el cuerpo mientras está vivo, pero conviene mirarlo.
- 2026-10-23: **fase 4 completa (cajas de suministro).** Banco PROVISIONAL de 40 preguntas en 9 temas y 4 dificultades (`server/src/questions/bank/*.json`); `tests/questions.test.js` recalcula cada respuesta correcta de forma independiente (Simpson en 1, 2 y 3 dimensiones, muestreo para Lagrange, derivadas numéricas) y comprueba que ningún distractor también sea correcto: las 40 pasaron a la primera. 4 generadores paramétricos probados con 300 semillas cada uno. `QuestionBank` elige por temas de la sala y dificultad de la rareza (la más cercana si falta), prefiere preguntas no vistas por ese jugador y baraja las opciones por jugador; la respuesta correcta vive solo en el servidor (una prueba revisa que el mensaje al cliente no la incluya). 26 cajas en `SUPPLY_CRATES` (rareza fija por lugar: campo, casas, contenedores, doradas en la plaza y el patio) y una de práctica en el campo de entrenamiento (no cuenta en estadísticas, se vuelve a cerrar a los 4 s). Modal de candado con KaTeX (rareza, tema, tiempo, 4 opciones grandes que responden al levantar el dedo, botín posible, cancelar). Mientras responde: quieto, icono "⚠ ABRIENDO" sobre el soldado; moverse o morir cancela sin bloquear. Acierto: botín (venda, botiquín, munición, granada, armas, chaleco) y explicación. Fallo o tiempo: caja bloqueada 15 s, luz roja y columna de alarma visible 3 s para todos; la pregunta queda guardada para los resultados. Racha de 3 = radar 10 s (flechas en el borde hacia los enemigos). Doradas: Todo o nada (dos tiradas épicas, o pierdes el chaleco). El host elige los temas en el lobby. 24 pruebas nuevas (50 en total). Dependencia: `katex` (ya estaba en el stack). Decisiones menores: las cajas no tienen colisión (simplifica la predicción del movimiento), la curación se aplica al instante (sin inventario de consumibles), durante una pregunta no se puede disparar, y al fallar no se muestra la respuesta en ese momento (aparece en los resultados al final). Corregidos: la caja de práctica quedaba junto al armero del francotirador (E tomaba el arma) y un reemplazo de `slate-` por `stone-` había roto el centrado del panel del lobby (`translate-x`).
- 2026-10-23: **fase 5 completa (zona y victoria).** `Zone.js`: 5 fases (aviso 60 s, cierre 45 s, ~9 min) con radios 58 → 40 → 27 (elipse 35×20, idea #3) → 15 → 6; cada zona nueva cabe dentro de la anterior (probado con 500 partidas simuladas); centro y semiejes enteros para que la desigualdad sea legible. Todas las zonas son elipses (`shared/src/zone.js`: contención, interpolación, desigualdad en LaTeX y sectores A1–F6). El mando transmite (`radio:message`) cada zona nueva con su desigualdad, el cierre, la última zona y el lanzamiento aéreo. Daño fuera de la zona 2 → 14 por segundo (20 al final), sin chaleco; muerte por zona con icono propio en el killfeed. Cliente: muro translúcido de la zona y franja blanca de la siguiente; minimapa en canvas (casas, contenedores, ejes, sectores, zona actual sombreada, siguiente punteada, alarmas, lanzamiento aéreo, enemigos con radar) que al tocarlo abre el mapa grande con coordenadas, tu sector, la próxima desigualdad y el historial de transmisiones; aviso "FUERA DE LA ZONA" con la desigualdad a la que volver; GPS con sector. Lanzamiento aéreo a los 4 min: coordenadas enteras dentro de la zona siguiente y sin obstáculos, cae en paracaídas 20 s y queda como caja dorada. Victoria: último vivo (y conectado) con 2 o más jugadores; posición por orden de caída; pantalla de resultados con ranking, aciertos por tema y cada pregunta fallada con tu respuesta, la correcta y la solución (solo la ve su dueño; se reenvía al reconectar). El host vuelve al lobby. 9 pruebas nuevas (59 en total) y una partida completa acelerada en Edge con 3 bots armados (zona, elipse, lanzamiento aéreo, ganador y resultados, sin errores de consola). Para probar rápido: `CR_TIME_SCALE` (solo pruebas) y `CR_SERVER_URL` para una segunda copia. Los bots ahora caminan hacia la zona si quedan afuera. Decisiones menores: sin región en polares (la elipse cubre la idea #3 de forma simple), los jugadores desconectados no cuentan para la victoria, con un solo jugador no hay victoria automática (pruebas en solitario).
- 2026-10-23: **fase 6 completa (operadores de radio y clase).** `radio.js`: al caer en partida se pasa a operador de radio con vista espectador (la cámara sigue a quien te eliminó u otro vivo, ◀ ▶ para cambiar) y transmisiones de 30 s una tras otra. Si caíste en las fases 1 o 2 de la zona y no has usado la reanimación: 3 aciertos seguidos te reaniman una vez dentro de la zona con pistola y 75 de vida (un fallo reinicia la cuenta). Si no: eliges sector en la cuadrícula A1–F6 y cada acierto es un voto; cada 60 s el más votado recibe un bombardeo (aviso de 5 s con columna roja en la escena, sector rojo en el minimapa y aviso grande a quien está dentro; 70 de daño en todo el sector). Nunca el mismo sector dos veces seguidas; desactivado con 5 vivos o menos. Intercepción cada 2 min para todos los vivos, sin detenerse (tarjeta compacta que no tapa los joysticks): los 5 primeros reciben el centro de la próxima zona (la zona siguiente se decide una sola vez y es la que después se anuncia; se salta la ronda si el anuncio está demasiado cerca para que sirva). Ranking por puntos: 10 por puesto superado, 15 por baja, 5 por acierto (cajas, transmisiones e intercepciones). Vista para proyector en `/espectador?code=ABCD` (mapa completo, vivos, killfeed, transmisiones, acierto de la clase por tema, seguir jugadores) y panel del profe con el acierto por tema en vivo (`class:stats` cada 2 s). Resultados guardados al terminar: Supabase si hay `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`, si no (o si falla) `server/data/resultados/*.json`; dependencia `@supabase/supabase-js` (estaba en el stack), cargada solo si hay variables. `client/vercel.json` para que `/espectador` funcione desplegado. 9 pruebas nuevas (68 en total) y partida acelerada en Edge con bots `--cazar` (nuevo modo: caminan hacia el vivo más cercano): intercepción, caída del host, panel de operador con transmisión y cámara siguiendo a otro jugador, proyector y resultados con puntos, sin errores de consola. Decisiones menores: reanimación con 75 de vida ("pistola y venda" = 50 + 25, sin inventario de consumibles); la reanimación cae directamente en la zona (sin animación de paracaídas, pasa a la fase 7); el sector por defecto para votar es donde caíste; la sirena del bombardeo queda para la fase 7 (sonidos).
- 2026-10-23: **plan reorganizado (tanda 2).** Nuevas fases 7 (despliegue), 8 (skins propias), 9 (mecánicas épicas) y 10 (cine); la antigua fase 7 pasa a ser la 11 (pulido y carga) e incluye los pendientes: sirena del bombardeo, animación de paracaídas, revisar el bot acostado, base militar, bosque, trincheras, sonidos y prueba de carga con 40 bots. Backlog: modo "Profe jefe final", #4 y #6.
- 2026-10-23: **fase 7 lista (despliegue).** `render.yaml` (Blueprint de Render, plan gratis): instala solo `server` y `shared` sin dependencias de desarrollo (`npm ci --omit=dev --ignore-scripts -w …`), `npm start`, Node 22.12, health check `/health`; `CLIENT_ORIGIN` y Supabase como secretos. `vercel.json` en la raíz (reemplaza a `client/vercel.json`): `npm ci --ignore-scripts` (evita que `cloudflared` descargue su binario en Vercel; esbuild no lo necesita), `npm run build` del workspace del cliente, salida `client/dist` y todas las rutas a `index.html`. `engines.node >= 22.12` (por `--env-file-if-exists`). `CLIENT_ORIGIN` admite varias URLs y comodines (`https://calculo-royale-*.vercel.app` para las vistas previas), en `server/src/origins.js` con prueba. Inicio: "Despertando el servidor… N s" si no conecta en 2 s. El QR en producción usa el origen (Vercel). Probado en copias limpias del repo con los mismos comandos de Render (instala 85 paquetes, arranca, responde `/health`, acepta una vista previa de Vercel y rechaza otro origen) y de Vercel (compila con `shared` y la URL de Render queda en el bundle). `npm run stop` (`scripts/stop.js`) libera 3001 y 5173 en Windows (netstat en inglés o español), macOS y Linux. Guía paso a paso en la sección 8. Corregido en el camino: un reemplazo con `$&` dentro de `String.replace` corrompió `server/src/index.js` (se restauró desde git antes de seguir).
- 2026-10-23: **fase 8 completa (skins propias).** Catálogo en `shared/src/skins.js` (24 skins: Básica, Leyendas de las Matemáticas, Santander, Fantasía, Locuras y De honor), validado en el servidor (`player:skin`, solo en el lobby; las de honor si el cliente las tiene desbloqueadas, es solo estética). Estilos en `client/src/game/models/skins.js`: cada skin cambia colores (uniforme, mangas, pantalón, botas, cara) y suma piezas procedurales grandes y legibles desde la cámara 3/4 (peluca y manzana de Newton, gorro de Gauss, turbante de Euler, laurel de Hipatia, moño y falda de Ada, cabeza y "culona" de hormiga con antenas, sombrero y capa del Chicamocha, aguadeño, ruana y carriel del arriero, tiara y armadura rosa, yelmo con penacho, sombrero de bruja con llamas, kabuto con cuernos, capucha ninja con banda, casco de astronauta con visera dorada, máscara de lucha libre propia con una ∫, cabezota de dinosaurio con cola, robot con antena, vendas de momia, sombrero charro gigante, y las de honor: General Integral, El Invicto, Operador de Oro y Centurión del Cálculo). El chaleco sigue visible en todas (información de juego) y el color del jugador aparece en el brazalete y en algún accesorio de cada skin (probado). Geometrías fusionadas y en caché por skin, color y nivel de chaleco. Logros en `localStorage` (`client/src/achievements.js`): 10 cajas legendarias, ganar sin fallar, 5 aciertos seguidos como operador, 50 aciertos. Selector en el lobby (botón **Skin**) con vista 3D girando, rareza, colecciones y candado con el progreso del logro; la skin se recuerda en el navegador. Galería en `/galeria`. 6 pruebas nuevas (76 en total). Decisión menor: la máscara del luchador es un diseño propio (base del color del jugador, ribetes blancos y una ∫ dorada).
- 2026-10-23: **fase 9 completa (mecánicas épicas).** *Líder* (`server/src/game/epic.js`): desde la fase 2 de la zona, el vivo con más puntos (15 por baja, 5 por acierto, mínimo 1) lleva el bit `LEADER`: corona dorada girando sobre la cabeza y corona en el minimapa de todos; el mando anuncia cada cambio y quien lo elimina recibe al instante dos tiradas de botín épico. *Clima* (`room:weather`, solo el host en el lobby; "al azar" se resuelve al iniciar; el campo de entrenamiento siempre es de día): despejado; lluvia (gotas en segmentos alrededor del jugador y 46 charcos brillantes con especular, una sola llamada de dibujo); niebla densa (niebla de 19 a 36 m desde la cámara: se ve poco más allá del jugador); tormenta de arena (polvo que vuela con el viento, cielo ocre, y en el servidor el viento acelera las granadas en vuelo; flecha del viento junto al clima); noche (luz ambiente casi nula, linterna real del jugador observado, conos de luz aditivos de todos, una luz de fogonazo que salta al último disparo y, en el minimapa, quien disparó queda marcado 2 s). Las partículas escalan con la calidad automática; en el proyector no se aplica la niebla del clima. *Jeeps* (`shared/src/vehicle.js` + `server/src/game/vehicles.js`): 4 en el mapa; "código del motor" (pregunta de dificultad 2 con el mismo modal, título propio; acertar enciende y sube como conductor, fallar o agotar el tiempo traba el motor 10 s); conductor (el joystick izquierdo maneja, no dispara; siempre envía inputs para que el jeep frene) y un pasajero que apunta y dispara. Física compartida: gira hacia el joystick con límite, acelera según lo alineado, reversa con el joystick hacia atrás, choque de frente = pierde velocidad y 10 de daño, de costado se desliza por la pared. El conductor predice su jeep con la misma función y se reconcilia con el snapshot (`vehicles` al final del estado); el pasajero se dibuja en su asiento del jeep interpolado. Vida 300: balas y granadas les pegan (el propio jeep no cuenta para su pasajero), explotan (daño en área, expulsan a los de adentro) y humean al estar dañados. Atropello: daño = velocidad × 6 con empujón y 0,8 s de espera por víctima. Con conductor aparecen en el minimapa de quien esté a 35 m (ruido). Modelo procedural (carrocería fusionada con estrella, parabrisas, barra antivuelco, asientos, volante, repuesto y bidón + 4 ruedas que giran), soldados sentados sin piernas. Avisos: encender / conducir / pasajero / bajarse, barra de vida del jeep en el HUD y causa de muerte "Atropellado por…". 8 pruebas nuevas (84 en total) y prueba visual en Edge con los cinco climas y un jeep encendido, manejado y abandonado de noche, sin errores de consola. Corregidos en el camino: el estado no pasaba el bombardeo al búfer de snapshots (el aviso grande de bombardeo nunca aparecía) y un jeep pegado a una pared perdía toda la velocidad cada tick y quedaba atascado (ahora se desliza, y existe la reversa). Decisiones menores: el viento no se dibuja en el arco de la granada (es parte de la sorpresa, la flecha avisa), las cajas no frenan al jeep (no tienen colisión), y la noche no oculta los nombres sobre los soldados.
- 2026-10-23: **fase 10 completa (cine).** *Duelo final* (`server/src/game/cine.js`): al quedar 2 vivos (si la partida empezó con más de 2) el servidor envía `match:duel`; durante 4 s los inputs se descartan, los jeeps se detienen y la zona no hace daño. La zona salta a la última fase con un círculo de radio 9 entre los dos (entero y dentro de la zona actual: `duelCircle`) que se cierra en 25 s, y el mando lo anuncia con su desigualdad. En el cliente: barras de cine, "DUELO FINAL" y la cámara girando alrededor de cada finalista (2 s cada uno) con su nombre y su skin; después, "¡A muerte!". En el proyector, terminada la presentación, la vista se parte en dos (una escena por finalista con su nombre y un VS). Para eso la cola de efectos ahora tiene una copia por vista (`EffectViews`). *Repetición*: el servidor guarda los últimos 10 s de snapshots (los mismos que envía) y puntúa cada baja hecha por un jugador: atropello 70, francotirador a más de 30 m 50 + distancia, multi-baja (2 o más en 5 s) 40 + 25 por baja, baja final 60, baja normal 10. La mejor se recorta (4,5 s antes y 1,5 s después) y al terminar se envía `match:replay` a 10 Hz, justo antes de `game:over` (los disparos y explosiones de los snapshots omitidos pasan al siguiente). El cliente la reproduce con `ReplayClient`, que tiene la misma interfaz que la escena espera de `GameClient`: cámara de cine girando despacio alrededor del protagonista, cámara lenta (×0,35) alrededor del momento clave, barras, título ("Doble baja de Bot 1"), barra de avance y botón **Saltar**; ~8 s reales. Mientras se ve, la escena en vivo se desmonta (un solo WebGL en el celular) y los resultados esperan. 9 pruebas nuevas (93 en total) y partida acelerada en Edge con bots: duelo anunciado, repetición de una doble baja en el jugador y en el proyector, Saltar lleva a los resultados y el proyector llega solo, sin errores de consola. Decisiones menores: con solo 2 jugadores desde el inicio no hay duelo (sería al empezar), la baja final llega sin su 1,5 s de "después" (la partida termina en ese tick) y si no hubo bajas de jugadores no hay repetición. Corregida una prueba intermitente de la fase 4 ("Todo o nada" exigía 3 objetos, pero si las dos tiradas épicas salen "Chaleco 3" son 2: fallaba 1 de cada 16 veces; el juego estaba bien).
- 2026-10-23: **fase 11 completa (Master Rig y skins externas).** *Master Rig* (`client/src/game/character/rig.js`): huesos con nombre (Root, Hips, Spine, Chest, Neck, Head, Shoulder/UpperArm/LowerArm/Hand y UpperLeg/LowerLeg/Foot de cada lado) y sockets (`WeaponSocket_R`, `WeaponSocket_L`, `BackWeaponSocket`, `HipWeaponSocket`, `HeadTopSocket`, `FaceSocket`, `BackSocket`, `AccessorySocket_L/R`). Las piezas de la fase 8 se cuelgan de los huesos sin cambiar su caché (los brazos se separaron en derecho e izquierdo) y en reposo quedan exactamente donde estaban (probado). `animation/pose.js` traduce el estado del juego (idle, caminar, correr, apuntar, disparar con retroceso, recargar, caer, conducir, pasajero y victoria) a rotaciones de huesos en el espacio del personaje, relativas al reposo. `Character` separa lo visual (`visualRoot` con rig y skin) del juego: `setSkin` en caliente no toca posición, hitbox ni red. Victoria: finalistas en la presentación del duelo y ganador en los resultados; en el jeep, sentado mirando al frente del jeep. Siempre visible sobre cualquier skin: anillo del color del jugador, nombre, vida, chaleco con su nivel (`Ch1`–`Ch3`) y corona. *Skins externas*: 5 espacios genéricos (`externa_01`…`externa_05`) con una línea cada uno en `character/skins/registry.js` (que también registra las procedurales y el soldado gris de fallback); el servidor valida sus IDs como los del resto. Cargador con `import()` dinámico (GLTFLoader, SkeletonUtils y DRACOLoader de `three/examples/jsm`, Draco apagado), caché por ruta con conteo de referencias, detección de `index.html` en lugar del GLB, normalización a 1,8 m con pies en 0, modos A, B y C, el arma en `WeaponSocket_R` llevado a la mano del modelo, avisos de límites para celular, LOD por objetos `LOD0`–`LOD2` o piezas secundarias por distancia (de noche y en calidad baja, el más bajo y sin sombras), `preloadMatchSkins` al iniciar y un aviso por skin que falla (reintenta a los 30 s). *Herramientas*: `/skins` (animaciones, LOD, calidad, rotar y zoom, estadísticas, esqueleto, caja, sockets y alias de huesos, "Asset pendiente"), `?debugSkins=1` en el juego y `/skins/stress` (40 personajes, `?clima=` y `?calidad=`), los tres con carga diferida; `/galeria` y `/espectador` también. Bundle dividido (juego 262 kB, three, react, r3f y katex aparte). `vercel.json`: caché de 1 día para los GLB, inmutable para los bundles con hash y 404 para un `/assets` faltante; Vite preempaqueta el cargador y OrbitControls (si no, recargaba la página al descubrirlos). Bots de prueba con `--skin=<id>` o `--skin=externas`. *Skins nuevas*: Mecha Integral, Dragón de Jade, Rey Pirata Fantasma y Hechicero del Gradiente ("Leyendas del Cálculo"). 15 pruebas nuevas (108 en total). *Verificado en Edge* con dos modelos de los ejemplos de three.js puestos temporalmente en `externa_01` (Soldier, esqueleto Mixamo: modo C) y `externa_02` (RobotExpressive: modo B con sus clips), sin dejarlos en el repo: carga y normalización, modo C apuntando y caminando, modo B caminando y bailando como victoria, "Asset pendiente" y soldado gris en las que faltan, dos navegadores viendo la skin del otro, de noche, conduciendo y de pasajero con skins externas, duelo final y repetición con todos en externas, `?debugSkins=1` y stress de 40 de día, de noche y con lluvia en calidad media (~290 llamadas de dibujo y ~125 mil triángulos; el FPS del navegador de prueba, 3–5, no sirve: renderiza por software). Decisiones menores: las rarezas usan las claves de la fase 8 (`legendario`…); la rotación del registro está en grados sobre la orientación estándar de glTF; sin contornos toon (no estaban en el juego); el material fantasma de los desconectados no se aplica a los modelos externos (se respetan sus materiales); las piezas procedurales no tienen LOD (ya son de pocos triángulos). Corregido en el camino: un aviso viejo de `toNonIndexed` en las rocas.
- 2026-10-23: **fase 12 completa (correcciones de la prueba real).** *Granada en PC:* no se pudo reproducir (funciona en local y en el sitio desplegado, en el lobby, con eventos de teclado simulados: arco, círculo y lanzamiento, 2/2 → 1/2). La causa más probable en tu equipo es que la primera pulsación de G se pierda (foco en otro elemento, una extensión o el IME del teclado) y como las repeticiones se ignoraban, mantener G nunca armaba el arco. Ahora: G arma el arco también con repeticiones, se reconoce por código físico o por la letra, el teclado solo se ignora al escribir en un campo de texto (antes también con casillas o deslizadores con foco) y en PC un clic en el botón de granada del HUD la arma y el siguiente clic la lanza (clic derecho o Esc cancela). `tests/keyboardFlow.test.js` prueba G mantenida → arco → soltar → el servidor la lanza y explota, la primera pulsación perdida, el botón del HUD y R, B, E, 1/2, clic izquierdo y clic derecho. *Brillo:* medido en capturas (luminancia promedio): baja 113, media 111, alta 112 → la calidad no oscurecía; el juego entero era oscuro. Exposición del tone mapping 1,3 en celular y 1,12 en PC, luz hemisférica +25 % y terreno algo más claro: 155, 153 y 152 (+36 %, parejo). Menú **Opciones** (⚙) con deslizador de **Brillo** (60–180 %) guardado en el navegador (`client/src/settings.js`, donde también irá el volumen); la noche y la niebla escalan igual, siguen más oscuras. *Anfitrión:* "Crear sala", "Esperando a que el anfitrión inicie…", "Panel del anfitrión", "Esperando al anfitrión…". *Munición finita:* reservas en `constants.js` (pistola 12 + 36, escopeta 5 + 10, rifle 30 + 60, francotirador 5 + 10); la munición de las cajas va al arma en mano (también la pistola) y los bots armados piden balas al quedarse sin munición. *Obtener balas* (`server/src/game/ammo.js`, eventos `ammo:*`): botón sobre Recargar en celular y tecla **B** en PC; pregunta rápida de dificultad 1 con 2 opciones en una tarjeta compacta, 15 s, te mueves pero no disparas; acierto = un cargador de reserva del arma en mano (cuenta para el ranking), fallo o tiempo = 10 s de espera; morir cancela. Generadores nuevos (`server/src/questions/basic/`): derivada de un polinomio en un punto, regla de la potencia y límite por sustitución directa, con distractores de errores típicos, verificados con 300 semillas cada uno. *Opciones por dificultad* (`optionCount`): 2 en dificultad 1 y 2 (común, raro, balas, intercepción, operadores, código del motor), 3 en 3 y 4 (épico, legendario, Todo o nada); se conservan la correcta y los primeros distractores (en los generadores van primero los de errores típicos; en el banco, el orden escrito o el campo opcional `plausibles`); botones más grandes en el candado y en las tarjetas. Las fuentes de KaTeX se precargan al entrar a la sala (la primera pregunta salía vacía unos instantes). 12 pruebas nuevas (120 en total). Decisiones menores: el tema de las preguntas de balas es "Derivadas y límites (balas)", no elegible en el lobby pero visible en las estadísticas; tras acertar hay 1,5 s de espera para no encadenar pedidos por error; en el lobby las preguntas de balas no cuentan en las estadísticas.
- 2026-10-23: **fase 14 completa (despliegue en bus).** `server/src/game/deploy.js`: al iniciar, la sala pide el despliegue (`Room.start` → `game.startDeploy(modo)`; las pruebas que arman escenarios con `startMatch` siguen empezando en el suelo). *Bus:* ruta recta con dirección al azar que pasa a lo sumo a un 30 % del semiancho del centro y empieza y termina fuera del mapa (probado con 300 rutas); arranca a los 4 s (la ruta punteada y el bus se ven en el minimapa), vuela a 45 m y 12 m/s. Cada uno salta con **Espacio** o el botón grande **¡Saltar!**; al final de la ruta saltan los que queden y los bots saltan al azar. *Caída:* libre a 13 m/s (11 m/s horizontales con el joystick o WASD), paracaídas automático a 14 m (4,5 m/s, 6 m/s horizontales) y aterrizaje fuera de obstáculos con solo la pistola. El movimiento en el aire está en `shared/movement.js` (`air`), así el cliente predice igual que el servidor. En el aire o en el bus no se dispara, no se interactúa y no se recibe daño (balas, granadas, zona, bombardeo ni atropellos). Banderas `IN_BUS`, `FALLING` y `PARACHUTE`, y la altura en el índice 9 del jugador solo mientras está en el aire; el bus va en el índice 12 del snapshot. *Cliente:* bus procedural (`client/src/game/Bus.jsx`): carrocería amarilla con franja verde, filete rojo y azul, ventanas, parrilla con equipaje, globo con franjas amarillas y verdes, cuerdas y hélice que gira; si existe `client/public/assets/bus/costado.png` se pega en los dos costados (si no, quedan sus colores). Cámara: en el bus se aleja 3 veces y se eleva para ver el bus y el mapa; cayendo se acerca a medida que baja, y la niebla se aleja con la cámara. Pose de caída libre (boca abajo, brazos al frente) y de paracaídas (brazos arriba, piernas meciéndose), también sobre skins externas en modo C. Paracaídas compartido (`models/parachute.js`) en el despliegue, la reanimación de operadores (ahora caen en paracaídas desde 24 m) y el lanzamiento aéreo. Altímetro y cuenta regresiva del bus. *Elegir punto* (el anfitrión lo elige en el lobby): 10 s con el mapa táctico para tocar dónde caer (si no, donde le tocó) y caída en paracaídas desde 30 m. 7 pruebas nuevas (127 en total) y prueba visual en Edge con bots (bus, salto con Espacio, caída, paracaídas, aterrizaje con pistola, proyector y elegir punto), sin errores de consola. Corregido en el camino: `THREE.Fog` no tiene `userData` (la niebla base se guarda en la cámara). Decisiones menores: mientras el bus vuela fuera del mapa los jugadores quedan en el borde (están ocultos); no se puede disparar a quien va en paracaídas (sin armas en el aire es lo más justo); el bus vuela a altura fija sobre el terreno.
- 2026-10-23: **fase 13 completa (mapa con más cariño).** *Tamaño:* `MAP_SIZE` 190 (antes 120, ~2,5 veces el área). Zona a escala: inicio de radio 136, fases de 92, 63, 43 (elipse), 24 y 9 m con esperas y cierres de 75/60, 65/55, 60/50, 55/45 y 50/40 s (~9 min 15 s de zona); lanzamiento aéreo a los 4 min 40 s (y su punto ya no usa un límite fijo de 57 m); bus a 15 m/s; 6 jeeps; sectores A1–F6 y bombardeo salen del tamaño. *Colisiones:* rejilla espacial de 8 m en `shared/collision.js` (473 obstáculos; cada consulta revisa solo las celdas que toca), probada contra la búsqueda completa con 4000 círculos y 200 rayos largos. *Generadores* (`shared/src/mapBuild.js`): casas con 1 a 3 cuartos (tabiques con vano a media profundidad), amueblado por tipo de cuarto en un marco local "pared del fondo → puerta" que sirve para cualquier orientación (sala: sofá, estante, mesa de centro, alfombra, cuadro, planta; cuarto: cama, ropero, mesa de noche, cuadro; cocina: mesón con estufa, nevera, mesa y sillas; bodega: cajas y barril; barracas: literas y casilleros; hangar: estanterías y pilas de cajas; búnker: estante y cajas). Muebles grandes con colisión (cobertura); alfombras, cuadros, sillas, plantas y mesas de noche son decorativos. *Zonas* (`shared/src/mapLayout.js`): pueblo al noroeste (8 casas, plaza), base militar al noreste (cerca con portones sur y oeste, hangar de 20 × 13 con portón de 7 m y techo en arco, 2 barracas, 4 torres de vigilancia con escalera y techo, sacos de arena), bosque al suroeste (156 árboles, pinos y frondosos, con 2 claros y una cabaña), trincheras al sur (dos zanjas en zigzag unidas por una de comunicación y un búnker que se abre hacia ellas) y el patio de contenedores ampliado al sureste; 11 caminos de tierra; cobertura dispersa con semilla que deja libres los puntos de caja y de jeep. *Cajas:* 64 puntos (9 calientes: plaza, centro del patio, las 4 torres, la casa central, el hangar y el búnker; 34 dentro de edificios, contenedores, base, trincheras y claros; 21 en campo abierto, todas comunes); en cada partida la sala elige con `pickMatchCrates`: las calientes siempre, 75 % de las de adentro y 35 % de las de afuera (en las pruebas que arman escenarios están todas). *Cliente:* `MapProps.jsx` con árboles, torres, sacos de arena y muebles con instancing (un modelo por tipo; los muebles solo de las casas a menos de 42 m del foco, revisado cada 300 ms), edificios con color y techo por tipo (arco en el hangar, plano en el búnker), terreno teñido por zona, más matorrales y charcos, mapa táctico con las zonas teñidas y rotuladas, árboles, torres y sacos, y marcas cada 40 m; vista del proyector más alta. 8 pruebas nuevas (135 en total): límites, sin superposiciones entre paredes, muebles y utilería, cajas y jeeps libres, se puede salir de cada edificio desde su caja (inundación en una cuadrícula de 0,25 m con el radio del jugador), zonas con contenido, zona a escala, rejilla equivalente y reglas de cajas por partida. Prueba visual en Edge cayendo con "elegir punto" en el pueblo, el hangar, el bosque, las trincheras y el patio de contenedores, más el mapa táctico y el proyector, sin errores. Corregidos en el camino gracias a las pruebas: una mesada más larga que el cuarto angosto, una caja de campo abierto tapada por una roca de la cobertura y un muro de sacos que bloqueaba la puerta del búnker. Decisiones menores: las torres no se suben (el juego es 2D): su caja está entre las patas; no hay contenedores abiertos por dentro (las cajas van en los pasillos entre ellos); las copas de los árboles no se desvanecen (la silueta amarilla muestra al jugador propio debajo); 4 pruebas viejas se pasaron a coordenadas del mapa nuevo y la de intercepción espera la reprogramación cuando el anuncio de zona está cerca.
- 2026-10-23: **fase 15 completa (pulido y carga).** *Sonidos* (`client/src/audio/`): todo sintetizado con Web Audio, sin archivos: disparo con timbre por arma (filtro, duración y golpe grave; el francotirador es el más fuerte), recarga, lanzar granada, explosión, pasos, candado abierto (arpegio) y fallado (zumbido), sirena del bombardeo, radio del mando (estática y pitido), salto del bus y paracaídas, y un motor continuo para el jeep en marcha más cercano que sube con la velocidad. Volumen y paneo según la distancia al jugador (la mitad a 12 m, nada más allá de 60 m; el este suena a la derecha), máximo 28 voces a la vez, y el audio arranca con el primer toque o tecla. **Volumen** en Opciones (curva perceptual, guardado en el navegador). *Bot acostado:* reproducido con 8 bots caminando cerca: no era la pose (las cajas de depuración, rectas en el mundo, se veían igual de inclinadas) sino la perspectiva en los bordes de la pantalla. La cámara pasa a 40° de campo de visión y 30,5 m de distancia (misma área visible, menos deformación); las distancias de niebla se corrieron 5 m. *Corregido:* los muebles con instancing nacían todos en el origen y en el lobby (sin casas cerca) nunca se recalculaban: se veía un objeto raro en el centro del campo de entrenamiento. *Carga:* `/health` agrega CPU del proceso, memoria, duración del tick y jugadores conectados (`server/src/metrics.js`), y `npm run loadtest -- 40 180` crea una sala, conecta los clientes (caminan, disparan, saltan del bus y piden balas), inicia la partida y mide. Contra `calculo-royale-server.onrender.com` (plan gratis) con 40 clientes: CPU del proceso 8–11 % en promedio (picos de 21 %), memoria estable en ~88 MB, tick de 1,3–2,7 ms en promedio (picos de 30–50 ms muy aislados), snapshots cada 50 ms (p95 55 ms), ping p50 216 ms y p95 234 ms (casi todo es distancia de red hasta Render) y cero desconexiones en 3 minutos y en 90 s. Una corrida hecha al mismo tiempo que una prueba de navegador pesada dio ping de varios segundos y desconexiones con el servidor tranquilo (7,7 % de CPU): el cuello de botella fue la máquina que corría los 40 clientes, se descartó. *Rendimiento con el mapa grande* (`?debug=1` en el pueblo): calidad baja 75 llamadas de dibujo y ~100 mil triángulos; media 75 y ~120 mil; alta 65 y ~119 mil. Es razonable para un celular de gama media, así que no se recortó más; los FPS del navegador de prueba (4–9) no sirven porque renderiza sin GPU: falta medirlo en un celular real. 5 pruebas nuevas (140 en total). Nota: en el commit de la fase 13 entraron sin querer cuatro modelos GLB que se habían puesto en `client/public/assets/skins/external/` (carpetas `2b`, `furina`, `ghost` y `luffy`); por decisión del usuario quedan en el repositorio tal cual, sin conectar, y se integran en la fase 16 (las skins se registrarán leyendo las carpetas reales). Desde entonces cada commit se arma revisando `git status`.
- 2026-10-23: **fase 16 completa (selector de skins con retratos).** *Manifiesto:* `scripts/skins-manifest.js` (`npm run skins:manifest`, encadenado antes de `dev`, `dev:client` y `build`, así Vercel lo corre) lee `client/public/assets/skins/external/`: cada carpeta con `character.glb`, o con un único `.glb` (caso `luffy/luffy.glb`, que no se renombró), es una skin; carpetas vacías o con varios `.glb` sin `character.glb` se ignoran (`externa_05` quedó vacía y no aparece). Escribe `external-manifest.json` y `portraits.json` para el cliente y `shared/src/externalSkins.js` para el servidor (módulo JS, no JSON: los `exports` de `shared` solo sirven `.js`; Render no corre el build del cliente, así que los generados van en el repo). *Registro único:* el catálogo compartido arma las externas desde ese archivo (colección "Personajes especiales", legendarias); el registro del cliente agrega procedurales + externas con una línea editable por id (`EXTERNAL_OVERRIDES`: 2B, Furina, Ghost y Luffy); sin línea, el id con mayúscula inicial. Se quitaron los espacios `externa_01`…`externa_05` y el "soldado gris": el respaldo ahora es la skin procedural base (Soldado), y una skin guardada en el navegador que ya no existe vuelve a la base. *Selector* (`client/src/ui/SkinPicker.jsx`): sin visor 3D ni GLB; tarjetas 3:4 con el retrato (`portraits/<id>.png`) o, si falta o falla, el color de la rareza con las iniciales; secciones "Personajes especiales" y "Skins del juego" (por colección), candado y logro en las de honor, tamaños con `clamp()`, zonas seguras y disposición horizontal en celular acostado. *Partida:* solo viaja `skinId` (el servidor ya lo validaba con `canUseSkin`), precarga de los GLB de la sala con caché. *Ajuste en `/skins`* (ahora con el arma en la mano, jeep de referencia en Drive y Pasajero, y botones de Caída y Paracaídas): las cuatro miran bien y miden bien con los valores por defecto; el arma quedaba lejos del cuerpo (el rig es más ancho que estos modelos) y se acercó con `weaponOffset`; en modo A se probó hundirlas en el jeep, pero solo asomaba la cabeza: quedan de pie en la cabina, con el torso sobre las puertas como el soldado; en el aire (caída y paracaídas) el arma se esconde en los modos A y B porque flotaba sobre la cabeza; en la victoria se mecen. *Verificado en Edge* con dos navegadores aislados a 844×390 (táctil): el selector pidió solo los 4 retratos y ningún GLB, la de honor quedó bloqueada con su logro, la elección sobrevivió a recargar, el segundo jugador empezó con la base, y en la partida cada navegador descargó solo `luffy.glb` y el `character.glb` de Ghost (las dos de la sala), sin errores. Aviso de la galería y la consola: las cuatro traen texturas de 2048 px (recomendado 1024 para celular); se pueden reducir con `npx @gltf-transform/cli optimize entrada.glb character.glb --texture-size 1024` (no se tocaron los archivos del usuario). 5 pruebas nuevas (143 en total).

| Validación fase 16 | Estado |
|---|---|
| Manifiesto: `character.glb`, único `.glb`, carpetas vacías o ambiguas fuera (prueba) | PASS |
| Sin espacios `externa_0N`; el servidor acepta las 4 reales y rechaza las demás (prueba) | PASS |
| Nombre por defecto e iniciales sin retrato (prueba) | PASS |
| Selector sin GLB, solo retratos (Edge, red) | PASS |
| Honor con candado y logro (Edge) | PASS |
| Selección guardada al recargar (Edge) | PASS |
| Dos navegadores en la misma partida; solo se descargan los GLB de la sala (Edge) | PASS |
| Respaldo a la base si falla el GLB, aviso una vez (prueba) | PASS |
| Caminar, apuntar, conducir, pasajero, caída, paracaídas y victoria en `/skins` | PASS |
| Build y 143 pruebas | PASS |
| Celular real | Pendiente (no hay uno conectado a esta máquina) |
