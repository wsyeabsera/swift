import { f164 } from './m164';
export interface Node165 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node165[] }
export function make165(n: number): Node165[] { return Array.from({ length: n }, (_, k) => ({ id: 'n165-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f165(nodes: Node165[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f165([c]); } return s + f164([]); }
