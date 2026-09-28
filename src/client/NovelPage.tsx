/**
 * The writing desk: novel list on the left, the selected novel's chapters,
 * character cards, and outline on the right. Data arrives through the
 * NovelFace; the page holds no Remote knowledge.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NovelFace } from './face.ts'
import type { NovelLocaleKey } from './locales.ts'
import type {
  ChapterDetail, ChapterRow, CharacterRow, CharacterRole, NovelDetail,
  NovelRow, NovelStatus, OutlineRow,
} from '@deepseek-ai/dsh-novel-platform/types'
import css from './NovelPage.module.css'

/** Full component props assembled by the main slot renderer. */
export type NovelPageProps =
  PropsRuntime<'main'>
  & PropsLocale<'novel'>
  & InjectFace<NovelFace>

type Translate = (key: NovelLocaleKey, params?: Record<string, string | number>) => string

const NOVEL_STATUSES: readonly NovelStatus[] = ['draft', 'serializing', 'finished']
const CHAPTER_STATUSES = ['outline', 'draft', 'revised', 'published'] as const
const CHARACTER_ROLES: readonly CharacterRole[] = ['protagonist', 'supporting', 'antagonist', 'minor']

/** Root writing-desk panel. */
export function NovelPage(props: NovelPageProps): ReactNode {
  // InjectFace passes the face's members through as individual props; the
  // component re-aliases them so nested sections keep one handle.
  const face: NovelFace = props
  const t = props.t as Translate
  const [novels, setNovels] = useState<NovelRow[] | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [detail, setDetail] = useState<NovelDetail | undefined>(undefined)
  const [tab, setTab] = useState<'chapters' | 'characters' | 'outline'>('chapters')

  const loadNovels = useCallback(async (): Promise<void> => {
    try {
      setNovels(await face.listNovels())
      setError(undefined)
    } catch (cause: unknown) {
      setError(t('novels.loadFailed', { message: String((cause as Error).message) }))
    }
  }, [face, t])

  useEffect(() => { void loadNovels() }, [loadNovels])

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

  const createNovel = async (title: string, genre: string, description: string): Promise<void> => {
    const novel = await face.createNovel({ title, genre, description })
    await loadNovels()
    setSelectedId(novel.novelId)
  }

  const deleteNovel = async (novelId: string): Promise<void> => {
    await face.deleteNovel(novelId)
    setSelectedId(undefined)
    await loadNovels()
  }

  const refreshDetail = async (): Promise<void> => {
    if (selectedId !== undefined) setDetail(await face.getNovel(selectedId))
  }

  return (
    <div className={css.page}>
      <header className={css.header}>
        <h1 className={css.title}>{t('panel')}</h1>
      </header>
      {error !== undefined && <div className={css.error}>{error}</div>}
      <div className={css.columns}>
        <aside className={css.novelList}>
          <NovelList
            novels={novels}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreate={createNovel}
            onDelete={deleteNovel}
            t={t}
          />
        </aside>
        <section className={css.workbench}>
          {detail === undefined
            ? <div className={css.placeholder}>{t('novels.empty')}</div>
            : (
                <>
                  <NovelHeader detail={detail} face={face} t={t} onChanged={refreshDetail} />
                  <nav className={css.tabs}>
                    <TabButton active={tab === 'chapters'} onClick={() => setTab('chapters')}>{t('tab.chapters')}</TabButton>
                    <TabButton active={tab === 'characters'} onClick={() => setTab('characters')}>{t('tab.characters')}</TabButton>
                    <TabButton active={tab === 'outline'} onClick={() => setTab('outline')}>{t('tab.outline')}</TabButton>
                  </nav>
                  {tab === 'chapters' && <ChaptersTab novelId={detail.novel.novelId} chapters={detail.chapters} face={face} t={t} onChanged={refreshDetail} />}
                  {tab === 'characters' && <CharactersTab novelId={detail.novel.novelId} characters={detail.characters} face={face} t={t} onChanged={refreshDetail} />}
                  {tab === 'outline' && <OutlineTab novelId={detail.novel.novelId} outline={detail.outline} face={face} t={t} onChanged={refreshDetail} />}
                </>
              )}
        </section>
      </div>
    </div>
  )
}

function NovelList(props: {
  novels: NovelRow[] | undefined
  selectedId: string | undefined
  onSelect: (novelId: string) => void
  onCreate: (title: string, genre: string, description: string) => Promise<void>
  onDelete: (novelId: string) => Promise<void>
  t: Translate
}): ReactNode {
  const { novels, selectedId, onSelect, onCreate, onDelete, t } = props
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')

  const submit = async (): Promise<void> => {
    if (title.trim().length === 0) return
    await onCreate(title.trim(), genre.trim(), description.trim())
    setTitle('')
    setGenre('')
    setDescription('')
    setCreating(false)
  }

  return (
    <>
      <div className={css.listHeader}>
        <h2 className={css.listTitle}>{t('novels.title')}</h2>
        <Button size="sm" onClick={() => setCreating(value => !value)}>{t('novels.create')}</Button>
      </div>
      {creating && (
        <form className={css.stack} onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <Input value={title} onChange={event => setTitle(event.target.value)} placeholder={t('novels.titleLabel')} />
          <Input value={genre} onChange={event => setGenre(event.target.value)} placeholder={t('novels.genrePlaceholder')} />
          <textarea
            className={css.textarea}
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder={t('novels.descriptionLabel')}
            rows={3}
          />
          <div className={css.row}>
            <Button size="sm" onClick={() => void submit()}>{t('action.confirm')}</Button>
            <Button size="sm" variant="outline" onClick={() => setCreating(false)}>{t('action.cancel')}</Button>
          </div>
        </form>
      )}
      <ul className={css.list}>
        {novels?.map(novel => (
          <li key={novel.novelId} className={css.listRow}>
            <button
              type="button"
              className={selectedId === novel.novelId ? css.listButtonActive : css.listButton}
              onClick={() => onSelect(novel.novelId)}
            >
              <span className={css.novelTitle}>{novel.title}</span>
              <span className={css.novelMeta}>{novel.genre}</span>
            </button>
            <button
              type="button"
              className={css.iconButton}
              aria-label={t('novels.delete')}
              title={t('novels.delete')}
              onClick={() => {
                if (window.confirm(t('novels.deleteConfirm'))) void onDelete(novel.novelId)
              }}
            >
              ×
            </button>
          </li>
        ))}
        {novels !== undefined && novels.length === 0 && <li className={css.empty}>{t('novels.empty')}</li>}
      </ul>
    </>
  )
}

function NovelHeader(props: {
  detail: NovelDetail
  face: NovelFace
  t: Translate
  onChanged: () => Promise<void>
}): ReactNode {
  const { detail, face, t, onChanged } = props
  const novel = detail.novel
  const totalWords = detail.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0)
  const setStatus = async (status: NovelStatus): Promise<void> => {
    await face.updateNovel(novel.novelId, { status })
    await onChanged()
  }
  return (
    <div className={css.novelHeader}>
      <div>
        <h2 className={css.novelHeading}>{novel.title}</h2>
        <p className={css.novelMeta}>
          {novel.genre}
          {' · '}
          {t('chapters.wordCount', { count: totalWords })}
          {' · '}
          {detail.chapters.length} {t('tab.chapters')}
        </p>
      </div>
      <label className={css.statusSelect}>
        {t('novels.statusLabel')}
        <select
          className={css.select}
          value={novel.status}
          onChange={(event) => { void setStatus(event.target.value as NovelStatus) }}
        >
          {NOVEL_STATUSES.map(status => (
            <option key={status} value={status}>{t(`novel.status.${status}` as NovelLocaleKey)}</option>
          ))}
        </select>
      </label>
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

function ChaptersTab(props: {
  novelId: string
  chapters: readonly ChapterRow[]
  face: NovelFace
  t: Translate
  onChanged: () => Promise<void>
}): ReactNode {
  const { novelId, chapters, face, t, onChanged } = props
  const [chapterId, setChapterId] = useState<string | undefined>(undefined)
  const [chapter, setChapter] = useState<ChapterDetail | undefined>(undefined)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

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

  const createChapter = async (): Promise<void> => {
    const created = await face.createChapter(novelId, {
      title: t('chapters.titleLabel'),
      content: '',
      status: 'draft',
    })
    await onChanged()
    setChapterId(created.chapterId)
  }

  const save = async (): Promise<void> => {
    if (chapterId === undefined) return
    setSaving(true)
    try {
      await face.updateChapter(chapterId, { title: draftTitle, content: draftContent })
      setDirty(false)
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string): Promise<void> => {
    await face.deleteChapter(id)
    if (chapterId === id) setChapterId(undefined)
    await onChanged()
  }

  return (
    <div className={css.split}>
      <div className={css.subList}>
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
      <div className={css.editor}>
        {chapter === undefined
          ? <div className={css.placeholder}>{t('chapters.selectHint')}</div>
          : (
              <>
                <Input value={draftTitle} onChange={(event) => { setDraftTitle(event.target.value); setDirty(true) }} />
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
                  <Button size="sm" disabled={saving || !dirty} onClick={() => { void save() }}>
                    {saving ? t('action.saving') : t('chapters.save')}
                  </Button>
                </div>
              </>
            )}
      </div>
    </div>
  )
}

function CharactersTab(props: {
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
    <div className={css.tabBody}>
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
    </div>
  )
}

function OutlineTab(props: {
  novelId: string
  outline: readonly OutlineRow[]
  face: NovelFace
  t: Translate
  onChanged: () => Promise<void>
}): ReactNode {
  const { novelId, outline, face, t, onChanged } = props
  const sorted = outline.slice().sort((left, right) => left.order - right.order)
  const [order, setOrder] = useState(String(sorted.length + 1))
  const [volume, setVolume] = useState('')
  const [summary, setSummary] = useState('')

  const save = async (): Promise<void> => {
    const parsedOrder = Number.parseInt(order, 10)
    if (!Number.isInteger(parsedOrder) || parsedOrder < 1) return
    await face.upsertOutlineEntry(novelId, { order: parsedOrder, volume: volume.trim(), summary: summary.trim() })
    setVolume('')
    setSummary('')
    setOrder(String(Math.max(parsedOrder + 1, sorted.length + 1)))
    await onChanged()
  }

  return (
    <div className={css.tabBody}>
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
