import { f65 } from './m65';
export interface Node66 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node66[] }
export function make66(n: number): Node66[] { return Array.from({ length: n }, (_, k) => ({ id: 'n66-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f66(nodes: Node66[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f66([c]); } return s + f65([]); }
