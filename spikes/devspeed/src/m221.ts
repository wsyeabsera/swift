import { f220 } from './m220';
export interface Node221 { id: string; x: number; y: number; w: number; h: number; tokens: Record<string, string>; children: Node221[] }
export function make221(n: number): Node221[] { return Array.from({ length: n }, (_, k) => ({ id: 'n221-' + k, x: k, y: k * 2, w: 10 + k, h: 20, tokens: { fill: '#0a84ff', font: 'Inter' }, children: [] })); }
export function f221(nodes: Node221[]): number { let s = 0; for (const n of nodes) { s += n.x + n.y + n.w + n.h + Object.keys(n.tokens).length; for (const c of n.children) s += f221([c]); } return s + f220([]); }
