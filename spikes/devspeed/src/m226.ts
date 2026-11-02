import { f225 } from './m225';
export interface Node226 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node226[] }
export function make226(n: number): Node226[] { return Array.from({ length: n }, (_, k) => ({ id: 'n226-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f226(nodes: Node226[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f226([c]); } return s + f225([]); }
