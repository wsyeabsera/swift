import { f21 } from './m21';
export interface Node22 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node22[] }
export function make22(n: number): Node22[] { return Array.from({ length: n }, (_, k) => ({ id: 'n22-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f22(nodes: Node22[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f22([c]); } return s + f21([]); }
