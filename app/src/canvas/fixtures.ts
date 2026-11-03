// Example frames: real tvdash-style surfaces with stable element ids (the Say op language addresses elements by id).
export type FrameDef = { id: string; root: string; title: string; x: number; y: number; w: number; h: number; html: string; kept?: boolean };
const row = (i: number, t: string, m: string) => `<div id="row${i}" style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.1)"><div id="row${i}-t" style="font-size:24px">${t}</div><div id="row${i}-m" style="opacity:.6;font-size:16px">${m}</div></div>`;
export const tvIdle = (): string => `<div id="tv" style="position:relative;width:1920px;height:1080px;overflow:hidden;font-family:var(--font,system-ui);color:#f5f5f7;background:linear-gradient(135deg,#0b1a3a,#1a0b3a 50%,#0b3a2a)">
<div id="clock" style="position:absolute;left:115px;top:86px;font-size:230px;font-weight:200;letter-spacing:-.03em">21:53</div>
<div id="date" style="position:absolute;left:120px;top:340px;font-size:34px;opacity:.7">Wednesday, 28 October</div>
<div id="recent" style="position:absolute;right:115px;top:140px;width:560px;padding:32px;border-radius:var(--rad,28px);background:rgba(255,255,255,.12);backdrop-filter:blur(var(--blur,24px)) saturate(1.5);border:1px solid rgba(255,255,255,.2)">
<div id="recent-h" style="letter-spacing:.1em;font-size:20px">RECENT</div>${row(1, 'All checks passed', 'Card · just now')}${row(2, 'cloudflare/workers-sdk #16551', 'Link · just now')}${row(3, 'Nightly backup done', 'Card · 2 h ago')}</div></div>`;
export const phone = (n = 0): string => `<div id="ph" style="width:390px;height:844px;font-family:system-ui;color:#f5f5f7;background:#0b0b0f;padding:24px;box-sizing:border-box"><div id="ph-t" style="font-size:20px;font-weight:600">tvdash remote ${n || ''}</div><div id="ph-np" style="margin-top:24px;padding:18px;border-radius:20px;background:#1c1c24"><div style="opacity:.6;font-size:13px">NOW PLAYING</div><div id="ph-np-t" style="font-size:22px;margin-top:6px">Big Buck Bunny</div></div><div id="ph-pad" style="margin:40px auto;width:220px;height:220px;border-radius:50%;background:#1c1c24"></div></div>`;
export const popup = (): string => `<div id="pp" style="width:380px;height:600px;font-family:system-ui;color:#f5f5f7;background:#0b0b0f;padding:20px;box-sizing:border-box"><div id="pp-t" style="font-size:18px;font-weight:600">Send this tab to the TV</div><button id="pp-b" style="margin-top:18px;width:100%;height:44px;border:0;border-radius:12px;background:#0a84ff;color:#fff;font-size:16px">Send</button></div>`;
export const email = (): string => `<div id="em" style="width:600px;height:800px;font-family:Barlow,system-ui;color:#111;background:#fff;padding:28px;box-sizing:border-box"><div id="em-h" style="font-size:28px;font-weight:700">Today in ML</div><div id="em-c" style="margin-top:16px;padding:16px;border:1px solid #ddd;border-radius:12px">Runs on: M-series 64GB</div></div>`;
/** The three real tvdash frames, then `n - 3` more in a grid below (to stress the canvas). */
export function makeFrames(n = 20): FrameDef[] {
  const base: FrameDef[] = [
    { id: 'tv', root: 'tv', title: 'TV · Idle 1920×1080', x: 0, y: 0, w: 1920, h: 1080, html: tvIdle() },
    { id: 'phone', root: 'ph', title: 'Remote · phone 390', x: 2100, y: 0, w: 390, h: 844, html: phone() },
    { id: 'popup', root: 'pp', title: 'Popup 380', x: 2590, y: 0, w: 380, h: 600, html: popup() },
  ];
  const extra: FrameDef[] = Array.from({ length: Math.max(0, n - 3) }, (_, i) => {
    const col = i % 5; const r = Math.floor(i / 5); const isMail = i % 3 === 2;
    return { id: `x${i}`, root: isMail ? 'em' : 'ph', title: isMail ? 'Digest email 600' : `Remote ${i + 2}`, x: col * 700, y: 1300 + r * 1000, w: isMail ? 600 : 390, h: isMail ? 800 : 844, html: isMail ? email() : phone(i + 2) };
  });
  return [...base, ...extra].slice(0, Math.max(n, 0));
}
/** A new project starts with one empty screen (not the tvdash fixtures). */
export const blankFrames = (): FrameDef[] => [{ id: 'screen', root: 'screen', title: 'Screen 1280×800', x: 0, y: 0, w: 1280, h: 800, html: '<div id="screen" style="position:relative;width:1280px;height:800px;overflow:hidden;font-family:system-ui;color:#f5f5f7;background:#14151a"><div id="title" style="position:absolute;left:80px;top:80px;font-size:56px;font-weight:600">New screen</div><div id="subtitle" style="position:absolute;left:80px;top:170px;font-size:24px;opacity:.6">Say what you want here.</div></div>' }];
