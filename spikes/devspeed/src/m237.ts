import { f236 } from './m236';
export interface Node237 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node237[] }
export function make237(n: number): Node237[] { return Array.from({ length: n }, (_, k) => ({ id: 'n237-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f237(nodes: Node237[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f237([c]); } return s + f236([]); }
