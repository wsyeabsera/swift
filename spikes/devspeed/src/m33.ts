import { f32 } from './m32';
export interface Node33 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node33[] }
export function make33(n: number): Node33[] { return Array.from({ length: n }, (_, k) => ({ id: 'n33-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f33(nodes: Node33[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f33([c]); } return s + f32([]); }
