# CLAUDE.md — Reglas del proyecto Cálculo Royale

Lee `README.md` completo antes de empezar cualquier tarea: ahí están el concepto, la arquitectura y el plan por fases.

## Identidad

- Cálculo Royale es **primero un battle royale militar de verdad**; el cálculo es la llave del poder (candados de las cajas de suministro, transmisiones del mando, operadores de radio). Es un juego real adaptado al cálculo, como el Blackjack de Cálculo, no al revés.
- Nada de estética de pizarra, neón ni curvas de nivel en el piso. La f(x, y) del terreno es **solo interna** (altura y velocidad por pendiente). Las matemáticas visibles viven en las preguntas, las transmisiones y el mapa táctico.
- Dirección de arte: 3D low-poly estilizado y propio (que no parezca surviv.io), cámara 3/4 en perspectiva, sol con sombras, niebla, terreno natural.

## Forma de trabajar

- **Primero planear, luego ejecutar.** Antes de cada fase, presenta un plan corto (archivos a crear o modificar y por qué) y espera aprobación.
- Trabaja **una fase a la vez**, en el orden del README. No adelantes funcionalidades de fases futuras.
- **Prioridad si el tiempo aprieta:** 1) combate, 2) cajas con preguntas, 3) zona. **El arte nunca bloquea esas tres:** lo que no quepa en la fase de arte base pasa a la fase de pulido.
- Al terminar cada fase:
  1. Verifica que `npm run dev` arranca sin errores.
  2. Actualiza la tabla **Estado del proyecto** y la **Bitácora** del README.
  3. Haz commit con un mensaje claro (ej. `fase 1: movimiento multijugador`).
- Pide permiso antes de agregar dependencias que no estén en el stack del README.
- Idioma: interfaz del juego, comentarios y mensajes de commit en **español**. Nombres de variables, funciones y archivos en inglés.

## Reglas técnicas

- **Servidor autoritativo.** El cliente solo envía intenciones (`input`); toda la lógica de movimiento, disparos, daño, cajas y botín vive en el servidor.
- **Nunca enviar la respuesta correcta al cliente.** Solo enunciado, opciones y tiempo límite.
- Constantes de juego (stats de armas, rarezas, tamaño del mapa, tick rate) solo en `shared/src/constants.js`. Nombres de eventos solo en `shared/src/protocol.js`.
- La distribución del mapa (edificios, muros, contenedores, árboles) vive en `shared/src/mapLayout.js`: el servidor la usa para colisiones y el cliente para dibujar. Una sola fuente de verdad.
- El mundo es 2D por dentro, en coordenadas matemáticas `(x, y)`; Three.js lo dibuja como `(x, f(x, y), −y)`. Nada de motores de física 3D.
- Snapshots compactos: el objetivo es 40 jugadores a 20 Hz en el plan gratuito de Render.
- **Celular primero:** la mayoría juega en celular. Probar siempre en viewport móvil horizontal. Limitar `dpr` del Canvas a `[1, 1.5]`, pocos materiales. Sombras solo del sol, con un mapa de sombras pequeño que sigue al jugador y solo para soldados y edificios. Modo de calidad baja automático si caen los FPS (sin sombras, `dpr` 1, menos partículas).
- **Modelos 100 % propios y procedurales:** soldados, armas, cajas y escenario se construyen por código con geometría low-poly en `client/src/game/models/`. Sin paquetes ni archivos externos (nada de glTF ni texturas descargadas); colores por vértice o texturas generadas en canvas. Fusionar las piezas estáticas de cada modelo en una sola geometría y usar `InstancedMesh` para objetos repetidos.
- JavaScript (ESM), sin TypeScript, para avanzar rápido.

## Comandos

- `npm install` en la raíz instala todos los workspaces.
- `npm run dev` levanta cliente y servidor.
- `npm run bots -- <CÓDIGO> <N> [--armados]` mete N bots en una sala.
- `npm run tunnel` abre una URL pública para probar en el celular (con `npm run dev` corriendo).
- `npm test` corre las pruebas (`node:test`). Agregar pruebas para la lógica nueva del servidor.
