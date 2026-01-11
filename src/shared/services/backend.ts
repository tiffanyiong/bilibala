export function getBackendOrigin(): string {
  // Optional override (no secrets): allows running backend on a different host/port.
  const fromEnv = (import.meta as any).env?.VITE_BACKEND_ORIGIN as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // Dev default: connect directly to the backend to avoid WS proxy issues.
  if ((import.meta as any).env?.DEV) return 'http://127.0.0.1:3001';

  // Prod default: same-origin (backend + frontend served together).
  return window.location.origin;
}

export function getBackendWsOrigin(): string {
  const httpOrigin = getBackendOrigin();
  return httpOrigin.startsWith('https://')
    ? httpOrigin.replace(/^https:/, 'wss:')
    : httpOrigin.replace(/^http:/, 'ws:');
}

