import { f237 } from './m237';
export interface Node238 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node238[] }
export function make238(n: number): Node238[] { return Array.from({ length: n }, (_, k) => ({ id: 'n238-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f238(nodes: Node238[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f238([c]); } return s + f237([]); }
