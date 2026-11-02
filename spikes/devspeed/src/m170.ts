import { f169 } from './m169';
export interface Node170 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node170[] }
export function make170(n: number): Node170[] { return Array.from({ length: n }, (_, k) => ({ id: 'n170-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f170(nodes: Node170[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f170([c]); } return s + f169([]); }
