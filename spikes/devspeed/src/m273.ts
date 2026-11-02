import { f272 } from './m272';
export interface Node273 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node273[] }
export function make273(n: number): Node273[] { return Array.from({ length: n }, (_, k) => ({ id: 'n273-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f273(nodes: Node273[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f273([c]); } return s + f272([]); }
