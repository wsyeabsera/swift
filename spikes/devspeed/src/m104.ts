import { f103 } from './m103';
export interface Node104 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node104[] }
export function make104(n: number): Node104[] { return Array.from({ length: n }, (_, k) => ({ id: 'n104-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f104(nodes: Node104[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f104([c]); } return s + f103([]); }
