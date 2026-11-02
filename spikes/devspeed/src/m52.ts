import { f51 } from './m51';
export interface Node52 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node52[] }
export function make52(n: number): Node52[] { return Array.from({ length: n }, (_, k) => ({ id: 'n52-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f52(nodes: Node52[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f52([c]); } return s + f51([]); }
