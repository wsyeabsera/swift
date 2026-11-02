import { f221 } from './m221';
export interface Node222 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node222[] }
export function make222(n: number): Node222[] { return Array.from({ length: n }, (_, k) => ({ id: 'n222-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f222(nodes: Node222[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f222([c]); } return s + f221([]); }
