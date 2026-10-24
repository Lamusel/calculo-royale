import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import 'katex/dist/katex.min.css';
import './index.css';
import { applyUiScale } from './settings.js';

applyUiScale();

// Pantallas que no son el juego: se descargan solo si se abren (import dinámico)
const Spectator = lazy(() => import('./screens/Spectator.jsx'));
const Gallery = lazy(() => import('./screens/Gallery.jsx'));
const SkinsGallery = lazy(() => import('./screens/skins/SkinsGallery.jsx'));
const StressTest = lazy(() => import('./screens/skins/StressTest.jsx'));

// /espectador?code=ABCD: vista para proyector · /galeria: skins procedurales
// /skins: galería con animaciones y depuración · /skins/stress: 40 personajes
function route(path) {
  if (path.startsWith('/espectador')) return <Spectator />;
  if (path.startsWith('/galeria')) return <Gallery />;
  if (path.startsWith('/skins/stress')) return <StressTest />;
  if (path.startsWith('/skins')) return <SkinsGallery />;
  return <App />;
}

const Loading = () => <div className="flex h-full items-center justify-center bg-olive-950 text-sm text-stone-400">Cargando…</div>;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<Loading />}>{route(location.pathname)}</Suspense>
  </React.StrictMode>,
);
