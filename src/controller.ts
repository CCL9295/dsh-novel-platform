/**
 * Typert Remote controller for the novel platform (`remote.novel`).
 *
 * Every Client panel read and write funnels through these methods. Lookup
 * parameters are deliberately absent: the platform is profile-global, not
 * Session-scoped, so no Agent or Session identity rides the wire. Domain
 * failures throw `RemoteError` with codes from the `novel/*` vocabulary.
 *
 * @module @deepseek-ai/dsh-novel-platform/controller
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  ChapterDetail, ChapterPatch, ChapterRow, CharacterRow, CharacterUpsertInput,
  ChapterCreateInput, NovelCreateInput, NovelDetail, NovelPatch, NovelRow,
  OutlineRow, OutlineUpsertInput,
} from './types.ts'
import type { NovelStoreService } from './store.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** No stored novel carries that id. */
    'novel/not-found': { readonly novelId: string }
    /** No stored chapter carries that id. */
    'novel/chapter-not-found': { readonly chapterId: string }
    /** No stored character card carries that id. */
    'novel/character-not-found': { readonly characterId: string }
    /** No stored outline entry carries that id. */
    'novel/outline-not-found': { readonly entryId: string }
    /** The store refused an otherwise valid write. */
    'novel/rejected': { readonly reason: string }
  }
}

/** Extract the bare id from a store "… does not exist" message. */
function missingId(message: string): string | undefined {
  return /"([^"]+)" does not exist/u.exec(message)?.[1]
}

/** Map a storage failure onto the `novel/*` Remote failure vocabulary. */
function domainError(error: unknown): RemoteError {
  if (error instanceof RemoteError) return error
  const message = error instanceof Error ? error.message : String(error)
  const id = missingId(message)
  if (id !== undefined) {
    if (id.startsWith('novel-')) return new RemoteError('novel/not-found', message, { novelId: id })
    if (id.startsWith('ch-')) return new RemoteError('novel/chapter-not-found', message, { chapterId: id })
    if (id.startsWith('char-')) return new RemoteError('novel/character-not-found', message, { characterId: id })
    if (id.startsWith('out-')) return new RemoteError('novel/outline-not-found', message, { entryId: id })
  }
  return new RemoteError('novel/rejected', message, { reason: message })
}

/** Remote owner for every novel-platform surface the Client panel consumes. */
export class NovelController extends TypertRemoteService {
  constructor(ctx: Context, private readonly store: NovelStoreService) {
    super(ctx, 'novel')
  }

  /** List every novel row, newest first. */
  @Remote('list')
  async listNovels(): Promise<NovelRow[]> {
    try {
      return await this.store.listNovels()
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Read one whole-novel snapshot (rows only; chapter bodies ride `getChapter`). */
  @Remote('detail')
  async getNovel(novelId: string): Promise<NovelDetail> {
    try {
      return await this.store.getNovel(novelId)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Read one chapter with its body. */
  @Remote('chapter')
  async getChapter(chapterId: string): Promise<ChapterDetail> {
    try {
      return await this.store.getChapter(chapterId)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Create a novel. */
  @Remote('create')
  async createNovel(input: NovelCreateInput): Promise<NovelRow> {
    try {
      return await this.store.createNovel(input)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Patch mutable novel fields. */
  @Remote('update')
  async updateNovel(novelId: string, patch: NovelPatch): Promise<NovelRow> {
    try {
      return await this.store.updateNovel(novelId, patch)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Delete a novel with everything it owns. */
  @Remote('delete')
  async deleteNovel(novelId: string): Promise<void> {
    try {
      await this.store.deleteNovel(novelId)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Create a chapter appended after every existing one. */
  @Remote('chapterCreate')
  async createChapter(novelId: string, input: ChapterCreateInput): Promise<ChapterRow> {
    try {
      return await this.store.createChapter(novelId, input)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Patch one chapter. */
  @Remote('chapterUpdate')
  async updateChapter(chapterId: string, patch: ChapterPatch): Promise<ChapterRow> {
    try {
      return await this.store.updateChapter(chapterId, patch)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Delete one chapter. */
  @Remote('chapterDelete')
  async deleteChapter(chapterId: string): Promise<void> {
    try {
      await this.store.deleteChapter(chapterId)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Insert or update a character card keyed by name. */
  @Remote('characterUpsert')
  async upsertCharacter(novelId: string, input: CharacterUpsertInput): Promise<CharacterRow> {
    try {
      return await this.store.upsertCharacter(novelId, input)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Delete one character card. */
  @Remote('characterDelete')
  async deleteCharacter(characterId: string): Promise<void> {
    try {
      await this.store.deleteCharacter(characterId)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Insert or update one outline entry keyed by its order slot. */
  @Remote('outlineUpsert')
  async upsertOutlineEntry(novelId: string, input: OutlineUpsertInput): Promise<OutlineRow> {
    try {
      return await this.store.upsertOutlineEntry(novelId, input)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Delete one outline entry. */
  @Remote('outlineDelete')
  async deleteOutlineEntry(entryId: string): Promise<void> {
    try {
      await this.store.deleteOutlineEntry(entryId)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }
}
