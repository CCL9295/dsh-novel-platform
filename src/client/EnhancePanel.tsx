/**
 * The right-hand assistant panel for one chapter action (润色 / 审稿 /
 * 去AI味 / 设定核查): model picker, skill picker (bundled + custom), extra
 * instruction, pending-review text, memo links, and chapter links. The ×
 * dismisses the panel so the editor reclaims the space.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { Dropdown } from './Dropdown.tsx'
import type { NovelFace } from './face.ts'
import type { NovelLocaleKey } from './locales.ts'
import type {
  ChapterRow, EnhanceActionInfo, EnhanceResult, Memo, ModelRouteInfo,
} from '@deepseek-ai/dsh-novel-platform/types'
import css from './NovelPage.module.css'

type Translate = (key: NovelLocaleKey, params?: Record<string, string | number>) => string

/** Which actions replace the chapter text when applied. */
const APPLY_ACTIONS = new Set(['chapter-polish', 'chapter-humanize', 'chapter-style', 'chapter-pleasure'])

/** The assistant panel. */
export function EnhancePanel(props: {
  action: EnhanceActionInfo
  novelId: string
  chapterId: string
  chapterBody: string
  face: NovelFace
  t: Translate
  onClose: () => void
  onApplied: (content: string) => Promise<void>
}): ReactNode {
  const { action, novelId, chapterId, chapterBody, face, t, onClose, onApplied } = props
  const [routes, setRoutes] = useState<readonly ModelRouteInfo[]>([])
  const [customs, setCustoms] = useState<readonly { modelKey: string; displayName: string; baseUrl: string; apiKey: string; model: string }[]>([])
  const [provider, setProvider] = useState<string | undefined>(undefined)
  const [model, setModel] = useState<string | undefined>(undefined)
  const [skills, setSkills] = useState<readonly { name: string; description: string; source: string }[]>([])
  const [skill, setSkill] = useState<string>(action.skill)
  const [note, setNote] = useState('')
  const [memoSel, setMemoSel] = useState<readonly string[]>([])
  const [memoPickOpen, setMemoPickOpen] = useState(false)
  const [memos, setMemos] = useState<readonly Memo[]>([])
  const [chapters, setChapters] = useState<readonly ChapterRow[]>([])
  const [chapterSel, setChapterSel] = useState<readonly string[]>([])
  const [chapterPickOpen, setChapterPickOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [result, setResult] = useState<EnhanceResult | undefined>(undefined)

  useEffect(() => {
    void face.modelList().then((list) => {
      setRoutes(list)
      const fallback = list[0]
      if (fallback !== undefined) {
        setProvider(current => current ?? fallback.provider)
        setModel(current => current ?? fallback.models[0])
      }
    }).catch(() => setRoutes([]))
    void face.skillList().then(setSkills).catch(() => setSkills([]))
    void face.customModelList().then(setCustoms).catch(() => setCustoms([]))
    void face.memoData().then(data => setMemos(data.memos)).catch(() => setMemos([]))
    void face.getNovel(novelId).then(detail => setChapters(detail.chapters)).catch(() => setChapters([]))
  }, [face, novelId])

  const run = async (): Promise<void> => {
    setRunning(true)
    setError(undefined)
    setResult(undefined)
    try {
      const memoContext = memos
        .filter(memo => memoSel.includes(memo.memoId) && memo.content.trim().length > 0)
        .map(memo => `【${memo.title}】${memo.content}`)
        .join('\n')
      const chapterContext: string[] = []
      for (const id of chapterSel) {
        const chapter = await face.getChapter(id)
        chapterContext.push(`《${chapter.title}》\n${chapter.content.slice(0, 4000)}`)
      }
      const input: {
        provider?: string
        model?: string
        skill?: string
        note?: string
        memoContext?: string
        chapterContext?: string
      } = {}
      if (provider !== undefined) { input.provider = provider }
      if (model !== undefined) { input.model = model }
      if (skill !== action.skill) { input.skill = skill }
      if (note.trim().length > 0) { input.note = note.trim() }
      if (memoContext.length > 0) { input.memoContext = memoContext }
      if (chapterContext.length > 0) { input.chapterContext = chapterContext.join('\n\n') }
      const enhanceResult = await face.enhanceWith(action.kind, chapterId, action.actionId, input)
      setResult(enhanceResult)
    } catch (cause: unknown) {
      setError(String((cause as Error).message))
    } finally {
      setRunning(false)
    }
  }

  const modelOptions = [
    ...routes.flatMap(route => route.models.map((modelId: string) => ({
      value: `${route.provider}::${modelId}`,
      label: `${route.provider} / ${modelId}`,
    }))),
    ...customs.map(customModel => ({
      value: `custom::${customModel.modelKey}`,
      label: `${customModel.displayName}（自定义）`,
    })),
  ]

  const skillOptions = [
    { value: action.skill, label: `${action.label} · ${action.skill}` },
    ...skills.filter(candidate => candidate.name !== action.skill).map(candidate => ({
      value: candidate.name,
      label: candidate.source === 'bundled' ? candidate.name : `${candidate.name}（自定义）`,
    })),
  ]

  const canApply = APPLY_ACTIONS.has(action.actionId) && result !== undefined

  return (
    <div className={css.assistPanel}>
      <div className={css.assistHeader}>
        <span>{action.label}</span>
        <button type="button" className={css.assistClose} onClick={onClose}>×</button>
      </div>
      <label className={css.assistLabel}>{t('panel.model')}</label>
      <Dropdown
        options={modelOptions}
        value={provider !== undefined && model !== undefined ? `${provider}::${model}` : undefined}
        onChange={(value) => {
          const [nextProvider, nextModel] = value.split('::')
          setProvider(nextProvider)
          setModel(nextModel)
        }}
        placeholder={t('assistant.pickModel')}
        emptyHint={t('assistant.noModel')}
      />
      <label className={css.assistLabel}>{t('panel.skill')}</label>
      <Dropdown
        options={skillOptions}
        value={skill}
        onChange={setSkill}
        placeholder={t('panel.skill')}
      />
      <label className={css.assistLabel}>{t('panel.note')}</label>
      <Input value={note} onChange={event => setNote(event.target.value)} placeholder={t('panel.notePlaceholder')} />
      <label className={css.assistLabel}>{t('panel.pending')}</label>
      {running
        ? <div className={css.placeholder}>{t('action.saving')}</div>
        : result !== undefined
          ? <textarea className={css.assistPending} readOnly value={result.suggestion} />
          : <textarea className={css.assistPending} readOnly value={chapterBody} />}
      {error !== undefined && <div className={css.enhanceError}>{error}</div>}
      <div className={css.row}>
        <Button size="sm" disabled={running} onClick={() => { void run() }}>
          {running ? t('action.saving') : t('panel.generate')}
        </Button>
        {canApply && (
          <Button size="sm" onClick={() => { void onApplied(result !== undefined ? result.suggestion : '').then(onClose) }}>
            {t('panel.apply')}
          </Button>
        )}
      </div>
      <div className={css.linkBlock}>
        <div className={css.linkHeader}>
          <span className={css.linkTitle}>{t('panel.memoLink')}</span>
          {memoSel.length > 0 && <span className={css.tag}>{memoSel.length}</span>}
          <span className={css.suggestionSpacer} />
          <button type="button" className={css.topbarButton} onClick={() => { setChapterPickOpen(false); setMemoPickOpen(value => !value) }}>
            {memoPickOpen ? t('action.cancel') : t('link.pickMemo')}
          </button>
        </div>
        {memoPickOpen && (
          <div className={css.linkPick}>
            {memos.map(memo => (
              <label key={memo.memoId} className={css.memoTreeRow}>
                <input
                  type="checkbox"
                  checked={memoSel.includes(memo.memoId)}
                  onChange={(event) => {
                    setMemoSel(current => event.target.checked
                      ? [...current, memo.memoId]
                      : current.filter(id => id !== memo.memoId))
                  }}
                />
                <span className={css.memoTreeMain}>{memo.title}</span>
              </label>
            ))}
            {memos.length === 0 && <span className={css.formRowLabel}>—</span>}
          </div>
        )}
        {memoSel.length > 0 && (
          <div className={css.linkChips}>
            {memos.filter(memo => memoSel.includes(memo.memoId)).map(memo => (
              <span key={memo.memoId} className={css.linkChip}>
                {memo.title}
                <button
                  type="button"
                  className={css.iconButton}
                  onClick={() => { setMemoSel(current => current.filter(id => id !== memo.memoId)) }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={css.linkBlock}>
        <div className={css.linkHeader}>
          <span className={css.linkTitle}>{t('panel.chapterLink')}</span>
          {chapterSel.length > 0 && <span className={css.tag}>{chapterSel.length}</span>}
          <span className={css.suggestionSpacer} />
          <button type="button" className={css.topbarButton} onClick={() => { setMemoPickOpen(false); setChapterPickOpen(value => !value) }}>
            {chapterPickOpen ? t('action.cancel') : t('link.pickChapter')}
          </button>
        </div>
        {chapterPickOpen && (
          <div className={css.linkPick}>
            {chapters.filter(chapterRow => chapterRow.chapterId !== chapterId).map(chapterRow => (
              <label key={chapterRow.chapterId} className={css.memoTreeRow}>
                <input
                  type="checkbox"
                  checked={chapterSel.includes(chapterRow.chapterId)}
                  onChange={(event) => {
                    setChapterSel(current => event.target.checked
                      ? [...current, chapterRow.chapterId]
                      : current.filter(id => id !== chapterRow.chapterId))
                  }}
                />
                <span className={css.memoTreeMain}>{chapterRow.order}. {chapterRow.title}</span>
              </label>
            ))}
            {chapters.length <= 1 && <span className={css.formRowLabel}>—</span>}
          </div>
        )}
        {chapterSel.length > 0 && (
          <div className={css.linkChips}>
            {chapters.filter(chapterRow => chapterSel.includes(chapterRow.chapterId)).map(chapterRow => (
              <span key={chapterRow.chapterId} className={css.linkChip}>
                {chapterRow.order}. {chapterRow.title}
                <button
                  type="button"
                  className={css.iconButton}
                  onClick={() => { setChapterSel(current => current.filter(id => id !== chapterRow.chapterId)) }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
