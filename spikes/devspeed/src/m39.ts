import { f38 } from './m38';
export interface Node39 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node39[] }
export function make39(n: number): Node39[] { return Array.from({ length: n }, (_, k) => ({ id: 'n39-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f39(nodes: Node39[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f39([c]); } return s + f38([]); }
