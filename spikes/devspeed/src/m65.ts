import { f64 } from './m64';
export interface Node65 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node65[] }
export function make65(n: number): Node65[] { return Array.from({ length: n }, (_, k) => ({ id: 'n65-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f65(nodes: Node65[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f65([c]); } return s + f64([]); }
