import { f202 } from './m202';
export interface Node203 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node203[] }
export function make203(n: number): Node203[] { return Array.from({ length: n }, (_, k) => ({ id: 'n203-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f203(nodes: Node203[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f203([c]); } return s + f202([]); }
