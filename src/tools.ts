/**
 * Agent-facing novel tools.
 *
 * The tools give the model the same store the panel uses, so anything the
 * writer asks in chat (draft a chapter, record a character, extend the
 * outline) lands in the same project the writing desk shows. Names follow the
 * native tool naming convention (`snake_case`, domain-prefixed); reads are
 * cheap, writes are validated minimally and fail with actionable messages.
 *
 * @module @deepseek-ai/dsh-novel-platform/tools
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { Context } from '@deepseek-ai/cordis'
import type { NovelStoreService } from './store.ts'
import type {
  ChapterStatus, CharacterRole, NovelStatus,
} from './types.ts'

const NOVEL_STATUSES: readonly NovelStatus[] = ['draft', 'serializing', 'finished']
const CHAPTER_STATUSES: readonly ChapterStatus[] = ['outline', 'draft', 'revised', 'published']
const CHARACTER_ROLES: readonly CharacterRole[] = ['protagonist', 'supporting', 'antagonist', 'minor']

/** Render a JSON value as the tool's model-facing text. */
function renderJson(_args: unknown, value: unknown): { type: 'text'; text: string }[] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

/** Widen a typed payload to the tool output schema's JSON face (wire shape is unchanged). */
function asJson<T>(value: T): JsonValue {
  return value as unknown as JsonValue
}

/**
 * Register every novel tool on the shared store.
 * @param ctx - host plugin context with the `tools` service present.
 * @param store - the process-wide novel store.
 */
export function registerNovelTools(ctx: Context, store: NovelStoreService): void {
  ctx.tools.register(defineTool({
    name: 'novel_list',
    description: 'List every novel in the writing platform with id, title, genre, status, and word counts. Call this before any other novel tool to discover novel ids.',
    parameters: {},
    output: { schema: { type: 'json' }, render: renderJson },
    async execute() {
      return asJson(await store.listNovels())
    },
  }))

  ctx.tools.register(defineTool({
    name: 'novel_create',
    description: 'Create a novel (作品) in the writing platform. The title is the book name; genre is the web-novel category such as 都市、玄幻、仙侠、悬疑; description is the back-cover blurb shown to readers.',
    parameters: {
      title: { type: 'string', required: true, description: 'Book title' },
      genre: { type: 'string', required: true, description: 'Web-novel genre/题材' },
      description: { type: 'string', required: true, description: 'Blurb/简介' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args) {
      return asJson(await store.createNovel(args))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'novel_overview',
    description: 'Read one novel\'s complete context: metadata, chapter list with word counts and statuses, character cards, and the outline. Call before writing or revising a chapter so continuity and 设定 stay consistent.',
    parameters: {
      novel_id: { type: 'string', required: true, description: 'Novel id from novel_list' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args) {
      return asJson(await store.getNovel(args.novel_id))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'novel_chapter_read',
    description: 'Read one chapter\'s full text. Use for continuity checks before writing the next chapter or when revising.',
    parameters: {
      chapter_id: { type: 'string', required: true, description: 'Chapter id from novel_overview' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args) {
      return asJson(await store.getChapter(args.chapter_id))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'novel_chapter_write',
    description: 'Create a chapter (append) or rewrite an existing chapter\'s content. Pass chapter_id to update; omit it to append a new chapter. Content is the full chapter prose — this tool replaces the body, never diffs it.',
    parameters: {
      novel_id: { type: 'string', required: true, description: 'Novel id (required when creating; ignored when updating)' },
      chapter_id: { type: 'string', description: 'Chapter id to update; omit to append a new chapter' },
      title: { type: 'string', required: true, description: 'Chapter title' },
      content: { type: 'string', required: true, description: 'Full chapter prose' },
      status: { type: 'string', enum: [...CHAPTER_STATUSES], description: 'Chapter status; default draft' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args) {
      const status = args.status ?? 'draft'
      if (args.chapter_id !== undefined) {
        return asJson(await store.updateChapter(args.chapter_id, { title: args.title, content: args.content, status }))
      }
      return asJson(await store.createChapter(args.novel_id, { title: args.title, content: args.content, status }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'novel_chapter_set_status',
    description: 'Move one chapter through its lifecycle: outline → draft → revised → published.',
    parameters: {
      chapter_id: { type: 'string', required: true, description: 'Chapter id' },
      status: { type: 'string', enum: [...CHAPTER_STATUSES], required: true, description: 'New chapter status' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args) {
      return asJson(await store.updateChapter(args.chapter_id, { status: args.status }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'novel_character_set',
    description: 'Insert or update one character card (角色卡) keyed by name within a novel: dramatic role and full profile (外貌、性格、能力、关系、弧光). Keep profiles current so later chapters stay consistent.',
    parameters: {
      novel_id: { type: 'string', required: true, description: 'Novel id' },
      name: { type: 'string', required: true, description: 'Character name (update key)' },
      role: { type: 'string', enum: [...CHARACTER_ROLES], required: true, description: 'Dramatic role' },
      profile: { type: 'string', required: true, description: 'Full character profile' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args) {
      return asJson(await store.upsertCharacter(args.novel_id, {
        name: args.name,
        role: args.role,
        profile: args.profile,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'novel_outline_set',
    description: 'Insert or update one outline entry (大纲条目) keyed by its order slot: which volume it belongs to and what happens. Use order 1..n in story sequence.',
    parameters: {
      novel_id: { type: 'string', required: true, description: 'Novel id' },
      order: { type: 'integer', required: true, description: 'Story-sequence slot, 1-based' },
      volume: { type: 'string', required: true, description: 'Volume/卷 name' },
      summary: { type: 'string', required: true, description: 'What happens in this beat' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args) {
      return asJson(await store.upsertOutlineEntry(args.novel_id, {
        order: args.order,
        volume: args.volume,
        summary: args.summary,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'novel_set_status',
    description: 'Update a novel\'s own metadata or lifecycle: title, genre, blurb, or status (draft → serializing → finished).',
    parameters: {
      novel_id: { type: 'string', required: true, description: 'Novel id' },
      title: { type: 'string', description: 'New title' },
      genre: { type: 'string', description: 'New genre' },
      description: { type: 'string', description: 'New blurb' },
      status: { type: 'string', enum: [...NOVEL_STATUSES], description: 'New novel status' },
    },
    output: { schema: { type: 'json' }, render: renderJson },
    async execute(args) {
      return asJson(await store.updateNovel(args.novel_id, {
        ...args.title !== undefined ? { title: args.title } : {},
        ...args.genre !== undefined ? { genre: args.genre } : {},
        ...args.description !== undefined ? { description: args.description } : {},
        ...args.status !== undefined ? { status: args.status } : {},
      }))
    },
  }))
}
