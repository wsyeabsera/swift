import { f25 } from './m25';
export interface Node26 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node26[] }
export function make26(n: number): Node26[] { return Array.from({ length: n }, (_, k) => ({ id: 'n26-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f26(nodes: Node26[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f26([c]); } return s + f25([]); }
