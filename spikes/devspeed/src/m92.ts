import { f91 } from './m91';
export interface Node92 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node92[] }
export function make92(n: number): Node92[] { return Array.from({ length: n }, (_, k) => ({ id: 'n92-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f92(nodes: Node92[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f92([c]); } return s + f91([]); }
