import { f292 } from './m292';
export interface Node293 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node293[] }
export function make293(n: number): Node293[] { return Array.from({ length: n }, (_, k) => ({ id: 'n293-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f293(nodes: Node293[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f293([c]); } return s + f292([]); }
