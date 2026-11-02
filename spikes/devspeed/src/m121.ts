import { f120 } from './m120';
export interface Node121 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node121[] }
export function make121(n: number): Node121[] { return Array.from({ length: n }, (_, k) => ({ id: 'n121-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f121(nodes: Node121[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f121([c]); } return s + f120([]); }
