import { f226 } from './m226';
export interface Node227 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node227[] }
export function make227(n: number): Node227[] { return Array.from({ length: n }, (_, k) => ({ id: 'n227-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f227(nodes: Node227[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f227([c]); } return s + f226([]); }
