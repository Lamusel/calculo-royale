// Créditos del juego (pantalla de inicio → "Créditos"). Edita este archivo: los textos entre
// corchetes son espacios para completar antes de la presentación.

export const CREDITS = {
  title: 'Cálculo Royale',
  subtitle: 'Battle royale militar para Cálculo Multivariable',
  institution: '[Universidad / Unidades Tecnológicas de Santander]',
  course: '[Cálculo Multivariable · grupo y semestre]',
  sections: [
    { role: 'Idea y desarrollo', names: ['[Nombre del autor o equipo]'] },
    { role: 'Docente', names: ['[Nombre del profesor o profesora]'] },
    { role: 'Banco de preguntas', names: ['[Quién redactó y revisó las preguntas]'] },
    { role: 'Pruebas', names: ['[Compañeros que probaron el juego]'] },
    { role: 'Modelos externos', names: ['[Autores de 2B, Furina, Ghost y Luffy, con su licencia]'] },
    // 7B: de dónde salen los sonidos y la música propios (assets/audio). Completar: autor o sitio y licencia
    { role: 'Fuentes de audio', names: ['Por confirmar'] },
    { role: 'Agradecimientos', names: ['[A quién agradecer]'] },
  ],
  tech: 'Hecho con React, Three.js (React Three Fiber), Socket.IO, KaTeX y Web Audio. Gráficos generados por código; sonidos propios (ver Fuentes de audio) y, los que faltan, sintetizados.',
  year: '2026',
};
