import { f146 } from './m146';
export interface Node147 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node147[] }
export function make147(n: number): Node147[] { return Array.from({ length: n }, (_, k) => ({ id: 'n147-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f147(nodes: Node147[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f147([c]); } return s + f146([]); }
