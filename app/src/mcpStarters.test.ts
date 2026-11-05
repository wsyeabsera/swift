import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { handleMcp, type McpEnv } from './mcp';
import { STARTERS } from './templates/starters';

it('list_templates shows the six built-in starters when App wires STARTERS into the env', async () => {
  const env = { frames: [], selection: null, api: {} as never, record: () => {}, undo: async () => false, bump: () => {}, builtinTemplates: STARTERS } as unknown as McpEnv;
  const r = (await handleMcp(env, 'list_templates', {})) as { templates: { name: string; source: string }[] };
  expect(r.templates).toHaveLength(6); expect(r.templates.every((t) => t.source === 'builtin')).toBe(true);
});
it('App.tsx passes STARTERS as builtinTemplates', () => {
  expect(readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')).toMatch(/builtinTemplates:\s*STARTERS/);
});
