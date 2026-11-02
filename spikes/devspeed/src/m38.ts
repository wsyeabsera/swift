import { f37 } from './m37';
export interface Node38 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node38[] }
export function make38(n: number): Node38[] { return Array.from({ length: n }, (_, k) => ({ id: 'n38-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f38(nodes: Node38[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f38([c]); } return s + f37([]); }
