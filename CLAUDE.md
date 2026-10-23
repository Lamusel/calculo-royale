# CLAUDE.md — Reglas del proyecto Cálculo Royale

Lee `README.md` completo antes de empezar cualquier tarea: ahí están el concepto, la arquitectura y el plan por fases.

## Forma de trabajar

- **Primero planear, luego ejecutar.** Antes de cada fase, presenta un plan corto (archivos a crear o modificar y por qué) y espera aprobación.
- Trabaja **una fase a la vez**, en el orden del README. No adelantes funcionalidades de fases futuras.
- Al terminar cada fase:
  1. Verifica que `npm run dev` arranca sin errores.
  2. Actualiza la tabla **Estado del proyecto** y la **Bitácora** del README.
  3. Haz commit con un mensaje claro (ej. `fase 1: movimiento multijugador`).
- Pide permiso antes de agregar dependencias que no estén en el stack del README.
- Idioma: interfaz del juego, comentarios y mensajes de commit en **español**. Nombres de variables, funciones y archivos en inglés.

## Reglas técnicas

- **Servidor autoritativo.** El cliente solo envía intenciones (`input`); toda la lógica de movimiento, disparos, daño, cofres y botín vive en el servidor.
- **Nunca enviar la respuesta correcta al cliente.** Solo enunciado, opciones y tiempo límite.
- Constantes de juego (stats de armas, rarezas, tamaño del mapa, tick rate) solo en `shared/src/constants.js`. Nombres de eventos solo en `shared/src/protocol.js`.
- El mundo es 2D por dentro (plano x, z). Nada de motores de física 3D.
- Snapshots compactos: el objetivo es 40 jugadores a 20 Hz en el plan gratuito de Render.
- **Celular primero:** la mayoría juega en celular. Probar siempre en viewport móvil horizontal. Limitar `dpr` del Canvas a `[1, 1.5]`, sombras mínimas, pocos materiales.
- Usar primitivas (cápsulas, cajas, cilindros) hasta la fase 6; los modelos glTF llegan al final.
- JavaScript (ESM), sin TypeScript, para avanzar rápido.

## Comandos

- `npm install` en la raíz instala todos los workspaces.
- `npm run dev` levanta cliente y servidor.
