import { f35 } from './m35';
export interface Node36 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node36[] }
export function make36(n: number): Node36[] { return Array.from({ length: n }, (_, k) => ({ id: 'n36-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f36(nodes: Node36[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f36([c]); } return s + f35([]); }
