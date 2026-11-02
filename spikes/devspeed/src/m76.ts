import { f75 } from './m75';
export interface Node76 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node76[] }
export function make76(n: number): Node76[] { return Array.from({ length: n }, (_, k) => ({ id: 'n76-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f76(nodes: Node76[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f76([c]); } return s + f75([]); }
