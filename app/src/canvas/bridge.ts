// Parent <-> frame bridge. Each frame is a sandboxed iframe (opaque origin, scripts only), exactly what an extension sandbox page gives us:
// the parent cannot touch the frame's DOM, so every edit and query goes through postMessage to this injected script.
// In the extension the frame is the manifest sandbox page frame.html (its own CSP lets it run the bridge; inline srcdoc frames inherit the page CSP and cannot); the design arrives by a 'load' message.
// Rules: the frame only listens to its parent; the parent only trusts replies from that frame's window; acks never wait on rAF
// (Chrome pauses rAF in offscreen sandboxed frames, spike #1706).
export type BridgeRequest =
  | { t: 'load'; rid: number; html: string }
  | { t: 'edit'; rid: number; el: string; prop: string; value: string }
  | { t: 'get'; rid: number; el: string; prop: string }
  | { t: 'hit'; rid: number; x: number; y: number }
  | { t: 'snapshot'; rid: number }
  | { t: 'outer'; rid: number; el: string }
  | { t: 'styled'; rid: number; el: string; tokens: Record<string, string> }
  | { t: 'replace'; rid: number; el: string; html: string }
  | { t: 'text'; rid: number; el: string; value: string }
  | { t: 'add'; rid: number; el: string; html: string }
  | { t: 'remove'; rid: number; el: string }
  | { t: 'rect'; rid: number; el: string }
  | { t: 'props'; rid: number; el: string; props: string[] }
  | { t: 'tree'; rid: number }
  | { t: 'audit'; rid: number }
  | { t: 'sig'; rid: number };
export type TreeNode = { id: string; parent: string | null; depth: number; tag: string; text: string; hidden?: boolean };
export type Rgb = { r: number; g: number; b: number };
export type AuditNode = { id: string; tag: string; text: string; x: number; y: number; w: number; h: number; fs: number; color: (Rgb & { a: number }) | null; bg: (Rgb & { image: boolean }) | null; clipX: boolean; clipY: boolean; interactive: boolean };
export type AuditFacts = { w: number; h: number; nodes: AuditNode[] };
export type ElSig = { style: string; text: string }; // an element's inline style attribute and own text: enough to tell two copies of a design apart
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type BridgeInput = DistributiveOmit<BridgeRequest, 'rid'>;
export type BridgeReply = { t: 'reply'; rid: number; ok: boolean; value?: string; id?: string | null; before?: string; html?: string; rect?: { x: number; y: number; w: number; h: number }; values?: Record<string, string>; tree?: TreeNode[]; audit?: AuditFacts; sig?: Record<string, ElSig> };
import frameJs from './bridge-frame.js?raw';
export const FRAME_JS: string = frameJs;
export const BRIDGE_SCRIPT = `<script>${frameJs}</script>`;
/** The srcdoc for a frame: the design's HTML plus the bridge. */
export const frameDoc = (html: string): string => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}</style>${html}${BRIDGE_SCRIPT}`;
export const isReply = (d: unknown): d is BridgeReply => typeof d === 'object' && d !== null && (d as { t?: unknown }).t === 'reply' && typeof (d as { rid?: unknown }).rid === 'number';

type Pending = { resolve: (r: BridgeReply) => void; timer: ReturnType<typeof setTimeout> };
/** Request/reply over postMessage with a timeout (a frame that never answers must not hang the caller). */
export class FrameBridge {
  private rid = 0; private pending = new Map<number, Pending>();
  constructor(private target: () => Window | null | undefined, private timeoutMs = 1000) {}
  handle = (e: MessageEvent): void => {
    if (e.source !== this.target() || !isReply(e.data)) return; // only this frame, only replies
    const p = this.pending.get(e.data.rid); if (!p) return; clearTimeout(p.timer); this.pending.delete(e.data.rid); p.resolve(e.data);
  };
  request(m: BridgeInput): Promise<BridgeReply> {
    const w = this.target(); const rid = ++this.rid;
    return new Promise((resolve) => {
      if (!w) return resolve({ t: 'reply', rid, ok: false });
      const timer = setTimeout(() => { this.pending.delete(rid); resolve({ t: 'reply', rid, ok: false }); }, this.timeoutMs);
      this.pending.set(rid, { resolve, timer }); w.postMessage({ ...m, rid }, '*');
    });
  }
}
