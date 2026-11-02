import { f124 } from './m124';
export interface Node125 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node125[] }
export function make125(n: number): Node125[] { return Array.from({ length: n }, (_, k) => ({ id: 'n125-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f125(nodes: Node125[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f125([c]); } return s + f124([]); }
