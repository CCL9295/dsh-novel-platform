/**
 * Book breakdown workspace: paste or import a source text, run skill-bound
 * dimension analyses (individually or one-click over all), view the
 * per-dimension collection, and fuse it into one coherent document.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { NovelFace } from './face.ts'
import type { NovelLocaleKey } from './locales.ts'
import type { Breakdown } from '@deepseek-ai/dsh-novel-platform/types'
import css from './NovelPage.module.css'

type Translate = (key: NovelLocaleKey, params?: Record<string, string | number>) => string

/** Breakdown dimensions shown on the first-version card grid (client copy of the host table). */
const BREAKDOWN_DIMENSIONS: readonly { skill: string; label: string }[] = [
  { skill: 'novel-pacing', label: '节奏结构' },
  { skill: 'novel-pleasure-points', label: '爽点分析' },
  { skill: 'novel-character-design', label: '人物弧光' },
  { skill: 'novel-worldbuilding', label: '世界观' },
  { skill: 'novel-innovation', label: '反套路' },
  { skill: 'novel-language-style', label: '文风' },
]

/** The breakdown workspace. */
export function BreakdownView(props: {
  face: NovelFace
  t: Translate
}): ReactNode {
  const { face, t } = props
  const [list, setList] = useState<readonly Breakdown[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [creating, setCreating] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | undefined>(undefined)
  const [view, setView] = useState<'dim' | 'fused'>('dim')
  const [runningSkill, setRunningSkill] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const fileRef = useCallback((node: HTMLInputElement | null) => { fileInputRef.current = node }, [])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    setList(await face.breakdownList())
  }, [face])

  useEffect(() => { void reload() }, [reload])

  const selected = list.find(candidate => candidate.breakdownId === selectedId)

  const loadFile = async (file: File): Promise<void> => {
    const text = await file.text()
    setSourceTitle(file.name.replace(/\.(txt|md)$/iu, ''))
    setSourceText(text)
  }

  const create = async (): Promise<void> => {
    if (sourceText.trim().length === 0) {
      setError(t('breakdown.needSource'))
      return
    }
    const breakdown = await face.breakdownCreate(sourceTitle.trim().length > 0 ? sourceTitle.trim() : t('breakdown.newSource'), sourceText)
    setSourceText('')
    setSourceTitle('')
    setCreating(false)
    setSelectedId(breakdown.breakdownId)
    await reload()
  }

  const runOne = async (skill: string): Promise<void> => {
    if (selected === undefined) return
    setRunningSkill(skill)
    setError(undefined)
    try {
      await face.breakdownRun(selected.breakdownId, skill, {})
      await reload()
    } catch (cause: unknown) {
      setError(String((cause as Error).message))
    } finally {
      setRunningSkill(undefined)
    }
  }

  const runAll = async (): Promise<void> => {
    if (selected === undefined) return
    setError(undefined)
    const total = BREAKDOWN_DIMENSIONS.length
    let done = 0
    setProgress({ done, total })
    try {
      for (const dimension of BREAKDOWN_DIMENSIONS) {
        setRunningSkill(dimension.skill)
        await face.breakdownRun(selected.breakdownId, dimension.skill, {})
        done += 1
        setProgress({ done, total })
        await reload()
      }
    } catch (cause: unknown) {
      setError(String((cause as Error).message))
    } finally {
      setRunningSkill(undefined)
      setProgress(undefined)
    }
  }

  const fuse = async (): Promise<void> => {
    if (selected === undefined) return
    setRunningSkill('fuse')
    setError(undefined)
    try {
      await face.breakdownFuse(selected.breakdownId, {})
      setView('fused')
      await reload()
    } catch (cause: unknown) {
      setError(String((cause as Error).message))
    } finally {
      setRunningSkill(undefined)
    }
  }

  const remove = async (breakdownId: string): Promise<void> => {
    await face.breakdownDelete(breakdownId)
    if (selectedId === breakdownId) setSelectedId(undefined)
    await reload()
  }

  return (
    <div className={css.breakdownPage}>
      <div className={css.listHeader}>
        <h2 className={css.novelHeading}>{t('breakdown.title')}</h2>
        <span className={css.suggestionSpacer} />
        <Button size="sm" onClick={() => setCreating(value => !value)}>{t('breakdown.newSource')}</Button>
      </div>
      {creating && (
        <form className={css.stack} onSubmit={(event) => { event.preventDefault(); void create() }}>
          <Input value={sourceTitle} onChange={event => setSourceTitle(event.target.value)} placeholder={t('breakdown.source')} />
          <textarea
            className={css.editorArea}
            value={sourceText}
            onChange={event => setSourceText(event.target.value)}
            rows={6}
          />
          <div className={css.row}>
            <input
              type="file"
              accept=".txt,.md"
              ref={fileRef}
              style={{ display: 'none' }}
              onChange={event => {
                const file = event.target.files?.[0]
                if (file !== undefined) void loadFile(file)
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>{t('breakdown.import')}</Button>
            <Button size="sm" onClick={() => { void create() }}>{t('action.confirm')}</Button>
            <Button size="sm" variant="outline" onClick={() => setCreating(false)}>{t('action.cancel')}</Button>
          </div>
        </form>
      )}
      <ul className={css.breakdownList}>
        {list.map(breakdown => (
          <li key={breakdown.breakdownId} className={css.listRow}>
            <button
              type="button"
              className={selectedId === breakdown.breakdownId ? css.listButtonActive : css.listButton}
              onClick={() => setSelectedId(breakdown.breakdownId)}
            >
              <span className={css.novelTitle}>{breakdown.sourceTitle}</span>
              <span className={css.novelMeta}>
                {breakdown.reports.length} 维度{breakdown.fused.length > 0 ? ' · 已融合' : ''}
              </span>
            </button>
            <button type="button" className={css.iconButton} onClick={() => { void remove(breakdown.breakdownId) }}>×</button>
          </li>
        ))}
        {list.length === 0 && <li className={css.empty}>{t('breakdown.needSource')}</li>}
      </ul>
      {selected !== undefined && (
        <>
          <div className={css.breakdownRow}>
            <Button size="sm" disabled={runningSkill !== undefined} onClick={() => { void runAll() }}>
              {progress !== undefined ? t('breakdown.progress', { done: progress.done, total: progress.total }) : t('breakdown.runAll')}
            </Button>
            <span className={css.assistLabel}>
              {t('breakdown.loaded', { count: selected.sourceText.length })}
            </span>
          </div>
          <div className={css.breakdownRow}>
            <span className={css.formRowLabel}>{t('breakdown.viewDim')}</span>
            <button
              type="button"
              className={view === 'dim' ? css.formPillActive : css.formPill}
              onClick={() => setView('dim')}
            >
              {t('breakdown.viewDim')}
            </button>
            <button
              type="button"
              className={view === 'fused' ? css.formPillActive : css.formPill}
              onClick={() => setView('fused')}
            >
              {t('breakdown.viewFused')}
            </button>
            {view === 'fused' && (
              <Button size="sm" disabled={runningSkill !== undefined || selected.reports.length === 0} onClick={() => { void fuse() }}>
                {runningSkill === 'fuse' ? t('action.saving') : t('breakdown.genFused')}
              </Button>
            )}
          </div>
          {error !== undefined && <div className={css.enhanceError}>{error}</div>}
          {view === 'dim' && (
            <>
              <div className={css.actionBar}>
                {BREAKDOWN_DIMENSIONS.map(dimension => (
                  <button
                    key={dimension.skill}
                    type="button"
                    className={css.actionButton}
                    disabled={runningSkill !== undefined}
                    onClick={() => { void runOne(dimension.skill) }}
                  >
                    {runningSkill === dimension.skill ? '…' : dimension.label}
                  </button>
                ))}
              </div>
              {selected.reports.length === 0 && <div className={css.placeholder}>{t('breakdown.needSource')}</div>}
              <ul className={css.breakdownList}>
                {selected.reports.map(report => (
                  <li key={report.skill} className={css.breakdownSection}>
                    <div className={css.breakdownSectionHeader}>
                      <strong>{report.label}</strong>
                      <span className={css.tag}>{report.skill}</span>
                      <span className={css.suggestionSpacer} />
                      <Button size="sm" variant="outline" disabled={runningSkill !== undefined} onClick={() => { void runOne(report.skill) }}>
                        {t('breakdown.rerun')}
                      </Button>
                    </div>
                    <p className={css.breakdownContent}>{report.content}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {view === 'fused' && (
            selected.fused.length === 0
              ? <div className={css.placeholder}>{t('breakdown.genFused')}</div>
              : (
                  <div className={css.breakdownSection}>
                    <div className={css.breakdownSectionHeader}>
                      <strong>{t('breakdown.viewFused')}</strong>
                      <span className={css.suggestionSpacer} />
                      <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(selected.fused) }}>
                        {t('enhance.copy')}
                      </Button>
                    </div>
                    <p className={css.breakdownContent}>{selected.fused}</p>
                  </div>
                )
          )}
        </>
      )}
    </div>
  )
}
