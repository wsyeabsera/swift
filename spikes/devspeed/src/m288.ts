import { f287 } from './m287';
export interface Node288 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node288[] }
export function make288(n: number): Node288[] { return Array.from({ length: n }, (_, k) => ({ id: 'n288-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f288(nodes: Node288[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f288([c]); } return s + f287([]); }
