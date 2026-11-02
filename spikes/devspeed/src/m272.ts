import { f271 } from './m271';
export interface Node272 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node272[] }
export function make272(n: number): Node272[] { return Array.from({ length: n }, (_, k) => ({ id: 'n272-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f272(nodes: Node272[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f272([c]); } return s + f271([]); }
