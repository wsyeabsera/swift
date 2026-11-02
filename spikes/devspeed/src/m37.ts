import { f36 } from './m36';
export interface Node37 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node37[] }
export function make37(n: number): Node37[] { return Array.from({ length: n }, (_, k) => ({ id: 'n37-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f37(nodes: Node37[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f37([c]); } return s + f36([]); }
