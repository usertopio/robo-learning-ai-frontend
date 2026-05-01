export const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : `${window.location.protocol}//${window.location.hostname}:3000`;

export const SOCKET_URL = API_BASE_URL;
