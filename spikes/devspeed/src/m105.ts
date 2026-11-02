import { f104 } from './m104';
export interface Node105 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node105[] }
export function make105(n: number): Node105[] { return Array.from({ length: n }, (_, k) => ({ id: 'n105-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f105(nodes: Node105[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f105([c]); } return s + f104([]); }
