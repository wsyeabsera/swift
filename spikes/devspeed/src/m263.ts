import { f262 } from './m262';
export interface Node263 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node263[] }
export function make263(n: number): Node263[] { return Array.from({ length: n }, (_, k) => ({ id: 'n263-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f263(nodes: Node263[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f263([c]); } return s + f262([]); }
