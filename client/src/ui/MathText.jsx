import { useMemo } from 'react';
import katex from 'katex';

// Texto con fórmulas entre $...$ renderizadas con KaTeX
export default function MathText({ text, className }) {
  const html = useMemo(
    () =>
      text
        .split(/(\$[^$]+\$)/g)
        .map((part) => {
          if (part.startsWith('$') && part.endsWith('$') && part.length > 1) {
            return katex.renderToString(part.slice(1, -1), { throwOnError: false });
          }
          return part.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
        })
        .join(''),
    [text],
  );
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
