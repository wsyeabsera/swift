import { f44 } from './m44';
export interface Node45 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node45[] }
export function make45(n: number): Node45[] { return Array.from({ length: n }, (_, k) => ({ id: 'n45-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f45(nodes: Node45[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f45([c]); } return s + f44([]); }
