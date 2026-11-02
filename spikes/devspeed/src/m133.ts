import { f132 } from './m132';
export interface Node133 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node133[] }
export function make133(n: number): Node133[] { return Array.from({ length: n }, (_, k) => ({ id: 'n133-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f133(nodes: Node133[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f133([c]); } return s + f132([]); }
