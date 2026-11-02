import { f119 } from './m119';
export interface Node120 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node120[] }
export function make120(n: number): Node120[] { return Array.from({ length: n }, (_, k) => ({ id: 'n120-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f120(nodes: Node120[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f120([c]); } return s + f119([]); }
