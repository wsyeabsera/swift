// Cheap structural check of the Claude Code plugin + marketplace (no claude binary needed).
// Usage: node tools/validate-plugin.mjs   (exit 1 on failure)
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const j = (p) => { try { return JSON.parse(readFileSync(join(root, p), 'utf8')) } catch (e) { errors.push(`${p}: ${e.message}`); return {} } }
const need = (c, m) => { if (!c) errors.push(m) }

const mk = j('.claude-plugin/marketplace.json')
need(mk.name && mk.owner?.name && Array.isArray(mk.plugins), 'marketplace: name, owner.name, plugins required')
for (const e of mk.plugins ?? []) {
  need(e.name && typeof e.source === 'string', `marketplace entry needs name and source`)
  need(e.source?.startsWith('./') && !e.source.includes('..'), `source must be ./relative without ..: ${e.source}`)
  const dir = join(root, e.source ?? '')
  need(existsSync(dir), `source path missing: ${e.source}`)
  const pj = j(join(e.source ?? '', '.claude-plugin/plugin.json'))
  need(pj.name === e.name, `entry name ${e.name} != plugin.json name ${pj.name}`)
  need(!/^(claude|anthropic)/i.test(pj.name ?? ''), 'plugin name is reserved')
  const srv = pj.mcpServers?.swift
  need(srv?.command === '${user_config.helper_path}' && srv.args?.[0] === 'mcp', 'mcp server must run `<helper> mcp`')
  need(srv?.env?.SWIFT_DATA_DIR === '${user_config.data_dir}', 'SWIFT_DATA_DIR must come from user_config.data_dir')
  for (const k of ['helper_path', 'data_dir']) need(pj.userConfig?.[k]?.type && pj.userConfig[k].title && pj.userConfig[k].description, `userConfig.${k} needs type, title, description`)
  // every ${user_config.X} used must be declared
  for (const m of JSON.stringify(pj.mcpServers ?? {}).matchAll(/\$\{user_config\.(\w+)\}/g)) need(pj.userConfig?.[m[1]], `undeclared user_config.${m[1]}`)
  const skills = join(dir, 'skills')
  for (const s of existsSync(skills) ? readdirSync(skills) : []) {
    const f = join(skills, s, 'SKILL.md'); need(existsSync(f), `skills/${s}/SKILL.md missing`)
    if (existsSync(f)) need(/^---\n(?:[\s\S]*?\n)?description: .+\n[\s\S]*?---\n/.test(readFileSync(f, 'utf8')), `skills/${s}/SKILL.md needs frontmatter with description`)
  }
  // tool names mentioned in skills must exist in the helper source
  const mcpSrc = readFileSync(join(root, 'helper/src/mcp.rs'), 'utf8')
  for (const s of existsSync(skills) ? readdirSync(skills) : []) {
    const t = readFileSync(join(skills, s, 'SKILL.md'), 'utf8')
    for (const m of t.matchAll(/`([a-z_]+)`/g)) if (/^[a-z]+_[a-z_]+$/.test(m[1]) && ['read_subtree','apply_ops','set_token','list_frames','new_from_template','fill_slots','list_templates','artifact_page'].includes(m[1])) need(mcpSrc.includes(`"${m[1]}"`), `skill ${s} names tool ${m[1]} not found in helper/src/mcp.rs`)
  }
}
if (errors.length) { console.error(errors.map((e) => 'FAIL ' + e).join('\n')); process.exit(1) }
console.log('plugin ok')
