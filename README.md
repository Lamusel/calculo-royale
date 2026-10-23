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
│       └── protocol.js        # nombres de eventos de Socket.io
├── server/
│   └── src/
│       ├── index.js           # Express + Socket.io
│       ├── rooms/RoomManager.js
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
        ├── net/socket.js
        ├── screens/           # Home, Lobby, Game, Results, Spectator, Host
        ├── game/
        │   ├── Scene.jsx      # Canvas R3F, cámara, luces
        │   ├── Players.jsx    # interpolación de jugadores
        │   ├── Bullets.jsx
        │   ├── MapMesh.jsx
        │   └── ZoneMesh.jsx
        ├── input/             # TouchControls (nipplejs), KeyboardMouse
        └── ui/                # HUD, QuestionModal (KaTeX), Minimap, Killfeed
```

---

## 4. Arquitectura de red

- **Servidor autoritativo:** el cliente solo envía intenciones; el servidor mueve, dispara, calcula impactos, valida respuestas y reparte botín.
- **Tick del servidor:** 20 Hz. **Snapshots** a los clientes: 20 Hz, formato compacto (arrays, no objetos con claves largas).
- **Cliente:** interpola posiciones de los demás con ~100 ms de retraso; predice su propio movimiento y se corrige con el servidor.
- **El mapa es 2D por dentro** (plano x, z). Colisiones círculo vs círculo y círculo vs rectángulo. El 3D es solo visual.
- **Las respuestas correctas nunca viajan al cliente.** El cliente recibe enunciado y opciones; el servidor valida el índice elegido.

### Eventos principales (ver `shared/src/protocol.js`)

| Dirección | Evento | Datos |
|---|---|---|
| C → S | `room:create` / `room:join` | nombre, código, configuración (host) |
| C → S | `input` | `{ seq, mx, my, aim, shoot }` |
| C → S | `chest:open` / `chest:answer` / `chest:cancel` | id del cofre, índice elegido |
| S → C | `state` | snapshot de jugadores, balas, cofres, zona |
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
| **1. Movimiento multijugador** | Salas con código, lobby, escena 3D, jugadores moviéndose con interpolación, controles táctiles y teclado | 2 pestañas + 1 celular se ven moverse |
| **2. Combate** | Disparo, balas, vida, muerte, obstáculos con colisión | Se pueden eliminar entre jugadores |
| **3. Cofres y preguntas** | Banco JSON, modal con KaTeX, validación en servidor, rarezas, armas y Seguro | Abrir cofre, responder y recibir botín |
| **4. Zona y victoria** | Zona por fases con desigualdad, daño fuera de zona, último en pie gana, pantalla de resultados | Partida completa de principio a fin |
| **5. Extras de clase** | Reanimación, racha y radar, Todo o nada, vista espectador, panel del host, reporte por tema (Supabase) | El profe ve estadísticas al final |
| **6. Pulido y carga** | Modelos low-poly, sonidos, despliegue, **script de bots que simula 40 jugadores** | Prueba de carga estable con 40 conexiones |

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
```

| Servicio | Puerto | Comprobación |
|---|---|---|
| Cliente (Vite) | 5173 | `http://localhost:5173` muestra "Conectado" con la latencia en ms |
| Servidor (Express + Socket.io) | 3001 | `http://localhost:3001/health` |

### Variables de entorno (opcionales en desarrollo)

Copiar `server/.env.example` a `server/.env` y `client/.env.example` a `client/.env` solo si hace falta cambiar algo.

| Variable | Dónde | Uso |
|---|---|---|
| `PORT` | server | Puerto del servidor (por defecto 3001; Render lo asigna) |
| `CLIENT_ORIGIN` | server | Orígenes CORS permitidos, separados por coma. Vacío = cualquiera |
| `VITE_SERVER_URL` | client | URL del servidor. Vacío = `http://<host de la página>:3001` |

### Probar desde el celular (misma red Wi-Fi)

1. Correr `npm run dev` y fijarse en la línea `Network: http://192.168.x.x:5173` que imprime Vite.
2. Abrir esa URL en el celular. El cliente se conecta solo al servidor en la misma IP, puerto 3001.
3. Si no carga, permitir Node.js en el Firewall de Windows (red privada) para los puertos 5173 y 3001.

---

## 8. Estado del proyecto

| Fase | Estado | Notas |
|---|---|---|
| 0 | ✅ Completa | Monorepo con workspaces, Express + Socket.io, Vite + React + Tailwind, indicador de conexión con ping |
| 1 | Pendiente | |
| 2 | Pendiente | |
| 3 | Pendiente | |
| 4 | Pendiente | |
| 5 | Pendiente | |
| 6 | Pendiente | |

### Bitácora

- 2026-10-22: definido el concepto, stack y plan por fases.
- 2026-10-22: **fase 0 completa.** Workspaces `shared`, `server` y `client`. El servidor responde `/health` y `ping`/`pong` por Socket.io; el cliente muestra conectado/desconectado y la latencia. Dependencias extra aprobadas: `concurrently` (raíz) y `cors` (servidor). Sin `dotenv`: se usa `--env-file-if-exists` de Node.
