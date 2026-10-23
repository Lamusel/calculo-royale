import { io } from 'socket.io-client';
import { SERVER_PORT } from '@calculo-royale/shared/constants';

// Sin VITE_SERVER_URL se usa el mismo host que sirve la página (sirve para el celular en la red local)
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || `${location.protocol}//${location.hostname}:${SERVER_PORT}`;

export const socket = io(SERVER_URL, { transports: ['websocket'] });
