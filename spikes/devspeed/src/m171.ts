import { f170 } from './m170';
export interface Node171 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node171[] }
export function make171(n: number): Node171[] { return Array.from({ length: n }, (_, k) => ({ id: 'n171-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f171(nodes: Node171[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f171([c]); } return s + f170([]); }
