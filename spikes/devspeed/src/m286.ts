import { f285 } from './m285';
export interface Node286 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node286[] }
export function make286(n: number): Node286[] { return Array.from({ length: n }, (_, k) => ({ id: 'n286-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f286(nodes: Node286[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f286([c]); } return s + f285([]); }
