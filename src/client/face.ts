/**
 * Writing-desk data face: typed Client Remote calls reduced to plain promises
 * so the page never branches on RemoteResult or knows the wire. Remote
 * failures are rethrown as real errors with their wire code attached.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Wire vocabulary comes from the package's client-safe types export (built by the host face).
import type {
  ChapterDetail, ChapterPatch, ChapterRow, CharacterRow, CharacterUpsertInput,
  ChapterCreateInput, NovelCreateInput, NovelDetail, NovelPatch, NovelRow,
  OutlineRow, OutlineUpsertInput,
} from '@deepseek-ai/dsh-novel-platform/types'

/** Remote failure carrying its wire code, for code-aware UI decisions. */
export class NovelFailure extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'NovelFailure'
    this.code = code
  }
}

/** Unwrap `RemoteResult` into a plain promise. */
async function unwrap<T>(call: Promise<{ ok: true; value: T } | { ok: false; error: Error & { code: string } }>): Promise<T> {
  const result = await call
  if (!result.ok) throw new NovelFailure(result.error.code, result.error.message)
  return result.value
}

/** The browser face the writing-desk page consumes. */
export interface NovelFace {
  readonly listNovels: () => Promise<NovelRow[]>
  readonly getNovel: (novelId: string) => Promise<NovelDetail>
  readonly getChapter: (chapterId: string) => Promise<ChapterDetail>
  readonly createNovel: (input: NovelCreateInput) => Promise<NovelRow>
  readonly updateNovel: (novelId: string, patch: NovelPatch) => Promise<NovelRow>
  readonly deleteNovel: (novelId: string) => Promise<void>
  readonly createChapter: (novelId: string, input: ChapterCreateInput) => Promise<ChapterRow>
  readonly updateChapter: (chapterId: string, patch: ChapterPatch) => Promise<ChapterRow>
  readonly deleteChapter: (chapterId: string) => Promise<void>
  readonly upsertCharacter: (novelId: string, input: CharacterUpsertInput) => Promise<CharacterRow>
  readonly deleteCharacter: (characterId: string) => Promise<void>
  readonly upsertOutlineEntry: (novelId: string, input: OutlineUpsertInput) => Promise<OutlineRow>
  readonly deleteOutlineEntry: (entryId: string) => Promise<void>
}

/**
 * Build the face over the `remote.novel` namespace. The namespace is resolved
 * lazily per call, so the face may be handed to the page before this plugin's
 * own `$mount` of the generated contribution settles.
 * @param ctx - browser plugin context carrying the typed Remote service.
 * @returns the writing-desk data face.
 */
export function createNovelFace(ctx: ClientContext): NovelFace {
  const remote = (): ClientContext['remote']['novel'] => ctx.remote.novel
  return {
    listNovels: () => unwrap(remote().list()),
    getNovel: novelId => unwrap(remote().detail(novelId)),
    getChapter: chapterId => unwrap(remote().chapter(chapterId)),
    createNovel: input => unwrap(remote().create(input)),
    updateNovel: (novelId, patch) => unwrap(remote().update(novelId, patch)),
    deleteNovel: novelId => unwrap(remote().delete(novelId)),
    createChapter: (novelId, input) => unwrap(remote().chapterCreate(novelId, input)),
    updateChapter: (chapterId, patch) => unwrap(remote().chapterUpdate(chapterId, patch)),
    deleteChapter: chapterId => unwrap(remote().chapterDelete(chapterId)),
    upsertCharacter: (novelId, input) => unwrap(remote().characterUpsert(novelId, input)),
    deleteCharacter: characterId => unwrap(remote().characterDelete(characterId)),
    upsertOutlineEntry: (novelId, input) => unwrap(remote().outlineUpsert(novelId, input)),
    deleteOutlineEntry: entryId => unwrap(remote().outlineDelete(entryId)),
  }
}
