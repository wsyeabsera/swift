import { f203 } from './m203';
export interface Node204 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node204[] }
export function make204(n: number): Node204[] { return Array.from({ length: n }, (_, k) => ({ id: 'n204-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f204(nodes: Node204[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f204([c]); } return s + f203([]); }
