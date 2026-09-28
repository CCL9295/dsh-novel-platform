/**
 * JSON-file persistence for the novel platform.
 *
 * One document per novel: a novel's chapters, characters, and outline live in
 * `<dsh-home>/novel-platform/novels/<novelId>.json`, plus an index sidecar for
 * the catalog. Mutations are serialized through a per-store queue and staged
 * through a temp-file rename, so tool and panel writes never interleave and
 * readers never observe partial documents. The store owns storage only —
 * domain rules belong to the controller layer.
 *
 * @module @deepseek-ai/dsh-novel-platform/store
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type {
  ChapterDetail, ChapterPatch, ChapterRow, CharacterRow, CharacterUpsertInput,
  ChapterCreateInput, NovelCreateInput, NovelDetail, NovelPatch, NovelRow,
  OutlineRow, OutlineUpsertInput,
} from './types.ts'

/** Storage shape of one novel document. */
interface NovelDocument {
  novel: NovelRow
  chapters: StoredChapter[]
  characters: CharacterRow[]
  outline: OutlineRow[]
}

/** Stored chapter: the row plus its body. */
interface StoredChapter extends ChapterRow {
  content: string
}

/** Structural guard for a document read off disk. */
function isNovelDocument(value: unknown): value is NovelDocument {
  if (typeof value !== 'object' || value === null) return false
  const document = value as Partial<NovelDocument>
  return typeof document.novel === 'object' && document.novel !== null
    && Array.isArray(document.chapters)
    && Array.isArray(document.characters)
    && Array.isArray(document.outline)
}

/** Count CJK characters individually and ASCII words as one token each. */
export function countWords(content: string): number {
  const trimmed = content.trim()
  if (trimmed.length === 0) return 0
  const cjkPattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
  const cjk = (trimmed.match(cjkPattern) ?? []).length
  const latin = (trimmed.replace(cjkPattern, ' ').match(/[A-Za-z0-9'’-]+/gu) ?? []).length
  return cjk + latin
}

/** Filesystem-backed novel store; one service per process. */
export class NovelStoreService extends Service {
  private readonly root: string
  private queue: Promise<unknown> = Promise.resolve()

  constructor(ctx: Context) {
    super(ctx, 'novelStore')
    this.root = dshHomePath('novel-platform', 'novels')
  }

  /** Serialize a mutation onto the store queue; callers receive the typed promise. */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work)
    this.queue = result.catch(() => {})
    return result
  }

  /** Reject ids that could escape the storage directory. */
  private static assertId(id: string, kind: string): void {
    if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error(`invalid ${kind} id "${id}"`)
  }

  private novelPath(novelId: string): string {
    NovelStoreService.assertId(novelId, 'novel')
    return join(this.root, `${novelId}.json`)
  }

  /** Read one document, tolerating a missing file for safe scans. */
  private async tryReadNovel(novelId: string): Promise<NovelDocument | undefined> {
    let raw: string
    try {
      raw = await readFile(this.novelPath(novelId), 'utf8')
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isNovelDocument(parsed)) throw new Error(`novel "${novelId}" storage is corrupt`)
    return parsed
  }

  /** Read one document or fail with a domain message. */
  private async readNovel(novelId: string): Promise<NovelDocument> {
    const document = await this.tryReadNovel(novelId)
    if (document === undefined) throw new Error(`novel "${novelId}" does not exist`)
    return document
  }

  private async writeNovel(document: NovelDocument): Promise<void> {
    await mkdir(this.root, { recursive: true })
    const path = this.novelPath(document.novel.novelId)
    const staged = `${path}.tmp`
    await writeFile(staged, JSON.stringify(document, null, 2), 'utf8')
    await rename(staged, path)
  }

  private async readIndex(): Promise<NovelRow[]> {
    try {
      const raw = await readFile(join(this.root, 'index.json'), 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(isNovelRow)
    } catch {
      return []
    }
  }

  private async writeIndex(rows: NovelRow[]): Promise<void> {
    await mkdir(this.root, { recursive: true })
    const path = join(this.root, 'index.json')
    const staged = `${path}.tmp`
    await writeFile(staged, JSON.stringify(rows, null, 2), 'utf8')
    await rename(staged, path)
  }

  /** List every novel row, newest first. */
  async listNovels(): Promise<NovelRow[]> {
    const rows = await this.readIndex()
    return rows.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  /** Read one whole-novel snapshot. */
  async getNovel(novelId: string): Promise<NovelDetail> {
    const document = await this.readNovel(novelId)
    return toDetail(document)
  }

  /** Read one chapter with its body. */
  async getChapter(chapterId: string): Promise<ChapterDetail> {
    return await this.enqueue(async () => {
      const found = await this.findChapter(chapterId)
      if (found === undefined) throw new Error(`chapter "${chapterId}" does not exist`)
      return found
    })
  }

  /** Scan every document for one chapter. */
  private async findChapter(chapterId: string): Promise<ChapterDetail | undefined> {
    NovelStoreService.assertId(chapterId, 'chapter')
    for (const novelId of await this.novelIds()) {
      const document = await this.tryReadNovel(novelId)
      const chapter = document?.chapters.find(candidate => candidate.chapterId === chapterId)
      if (document !== undefined && chapter !== undefined) {
        return { ...withoutContent(chapter), content: chapter.content }
      }
    }
    return undefined
  }

  /** Every novel id the index knows, tolerating drift. */
  private async novelIds(): Promise<string[]> {
    return (await this.readIndex()).map(row => row.novelId)
  }

  /** Create a novel and refresh the catalog index. */
  async createNovel(input: NovelCreateInput): Promise<NovelRow> {
    return await this.enqueue(async () => {
      const now = new Date().toISOString()
      const novel: NovelRow = {
        novelId: randomId('novel'),
        title: input.title,
        genre: input.genre,
        description: input.description,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      }
      await this.writeNovel({ novel, chapters: [], characters: [], outline: [] })
      await this.writeIndex([...await this.readIndex(), novel])
      return novel
    })
  }

  /** Patch mutable novel fields. */
  async updateNovel(novelId: string, patch: NovelPatch): Promise<NovelRow> {
    return await this.enqueue(async () => {
      const document = await this.readNovel(novelId)
      const novel: NovelRow = {
        ...document.novel,
        ...patch.title !== undefined ? { title: patch.title } : {},
        ...patch.genre !== undefined ? { genre: patch.genre } : {},
        ...patch.description !== undefined ? { description: patch.description } : {},
        ...patch.status !== undefined ? { status: patch.status } : {},
        updatedAt: new Date().toISOString(),
      }
      await this.writeNovel({ ...document, novel })
      await this.writeIndex([
        ...(await this.readIndex()).filter(row => row.novelId !== novelId),
        novel,
      ])
      return novel
    })
  }

  /** Delete a novel document and its index row. */
  async deleteNovel(novelId: string): Promise<void> {
    await this.enqueue(async () => {
      await this.readNovel(novelId)
      await this.writeIndex((await this.readIndex()).filter(row => row.novelId !== novelId))
      await rm(this.novelPath(novelId), { force: true })
    })
  }

  /** Create a chapter appended after every existing one. */
  async createChapter(novelId: string, input: ChapterCreateInput): Promise<ChapterRow> {
    return await this.enqueue(async () => {
      const document = await this.readNovel(novelId)
      const now = new Date().toISOString()
      const order = document.chapters.reduce((max, chapter) => Math.max(max, chapter.order), 0) + 1
      const chapter: StoredChapter = {
        chapterId: randomId('ch'),
        novelId,
        order,
        title: input.title,
        content: input.content,
        wordCount: countWords(input.content),
        status: input.status,
        createdAt: now,
        updatedAt: now,
      }
      await this.writeNovel({ ...document, chapters: [...document.chapters, chapter] })
      await this.touchNovel(novelId)
      return withoutContent(chapter)
    })
  }

  /** Patch one chapter; content updates recompute the word count. */
  async updateChapter(chapterId: string, patch: ChapterPatch): Promise<ChapterRow> {
    return await this.enqueue(async () => {
      const found = await this.locateChapter(chapterId)
      if (found === undefined) throw new Error(`chapter "${chapterId}" does not exist`)
      const { document, chapter: previous } = found
      const chapter: StoredChapter = {
        ...previous,
        ...patch.title !== undefined ? { title: patch.title } : {},
        ...patch.content !== undefined ? { content: patch.content, wordCount: countWords(patch.content) } : {},
        ...patch.status !== undefined ? { status: patch.status } : {},
        updatedAt: new Date().toISOString(),
      }
      await this.writeNovel({
        ...document,
        chapters: document.chapters.map(candidate => candidate.chapterId === chapterId ? chapter : candidate),
      })
      await this.touchNovel(document.novel.novelId)
      return withoutContent(chapter)
    })
  }

  /** Delete one chapter and close the order gap. */
  async deleteChapter(chapterId: string): Promise<void> {
    await this.enqueue(async () => {
      const found = await this.locateChapter(chapterId)
      if (found === undefined) throw new Error(`chapter "${chapterId}" does not exist`)
      const { document } = found
      const chapters = document.chapters
        .filter(candidate => candidate.chapterId !== chapterId)
        .map((chapter, position) => ({ ...chapter, order: position + 1 }))
      await this.writeNovel({ ...document, chapters })
      await this.touchNovel(document.novel.novelId)
    })
  }

  /** Insert or update a character card keyed by name within the novel. */
  async upsertCharacter(novelId: string, input: CharacterUpsertInput): Promise<CharacterRow> {
    return await this.enqueue(async () => {
      const document = await this.readNovel(novelId)
      const now = new Date().toISOString()
      const existing = document.characters.find(candidate => candidate.name === input.name)
      if (existing !== undefined) {
        const character: CharacterRow = { ...existing, role: input.role, profile: input.profile, updatedAt: now }
        await this.writeNovel({
          ...document,
          characters: document.characters.map(candidate => candidate.name === input.name ? character : candidate),
        })
        return character
      }
      const character: CharacterRow = {
        characterId: randomId('char'),
        novelId,
        name: input.name,
        role: input.role,
        profile: input.profile,
        updatedAt: now,
      }
      await this.writeNovel({ ...document, characters: [...document.characters, character] })
      await this.touchNovel(novelId)
      return character
    })
  }

  /** Delete a character card by id. */
  async deleteCharacter(characterId: string): Promise<void> {
    await this.enqueue(async () => {
      const found = await this.locateCharacter(characterId)
      if (found === undefined) throw new Error(`character "${characterId}" does not exist`)
      const { document, character } = found
      await this.writeNovel({
        ...document,
        characters: document.characters.filter(candidate => candidate.characterId !== character.characterId),
      })
      await this.touchNovel(document.novel.novelId)
    })
  }

  /** Insert or update one outline entry keyed by its order slot. */
  async upsertOutlineEntry(novelId: string, input: OutlineUpsertInput): Promise<OutlineRow> {
    return await this.enqueue(async () => {
      const document = await this.readNovel(novelId)
      const now = new Date().toISOString()
      const existing = document.outline.find(candidate => candidate.order === input.order)
      if (existing !== undefined) {
        const entry: OutlineRow = { ...existing, volume: input.volume, summary: input.summary, updatedAt: now }
        await this.writeNovel({
          ...document,
          outline: document.outline.map(candidate => candidate.order === input.order ? entry : candidate),
        })
        return entry
      }
      const entry: OutlineRow = {
        entryId: randomId('out'),
        novelId,
        order: input.order,
        volume: input.volume,
        summary: input.summary,
        updatedAt: now,
      }
      await this.writeNovel({ ...document, outline: [...document.outline, entry] })
      await this.touchNovel(novelId)
      return entry
    })
  }

  /** Delete one outline entry by id. */
  async deleteOutlineEntry(entryId: string): Promise<void> {
    await this.enqueue(async () => {
      const found = await this.locateOutline(entryId)
      if (found === undefined) throw new Error(`outline entry "${entryId}" does not exist`)
      const { document, entry } = found
      await this.writeNovel({
        ...document,
        outline: document.outline.filter(candidate => candidate.entryId !== entry.entryId),
      })
      await this.touchNovel(document.novel.novelId)
    })
  }

  /** Bump the novel's updatedAt after any nested mutation. */
  private async touchNovel(novelId: string): Promise<void> {
    const document = await this.tryReadNovel(novelId)
    if (document === undefined) return
    await this.writeNovel({
      ...document,
      novel: { ...document.novel, updatedAt: new Date().toISOString() },
    })
  }

  /** Find the document holding one chapter. */
  private async locateChapter(chapterId: string): Promise<{ document: NovelDocument; chapter: StoredChapter } | undefined> {
    NovelStoreService.assertId(chapterId, 'chapter')
    for (const novelId of await this.novelIds()) {
      const document = await this.tryReadNovel(novelId)
      const chapter = document?.chapters.find(candidate => candidate.chapterId === chapterId)
      if (document !== undefined && chapter !== undefined) return { document, chapter }
    }
    return undefined
  }

  /** Find the document holding one character card. */
  private async locateCharacter(characterId: string): Promise<{ document: NovelDocument; character: CharacterRow } | undefined> {
    NovelStoreService.assertId(characterId, 'character')
    for (const novelId of await this.novelIds()) {
      const document = await this.tryReadNovel(novelId)
      const character = document?.characters.find(candidate => candidate.characterId === characterId)
      if (document !== undefined && character !== undefined) return { document, character }
    }
    return undefined
  }

  /** Find the document holding one outline entry. */
  private async locateOutline(entryId: string): Promise<{ document: NovelDocument; entry: OutlineRow } | undefined> {
    NovelStoreService.assertId(entryId, 'outline')
    for (const novelId of await this.novelIds()) {
      const document = await this.tryReadNovel(novelId)
      const entry = document?.outline.find(candidate => candidate.entryId === entryId)
      if (document !== undefined && entry !== undefined) return { document, entry }
    }
    return undefined
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Process-wide novel store; safe for concurrent tool and panel writes. */
    novelStore: NovelStoreService
  }
}

/** Guard for index rows read off disk. */
function isNovelRow(value: unknown): value is NovelRow {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Partial<NovelRow>
  return typeof row.novelId === 'string' && typeof row.title === 'string'
    && typeof row.createdAt === 'string' && typeof row.updatedAt === 'string'
}

/** Strip a chapter body for a row projection. */
function withoutContent(chapter: StoredChapter): ChapterRow {
  return {
    chapterId: chapter.chapterId,
    novelId: chapter.novelId,
    order: chapter.order,
    title: chapter.title,
    wordCount: chapter.wordCount,
    status: chapter.status,
    createdAt: chapter.createdAt,
    updatedAt: chapter.updatedAt,
  }
}

/** Project a stored document to its client-safe snapshot. */
function toDetail(document: NovelDocument): NovelDetail {
  return {
    novel: document.novel,
    chapters: document.chapters.map(withoutContent),
    characters: document.characters,
    outline: document.outline,
  }
}

/** URL-safe opaque id with a domain prefix. */
function randomId(prefix: string): string {
  const entropy = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36)
  return `${prefix}-${time}${entropy}`
}
