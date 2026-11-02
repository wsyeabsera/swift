import { f260 } from './m260';
export interface Node261 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node261[] }
export function make261(n: number): Node261[] { return Array.from({ length: n }, (_, k) => ({ id: 'n261-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f261(nodes: Node261[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f261([c]); } return s + f260([]); }
