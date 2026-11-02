import { f31 } from './m31';
export interface Node32 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node32[] }
export function make32(n: number): Node32[] { return Array.from({ length: n }, (_, k) => ({ id: 'n32-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f32(nodes: Node32[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f32([c]); } return s + f31([]); }
