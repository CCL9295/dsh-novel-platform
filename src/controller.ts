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
  Breakdown, BreakdownReport, ChapterDetail, ChapterPatch, ChapterRow,
  CharacterRow, CharacterUpsertInput, ChapterCreateInput, CustomModel,
  EnhanceActionInfo, EnhanceInput, EnhanceKind, EnhanceResult, Memo,
  MemoFolder, ModelRouteInfo, NovelCreateInput, NovelDetail, NovelPatch,
  NovelRow, OutlineRow, OutlineUpsertInput, WorldEntry, WorldUpsertInput,
  GuideStepInfo,
} from './types.ts'
import type { NovelStoreService } from './store.ts'
import {
  deleteUserSkill, enhance, fuseBreakdown, guideDraft, listActions,
  listKnownSkills, listModelRoutes, runBreakdownReport, saveUserSkill,
  GUIDE_STEPS,
} from './enhance.ts'

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
    /** No enhance action carries that id. */
    'novel/action-not-found': { readonly actionId: string }
    /** The deployment has no usable default model selection. */
    'novel/no-model': { readonly reason: string }
    /** No guide step carries that id. */
    'novel/step-not-found': { readonly stepId: string }
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

  /** List the AI enhance actions the desk offers, with their bundled skills. */
  @Remote('actions')
  listActions(): EnhanceActionInfo[] {
    return listActions()
  }

  /** Run one skill-steered enhance action; returns a suggestion, never applies it. */
  @Remote('enhance')
  async enhance(kind: EnhanceKind, targetId: string, actionId: string, input: EnhanceInput): Promise<EnhanceResult> {
    try {
      return await enhance(this.ctx, this.store, kind, targetId, actionId, input)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** The worldbuilding wizard's ordered steps. */
  @Remote('guideSteps')
  guideSteps(): readonly GuideStepInfo[] {
    return GUIDE_STEPS
  }

  /** Draft one wizard step with the bound skill and the settings gathered so far. */
  @Remote('guideDraft')
  async guideDraft(novelId: string, stepId: string, userNote: string): Promise<EnhanceResult> {
    try {
      return await guideDraft(this.ctx, this.store, novelId, stepId, userNote)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Insert or update one world setting entry. */
  @Remote('worldUpsert')
  async upsertWorldEntry(novelId: string, input: WorldUpsertInput): Promise<WorldEntry> {
    try {
      return await this.store.upsertWorldEntry(novelId, input)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Delete one world setting entry. */
  @Remote('worldDelete')
  async deleteWorldEntry(entryId: string): Promise<void> {
    try {
      await this.store.deleteWorldEntry(entryId)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  // == Memos ==

  /** List every memo folder and note across scopes. */
  @Remote('memoData')
  async memoData(): Promise<{ folders: MemoFolder[]; memos: Memo[] }> {
    return await this.store.listMemoData()
  }

  /** Create one memo folder. */
  @Remote('memoFolderCreate')
  async createMemoFolder(scope: string, parentId: string | null, name: string): Promise<MemoFolder> {
    return await this.store.createMemoFolder(scope, parentId, name)
  }

  /** Delete one memo folder with everything inside it. */
  @Remote('memoFolderDelete')
  async deleteMemoFolder(folderId: string): Promise<void> {
    await this.store.deleteMemoFolder(folderId)
  }

  /** Create one memo note. */
  @Remote('memoCreate')
  async createMemo(scope: string, folderId: string | null, title: string): Promise<Memo> {
    return await this.store.createMemo(scope, folderId, title)
  }

  /** Update one memo's title and/or content. */
  @Remote('memoUpdate')
  async updateMemo(memoId: string, patch: { title?: string; content?: string }): Promise<Memo> {
    return await this.store.updateMemo(memoId, patch)
  }

  /** Delete one memo note. */
  @Remote('memoDelete')
  async deleteMemo(memoId: string): Promise<void> {
    await this.store.deleteMemo(memoId)
  }

  // == Book breakdowns ==

  /** Create one breakdown job from pasted or imported source text. */
  @Remote('breakdownCreate')
  async createBreakdown(sourceTitle: string, sourceText: string): Promise<Breakdown> {
    return await this.store.createBreakdown(sourceTitle, sourceText)
  }

  /** List every breakdown job. */
  @Remote('breakdownList')
  async listBreakdowns(): Promise<Breakdown[]> {
    return await this.store.listBreakdowns()
  }

  /** Delete one breakdown job. */
  @Remote('breakdownDelete')
  async deleteBreakdown(breakdownId: string): Promise<void> {
    await this.store.deleteBreakdown(breakdownId)
  }

  /** Run one skill-dimension breakdown over the stored source text. */
  @Remote('breakdownRun')
  async runBreakdown(breakdownId: string, skill: string, input: EnhanceInput): Promise<BreakdownReport> {
    try {
      const { report } = await runBreakdownReport(this.ctx, this.store, breakdownId, skill, input)
      return report
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Fuse every stored dimension report into one coherent document. */
  @Remote('breakdownFuse')
  async fuseBreakdown(breakdownId: string, input: EnhanceInput): Promise<Breakdown> {
    try {
      await fuseBreakdown(this.ctx, this.store, breakdownId, input)
      return await this.store.getBreakdown(breakdownId)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  // == Skills (bundled + user-imported) ==

  /** List every registered skill with its source. */
  @Remote('skillList')
  async listSkills(): Promise<{ name: string; description: string; source: string }[]> {
    return await listKnownSkills(this.ctx)
  }

  /** Save one user-imported skill into ~/.dsh/skills/. */
  @Remote('skillSave')
  async saveSkill(name: string, description: string, content: string): Promise<{ path: string }> {
    try {
      return await saveUserSkill(name, description, content)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  /** Delete one user-imported skill (bundled skills refuse). */
  @Remote('skillDelete')
  async deleteSkill(name: string): Promise<void> {
    try {
      await deleteUserSkill(name)
    } catch (error: unknown) {
      throw domainError(error)
    }
  }

  // == Model routes ==

  /** Every selectable provider route with its models, plus custom routes. */
  @Remote('modelList')
  async listModels(): Promise<ModelRouteInfo[]> {
    return await listModelRoutes(this.ctx, this.store)
  }

  /** List user-added custom model routes. */
  @Remote('customModelList')
  async listCustomModels(): Promise<CustomModel[]> {
    return await this.store.listCustomModels()
  }

  /** Add or update one custom model route. */
  @Remote('customModelSave')
  async saveCustomModel(input: CustomModel): Promise<CustomModel> {
    return await this.store.saveCustomModel(input)
  }

  /** Delete one custom model route. */
  @Remote('customModelDelete')
  async deleteCustomModel(modelKey: string): Promise<void> {
    await this.store.deleteCustomModel(modelKey)
  }
}
