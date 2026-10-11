/**
 * The writing desk. A top strip carries the novels (长篇 / 短篇 chips, 拆书,
 * 新建); the workbench header shows the book title with the memo pad, and the
 * editor area is three-pane — chapter list, the body with a horizontally
 * scrolling AI action bar, and the dismissible assistant panel. Column widths
 * are drag-adjustable and the body auto-saves as it is edited.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NovelFace } from './face.ts'
import type { NovelLocaleKey } from './locales.ts'
import { BreakdownView } from './BreakdownView.tsx'
import { EnhancePanel } from './EnhancePanel.tsx'
import { MemoPad } from './MemoPad.tsx'
import { ModelManager } from './ModelManager.tsx'
import { AiAssistant } from './AiAssistant.tsx'
import { SettingsTab } from './SettingsTab.tsx'
import { SkillsManager } from './SkillsManager.tsx'
import type {
  ChapterDetail, ChapterRow, EnhanceActionInfo,
  EnhanceKind, EnhanceResult, NovelDetail,
  NovelForm, NovelRow, OutlineRow,
} from '@deepseek-ai/dsh-novel-platform/types'
import css from './NovelPage.module.css'

/** Full component props assembled by the main slot renderer. */
export type NovelPageProps =
  PropsRuntime<'main'>
  & PropsLocale<'novel'>
  & InjectFace<NovelFace>

type Translate = (key: NovelLocaleKey, params?: Record<string, string | number>) => string

const CHAPTER_STATUSES = ['outline', 'draft', 'revised', 'published'] as const

/** The four assistant actions shown on the editor's action bar, in order. */
const BAR_ACTIONS: readonly string[] = [
  'chapter-polish', 'chapter-review', 'chapter-humanize', 'chapter-consistency',
]

function formLabel(novel: NovelRow): string {
  return novel.form === 'short' ? '短篇' : '长篇'
}

/** Root writing-desk panel. */
export function NovelPage(props: NovelPageProps): ReactNode {
  const face: NovelFace = props
  const t = props.t as Translate
  const [mode, setMode] = useState<'desk' | 'breakdown'>('desk')
  const [novels, setNovels] = useState<NovelRow[] | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [detail, setDetail] = useState<NovelDetail | undefined>(undefined)
  const [tab, setTab] = useState<'chapters' | 'settings' | 'outline'>('chapters')
  const [actions, setActions] = useState<readonly EnhanceActionInfo[] | undefined>(undefined)
  const [memosOpen, setMemosOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [modelsOpen, setModelsOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [stripCollapsed, setStripCollapsed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<NovelForm>('long')
  const [createTitle, setCreateTitle] = useState('')
  const [createGenre, setCreateGenre] = useState('')
  const [createDescription, setCreateDescription] = useState('')

  const loadNovels = useCallback(async (): Promise<void> => {
    try {
      setNovels(await face.listNovels())
      setError(undefined)
    } catch (cause: unknown) {
      setError(t('novels.loadFailed', { message: String((cause as Error).message) }))
    }
  }, [face, t])

  useEffect(() => { void loadNovels() }, [loadNovels])
  useEffect(() => { void face.listActions().then(setActions).catch(() => setActions([])) }, [face])

  useEffect(() => {
    if (selectedId === undefined) {
      setDetail(undefined)
      return
    }
    let alive = true
    face.getNovel(selectedId).then((snapshot) => {
      if (alive) setDetail(snapshot)
    }).catch((cause: unknown) => {
      if (alive) setError(String((cause as Error).message))
    })
    return () => { alive = false }
  }, [selectedId, face])

  const exit = (): void => {
    setSelectedId(undefined)
    setMode('desk')
  }

  const createNovel = async (title: string, genre: string, description: string, form: NovelForm): Promise<void> => {
    const novel = await face.createNovel({ title, genre, description, form })
    await loadNovels()
    setSelectedId(novel.novelId)
  }

  const refreshDetail = async (): Promise<void> => {
    if (selectedId !== undefined) setDetail(await face.getNovel(selectedId))
  }

  const actionsFor = (kind: EnhanceKind): readonly EnhanceActionInfo[] =>
    (actions ?? []).filter(action => action.kind === kind)

  const submitCreate = async (): Promise<void> => {
    if (createTitle.trim().length === 0) return
    await createNovel(createTitle.trim(), createGenre.trim(), createDescription.trim(), createForm)
    setCreateTitle('')
    setCreateGenre('')
    setCreateDescription('')
    setCreating(false)
  }

  const chip = (novel: NovelRow): ReactNode => (
    <button
      key={novel.novelId}
      type="button"
      className={selectedId === novel.novelId ? `${css.novelChip} ${css.novelChipActive}` : css.novelChip}
      onClick={() => setSelectedId(novel.novelId)}
    >
      <span className={css.novelTitle}>{novel.title}</span>
      <span className={css.novelChipForm}>{novel.genre} · {formLabel(novel)}</span>
    </button>
  )

  const longs = (novels ?? []).filter(novel => novel.form !== 'short')
  const shorts = (novels ?? []).filter(novel => novel.form === 'short')

  return (
    <div className={css.page}>
      <header className={css.topbar}>
        <h1 className={css.topbarTitle}>{t('panel')}</h1>
        <span className={css.topbarSpacer} />
        <button type="button" className={css.topbarButton} onClick={() => setSkillsOpen(value => !value)}>{t('desk.skills')}</button>
        <button type="button" className={css.topbarButton} onClick={() => setModelsOpen(value => !value)}>{t('desk.models')}</button>
        <button type="button" className={css.topbarButton} onClick={() => setAssistantOpen(value => !value)}>AI 助手</button>
        {(mode === 'breakdown' || selectedId !== undefined) && (
          <button type="button" className={css.topbarButton} onClick={exit}>{t('desk.exit')} ←</button>
        )}
      </header>
      {error !== undefined && <div className={css.error}>{error}</div>}
      {mode === 'breakdown'
        ? <BreakdownView face={face} t={t} />
        : (
            <>
              <div className={css.novelStrip} style={selectedId !== undefined ? { display: 'none' } : undefined}>
                <button
                  type="button"
                  className={css.topbarButton}
                  title={stripCollapsed ? t('memo.showList') : t('memo.hideList')}
                  onClick={() => setStripCollapsed(value => !value)}
                >
                  {stripCollapsed ? '»' : '«'}
                </button>
                {!stripCollapsed && <span className={css.memoTreeScope}>▾ {t('form.long')}</span>}
                {!stripCollapsed && longs.map(chip)}
                {!stripCollapsed && shorts.length > 0 && <span className={css.memoTreeScope}>▾ {t('form.short')}</span>}
                {!stripCollapsed && shorts.map(chip)}
                <span className={css.topbarSpacer} />
                <Button size="sm" onClick={() => setCreating(value => !value)}>{t('novels.create')}</Button>
                <button type="button" className={css.topbarButton} onClick={() => setMode('breakdown')}>📖 {t('desk.breakdown')}</button>
              </div>
              {creating && (
                <div className={css.skillsImport} style={{ margin: '8px 12px' }}>
                  <div className={css.row}>
                    <button type="button" className={createForm === 'long' ? css.formPillActive : css.formPill} onClick={() => setCreateForm('long')}>{t('form.long')}</button>
                    <button type="button" className={createForm === 'short' ? css.formPillActive : css.formPill} onClick={() => setCreateForm('short')}>{t('form.short')}</button>
                  </div>
                  <Input value={createTitle} onChange={event => setCreateTitle(event.target.value)} placeholder={t('novels.titleLabel')} />
                  <Input value={createGenre} onChange={event => setCreateGenre(event.target.value)} placeholder={t('novels.genrePlaceholder')} />
                  <textarea
                    className={css.textarea}
                    value={createDescription}
                    onChange={event => setCreateDescription(event.target.value)}
                    placeholder={t('novels.descriptionLabel')}
                    rows={2}
                  />
                  <div className={css.row}>
                    <Button size="sm" onClick={() => { void submitCreate() }}>{t('action.confirm')}</Button>
                    <Button size="sm" variant="outline" onClick={() => setCreating(false)}>{t('action.cancel')}</Button>
                  </div>
                </div>
              )}
              <div className={css.workArea}>
                <section className={css.workbench}>
                  {selectedId === undefined || detail === undefined
                    ? (
                        <div className={css.worksList}>
                          <div className={css.memoTreeScope}>▾ {t('form.long')}（{longs.length}）</div>
                          {longs.map(novel => (
                            <button key={novel.novelId} type="button" className={css.listButton} onClick={() => setSelectedId(novel.novelId)}>
                              <span className={css.novelTitle}>{novel.title}</span>
                              <span className={css.novelMeta}>{novel.genre} · {novel.status === 'draft' ? '草稿' : novel.status === 'serializing' ? '连载中' : '完结'}</span>
                            </button>
                          ))}
                          {longs.length === 0 && <div className={css.empty}>—</div>}
                          <div className={css.memoTreeScope}>▾ {t('form.short')}（{shorts.length}）</div>
                          {shorts.map(novel => (
                            <button key={novel.novelId} type="button" className={css.listButton} onClick={() => setSelectedId(novel.novelId)}>
                              <span className={css.novelTitle}>{novel.title}</span>
                              <span className={css.novelMeta}>{novel.genre} · {novel.status === 'draft' ? '草稿' : novel.status === 'serializing' ? '连载中' : '完结'}</span>
                            </button>
                          ))}
                          {shorts.length === 0 && <div className={css.empty}>—</div>}
                        </div>
                      )
                    : (
                        <>
                          <div className={css.stack}>
                            <div className={css.novelHeader}>
                              <h2 className={css.novelHeading}>{detail.novel.title}</h2>
                              <button type="button" className={css.topbarButton} onClick={() => setMemosOpen(value => !value)}>
                                {t('desk.memo')}
                              </button>
                            </div>
                            <p className={css.novelMeta}>
                              {detail.novel.genre}
                              {' · '}
                              {t('chapters.wordCount', { count: detail.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0) })}
                              {' · '}
                              {detail.chapters.length} {t('tab.chapters')}
                            </p>
                          </div>
                          <nav className={css.tabs}>
                            <TabButton active={tab === 'chapters'} onClick={() => setTab('chapters')}>{t('tab.chapters')}</TabButton>
                            <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>{t('tab.settings')}</TabButton>
                            <TabButton active={tab === 'outline'} onClick={() => setTab('outline')}>{t('tab.outline')}</TabButton>
                          </nav>
                          {tab === 'chapters' && (
                            <ChaptersTab
                              novelId={selectedId}
                              chapters={detail.chapters}
                              face={face}
                              t={t}
                              onChanged={refreshDetail}
                              chapterActions={actionsFor('chapter')}
                            />
                          )}
                          {tab === 'settings' && (
                            <SettingsTab novelId={selectedId} detail={detail} face={face} t={t} onChanged={refreshDetail} />
                          )}
                          {tab === 'outline' && (
                            <OutlineTab
                              novelId={selectedId}
                              outline={detail.outline}
                              face={face}
                              t={t}
                              onChanged={refreshDetail}
                              outlineActions={actionsFor('outline')}
                            />
                          )}
                        </>
                      )}
                </section>
              </div>
            </>
          )}
      {memosOpen && selectedId !== undefined && (
        <MemoPad novelId={selectedId} face={face} t={t} onClose={() => setMemosOpen(false)} />
      )}
      {skillsOpen && (
        <div className={css.memoPad} style={{ left: 160, top: 80, width: 640, height: 520 }}>
          <div className={css.memoPadBar}>
            <span className={css.memoPadTitle}>{t('skills.title')}</span>
            <span className={css.memoPadSpacer} />
            <button type="button" className={css.assistClose} onClick={() => setSkillsOpen(false)}>×</button>
          </div>
          <div className={css.breakdownPage}>
            <SkillsManager face={face} t={t} />
          </div>
        </div>
      )}
      {modelsOpen && (
        <ModelManager face={face} t={t} onClose={() => setModelsOpen(false)} />
      )}
      {assistantOpen && (
        <AiAssistant novelId={selectedId} detail={detail} face={face} t={t} onClose={() => setAssistantOpen(false)} />
      )}
    </div>
  )
}

function TabButton(props: { active: boolean; onClick: () => void; children: ReactNode }): ReactNode {
  return (
    <button type="button" className={props.active ? css.tabActive : css.tab} onClick={props.onClick}>
      {props.children}
    </button>
  )
}

/** AI suggestion preview: never auto-applied; the writer adopts or discards. */
function SuggestionPanel(props: {
  result: EnhanceResult
  onApply: (() => Promise<void>) | undefined
  applyLabel: string
  onClose: () => void
  t: Translate
}): ReactNode {
  const { result, onApply, applyLabel, onClose, t } = props
  const [applying, setApplying] = useState(false)
  const apply = async (): Promise<void> => {
    if (onApply === undefined) return
    setApplying(true)
    try {
      await onApply()
      onClose()
    } finally {
      setApplying(false)
    }
  }
  return (
    <div className={css.suggestion}>
      <div className={css.suggestionHeader}>
        <strong>{result.label}</strong>
        <span className={css.tag}>{result.skill}</span>
        <span className={css.suggestionSpacer} />
        {onApply !== undefined && (
          <Button size="sm" disabled={applying} onClick={() => { void apply() }}>
            {applying ? t('action.saving') : applyLabel}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(result.suggestion) }}>{t('enhance.copy')}</Button>
        <Button size="sm" variant="outline" onClick={onClose}>{t('action.cancel')}</Button>
      </div>
      <textarea className={css.suggestionBody} readOnly value={result.suggestion} rows={12} />
    </div>
  )
}

function ChaptersTab(props: {
  novelId: string
  chapters: readonly ChapterRow[]
  face: NovelFace
  t: Translate
  onChanged: () => Promise<void>
  chapterActions: readonly EnhanceActionInfo[]
}): ReactNode {
  const { novelId, chapters, face, t, onChanged, chapterActions } = props
  const [chapterId, setChapterId] = useState<string | undefined>(undefined)
  const [chapter, setChapter] = useState<ChapterDetail | undefined>(undefined)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [panelAction, setPanelAction] = useState<EnhanceActionInfo | undefined>(undefined)
  const [panelBody, setPanelBody] = useState('')
  const [panelNonce, setPanelNonce] = useState(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [listWidth, setListWidth] = useState(200)
  const [panelWidth, setPanelWidth] = useState(320)
  const dragRef = useRef<{ mode: 'list' | 'panel'; startX: number; baseList: number; basePanel: number } | undefined>(undefined)

  useEffect(() => {
    if (chapterId === undefined) {
      setChapter(undefined)
      return
    }
    let alive = true
    face.getChapter(chapterId).then((loaded) => {
      if (!alive) return
      setChapter(loaded)
      setDraftTitle(loaded.title)
      setDraftContent(loaded.content)
      setDirty(false)
    }).catch(() => {
      if (alive) setChapter(undefined)
    })
    return () => { alive = false }
  }, [chapterId, face, chapters])

  // Auto-save: one debounce timer per edit burst (the save button is gone).
  useEffect(() => {
    if (!dirty || chapterId === undefined) return
    if (saveTimer.current !== undefined) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void (async () => {
        try {
          await face.updateChapter(chapterId, { title: draftTitle, content: draftContent })
          setDirty(false)
          await onChanged()
        } catch {
          // Transient failures stay silent; the next edit retries.
        }
      })()
    }, 900)
    return () => { if (saveTimer.current !== undefined) clearTimeout(saveTimer.current) }
  }, [draftTitle, draftContent, dirty, chapterId, face, onChanged])

  const createChapter = async (): Promise<void> => {
    const created = await face.createChapter(novelId, {
      title: t('chapters.titleLabel'),
      content: '',
      status: 'draft',
    })
    await onChanged()
    setChapterId(created.chapterId)
  }

  const remove = async (id: string): Promise<void> => {
    await face.deleteChapter(id)
    if (chapterId === id) setChapterId(undefined)
    await onChanged()
  }

  const openPanel = async (action: EnhanceActionInfo): Promise<void> => {
    if (chapterId === undefined) return
    // The panel works on the saved text: flush pending edits first, then
    // snapshot the body exactly as it was when the action was clicked.
    if (dirty) {
      await face.updateChapter(chapterId, { title: draftTitle, content: draftContent })
      setDirty(false)
      await onChanged()
    }
    setPanelBody(draftContent)
    setPanelAction(action)
    setPanelNonce(value => value + 1)
  }

  const startResize = (mode: 'list' | 'panel') => (event: React.MouseEvent): void => {
    event.stopPropagation()
    dragRef.current = { mode, startX: event.clientX, baseList: listWidth, basePanel: panelWidth }
    const move = (e: MouseEvent): void => {
      const drag = dragRef.current
      if (drag === undefined) return
      if (drag.mode === 'list') setListWidth(Math.max(140, Math.min(420, drag.baseList + e.clientX - drag.startX)))
      else setPanelWidth(Math.max(260, Math.min(560, drag.basePanel - (e.clientX - drag.startX))))
    }
    const up = (): void => {
      dragRef.current = undefined
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const barActions = chapterActions
    .filter(action => BAR_ACTIONS.includes(action.actionId))
    .sort((left, right) => BAR_ACTIONS.indexOf(left.actionId) - BAR_ACTIONS.indexOf(right.actionId))

  return (
    <div className={css.chapterColumns}>
      <div className={css.subList} style={{ width: listWidth, flex: 'none' }}>
        <div className={css.listHeader}>
          <span className={css.listTitle}>{t('tab.chapters')}</span>
          <Button size="sm" onClick={() => { void createChapter() }}>{t('chapters.create')}</Button>
        </div>
        <ul className={css.list}>
          {chapters.map(chapterRow => (
            <li key={chapterRow.chapterId} className={css.listRow}>
              <button
                type="button"
                className={chapterId === chapterRow.chapterId ? css.listButtonActive : css.listButton}
                onClick={() => setChapterId(chapterRow.chapterId)}
              >
                <span className={css.novelTitle}>
                  {chapterRow.order}. {chapterRow.title}
                </span>
                <span className={css.novelMeta}>
                  {t('chapters.wordCount', { count: chapterRow.wordCount })}
                  {' · '}
                  {t(`chapters.status.${chapterRow.status}` as NovelLocaleKey)}
                </span>
              </button>
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('chapters.delete')}
                onClick={() => { void remove(chapterRow.chapterId) }}
              >
                ×
              </button>
            </li>
          ))}
          {chapters.length === 0 && <li className={css.empty}>{t('chapters.empty')}</li>}
        </ul>
      </div>
      <div className={css.colResizer} onMouseDown={startResize('list')} />
      <div className={css.editor}>
        {chapter === undefined
          ? <div className={css.placeholder}>{t('chapters.selectHint')}</div>
          : (
              <>
                <Input value={draftTitle} onChange={(event) => { setDraftTitle(event.target.value); setDirty(true) }} />
                <div className={css.actionBar}>
                  {barActions.map(action => (
                    <button
                      key={action.actionId}
                      type="button"
                      className={css.actionButton}
                      onClick={() => { void openPanel(action) }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                <textarea
                  className={css.editorArea}
                  value={draftContent}
                  onChange={(event) => { setDraftContent(event.target.value); setDirty(true) }}
                  placeholder={t('chapters.contentPlaceholder')}
                />
                <div className={css.row}>
                  <span className={dirty ? css.unsaved : css.saved}>
                    {dirty ? t('chapters.unsaved') : t('chapters.saved')}
                  </span>
                  <select
                    className={css.select}
                    value={chapter.status}
                    onChange={(event) => {
                      void face.updateChapter(chapter.chapterId, { status: event.target.value as typeof CHAPTER_STATUSES[number] })
                        .then(onChanged)
                    }}
                  >
                    {CHAPTER_STATUSES.map(status => (
                      <option key={status} value={status}>{t(`chapters.status.${status}` as NovelLocaleKey)}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
      </div>
      {panelAction !== undefined && chapter !== undefined && (
        <>
          <div className={css.colResizer} onMouseDown={startResize('panel')} />
          <EnhancePanel
            key={`${panelAction.actionId}-${panelNonce}`}
            action={panelAction}
            novelId={novelId}
            chapterId={chapter.chapterId}
            chapterBody={panelBody}
            face={face}
            t={t}
            onClose={() => setPanelAction(undefined)}
            onApplied={async (content) => {
              await face.updateChapter(chapter.chapterId, { content })
              setDraftContent(content)
              await onChanged()
            }}
          />
        </>
      )}
    </div>
  )
}

function OutlineTab(props: {
  novelId: string
  outline: readonly OutlineRow[]
  face: NovelFace
  t: Translate
  onChanged: () => Promise<void>
  outlineActions: readonly EnhanceActionInfo[]
}): ReactNode {
  const { novelId, outline, face, t, onChanged, outlineActions } = props
  const sorted = outline.slice().sort((left, right) => left.order - right.order)
  const [order, setOrder] = useState(String(sorted.length + 1))
  const [volume, setVolume] = useState('')
  const [summary, setSummary] = useState('')
  const [runningAction, setRunningAction] = useState<string | undefined>(undefined)
  const [enhanceError, setEnhanceError] = useState<string | undefined>(undefined)
  const [result, setResult] = useState<EnhanceResult | undefined>(undefined)

  const save = async (): Promise<void> => {
    const parsedOrder = Number.parseInt(order, 10)
    if (!Number.isInteger(parsedOrder) || parsedOrder < 1) return
    await face.upsertOutlineEntry(novelId, { order: parsedOrder, volume: volume.trim(), summary: summary.trim() })
    setVolume('')
    setSummary('')
    setOrder(String(Math.max(parsedOrder + 1, sorted.length + 1)))
    await onChanged()
  }

  const aiGenerate = async (): Promise<void> => {
    setRunningAction('ai-generate')
    setEnhanceError(undefined)
    try {
      const result = await face.enhanceWith('outline', novelId, 'outline-genres', {})
      // Parse the result into entries: lines starting with a number or 【】.
      const lines = result.suggestion.split('\n').filter(line => line.trim().length > 0)
      let order = sorted.length + 1
      for (const line of lines) {
        const match = /^\s*(\d+)[.、．]?\s*[【\[?]?(.+?)[】\]]?\s*$/.exec(line)
        if (match !== null) {
          const parsedOrder = Number.parseInt(match[1], 10)
          const text = match[2].trim()
          if (text.length > 0 && Number.isInteger(parsedOrder)) {
            await face.upsertOutlineEntry(novelId, { order: parsedOrder, volume: '', summary: text })
            order = Math.max(order, parsedOrder + 1)
          }
        }
      }
      await onChanged()
      setOrder(String(order))
    } catch (cause: unknown) {
      setEnhanceError(String((cause as Error).message))
    } finally {
      setRunningAction(undefined)
    }
  }

  return (
    <div className={css.tabBody}>
      <div className={css.listHeader}>
        <span className={css.listTitle}>{t('tab.outline')}</span>
        <Button size="sm" disabled={runningAction !== undefined} onClick={() => { void aiGenerate() }}>
          {runningAction === 'ai-generate' ? t('outline.aiGenerating') : t('outline.aiGenerate')}
        </Button>
      </div>
      {sorted.length === 0 && <div className={css.placeholder}>{t('outline.empty')}</div>}
      <ul className={css.cardList}>
        {sorted.map(entry => (
          <li key={entry.entryId} className={css.card}>
            <div className={css.cardHeader}>
              <strong>{entry.order}. {entry.volume}</strong>
              <button
                type="button"
                className={css.iconButton}
                aria-label={t('outline.delete')}
                onClick={() => { void face.deleteOutlineEntry(entry.entryId).then(onChanged) }}
              >
                ×
              </button>
            </div>
            <p className={css.cardBody}>{entry.summary}</p>
          </li>
        ))}
      </ul>
      {enhanceError !== undefined && <div className={css.enhanceError}>{enhanceError}</div>}
      <form className={css.stack} onSubmit={(event) => { event.preventDefault(); void save() }}>
        <div className={css.row}>
          <Input value={order} onChange={event => setOrder(event.target.value)} placeholder={t('outline.orderLabel')} />
          <Input value={volume} onChange={event => setVolume(event.target.value)} placeholder={t('outline.volumeLabel')} />
        </div>
        <textarea
          className={css.textarea}
          value={summary}
          onChange={event => setSummary(event.target.value)}
          placeholder={t('outline.summaryPlaceholder')}
          rows={3}
        />
        <div>
          <Button size="sm" onClick={() => { void save() }}>{t('outline.save')}</Button>
        </div>
      </form>
    </div>
  )
}
