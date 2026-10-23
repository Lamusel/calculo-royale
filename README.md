# Cálculo Royale

Battle royale educativo multijugador para **Cálculo Multivariable (corte 3)**, UTS Bucaramanga.
Hasta 40 jugadores en la misma partida (≈36 en celular, ≈4 en PC), directo desde el navegador.
Las armas, armaduras y objetos se consiguen abriendo **cofres** que piden responder preguntas de cálculo (ABCD).

> Este README es el documento vivo del proyecto. Se actualiza al cerrar cada fase (ver **Estado del proyecto** al final).
> Sucesor de *Blackjack de Cálculo* (corte 2).

---

## 1. Concepto de juego

- **Vista:** 3D low-poly con cámara fija desde arriba e inclinada (estilo Brawl Stars). No hay primera persona.
- **Controles celular:** joystick izquierdo = moverse, joystick derecho = apuntar y disparar (twin-stick). Pantalla horizontal.
- **Controles PC:** WASD = moverse, mouse = apuntar, clic = disparar, E = abrir cofre.
- **Partida:** el profe (host) crea una sala, elige temas y modo; los estudiantes entran con un código de 4 letras (o QR). Duración objetivo: 8 a 12 minutos.

### Mecánicas centrales

| Mecánica | Descripción |
|---|---|
| **Cofres de cálculo** | Al abrir un cofre aparece una pregunta ABCD. Rareza del cofre = dificultad de la pregunta = calidad del botín. |
| **Riesgo al responder** | Mientras respondes estás quieto y los demás ven un icono de "concentrado" sobre ti. Moverte cancela la pregunta. |
| **Fallar** | El cofre se bloquea 15 s y suena una alarma visible en el minimapa de todos durante 3 s. |
| **Zona segura matemática** | La zona se cierra por fases y se anuncia como desigualdad: `(x − a)² + (y − b)² ≤ r²`. |
| **Reanimación** | Al morir (solo en fases 1 y 2 de la zona) entras a la sala de reanimación: 3 aciertos seguidos = reapareces una vez con equipo básico. |
| **Racha** | 3 aciertos seguidos en cofres = radar de 10 s (ves a todos en el minimapa). |
| **Todo o nada** | Cofres dorados: pregunta legendaria; si aciertas, botín doble; si fallas, pierdes tu armadura. |
| **Preguntas paramétricas** | Mismo tipo de ejercicio con números distintos por jugador, opciones barajadas. Nadie puede soplar "es la C". |

### El cálculo es la física del juego (ideas aprobadas 2026-10-22)

Principio: quien entiende el cálculo juega mejor, y quien no, lo aprende jugando.

| # | Idea | Descripción | Fase |
|---|---|---|---|
| 1 | **El mapa es z = f(x, y)** | Terreno de colinas suaves que nunca tapan jugadores con la cámara. Una sola función fija por ahora: `z = 2·sin(x/10)·cos(y/10)`. La pendiente (derivada direccional `∇f · û`) modifica la velocidad **solo entre 80 % y 115 %**. La altura **no** da ventaja de alcance (descartado). | Visual: 1 ✅ · velocidad: 2 |
| 2 | **Piso = plano cartesiano** | Ejes x (rojo) e y (azul) numerados, cuadrícula de tiza, curvas de nivel y tus coordenadas `(x, y)` siempre en el HUD. Quien lee la desigualdad de la zona llega primero al centro. | Piso: 1 ✅ · zona: 4 |
| 5 | **Fantasmas matemáticos** | Los eliminados siguen respondiendo preguntas: con sus aciertos votan dónde cae el siguiente cofre legendario, suman al ranking de clase o ganan su reanimación. Nadie se queda sin hacer nada. | 5 |
| 7 | **Examen relámpago** | Cada 2 min todos reciben la misma pregunta rápida que se responde sin detenerse (panel pequeño). Los 5 primeros en acertar ganan un buff de 15 s. | 5 |
| 8 | **Lobby jugable** | Mientras esperan, todos ya están en la escena moviéndose (en la fase 2 también disparando a muñecos de práctica). Es el tutorial sin tutorial. | 1 ✅ · muñecos: 2 |
| 9 | **Detalles pro** | Reconexión al mismo jugador, unirse por QR, aviso de girar el celular y pantalla completa *(1 ✅)*; vibración y killfeed en notación ("Ana ∂ Juan") *(2)*; pantalla final con tus errores resueltos en KaTeX *(4)*; mapa de calor de temas en el panel del profe *(5)*. | 1, 2, 4, 5 |

**Opcionales (si alcanza el tiempo):**

| # | Idea | Descripción | Fase |
|---|---|---|---|
| 3 | **Zonas con regiones de verdad** | Además del círculo: elipses, cardioide en polares `r ≤ 4(1 + cos θ)`, rectángulos `|x| ≤ a, |y| ≤ b`. La última fase se anuncia solo como fórmula. | 4 |
| 4 | **Campos vectoriales vivos** | Zonas de viento `F(x, y) = (−y, x)` dibujadas con flechas que empujan jugadores y balas (rotacional y divergencia visibles). | 2 o 4 |

**Al final de la lista:** #6 *Suministro por centro de masa* (el cofre legendario cae en el centro de masa de una región con densidad dada; se revela a los 20 s).

### Rarezas y botín

| Rareza | Dificultad | Tiempo para responder | Botín posible |
|---|---|---|---|
| Común (gris) | 1 | 25 s | Munición, venda (+25 vida) |
| Raro (azul) | 2 | 35 s | Seguro nivel 1 o 2, arma rara |
| Épico (morado) | 3 | 45 s | Seguro nivel 3, arma épica, botiquín (+100) |
| Legendario (dorado) | 4 | 60 s | Arma legendaria, Todo o nada |

### Arsenal (nombres de cálculo)

| Arma | Tipo | Rareza | Notas |
|---|---|---|---|
| **Derivada** | Pistola | Inicial | Munición infinita, daño bajo |
| **Integral Triple** | Rifle de ráfaga (3 balas) | Raro | |
| **Jacobiano** | Escopeta (abanico de 6 perdigones) | Raro | Alto daño a corta distancia |
| **Gradiente** | Rifle con leve auto apuntado | Épico | Corrige el ángulo unos grados hacia el enemigo más cercano |
| **Campo Vectorial** | Granada de empuje | Legendario | Empuja y aturde en área |

**Seguro (armadura):** niveles 1 a 3, absorbe 25 / 50 / 75 de daño antes de la vida. Nombre heredado del Blackjack.

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Cliente | React + Vite + Tailwind, **React Three Fiber** + drei (Three.js), nipplejs (joysticks), KaTeX (fórmulas) |
| Servidor | Node + Express + **Socket.io**, servidor autoritativo |
| Datos | Banco de preguntas en JSON dentro del repo (fase inicial); Supabase para resultados y reportes (fase 5) |
| Despliegue | Cliente en Vercel, servidor en Render (+ UptimeRobot para evitar que se duerma) |
| Modelos 3D | Primitivas (cápsulas, cajas) al inicio; luego paquetes low-poly CC0 de Kenney y Quaternius (glTF) |

---

## 3. Estructura del proyecto (objetivo)

```
calculo-royale/
├── CLAUDE.md                  # reglas para el asistente de código
├── README.md                  # este documento
├── package.json               # workspaces: client, server, shared
├── shared/
│   └── src/
│       ├── constants.js       # tamaño del mapa, tick rate, stats de armas, rarezas
│       ├── protocol.js        # nombres de eventos de Socket.io
│       ├── codec.js           # codificación compacta de inputs y snapshots
│       ├── movement.js        # movimiento compartido (servidor = verdad, cliente = predicción)
│       └── terrain.js         # z = f(x, y) y su gradiente
├── server/
│   ├── scripts/bots.js        # bots de prueba (npm run bots)
│   └── src/
│       ├── index.js           # Express + Socket.io
│       ├── rooms/
│       │   ├── RoomManager.js # códigos, unirse, reconexión
│       │   └── Room.js        # jugadores, host, fase lobby/partida
│       ├── game/
│       │   ├── Game.js        # loop de la partida (tick 20 Hz)
│       │   ├── World.js       # mapa, obstáculos, colisiones
│       │   ├── Player.js
│       │   ├── Bullet.js
│       │   ├── Chest.js
│       │   ├── Zone.js
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
        │   ├── Scene.jsx      # Canvas R3F, cámara, luces
        │   ├── Players.jsx    # cápsulas, nombres, sombra inclinada con el terreno
        │   ├── Bullets.jsx
        │   ├── MapMesh.jsx    # terreno "pizarra": shader con ejes, cuadrícula y curvas de nivel
        │   ├── labels.js      # textos como texturas de canvas
        │   └── ZoneMesh.jsx
        ├── input/             # inputState, TouchControls (nipplejs), KeyboardMouse
        └── ui/                # HUD, RotateDevice, QuestionModal (KaTeX), Minimap, Killfeed
```

---

## 4. Arquitectura de red

- **Servidor autoritativo:** el cliente solo envía intenciones; el servidor mueve, dispara, calcula impactos, valida respuestas y reparte botín.
- **Tick del servidor:** 20 Hz. **Snapshots** a los clientes: 20 Hz, formato compacto (arrays, no objetos con claves largas).
- **Cliente:** interpola posiciones de los demás con ~100 ms de retraso; predice su propio movimiento y se corrige con el servidor.
- **El mapa es 2D por dentro.** Servidor y `shared` usan las coordenadas matemáticas `(x, y)` del plano cartesiano (las mismas que ve el jugador en el HUD y en la desigualdad de la zona). Three.js las dibuja como `(x, f(x, y), −y)`, así y crece hacia arriba en la pantalla. Colisiones círculo vs círculo y círculo vs rectángulo. El 3D es solo visual.
- **Inputs a 20 Hz** con número de secuencia; si el jugador está quieto y no gira, no se envía nada. El servidor acepta ráfagas de hasta 3 inputs pero en promedio solo 1 por tick (anti speed hack).
- **Reconexión:** cada jugador tiene un token (guardado en `sessionStorage`, por pestaña). Si se cae la conexión o se recarga la página, vuelve como el mismo jugador durante 60 s.
- **Las respuestas correctas nunca viajan al cliente.** El cliente recibe enunciado y opciones; el servidor valida el índice elegido.

### Eventos principales (ver `shared/src/protocol.js`)

| Dirección | Evento | Datos |
|---|---|---|
| C → S | `room:create` / `room:join` (ack) | nombre, código, token de reconexión |
| C → S | `room:leave` / `game:start` | — (iniciar: solo host) |
| S → C | `room:info` | código, fase, host, lista de jugadores |
| S → C | `room:kicked` | la sesión se abrió en otra pestaña |
| C → S | `input` | `[seq, mx, my, aim]` (`shoot` llega en la fase 2) |
| C → S | `chest:open` / `chest:answer` / `chest:cancel` | id del cofre, índice elegido |
| S → C | `state` | `[tick, [[id, x, y, aim, lastSeq], ...]]`; luego balas, cofres, zona |
| S → C | `chest:question` | enunciado, opciones, tiempo límite |
| S → C | `chest:result` | correcto o no, botín, explicación |
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
- `dificultad`: 1 a 4 (coincide con la rareza del cofre).
- Fórmulas en LaTeX entre `$...$`, renderizadas con KaTeX.
- **Paramétricas:** archivos en `server/src/questions/generators/` que exportan una función `generar()` y devuelven el mismo formato con números aleatorios.
- El host elige qué temas entran en la sala; si un tema no tiene preguntas de cierta dificultad, se usa la más cercana.

---

## 6. Plan por fases

| Fase | Objetivo | Resultado verificable |
|---|---|---|
| **0. Base** | Monorepo, cliente y servidor corriendo, conexión Socket.io | Cliente muestra "conectado" |
| **1. Movimiento multijugador** | Salas con código y QR, lobby jugable, escena 3D con terreno z = f(x, y) y plano cartesiano, interpolación y predicción, controles táctiles y teclado, reconexión, bots de prueba | 2 pestañas + 1 celular se ven moverse |
| **2. Combate** | Disparo, balas, vida, muerte, obstáculos con colisión, velocidad según pendiente (80–115 %), muñecos de práctica en el lobby, vibración, killfeed en notación. *Opcional: campos vectoriales (#4)* | Se pueden eliminar entre jugadores |
| **3. Cofres y preguntas** | Banco JSON, modal con KaTeX, validación en servidor, rarezas, armas y Seguro | Abrir cofre, responder y recibir botín |
| **4. Zona y victoria** | Zona por fases con desigualdad, daño fuera de zona, último en pie gana, pantalla de resultados con tus errores resueltos. *Opcional: regiones polares y elípticas (#3)* | Partida completa de principio a fin |
| **5. Extras de clase** | Reanimación, fantasmas matemáticos, examen relámpago, racha y radar, Todo o nada, vista espectador, panel del host con mapa de calor por tema, reporte por tema (Supabase) | El profe ve estadísticas al final |
| **6. Pulido y carga** | Modelos low-poly, sonidos, despliegue, división del bundle de Three.js, **bots ampliados a 40 jugadores** | Prueba de carga estable con 40 conexiones |
| *Backlog* | #6 Suministro por centro de masa | |

**Meta semana 1:** fases 0 a 4 (núcleo jugable).
**Semanas 2 y 3:** fases 5 y 6, y cargar las preguntas reales del corte 3.

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
```

| Servicio | Puerto | Comprobación |
|---|---|---|
| Cliente (Vite) | 5173 | `http://localhost:5173` muestra la pantalla de inicio con "Conectado" |
| Servidor (Express + Socket.io) | 3001 | `http://localhost:3001/health` (incluye cuántas salas hay) |

### Probar solo, sin más dispositivos

1. Abrir `http://localhost:5173`, escribir un nombre y **Crear sala (profe)**.
2. En otra terminal: `npm run bots -- <CÓDIGO> 5`. Los bots aparecen en el lobby y caminan.
3. Abrir una segunda pestaña y entrar con el mismo código (cada pestaña es un jugador distinto).
4. **Controles PC:** WASD o flechas para moverse, mouse para apuntar. **Celular:** mitad izquierda de la pantalla = moverse, mitad derecha = apuntar (el joystick aparece donde tocas).
5. Recargar una pestaña: vuelve al mismo jugador, en la misma posición.

### Variables de entorno (opcionales en desarrollo)

Copiar `server/.env.example` a `server/.env` y `client/.env.example` a `client/.env` solo si hace falta cambiar algo.

| Variable | Dónde | Uso |
|---|---|---|
| `PORT` | server | Puerto del servidor (por defecto 3001; Render lo asigna) |
| `CLIENT_ORIGIN` | server | Orígenes CORS permitidos, separados por coma. Vacío = cualquiera |
| `VITE_SERVER_URL` | client | URL del servidor. Vacío = `http://<host de la página>:3001` |

### Probar desde el celular (misma red Wi-Fi)

1. Correr `npm run dev`, crear la sala en el PC y tocar **QR** junto al código. El QR ya apunta a la IP de la red local (aunque el PC haya abierto `localhost`).
2. Escanear con el celular. También sirve abrir la línea `Network: http://192.168.x.x:5173` que imprime Vite y escribir el código.
3. Si no carga, permitir Node.js en el Firewall de Windows (red privada) para los puertos 5173 y 3001.

---

## 8. Estado del proyecto

| Fase | Estado | Notas |
|---|---|---|
| 0 | ✅ Completa | Monorepo con workspaces, Express + Socket.io, Vite + React + Tailwind, indicador de conexión con ping |
| 1 | ✅ Completa | Salas con código y QR, lobby jugable, terreno pizarra z = f(x, y), predicción + interpolación, joysticks y teclado, reconexión, bots. Falta probar en un celular real |
| 2 | Pendiente | |
| 3 | Pendiente | |
| 4 | Pendiente | |
| 5 | Pendiente | |
| 6 | Pendiente | |

### Bitácora

- 2026-10-22: definido el concepto, stack y plan por fases.
- 2026-10-22: **fase 0 completa.** Workspaces `shared`, `server` y `client`. El servidor responde `/health` y `ping`/`pong` por Socket.io; el cliente muestra conectado/desconectado y la latencia. Dependencias extra aprobadas: `concurrently` (raíz) y `cors` (servidor). Sin `dotenv`: se usa `--env-file-if-exists` de Node.
- 2026-10-22: aprobadas las ideas #1, #2, #5, #7, #8 y #9 (base), #3 y #4 (opcionales) y #6 (backlog). Ajustes a #1: colinas suaves que no tapen jugadores, pendiente solo entre 80 % y 115 % de velocidad, sin ventaja de alcance por altura y una sola f(x, y) fija.
- 2026-10-22: **fase 1 completa.** Salas de 4 letras (sin I ni O) hasta 40 jugadores, host que inicia, QR con IP de la red local, reconexión por token (60 s) y "toma de control" si se abre en otra pestaña. Loop de 20 Hz también en el lobby (lobby jugable). Movimiento compartido en `shared/movement.js`: predicción del jugador propio con reconciliación suavizada e interpolación de los demás a 100 ms. Terreno con shader tipo pizarra que calcula f(x, y) y su gradiente por píxel (curvas de nivel exactas). Coordenadas (x, y) y altura z en el HUD. Controles: nipplejs dinámico en celular y WASD/flechas + mouse en PC; aviso de girar el celular y pantalla completa. Script `npm run bots`. Dependencias nuevas: `three`, `@react-three/fiber`, `nipplejs` (del stack) y `qrcode.react` (aprobada). drei aún no hizo falta. Verificado con prueba de servidor (20 casos: salas, movimiento a 8 u/s, anti speed hack, reconexión, inicio) y prueba visual en Edge headless (lobby, QR, recarga, inicio, sin errores de consola). La velocidad por pendiente queda para la fase 2. El bundle pesa ~300 KB gzip (Three.js); se dividirá en la fase 6.
