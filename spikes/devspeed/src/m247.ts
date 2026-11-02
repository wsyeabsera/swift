import { f246 } from './m246';
export interface Node247 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node247[] }
export function make247(n: number): Node247[] { return Array.from({ length: n }, (_, k) => ({ id: 'n247-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f247(nodes: Node247[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f247([c]); } return s + f246([]); }
