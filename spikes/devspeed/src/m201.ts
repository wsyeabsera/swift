import { f200 } from './m200';
export interface Node201 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node201[] }
export function make201(n: number): Node201[] { return Array.from({ length: n }, (_, k) => ({ id: 'n201-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f201(nodes: Node201[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f201([c]); } return s + f200([]); }
