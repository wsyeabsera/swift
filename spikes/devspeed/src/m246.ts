import { f245 } from './m245';
export interface Node246 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node246[] }
export function make246(n: number): Node246[] { return Array.from({ length: n }, (_, k) => ({ id: 'n246-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f246(nodes: Node246[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f246([c]); } return s + f245([]); }
