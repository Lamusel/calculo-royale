# Cálculo Royale

Battle royale **militar** multijugador para **Cálculo Multivariable (corte 3)**, UTS Bucaramanga.
Hasta 40 jugadores en la misma partida (≈36 en celular, ≈4 en PC), directo desde el navegador.
Primero es un battle royale de verdad; **el cálculo es la llave del poder**: las cajas de suministro tienen candado de código (una pregunta ABCD), el centro de mando habla en desigualdades y los caídos siguen peleando como operadores de radio.

> Este README es el documento vivo del proyecto. Se actualiza al cerrar cada fase (ver **Estado del proyecto** al final).
> Sucesor de *Blackjack de Cálculo* (corte 2): igual que allá, un juego real adaptado al cálculo, no al revés.

---

## 1. Concepto de juego

- **Vista:** 3D low-poly con cámara 3/4 en perspectiva que sigue al soldado. No hay primera persona.
- **Controles celular:** joystick izquierdo = moverse, joystick derecho = apuntar y disparar (twin-stick). Pantalla horizontal.
- **Controles PC:** WASD = moverse, mouse = apuntar, clic = disparar, R = recargar, 1/2 = cambiar arma, G = granada, E = interactuar.
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
| Datos | Banco de preguntas en JSON dentro del repo; Supabase para resultados y reportes (fase 6) |
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
│       │   ├── Crate.js       # cajas de suministro
│       │   ├── Zone.js
│       │   ├── radio.js       # operadores de radio, votos y bombardeos
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
        │   ├── MapMesh.jsx    # terreno natural
        │   ├── Obstacles.jsx  # obstáculos de mapLayout con instancing
        │   ├── Training.jsx   # armeros y blancos del campo de entrenamiento
        │   ├── Effects.jsx    # trazadoras, fogonazo, explosiones, números de daño
        │   ├── Grenades.jsx
        │   ├── models/        # soldado, armas, cajas, edificios, contenedores (procedurales)
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

- `tema`: slug del tema (lista definitiva pendiente de los temas del corte 3).
- `dificultad`: 1 a 4 (coincide con la rareza de la caja).
- Fórmulas en LaTeX entre `$...$`, renderizadas con KaTeX.
- **Paramétricas:** archivos en `server/src/questions/generators/` que exportan una función `generar()` y devuelven el mismo formato con números aleatorios.
- El host elige qué temas entran en la sala; si un tema no tiene preguntas de cierta dificultad, se usa la más cercana.
- Las mismas preguntas alimentan candados, transmisiones de operadores de radio e intercepciones.

---

## 6. Plan por fases

**Prioridad si el tiempo aprieta:** 1) combate, 2) cajas con preguntas, 3) zona. El arte nunca bloquea esas tres: lo que no quepa en la fase 3 pasa a la fase 7.

| Fase | Objetivo | Resultado verificable |
|---|---|---|
| **0. Base** ✅ | Monorepo, cliente y servidor corriendo, conexión Socket.io | Cliente muestra "conectado" |
| **1. Movimiento multijugador** ✅ | Salas con código y QR, lobby jugable, escena 3D con terreno z = f(x, y), interpolación y predicción, controles táctiles y teclado, reconexión, bots de prueba | 2 pestañas + 1 celular se ven moverse |
| **2. Combate** | Túnel para probar desde el celular. Piso neutro natural (fuera la pizarra). Pistola, escopeta, rifle de asalto, francotirador y granadas (máx. 2); balas, vida, chaleco, muerte. Obstáculos de `mapLayout` con colisión que bloquean balas. Velocidad por pendiente. Hit markers, números de daño, vibración, killfeed con icono. Campo de entrenamiento con armeros y blancos. Modelos simples todavía | Se pueden eliminar entre jugadores con todas las armas |
| **3. Arte base** (alcance mínimo) | Soldado procedural completo con animaciones, terreno natural, cámara 3/4, sol con sombras, niebla, efectos, paredes semitransparentes, calidad automática. Solo dos zonas: **pueblo** y **patio de contenedores** | El juego ya "se ve" final en PC y celular |
| **4. Cajas de suministro** | Banco JSON, modal de candado con KaTeX, validación en servidor, rarezas, botín, racha y radar, Todo o nada | Abrir caja, responder y recibir botín |
| **5. Zona y victoria** | Transmisiones del mando con la desigualdad, mapa táctico con coordenadas, daño fuera de zona, lanzamientos aéreos, último en pie gana, resultados con tus errores resueltos. *Opcional: #3* | Partida completa de principio a fin |
| **6. Operadores de radio y clase** | Vista espectador, reanimación, votos y bombardeo por sector, interceptar transmisión, ranking, panel del profe con mapa de calor, reporte (Supabase) | El profe ve estadísticas al final |
| **7. Pulido y carga** | Base militar, bosque y trincheras; sonidos; despliegue; división del bundle; prueba con 40 bots; ajuste en celulares de gama baja; lo que haya quedado pendiente de arte | Prueba de carga estable con 40 conexiones |
| *Backlog* | #4 campos vectoriales, #6 centro de masa | |

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
npm run tunnel     # URL pública para el celular (con npm run dev corriendo)
npm test           # pruebas de combate y colisiones (node:test)
```

| Servicio | Puerto | Comprobación |
|---|---|---|
| Cliente (Vite) | 5173 | `http://localhost:5173` muestra la pantalla de inicio con "Conectado" |
| Servidor (Express + Socket.io) | 3001 | `http://localhost:3001/health` (incluye cuántas salas hay) |

Vite redirige `/socket.io`, `/health` y `/net-info` al servidor: en desarrollo **todo pasa por el puerto 5173**.

### Probar solo, sin más dispositivos

1. Abrir `http://localhost:5173`, escribir un nombre y **Crear sala (profe)**.
2. En otra terminal: `npm run bots -- <CÓDIGO> 5` (agregar `--armados` para que disparen).
3. Abrir una segunda pestaña y entrar con el mismo código (cada pestaña es un jugador distinto).
4. **Controles PC:** WASD o flechas = moverse, mouse = apuntar, clic = disparar (mantener con el rifle), R = recargar, 1/2 = cambiar arma, G = granada hacia el mouse, E = tomar del armero.
   **Celular:** mitad izquierda = moverse; mitad derecha: **toque rápido** = dispara solo al enemigo visible más cercano, **arrastrar** = apuntar y disparar (pistola, escopeta, rifle) o apuntar y **soltar** para disparar (francotirador). Botón de granada en la barra de armas: el siguiente gesto la lanza (arrastrar más = más lejos). Volver al centro antes de soltar cancela.
5. En el campo de entrenamiento hay armeros (escopeta, rifle, francotirador, granadas, chaleco) y blancos de práctica. Lo que se toma ahí no pasa a la partida.
6. Recargar una pestaña: vuelve al mismo jugador, en la misma posición.

### Variables de entorno (opcionales en desarrollo)

Copiar `server/.env.example` a `server/.env` y `client/.env.example` a `client/.env` solo si hace falta cambiar algo.

| Variable | Dónde | Uso |
|---|---|---|
| `PORT` | server | Puerto del servidor (por defecto 3001; Render lo asigna) |
| `CLIENT_ORIGIN` | server | Orígenes CORS permitidos, separados por coma. Vacío = cualquiera |
| `VITE_SERVER_URL` | client | URL del servidor en producción. Vacío = mismo origen (proxy de Vite) |

### Probar desde el celular (recomendado: túnel)

1. Con `npm run dev` corriendo, en otra terminal: `npm run tunnel`. La primera vez descarga `cloudflared`; luego imprime una URL `https://….trycloudflare.com` (cambia cada vez).
2. Crear la sala en el PC y tocar **QR**: mientras el túnel esté activo, el QR usa la URL pública. Funciona con datos móviles o cualquier Wi-Fi.
3. El túnel suma ~50–150 ms de latencia: sirve para probar, no para medir rendimiento.

**Sin túnel (misma red Wi-Fi):** el QR usa la IP local (`http://192.168.x.x:5173`). Si no carga, permitir Node.js en el Firewall de Windows (red privada) para el puerto 5173, o revisar si la red aísla a los dispositivos (común en redes de universidad).

---

## 8. Estado del proyecto

| Fase | Estado | Notas |
|---|---|---|
| 0 | ✅ Completa | Monorepo con workspaces, Express + Socket.io, Vite + React + Tailwind, indicador de conexión con ping |
| 1 | ✅ Completa | Salas con código y QR, lobby jugable, terreno z = f(x, y), predicción + interpolación, joysticks y teclado, reconexión, bots. El piso tipo pizarra se reemplaza al empezar la fase 2. Falta probar en un celular real |
| 2 | ✅ Completa | Túnel, piso natural, mapa con pueblo y contenedores, colisiones, pendiente, 5 armas + chaleco, hitscan con compensación de lag, auto apuntado por toque, granadas, campo de entrenamiento, killfeed, bots armados, 15 pruebas. Falta probar en un celular real |
| 3 | Pendiente | |
| 4 | Pendiente | |
| 5 | Pendiente | |
| 6 | Pendiente | |
| 7 | Pendiente | |

### Bitácora

- 2026-10-22: definido el concepto, stack y plan por fases.
- 2026-10-22: **fase 0 completa.** Workspaces `shared`, `server` y `client`. El servidor responde `/health` y `ping`/`pong` por Socket.io; el cliente muestra conectado/desconectado y la latencia. Dependencias extra aprobadas: `concurrently` (raíz) y `cors` (servidor). Sin `dotenv`: se usa `--env-file-if-exists` de Node.
- 2026-10-22: aprobadas las ideas #1, #2, #5, #7, #8 y #9 (base), #3 y #4 (opcionales) y #6 (backlog). Ajustes a #1: colinas suaves que no tapen jugadores, pendiente solo entre 80 % y 115 % de velocidad, sin ventaja de alcance por altura y una sola f(x, y) fija.
- 2026-10-22: **fase 1 completa.** Salas de 4 letras (sin I ni O) hasta 40 jugadores, host que inicia, QR con IP de la red local, reconexión por token (60 s) y "toma de control" si se abre en otra pestaña. Loop de 20 Hz también en el lobby (lobby jugable). Movimiento compartido en `shared/movement.js`: predicción del jugador propio con reconciliación suavizada e interpolación de los demás a 100 ms. Terreno con shader tipo pizarra que calcula f(x, y) y su gradiente por píxel. Controles: nipplejs dinámico en celular y WASD/flechas + mouse en PC; aviso de girar el celular y pantalla completa. Script `npm run bots`. Dependencias nuevas: `three`, `@react-three/fiber`, `nipplejs` (del stack) y `qrcode.react` (aprobada). Verificado con prueba de servidor (20 casos) y prueba visual en Edge headless.
- 2026-10-22: **cambio de dirección.** El juego pasa a ser primero un battle royale militar; el cálculo es la llave del poder. Fuera la estética de pizarra (la f(x, y) queda solo interna). Arte 3D low-poly propio y procedural (adiós primitivas y glTF externos), cámara 3/4, sol con sombras, niebla y efectos. Armas reales (pistola, escopeta, rifle de asalto, francotirador, granada con máximo 2), chaleco nivel 1 a 3, cajas de suministro con candado, transmisiones del centro de mando, interceptar transmisión, operadores de radio con reanimación y bombardeo por votos (cuadrícula 6×6, sin repetir sector seguido, desactivado con 5 vivos o menos). Nueva fase 3 de arte base con alcance mínimo (solo pueblo y contenedores); base militar, bosque y trincheras pasan a la fase 7. Prioridad: combate > cajas > zona; el arte nunca las bloquea. #4 pasa al backlog.
- 2026-10-23: **fase 2 completa.** Túnel de Cloudflare (`npm run tunnel`, dependencia `cloudflared`) con proxy de Vite: un solo puerto (5173) para cliente y servidor, y el QR usa la URL pública. Piso de pasto, tierra y grava low-poly (fuera la pizarra); GPS `POS x, y` en el HUD. `shared/mapLayout.js` con pueblo (6 casas con puertas), patio de contenedores, cobertura dispersa con semilla fija y campo de entrenamiento; `shared/collision.js` (círculo contra rectángulo/círculo y rayos) usado por servidor y predicción. Velocidad por pendiente 80–115 %. Armas en `constants.js` (pistola, escopeta, rifle, francotirador, granada máx. 2) y chaleco 25/50/75. Disparo hitscan con compensación de lag (~300 ms de historia), recarga, cadencia, auto apuntado del toque rápido decidido por el servidor; granadas simuladas en el servidor que rebotan y explotan con daño en área bloqueado por paredes. Feedback: trazadoras, fogonazo, explosión, números de daño, destello rojo, vibración, killfeed con iconos propios, pantalla de eliminado. Campo de entrenamiento: armeros, blancos que se regeneran y reaparición a los 3 s; al iniciar todos vuelven a pistola. Host puede volver al lobby. Bots `--armados`. `npm test` con 15 pruebas (`node:test`, sin dependencias). Corregido en pruebas: el primer estado privado podía perderse (el cliente ahora lo pide al arrancar) y el clic sobre textos de la interfaz no disparaba. La cámara se alejó un poco (offset 20/13.5) para ver a quien dispara con el celular en horizontal; la cámara 3/4 final es de la fase 3.
