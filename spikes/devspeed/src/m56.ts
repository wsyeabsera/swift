import { f55 } from './m55';
export interface Node56 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node56[] }
export function make56(n: number): Node56[] { return Array.from({ length: n }, (_, k) => ({ id: 'n56-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f56(nodes: Node56[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f56([c]); } return s + f55([]); }
