import type { TreeNode } from './bridge';
/** The parent id of `id`, or null at the root / unknown. */
export const parentOf = (tree: TreeNode[], id: string): string | null => tree.find((n) => n.id === id)?.parent ?? null;
/** The first child (document order) of `id`, or null when it has none. */
export const firstChild = (tree: TreeNode[], id: string): string | null => tree.find((n) => n.parent === id)?.id ?? null;
