/**
 * Wire-facing payload vocabulary and storage model for the novel platform.
 *
 * Host tools, the Typert Remote namespace, and the browser panel all speak
 * these shapes. Rows are client-safe projections; drafts live in the store
 * only. IDs are store-generated opaque strings.
 *
 * @module @deepseek-ai/dsh-novel-platform/types
 */

/** Publication lifecycle of one novel. */
export type NovelStatus = 'draft' | 'serializing' | 'finished'

/** Writing lifecycle of one chapter. */
export type ChapterStatus = 'outline' | 'draft' | 'revised' | 'published'

/** Dramatic role of one character card. */
export type CharacterRole = 'protagonist' | 'supporting' | 'antagonist' | 'minor'

/** One novel as Client and tools read it. */
export interface NovelRow {
  readonly novelId: string
  readonly title: string
  readonly genre: string
  readonly description: string
  readonly status: NovelStatus
  readonly createdAt: string
  readonly updatedAt: string
}

/** One chapter as Client and tools read it. Content rides `getChapter` only. */
export interface ChapterRow {
  readonly chapterId: string
  readonly novelId: string
  readonly order: number
  readonly title: string
  readonly wordCount: number
  readonly status: ChapterStatus
  readonly createdAt: string
  readonly updatedAt: string
}

/** One chapter with its body, for read paths only. */
export interface ChapterDetail extends ChapterRow {
  readonly content: string
}

/** One character card. */
export interface CharacterRow {
  readonly characterId: string
  readonly novelId: string
  readonly name: string
  readonly role: CharacterRole
  readonly profile: string
  readonly updatedAt: string
}

/** One outline entry. */
export interface OutlineRow {
  readonly entryId: string
  readonly novelId: string
  readonly order: number
  readonly volume: string
  readonly summary: string
  readonly updatedAt: string
}

/** Whole-novel snapshot the `novel_overview` tool and novel detail view consume. */
export interface NovelDetail {
  readonly novel: NovelRow
  readonly chapters: readonly ChapterRow[]
  readonly characters: readonly CharacterRow[]
  readonly outline: readonly OutlineRow[]
  readonly world: readonly WorldEntry[]
}

/** Creation input for a novel. */
export interface NovelCreateInput {
  readonly title: string
  readonly genre: string
  readonly description: string
}

/** Mutable novel fields. */
export interface NovelPatch {
  readonly title?: string
  readonly genre?: string
  readonly description?: string
  readonly status?: NovelStatus
}

/** Creation input for a chapter. */
export interface ChapterCreateInput {
  readonly title: string
  readonly content: string
  readonly status: ChapterStatus
}

/** Mutable chapter fields. */
export interface ChapterPatch {
  readonly title?: string
  readonly content?: string
  readonly status?: ChapterStatus
}

/** Upsert input for a character card. */
export interface CharacterUpsertInput {
  readonly name: string
  readonly role: CharacterRole
  readonly profile: string
}

/** Upsert input for one outline entry. */
export interface OutlineUpsertInput {
  readonly order: number
  readonly volume: string
  readonly summary: string
}

/** Which surface an AI enhance action operates on. */
export type EnhanceKind = 'chapter' | 'outline'

/** One AI enhance action the writing desk offers, bound to a bundled skill. */
export interface EnhanceActionInfo {
  readonly actionId: string
  readonly kind: EnhanceKind
  readonly label: string
  /** The bundled (弧光) skill whose instructions steer the model. */
  readonly skill: string
  /** One-line "what this does here" shown on the button/card. */
  readonly hint: string
}

/** Model output for one enhance action; never auto-applied. */
export interface EnhanceResult {
  readonly actionId: string
  readonly kind: EnhanceKind
  readonly label: string
  readonly skill: string
  readonly suggestion: string
}

/** Worldbuilding entry categories, in wizard order. */
export type WorldCategory = 'premise' | 'power' | 'geography' | 'faction' | 'rule' | 'history' | 'character' | 'other'

/** One worldbuilding entry in the novel's setting bible. */
export interface WorldEntry {
  readonly entryId: string
  readonly novelId: string
  readonly category: WorldCategory
  readonly title: string
  readonly content: string
  readonly updatedAt: string
}

/** Upsert input for a world entry (identity = novel + category + title). */
export interface WorldUpsertInput {
  readonly category: WorldCategory
  readonly title: string
  readonly content: string
}

/** The worldbuilding wizard: ordered steps, each bound to a skill and its guiding question. */
export interface GuideStepInfo {
  readonly stepId: string
  readonly order: number
  readonly label: string
  /** The bundled (弧光) skill steering this step's draft. */
  readonly skill: string
  readonly category: WorldCategory
  readonly title: string
  /** The guiding question shown to the writer for this step. */
  readonly question: string
}
