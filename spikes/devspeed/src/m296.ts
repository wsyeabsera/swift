import { f295 } from './m295';
export interface Node296 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node296[] }
export function make296(n: number): Node296[] { return Array.from({ length: n }, (_, k) => ({ id: 'n296-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f296(nodes: Node296[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f296([c]); } return s + f295([]); }
