import { f137 } from './m137';
export interface Node138 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node138[] }
export function make138(n: number): Node138[] { return Array.from({ length: n }, (_, k) => ({ id: 'n138-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f138(nodes: Node138[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f138([c]); } return s + f137([]); }
