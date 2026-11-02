import { f22 } from './m22';
export interface Node23 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node23[] }
export function make23(n: number): Node23[] { return Array.from({ length: n }, (_, k) => ({ id: 'n23-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f23(nodes: Node23[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f23([c]); } return s + f22([]); }
