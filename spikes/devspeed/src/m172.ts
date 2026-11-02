import { f171 } from './m171';
export interface Node172 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node172[] }
export function make172(n: number): Node172[] { return Array.from({ length: n }, (_, k) => ({ id: 'n172-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f172(nodes: Node172[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f172([c]); } return s + f171([]); }
