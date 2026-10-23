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

**Prioridad si el tiempo aprieta:** 1) combate, 2) cajas con preguntas, 3) zona. El arte nunca bloquea esas tres: lo que no quepa pasa a la fase 11 (pulido).

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
| **11. Pulido y carga** | Base militar, bosque y trincheras; sonidos (con la sirena del bombardeo); animación de paracaídas al reanimar; revisar el bot que salió acostado en una captura; división del bundle; prueba de carga con 40 bots; ajuste en celulares de gama baja; lo pendiente de arte | Prueba de carga estable con 40 conexiones |
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
| 11 | Pendiente | |

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
