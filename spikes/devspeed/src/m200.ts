import { f199 } from './m199';
export interface Node200 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node200[] }
export function make200(n: number): Node200[] { return Array.from({ length: n }, (_, k) => ({ id: 'n200-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f200(nodes: Node200[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f200([c]); } return s + f199([]); }
