import { io } from 'socket.io-client';

// En desarrollo se usa el mismo origen de la página: Vite redirige /socket.io al servidor
// (funciona igual en localhost, en la red local y por el túnel). En producción, VITE_SERVER_URL.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || location.origin;

export const socket = io(SERVER_URL, { transports: ['websocket'] });
