import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Spectator from './screens/Spectator.jsx';
import 'katex/dist/katex.min.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* /espectador?code=ABCD: vista para proyector */}
    {location.pathname.startsWith('/espectador') ? <Spectator /> : <App />}
  </React.StrictMode>,
);
