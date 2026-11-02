import { f23 } from './m23';
export interface Node24 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node24[] }
export function make24(n: number): Node24[] { return Array.from({ length: n }, (_, k) => ({ id: 'n24-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f24(nodes: Node24[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f24([c]); } return s + f23([]); }
