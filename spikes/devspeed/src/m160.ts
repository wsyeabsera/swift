import { f159 } from './m159';
export interface Node160 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node160[] }
export function make160(n: number): Node160[] { return Array.from({ length: n }, (_, k) => ({ id: 'n160-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f160(nodes: Node160[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f160([c]); } return s + f159([]); }
