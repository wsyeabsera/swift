import { f296 } from './m296';
export interface Node297 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node297[] }
export function make297(n: number): Node297[] { return Array.from({ length: n }, (_, k) => ({ id: 'n297-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f297(nodes: Node297[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f297([c]); } return s + f296([]); }
