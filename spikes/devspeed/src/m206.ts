import { f205 } from './m205';
export interface Node206 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node206[] }
export function make206(n: number): Node206[] { return Array.from({ length: n }, (_, k) => ({ id: 'n206-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f206(nodes: Node206[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f206([c]); } return s + f205([]); }
