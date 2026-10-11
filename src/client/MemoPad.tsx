/**
 * Memo pad popup: draggable, resizable, with a hideable folder/memo list
 * (global scope + per-novel scope) and the memo body with title and
 * created/modified timestamps.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { NovelFace } from './face.ts'
import type { Memo, MemoFolder } from '@deepseek-ai/dsh-novel-platform/types'
import css from './NovelPage.module.css'

type Translate = (key: import('./locales.ts').NovelLocaleKey, params?: Record<string, string | number>) => string

const DEFAULT_POS = { x: 120, y: 80 }
const DEFAULT_SIZE = { w: 760, h: 480 }

/** The memo pad popup. */
export function MemoPad(props: {
  novelId: string
  face: NovelFace
  t: Translate
  onClose: () => void
}): ReactNode {
  const { face, t, onClose } = props
  const [folders, setFolders] = useState<readonly MemoFolder[]>([])
  const [memos, setMemos] = useState<readonly Memo[]>([])
  const [listHidden, setListHidden] = useState(false)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [pos, setPos] = useState(DEFAULT_POS)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [listWidth, setListWidth] = useState(200)
  const dragRef = useRef<{ mode: 'move' | 'resize' | 'list'; startX: number; startY: number; baseX: number; baseY: number; baseW: number; baseH: number; baseList: number } | undefined>(undefined)

  const reload = useCallback(async (): Promise<void> => {
    const data = await face.memoData()
    setFolders(data.folders)
    setMemos(data.memos)
  }, [face])

  useEffect(() => { void reload() }, [reload])

  const selected = memos.find(memo => memo.memoId === selectedId)

  const onBarMouseDown = (event: React.MouseEvent): void => {
    dragRef.current = { mode: 'move', startX: event.clientX, startY: event.clientY, baseX: pos.x, baseY: pos.y, baseW: size.w, baseH: size.h, baseList: listWidth }
    const move = (e: MouseEvent): void => {
      const drag = dragRef.current
      if (drag === undefined || drag.mode !== 'move') return
      setPos({
        x: Math.max(0, drag.baseX + e.clientX - drag.startX),
        y: Math.max(0, drag.baseY + e.clientY - drag.startY),
      })
    }
    const up = (): void => {
      dragRef.current = undefined
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onHandleMouseDown = (event: React.MouseEvent): void => {
    event.stopPropagation()
    dragRef.current = { mode: 'resize', startX: event.clientX, startY: event.clientY, baseX: pos.x, baseY: pos.y, baseW: size.w, baseH: size.h, baseList: listWidth }
    const move = (e: MouseEvent): void => {
      const drag = dragRef.current
      if (drag === undefined || drag.mode !== 'resize') return
      setSize({
        w: Math.max(420, drag.baseW + e.clientX - drag.startX),
        h: Math.max(300, drag.baseH + e.clientY - drag.startY),
      })
    }
    const up = (): void => {
      dragRef.current = undefined
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onResizerMouseDown = (event: React.MouseEvent): void => {
    event.stopPropagation()
    dragRef.current = { mode: 'list', startX: event.clientX, startY: event.clientY, baseX: pos.x, baseY: pos.y, baseW: size.w, baseH: size.h, baseList: listWidth }
    const move = (e: MouseEvent): void => {
      const drag = dragRef.current
      if (drag === undefined || drag.mode !== 'list') return
      setListWidth(Math.max(140, Math.min(400, drag.baseList + e.clientX - drag.startX)))
    }
    const up = (): void => {
      dragRef.current = undefined
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const addFolder = async (scope: string, parentId: string | null): Promise<void> => {
    const name = window.prompt(t('memo.folderName'))
    if (name === null || name.trim().length === 0) return
    await face.memoFolderCreate(scope, parentId, name.trim())
    await reload()
  }

  const addMemo = async (scope: string, folderId: string | null): Promise<void> => {
    const memo = await face.memoCreate(scope, folderId, t('memo.untitled'))
    await reload()
    setSelectedId(memo.memoId)
  }

  const updateSelected = async (patch: { title?: string; content?: string }): Promise<void> => {
    if (selected === undefined) return
    await face.memoUpdate(selected.memoId, patch)
    await reload()
  }

  const deleteFolder = async (folderId: string): Promise<void> => {
    await face.memoFolderDelete(folderId)
    await reload()
  }

  const deleteMemo = async (memoId: string): Promise<void> => {
    await face.memoDelete(memoId)
    if (selectedId === memoId) setSelectedId(undefined)
    await reload()
  }

  const treeScope = (scope: 'global' | 'novel', label: string): ReactNode => {
    const scopeFolders = folders.filter(folder => folder.scope === scope)
    const renderFolder = (folder: MemoFolder, depth: number): ReactNode => (
      <div key={folder.folderId}>
        <div className={css.memoTreeRow} style={{ paddingLeft: depth * 12 + 6 }}>
          <span className={css.memoTreeMain}>📁 {folder.name}</span>
          <button type="button" className={css.iconButton} title={t('memo.newMemo')} onClick={() => { void addMemo(scope, folder.folderId) }}>📄</button>
          <button type="button" className={css.iconButton} title={t('memo.newFolder')} onClick={() => { void addFolder(scope, folder.folderId) }}>＋</button>
          <button type="button" className={css.iconButton} title={t('skills.delete')} onClick={() => { void deleteFolder(folder.folderId) }}>×</button>
        </div>
        {scopeFolders.filter(candidate => candidate.parentId === folder.folderId).map(candidate => renderFolder(candidate, depth + 1))}
        {memos.filter(memo => memo.scope === scope && memo.folderId === folder.folderId).map(memo => (
          <div key={memo.memoId} className={css.memoTreeRow} style={{ paddingLeft: (depth + 1) * 12 + 6 }}>
            <button
              type="button"
              className={selectedId === memo.memoId ? `${css.memoTreeMain} ${css.memoTreeRowActive}` : css.memoTreeMain}
              onClick={() => setSelectedId(memo.memoId)}
            >
              📄 {memo.title}
            </button>
            <button type="button" className={css.iconButton} onClick={() => { void deleteMemo(memo.memoId) }}>×</button>
          </div>
        ))}
      </div>
    )
    return (
      <>
        <div className={css.memoTreeScope}>{label}</div>
        <div className={css.memoTreeRow}>
          <button type="button" className={css.memoTreeMain} onClick={() => { void addFolder(scope, null) }}>＋ {t('memo.newFolder')}</button>
        </div>
        {scopeFolders.filter(folder => folder.parentId === null).map(folder => renderFolder(folder, 0))}
        {memos.filter(memo => memo.scope === scope && memo.folderId === null).map(memo => (
          <div key={memo.memoId} className={css.memoTreeRow}>
            <button
              type="button"
              className={selectedId === memo.memoId ? `${css.memoTreeMain} ${css.memoTreeRowActive}` : css.memoTreeMain}
              onClick={() => setSelectedId(memo.memoId)}
            >
              📄 {memo.title}
            </button>
            <button type="button" className={css.iconButton} onClick={() => { void deleteMemo(memo.memoId) }}>×</button>
          </div>
        ))}
        <button type="button" className={css.memoTreeRow} onClick={() => { void addMemo(scope, null) }}>＋ {t('memo.newMemo')}</button>
      </>
    )
  }

  return (
    <div
      className={`${css.memoPad} ${listHidden ? css.memoListHidden : ''}`}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <div className={css.memoPadBar} onMouseDown={onBarMouseDown}>
        <span className={css.memoPadTitle}>{t('memo.title')}</span>
        <span className={css.memoPadSpacer} />
        <button type="button" className={css.topbarButton} onClick={() => setListHidden(value => !value)}>
          {listHidden ? t('memo.showList') : t('memo.hideList')}
        </button>
        <button type="button" className={css.assistClose} onClick={onClose}>×</button>
      </div>
      <div className={css.memoPadBody}>
        <div className={css.memoList} style={{ width: listWidth }}>
          {treeScope('global', t('memo.global'))}
          {treeScope('novel', t('memo.novel'))}
        </div>
        <div className={css.memoResizer} onMouseDown={onResizerMouseDown} />
        <div className={css.memoText}>
          {selected === undefined
            ? <div className={css.placeholder}>{t('memo.untitled')}</div>
            : (
                <>
                  <Input
                    value={selected.title}
                    onChange={event => { void updateSelected({ title: event.target.value }) }}
                  />
                  <div className={css.memoMeta}>
                    {t('memo.createdAt')} {new Date(selected.createdAt).toLocaleString()}
                    {' · '}
                    {t('memo.updatedAt')} {new Date(selected.updatedAt).toLocaleString()}
                  </div>
                  <div className={css.memoDivider} />
                  <textarea
                    className={css.memoContent}
                    value={selected.content}
                    onChange={event => { void updateSelected({ content: event.target.value }) }}
                    placeholder='…'
                  />
                </>
              )}
        </div>
      </div>
      <div className={css.memoHandle} onMouseDown={onHandleMouseDown} />
    </div>
  )
}
