import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { MAX_PLAYERS } from '@calculo-royale/shared/constants';
import { SERVER_URL } from '../net/socket.js';
import { startGame } from '../net/session.js';

const isLocalhost = () => ['localhost', '127.0.0.1'].includes(location.hostname);

// Link para el QR, en orden de preferencia: túnel público (npm run tunnel),
// IP de la red local si el host abrió localhost, o el origen actual.
function useJoinUrl(code) {
  const [url, setUrl] = useState(`${location.origin}/?code=${code}`);
  useEffect(() => {
    fetch(`${SERVER_URL}/net-info`)
      .then((r) => r.json())
      .then(({ addresses, publicUrl }) => {
        if (publicUrl) setUrl(`${publicUrl}/?code=${code}`);
        else if (isLocalhost() && addresses[0]) {
          setUrl(`${location.protocol}//${addresses[0]}:${location.port}/?code=${code}`);
        }
      })
      .catch(() => {});
  }, [code]);
  return url;
}

function BigInvite({ room, url, onClose }) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-stone-950/90 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div className="flex max-h-full flex-col items-center gap-6 overflow-y-auto sm:flex-row sm:gap-12">
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG value={url} size={260} className="h-auto max-h-[60vh] w-auto" />
        </div>
        <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <p className="text-lg text-stone-400">Código de la sala</p>
          <p className="font-mono text-7xl font-black tracking-[0.2em] text-khaki sm:text-8xl">{room.code}</p>
          <p className="break-all font-mono text-sm text-stone-400">{url}</p>
          <p className="text-stone-300">
            {room.players.length} / {MAX_PLAYERS} jugadores
          </p>
          <p className="text-sm text-stone-500">Toca para cerrar</p>
        </div>
      </div>
    </div>
  );
}

// Panel del lobby jugable: la escena sigue viva detrás, todos pueden moverse mientras esperan
export default function Lobby({ room, myId, isTouch }) {
  const [showInvite, setShowInvite] = useState(false);
  const [error, setError] = useState('');
  const url = useJoinUrl(room.code);
  const isHost = room.hostId === myId;

  async function onStart() {
    setError('');
    const res = await startGame();
    if (!res.ok) setError(res.error);
  }

  return (
    <>
      <div className="absolute left-1/2 top-3 z-20 flex max-w-[60vw] -transtone-x-1/2 flex-col items-center gap-2">
        <div className="flex items-center gap-3 rounded-lg bg-black/60 px-4 py-2 text-stone-100 backdrop-blur">
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-3" title="Mostrar código y QR">
            <span className="font-mono text-2xl font-black tracking-[0.2em] text-khaki">{room.code}</span>
            <span className="rounded-lg bg-white/10 px-2 py-1 text-xs">QR</span>
          </button>
          <span className="text-sm text-stone-300">
            {room.players.length}/{MAX_PLAYERS}
          </span>
          {isHost && (
            <button onClick={onStart} className="rounded bg-khaki px-4 py-1.5 font-bold text-olive-950">
              Iniciar
            </button>
          )}
        </div>
        <p className="rounded bg-black/45 px-3 py-1 text-center text-[11px] text-stone-200">
          {isHost ? 'Campo de entrenamiento' : 'Esperando a que el profe inicie…'}
        </p>
        {error && <p className="rounded-lg bg-red-950/80 px-3 py-1 text-xs text-red-300">{error}</p>}
      </div>

      {/* Ayuda de controles abajo a la izquierda, lejos del killfeed y de la barra de armas */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[28vw] rounded bg-black/45 px-2.5 py-1.5 text-[10px] leading-snug text-stone-200 sm:text-[11px]">
        {isTouch ? (
          <>
            <b className="text-khaki-light">Toca</b> el joystick derecho: dispara al más cercano
            <br />
            <b className="text-khaki-light">Arrastra</b>: apuntar y disparar
          </>
        ) : (
          <>
            WASD moverse · clic disparar
            <br />R recargar · 1/2 armas · G granada · E tomar
          </>
        )}
      </div>

      {showInvite && <BigInvite room={room} url={url} onClose={() => setShowInvite(false)} />}
    </>
  );
}
