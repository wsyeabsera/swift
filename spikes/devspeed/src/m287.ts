import { f286 } from './m286';
export interface Node287 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node287[] }
export function make287(n: number): Node287[] { return Array.from({ length: n }, (_, k) => ({ id: 'n287-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f287(nodes: Node287[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f287([c]); } return s + f286([]); }
