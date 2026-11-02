import { f297 } from './m297';
export interface Node298 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node298[] }
export function make298(n: number): Node298[] { return Array.from({ length: n }, (_, k) => ({ id: 'n298-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f298(nodes: Node298[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f298([c]); } return s + f297([]); }
