import { f123 } from './m123';
export interface Node124 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node124[] }
export function make124(n: number): Node124[] { return Array.from({ length: n }, (_, k) => ({ id: 'n124-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f124(nodes: Node124[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f124([c]); } return s + f123([]); }
