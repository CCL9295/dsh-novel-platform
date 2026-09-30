/**
 * The settings tab: the world bible (with the step-by-step worldbuilding
 * wizard), then the character cards. Every AI draft is a suggestion — the
 * writer edits and saves it into the bible explicitly.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { NovelFace } from './face.ts'
import type { NovelLocaleKey } from './locales.ts'
import type {
  CharacterRow, CharacterRole, EnhanceResult, NovelDetail, WorldCategory,
  WorldEntry, WorldUpsertInput,
} from '@deepseek-ai/dsh-novel-platform/types'
import css from './NovelPage.module.css'

type Translate = (key: NovelLocaleKey, params?: Record<string, string | number>) => string

const CHARACTER_ROLES: readonly CharacterRole[] = ['protagonist', 'supporting', 'antagonist', 'minor']

/** World-setting categories shown in the bible, in wizard order. */
const WORLD_CATEGORIES: readonly { category: WorldCategory; label: string }[] = [
  { category: 'premise', label: '世界基调' },
  { category: 'power', label: '力量体系' },
  { category: 'geography', label: '地理格局' },
  { category: 'faction', label: '势力阵营' },
  { category: 'rule', label: '规则禁忌' },
  { category: 'history', label: '历史冲突' },
  { category: 'character', label: '角色世界' },
  { category: 'other', label: '其他' },
]

/** A wizard step as the Remote returns it (client-safe projection). */
interface GuideStep {
  readonly stepId: string
  readonly order: number
  readonly label: string
  readonly skill: string
  readonly category: string
  readonly title: string
  readonly question: string
}

/** The settings tab body. */
export function SettingsTab(props: {
  novelId: string
  detail: NovelDetail
  face: NovelFace
  t: Translate
  onChanged: () => Promise<void>
}): ReactNode {
  const { novelId, detail, face, t, onChanged } = props
  const [wizard, setWizard] = useState(false)

  const deleteWorld = async (entryId: string): Promise<void> => {
    await face.deleteWorldEntry(entryId)
    await onChanged()
  }

  return (
    <div className={css.tabBody}>
      {wizard
        ? (
            <WorldWizard
              novelId={novelId}
              world={detail.world ?? []}
              face={face}
              t={t}
              onClose={() => setWizard(false)}
              onChanged={onChanged}
            />
          )
        : (
            <>
              <div className={css.listHeader}>
                <span className={css.listTitle}>{t('world.title')}</span>
                <Button size="sm" onClick={() => setWizard(true)}>{t('world.wizard')}</Button>
              </div>
              {(detail.world ?? []).length === 0 && (
                <div className={css.placeholder}>{t('world.empty')}</div>
              )}
              <ul className={css.cardList}>
                {(detail.world ?? []).map(entry => (
                  <WorldEntryCard key={entry.entryId} entry={entry} face={face} t={t} onDelete={deleteWorld} />
                ))}
              </ul>
              <WorldEntryForm novelId={novelId} face={face} t={t} onChanged={onChanged} />
              <div className={css.listHeader}>
                <span className={css.listTitle}>{t('characters.title')}</span>
              </div>
              <CharacterCards novelId={novelId} characters={detail.characters} face={face} t={t} onChanged={onChanged} />
            </>
          )}
    </div>
  )
}

/** One world entry with inline edit. */
function WorldEntryCard(props: {
  entry: WorldEntry
  face: NovelFace
  t: Translate
  onDelete: (entryId: string) => Promise<void>
}): ReactNode {
  const { entry, face, t, onDelete } = props
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.content)
  const categoryLabel = WORLD_CATEGORIES.find(candidate => candidate.category === entry.category)?.label ?? entry.category
  const save = async (): Promise<void> => {
    await face.upsertWorldEntry(entry.novelId, { category: entry.category, title: entry.title, content: draft })
    setEditing(false)
  }
  return (
    <li className={css.card}>
      <div className={css.cardHeader}>
        <strong>{entry.title}</strong>
        <span className={css.tag}>{categoryLabel}</span>
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('characters.delete')}
          onClick={() => { void onDelete(entry.entryId) }}
        >
          ×
        </button>
      </div>
      {editing
        ? (
            <>
              <textarea className={css.textarea} value={draft} onChange={event => setDraft(event.target.value)} rows={4} />
              <div className={css.row}>
                <Button size="sm" onClick={() => { void save() }}>{t('world.saveEntry')}</Button>
                <Button size="sm" variant="outline" onClick={() => { setDraft(entry.content); setEditing(false) }}>{t('action.cancel')}</Button>
              </div>
            </>
          )
        : (
            <p className={css.cardBody} onClick={() => setEditing(true)} role="presentation">{entry.content}</p>
          )}
    </li>
  )
}

/** Manual world-entry form. */
function WorldEntryForm(props: {
  novelId: string
  face: NovelFace
  t: Translate
  onChanged: () => Promise<void>
}): ReactNode {
  const { novelId, face, t, onChanged } = props
  const [category, setCategory] = useState<WorldCategory>('premise')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const save = async (): Promise<void> => {
    if (title.trim().length === 0 || content.trim().length === 0) return
    const input: WorldUpsertInput = { category, title: title.trim(), content: content.trim() }
    await face.upsertWorldEntry(novelId, input)
    setTitle('')
    setContent('')
    await onChanged()
  }
  return (
    <form className={css.stack} onSubmit={(event) => { event.preventDefault(); void save() }}>
      <div className={css.row}>
        <select className={css.select} value={category} onChange={event => setCategory(event.target.value as WorldCategory)}>
          {WORLD_CATEGORIES.map(candidate => (
            <option key={candidate.category} value={candidate.category}>{candidate.label}</option>
          ))}
        </select>
        <Input value={title} onChange={event => setTitle(event.target.value)} placeholder={t('world.titleLabel')} />
      </div>
      <textarea
        className={css.textarea}
        value={content}
        onChange={event => setContent(event.target.value)}
        placeholder={t('world.contentPlaceholder')}
        rows={3}
      />
      <div>
        <Button size="sm" onClick={() => { void save() }}>{t('world.saveEntry')}</Button>
      </div>
    </form>
  )
}

/** The step-by-step worldbuilding wizard: question → AI draft → save to bible. */
function WorldWizard(props: {
  novelId: string
  world: readonly WorldEntry[]
  face: NovelFace
  t: Translate
  onClose: () => void
  onChanged: () => Promise<void>
}): ReactNode {
  const { novelId, world, face, t, onClose, onChanged } = props
  const [steps, setSteps] = useState<readonly GuideStep[] | undefined>(undefined)
  const [current, setCurrent] = useState(0)
  const [note, setNote] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | undefined>(undefined)
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)

  useEffect(() => { void face.guideSteps().then(setSteps).catch(() => setSteps([])) }, [face])
  const step = steps?.[current]

  const runDraft = async (): Promise<void> => {
    if (step === undefined) return
    setDrafting(true)
    setDraftError(undefined)
    setDraft(undefined)
    try {
      const result: EnhanceResult = await face.guideDraft(novelId, step.stepId, note)
      setDraft(result.suggestion)
    } catch (cause: unknown) {
      setDraftError(String((cause as Error).message))
    } finally {
      setDrafting(false)
    }
  }

  const saveDraft = async (): Promise<void> => {
    if (step === undefined || draft === undefined) return
    setSaving(true)
    try {
      // Existing entries of this step's category and title are overwritten by
      // upsert; the wizard is iterative by design.
      const input: WorldUpsertInput = {
        category: step.category as WorldCategory,
        title: step.title,
        content: draft,
      }
      await face.upsertWorldEntry(novelId, input)
      await onChanged()
      setDraft(undefined)
      setNote('')
      if (current < (steps?.length ?? 1) - 1) setCurrent(value => value + 1)
    } finally {
      setSaving(false)
    }
  }

  const existingForStep = world.filter(entry => step !== undefined && entry.category === (step.category as WorldCategory))

  return (
    <div className={css.wizard}>
      <div className={css.listHeader}>
        <Button size="sm" variant="outline" onClick={onClose}>{t('world.back')}</Button>
        <span className={css.listTitle}>{t('world.wizard')}</span>
        <span className={css.suggestionSpacer} />
      </div>
      <ol className={css.stepRail}>
        {(steps ?? []).map((candidate, index) => (
          <li key={candidate.stepId}>
            <button
              type="button"
              className={index === current ? css.stepActive : css.step}
              onClick={() => { setCurrent(index); setDraft(undefined); setDraftError(undefined) }}
            >
              {candidate.order}. {candidate.label}
            </button>
          </li>
        ))}
      </ol>
      {step !== undefined && (
        <div className={css.stack}>
          <h3 className={css.novelHeading}>{step.title}</h3>
          <p className={css.cardBody}>{step.question}</p>
          {existingForStep.length > 0 && (
            <div className={css.existing}>
              {existingForStep.map(entry => (
                <p key={entry.entryId} className={css.cardBody}>
                  【{entry.title}】{entry.content.slice(0, 120)}{entry.content.length > 120 ? '…' : ''}
                </p>
              ))}
            </div>
          )}
          <Input value={note} onChange={event => setNote(event.target.value)} placeholder={t('world.notePlaceholder')} />
          <div className={css.row}>
            <Button size="sm" disabled={drafting} onClick={() => { void runDraft() }}>
              {drafting ? t('action.saving') : t('world.draft')}
            </Button>
            <span className={css.skillCardSkill}>{step.skill}</span>
          </div>
          {draftError !== undefined && <div className={css.enhanceError}>{draftError}</div>}
          {draft !== undefined && (
            <>
              <textarea className={css.suggestionBody} readOnly value={draft} rows={12} />
              <div className={css.row}>
                <Button size="sm" disabled={saving} onClick={() => { void saveDraft() }}>
                  {saving ? t('action.saving') : t('world.saveStep')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDraft(undefined)}>{t('action.cancel')}</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Character cards (split out of the old settings tab). */
function CharacterCards(props: {
  novelId: string
  characters: readonly CharacterRow[]
  face: NovelFace
  t: Translate
  onChanged: () => Promise<void>
}): ReactNode {
  const { novelId, characters, face, t, onChanged } = props
  const [name, setName] = useState('')
  const [role, setRole] = useState<CharacterRole>('protagonist')
  const [profile, setProfile] = useState('')
  const save = async (): Promise<void> => {
    if (name.trim().length === 0) return
    await face.upsertCharacter(novelId, { name: name.trim(), role, profile })
    setName('')
    setProfile('')
    await onChanged()
  }
  return (
    <>
      {characters.length === 0 && <div className={css.placeholder}>{t('characters.empty')}</div>}
      <ul className={css.cardList}>
        {characters.map(character => (
          <li key={character.characterId} className={css.card}>
            <div className={css.cardHeader}>
              <strong>{character.name}</strong>
              <span className={css.tag}>{t(`characters.role.${character.role}` as NovelLocaleKey)}</span>
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('characters.delete')}
                onClick={() => { void face.deleteCharacter(character.characterId).then(onChanged) }}
              >
                ×
              </button>
            </div>
            <p className={css.cardBody}>{character.profile}</p>
          </li>
        ))}
      </ul>
      <form className={css.stack} onSubmit={(event) => { event.preventDefault(); void save() }}>
        <div className={css.row}>
          <Input value={name} onChange={event => setName(event.target.value)} placeholder={t('characters.nameLabel')} />
          <select className={css.select} value={role} onChange={event => setRole(event.target.value as CharacterRole)}>
            {CHARACTER_ROLES.map(candidate => (
              <option key={candidate} value={candidate}>{t(`characters.role.${candidate}` as NovelLocaleKey)}</option>
            ))}
          </select>
        </div>
        <textarea
          className={css.textarea}
          value={profile}
          onChange={event => setProfile(event.target.value)}
          placeholder={t('characters.profilePlaceholder')}
          rows={4}
        />
        <div>
          <Button size="sm" onClick={() => { void save() }}>{t('characters.save')}</Button>
        </div>
      </form>
    </>
  )
}
