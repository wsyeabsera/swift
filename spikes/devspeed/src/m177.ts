import { f176 } from './m176';
export interface Node177 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node177[] }
export function make177(n: number): Node177[] { return Array.from({ length: n }, (_, k) => ({ id: 'n177-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f177(nodes: Node177[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f177([c]); } return s + f176([]); }
