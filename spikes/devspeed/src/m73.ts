import { f72 } from './m72';
export interface Node73 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node73[] }
export function make73(n: number): Node73[] { return Array.from({ length: n }, (_, k) => ({ id: 'n73-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f73(nodes: Node73[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f73([c]); } return s + f72([]); }
