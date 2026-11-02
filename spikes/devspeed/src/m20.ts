import { f19 } from './m19';
export interface Node20 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node20[] }
export function make20(n: number): Node20[] { return Array.from({ length: n }, (_, k) => ({ id: 'n20-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f20(nodes: Node20[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f20([c]); } return s + f19([]); }
