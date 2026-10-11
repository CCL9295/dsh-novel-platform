/**
 * Writing-desk data face: typed Client Remote calls reduced to plain promises
 * so the page never branches on RemoteResult or knows the wire. Remote
 * failures are rethrown as real errors with their wire code attached.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
// Wire vocabulary comes from the package's client-safe types export (built by the host face).
import type {
  Breakdown, BreakdownReport, ChapterDetail, ChapterPatch, ChapterRow,
  CharacterRow, CharacterUpsertInput, ChapterCreateInput, EnhanceActionInfo,
  EnhanceInput, EnhanceKind, EnhanceResult, Memo, MemoFolder, MemoPatch,
  ModelRouteInfo, NovelCreateInput, NovelDetail, NovelPatch, NovelRow,
  OutlineRow, OutlineUpsertInput, WorldEntry, WorldUpsertInput,
  CustomModel,
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

/**
 * The `remote.novel` namespace surface, written out explicitly instead of
 * relying on the generated declaration merge — the face is the deliberate
 * hand-maintained projection layer between the wire and the page.
 */
interface NovelNamespace {
  list: () => Promise<RemoteResult<NovelRow[]>>
  detail: (novelId: string) => Promise<RemoteResult<NovelDetail>>
  chapter: (chapterId: string) => Promise<RemoteResult<ChapterDetail>>
  create: (input: NovelCreateInput) => Promise<RemoteResult<NovelRow>>
  update: (novelId: string, patch: NovelPatch) => Promise<RemoteResult<NovelRow>>
  delete: (novelId: string) => Promise<RemoteResult<void>>
  chapterCreate: (novelId: string, input: ChapterCreateInput) => Promise<RemoteResult<ChapterRow>>
  chapterUpdate: (chapterId: string, patch: ChapterPatch) => Promise<RemoteResult<ChapterRow>>
  chapterDelete: (chapterId: string) => Promise<RemoteResult<void>>
  characterUpsert: (novelId: string, input: CharacterUpsertInput) => Promise<RemoteResult<CharacterRow>>
  characterDelete: (characterId: string) => Promise<RemoteResult<void>>
  outlineUpsert: (novelId: string, input: OutlineUpsertInput) => Promise<RemoteResult<OutlineRow>>
  outlineDelete: (entryId: string) => Promise<RemoteResult<void>>
  actions: () => Promise<RemoteResult<EnhanceActionInfo[]>>
  enhance: (kind: EnhanceKind, targetId: string, actionId: string, input: EnhanceInput) => Promise<RemoteResult<EnhanceResult>>
  guideSteps: () => Promise<RemoteResult<readonly { stepId: string; order: number; label: string; skill: string; category: string; title: string; question: string }[]>>
  guideDraft: (novelId: string, stepId: string, userNote: string) => Promise<RemoteResult<EnhanceResult>>
  worldUpsert: (novelId: string, input: WorldUpsertInput) => Promise<RemoteResult<WorldEntry>>
  worldDelete: (entryId: string) => Promise<RemoteResult<void>>
  memoData: () => Promise<RemoteResult<{ folders: MemoFolder[]; memos: Memo[] }>>
  memoFolderCreate: (scope: string, parentId: string | null, name: string) => Promise<RemoteResult<MemoFolder>>
  memoFolderDelete: (folderId: string) => Promise<RemoteResult<void>>
  memoCreate: (scope: string, folderId: string | null, title: string) => Promise<RemoteResult<Memo>>
  memoUpdate: (memoId: string, patch: { title?: string; content?: string }) => Promise<RemoteResult<Memo>>
  memoDelete: (memoId: string) => Promise<RemoteResult<void>>
  breakdownCreate: (sourceTitle: string, sourceText: string) => Promise<RemoteResult<Breakdown>>
  breakdownList: () => Promise<RemoteResult<Breakdown[]>>
  breakdownDelete: (breakdownId: string) => Promise<RemoteResult<void>>
  breakdownRun: (breakdownId: string, skill: string, input: EnhanceInput) => Promise<RemoteResult<BreakdownReport>>
  breakdownFuse: (breakdownId: string, input: EnhanceInput) => Promise<RemoteResult<Breakdown>>
  skillList: () => Promise<RemoteResult<{ name: string; description: string; source: string }[]>>
  skillSave: (name: string, description: string, content: string) => Promise<RemoteResult<{ path: string }>>
  skillDelete: (name: string) => Promise<RemoteResult<void>>
  modelList: () => Promise<RemoteResult<ModelRouteInfo[]>>
  customModelList: () => Promise<RemoteResult<CustomModel[]>>
  customModelSave: (input: CustomModel) => Promise<RemoteResult<CustomModel>>
  customModelDelete: (modelKey: string) => Promise<RemoteResult<void>>
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
  readonly listActions: () => Promise<EnhanceActionInfo[]>
  readonly guideSteps: () => Promise<readonly { stepId: string; order: number; label: string; skill: string; category: string; title: string; question: string }[]>
  readonly guideDraft: (novelId: string, stepId: string, userNote: string) => Promise<EnhanceResult>
  readonly upsertWorldEntry: (novelId: string, input: WorldUpsertInput) => Promise<WorldEntry>
  readonly deleteWorldEntry: (entryId: string) => Promise<void>
  readonly enhanceWith: (kind: EnhanceKind, targetId: string, actionId: string, input: EnhanceInput) => Promise<EnhanceResult>
  readonly memoData: () => Promise<{ folders: MemoFolder[]; memos: Memo[] }>
  readonly memoFolderCreate: (scope: string, parentId: string | null, name: string) => Promise<MemoFolder>
  readonly memoFolderDelete: (folderId: string) => Promise<void>
  readonly memoCreate: (scope: string, folderId: string | null, title: string) => Promise<Memo>
  readonly memoUpdate: (memoId: string, patch: MemoPatch) => Promise<Memo>
  readonly memoDelete: (memoId: string) => Promise<void>
  readonly breakdownCreate: (sourceTitle: string, sourceText: string) => Promise<Breakdown>
  readonly breakdownList: () => Promise<Breakdown[]>
  readonly breakdownDelete: (breakdownId: string) => Promise<void>
  readonly breakdownRun: (breakdownId: string, skill: string, input: EnhanceInput) => Promise<BreakdownReport>
  readonly breakdownFuse: (breakdownId: string, input: EnhanceInput) => Promise<Breakdown>
  readonly skillList: () => Promise<{ name: string; description: string; source: string }[]>
  readonly skillSave: (name: string, description: string, content: string) => Promise<{ path: string }>
  readonly skillDelete: (name: string) => Promise<void>
  readonly modelList: () => Promise<ModelRouteInfo[]>
  readonly customModelList: () => Promise<CustomModel[]>
  readonly customModelSave: (input: CustomModel) => Promise<CustomModel>
  readonly customModelDelete: (modelKey: string) => Promise<void>
}

/**
 * Build the face over the `remote.novel` namespace. The namespace is resolved
 * lazily per call, so the face may be handed to the page before this plugin's
 * own `$mount` of the generated contribution settles.
 * @param ctx - browser plugin context carrying the typed Remote service.
 * @returns the writing-desk data face.
 */
export function createNovelFace(ctx: ClientContext): NovelFace {
  const remote = (): NovelNamespace => ctx.remote.novel as unknown as NovelNamespace
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
    listActions: () => unwrap(remote().actions()),
    guideSteps: () => unwrap(remote().guideSteps()),
    guideDraft: (novelId, stepId, userNote) => unwrap(remote().guideDraft(novelId, stepId, userNote)),
    upsertWorldEntry: (novelId, input) => unwrap(remote().worldUpsert(novelId, input)),
    deleteWorldEntry: entryId => unwrap(remote().worldDelete(entryId)),
    enhanceWith: (kind, targetId, actionId, input) => unwrap(remote().enhance(kind, targetId, actionId, input)),
    memoData: () => unwrap(remote().memoData()),
    memoFolderCreate: (scope, parentId, name) => unwrap(remote().memoFolderCreate(scope, parentId, name)),
    memoFolderDelete: folderId => unwrap(remote().memoFolderDelete(folderId)),
    memoCreate: (scope, folderId, title) => unwrap(remote().memoCreate(scope, folderId, title)),
    memoUpdate: (memoId, patch) => unwrap(remote().memoUpdate(memoId, patch)),
    memoDelete: memoId => unwrap(remote().memoDelete(memoId)),
    breakdownCreate: (sourceTitle, sourceText) => unwrap(remote().breakdownCreate(sourceTitle, sourceText)),
    breakdownList: () => unwrap(remote().breakdownList()),
    breakdownDelete: breakdownId => unwrap(remote().breakdownDelete(breakdownId)),
    breakdownRun: (breakdownId, skill, input) => unwrap(remote().breakdownRun(breakdownId, skill, input)),
    breakdownFuse: (breakdownId, input) => unwrap(remote().breakdownFuse(breakdownId, input)),
    skillList: () => unwrap(remote().skillList()),
    skillSave: (name, description, content) => unwrap(remote().skillSave(name, description, content)),
    skillDelete: name => unwrap(remote().skillDelete(name)),
    modelList: () => unwrap(remote().modelList()),
    customModelList: () => unwrap(remote().customModelList()),
    customModelSave: input => unwrap(remote().customModelSave(input)),
    customModelDelete: modelKey => unwrap(remote().customModelDelete(modelKey)),
  }
}
