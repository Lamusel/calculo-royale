import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Gallery from './screens/Gallery.jsx';
import Spectator from './screens/Spectator.jsx';
import 'katex/dist/katex.min.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* /espectador?code=ABCD: vista para proyector */}
    {/* /galeria: todas las skins */}
    {location.pathname.startsWith('/espectador') ? <Spectator /> : location.pathname.startsWith('/galeria') ? <Gallery /> : <App />}
  </React.StrictMode>,
);
