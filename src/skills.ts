/**
 * Bundled writing-skill registration (the 弧光 novel toolbox).
 *
 * The resources live under `resources/skills/<name>/` inside this package;
 * each skill's SKILL.md carries kebab-case frontmatter matching the dsh skill
 * grammar. Registration is runtime (`ctx.skills.register`): bodies load once
 * at apply, and each skill's resource base points at its own directory so
 * referenced `references/*.md` files resolve for the model on demand.
 *
 * @module @deepseek-ai/dsh-novel-platform/skills
 */

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
// Context augmentation: the `skills` registry service this module registers into.
import type {} from '@deepseek-ai/dsh-skill'

/** One parsed SKILL.md. */
interface ParsedSkill {
  readonly name: string
  readonly description: string
  readonly content: string
}

/** Skills intentionally excluded from registration. */
const EXCLUDED = new Set([
  // Guides evading platform AI-content detection rather than improving the
  // writing itself; the rest of the toolbox covers the craft side.
  'novel-anti-detection',
])

/** Package resources directory. */
const RESOURCES = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'skills')

/** Read every bundled skill directory and parse its SKILL.md. */
export async function collectBundledSkills(): Promise<ParsedSkill[]> {
  const entries = await readdir(RESOURCES, { withFileTypes: true })
  const skills: ParsedSkill[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || EXCLUDED.has(entry.name)) continue
    let raw: string
    try {
      raw = await readFile(join(RESOURCES, entry.name, 'SKILL.md'), 'utf8')
    } catch {
      continue
    }
    const parsed = parseFrontmatter(raw)
    if (parsed !== undefined) skills.push(parsed)
  }
  return skills.sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Register every bundled writing skill for model and user invocation.
 * @param ctx - host plugin context.
 */
export async function registerBundledSkills(ctx: Context): Promise<void> {
  const skills = await collectBundledSkills()
  for (const skill of skills) {
    try {
      ctx.skills.register({
        name: skill.name,
        description: skill.description,
        content: skill.content,
        source: 'bundled',
        path: join(RESOURCES, skill.name, 'SKILL.md'),
        resourceBase: { kind: 'directory', path: join(RESOURCES, skill.name) },
      })
    } catch (error: unknown) {
      ctx.logger.warn('novel-platform: skill "%s" not registered: %s', skill.name, String(error))
    }
  }
  ctx.logger.info('novel-platform: registered %d bundled writing skills', skills.length)
}

/** Minimal frontmatter parser for the `name` / `description` pair. */
function parseFrontmatter(raw: string): ParsedSkill | undefined {
  if (!raw.startsWith('---')) return undefined
  const end = raw.indexOf('\n---', 3)
  if (end < 0) return undefined
  const header = raw.slice(3, end)
  const body = raw.slice(raw.indexOf('\n', end + 1) + 1)
  const name = /^name:\s*(\S+)\s*$/mu.exec(header)?.[1]
  const description = matchMultiline(header, 'description')
  if (name === undefined || description === undefined) return undefined
  return { name, description, content: body }
}

/** Match a scalar or block-scalar frontmatter value. */
function matchMultiline(header: string, key: string): string | undefined {
  const inline = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'mu').exec(header)?.[1]
  if (inline !== undefined && !inline.startsWith('|') && !inline.startsWith('>')) {
    return inline.replace(/^["']|["']$/gu, '')
  }
  const block = new RegExp(`^${key}:\\s*[|>]\\s*\\n((?:[ \\t]+.*\\n?)*)`, 'mu').exec(header)
  if (block === null) return undefined
  return block[1]!
    .split('\n')
    .map(line => line.replace(/^[ \t]+/u, ''))
    .join(' ')
    .trim()
}
