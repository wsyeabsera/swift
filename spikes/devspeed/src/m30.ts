import { f29 } from './m29';
export interface Node30 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node30[] }
export function make30(n: number): Node30[] { return Array.from({ length: n }, (_, k) => ({ id: 'n30-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f30(nodes: Node30[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f30([c]); } return s + f29([]); }
