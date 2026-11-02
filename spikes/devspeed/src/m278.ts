import { f277 } from './m277';
export interface Node278 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node278[] }
export function make278(n: number): Node278[] { return Array.from({ length: n }, (_, k) => ({ id: 'n278-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f278(nodes: Node278[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f278([c]); } return s + f277([]); }
