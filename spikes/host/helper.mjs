// Tiny localhost helper for spike #1714: raw WebSocket handshake (no deps), checks Origin + token, streams a message every 100 ms for STREAM_S seconds.
import http from 'node:http'; import crypto from 'node:crypto';
export function startHelper({ port, token, allowedOrigin, streamS = 20 }) {
  const log = { rejected: [], accepted: 0 };
  const server = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end('<!doctype html><body style="background:#0b0b0f;font-family:Inter,sans-serif"><h1>page under capture</h1><p>hello</p>'); });
  server.on('upgrade', (req, sock) => {
    const url = new URL(req.url, 'http://x'); const origin = req.headers.origin || '';
    if (origin !== allowedOrigin || url.searchParams.get('token') !== token) { log.rejected.push({ origin, tokenOk: url.searchParams.get('token') === token }); sock.write('HTTP/1.1 403 Forbidden\r\n\r\n'); sock.destroy(); return; }
    log.accepted++;
    const key = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${key}\r\n\r\n`);
    let n = 0; const t = setInterval(() => { const p = Buffer.from(JSON.stringify({ n: n++ })); sock.write(Buffer.concat([Buffer.from([0x81, p.length]), p])); if (n >= streamS * 10) { clearInterval(t); sock.write(Buffer.from([0x88, 0])); sock.end(); } }, 100);
    sock.on('error', () => clearInterval(t)); sock.on('close', () => clearInterval(t));
  });
  return new Promise(res => server.listen(port, '127.0.0.1', () => res({ server, log })));
}
