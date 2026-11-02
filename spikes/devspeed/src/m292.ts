import { f291 } from './m291';
export interface Node292 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node292[] }
export function make292(n: number): Node292[] { return Array.from({ length: n }, (_, k) => ({ id: 'n292-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f292(nodes: Node292[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f292([c]); } return s + f291([]); }
