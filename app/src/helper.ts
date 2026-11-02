// Client for the local helper: an authenticated WebSocket on 127.0.0.1. The helper checks the Origin and the token (see helper/src/lib.rs).
export const HELPER_PORT = 7431;
export type HelperState = { status: 'connecting' | 'connected' | 'offline'; claude?: string; version?: string };
export function helperUrl(token: string, port = HELPER_PORT): string { return `ws://127.0.0.1:${port}/?token=${encodeURIComponent(token)}`; }
export function parseHello(data: string): HelperState | null {
  try { const m = JSON.parse(data) as { type?: string; claude?: string; version?: string }; return m.type === 'hello' ? { status: 'connected', ...(m.claude !== undefined ? { claude: m.claude } : {}), ...(m.version !== undefined ? { version: m.version } : {}) } : null; } catch { return null; }
}
export function connectHelper(token: string, onState: (s: HelperState) => void): () => void {
  let ws: WebSocket | null = null; let stop = false; let timer: ReturnType<typeof setTimeout> | undefined;
  const open = () => {
    onState({ status: 'connecting' }); ws = new WebSocket(helperUrl(token));
    ws.onmessage = (e) => { const s = typeof e.data === 'string' ? parseHello(e.data) : null; if (s) onState(s); };
    ws.onclose = () => { onState({ status: 'offline' }); if (!stop) timer = setTimeout(open, 2000); };
    ws.onerror = () => ws?.close();
  };
  open();
  return () => { stop = true; if (timer) clearTimeout(timer); ws?.close(); };
}
