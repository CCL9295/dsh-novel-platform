/**
 * Skill manager: lists every registered skill (bundled 弧光 + user-imported),
 * imports new skills into ~/.dsh/skills/<name>/SKILL.md, and deletes
 * user-imported ones. Bundled skills refuse deletion on the host side.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { NovelFace } from './face.ts'
import type { NovelLocaleKey } from './locales.ts'
import css from './NovelPage.module.css'

type Translate = (key: NovelLocaleKey, params?: Record<string, string | number>) => string

/** The skill manager block on the settings tab. */
export function SkillsManager(props: {
  face: NovelFace
  t: Translate
}): ReactNode {
  const { face, t } = props
  const [skills, setSkills] = useState<readonly { name: string; description: string; source: string }[] | undefined>(undefined)
  const [importing, setImporting] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    setSkills(await face.skillList())
  }, [face])

  useEffect(() => { void reload() }, [reload])

  const loadFile = async (file: File): Promise<void> => {
    const raw = await file.text()
    // Accept a full SKILL.md (frontmatter parsed for name/description) or a bare body.
    const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/u.exec(raw)
    if (match !== null) {
      const header = match[1] ?? ''
      const body = match[2] ?? ''
      const nameMatch = /^name:\s*(\S+)\s*$/mu.exec(header)?.[1]
      const descMatch = /^description:\s*(.+?)\s*$/mu.exec(header)?.[1]
      if (nameMatch !== undefined) setName(nameMatch)
      if (descMatch !== undefined) setDescription(descMatch)
      setContent(body.trim())
      return
    }
    setContent(raw.trim())
  }

  const save = async (): Promise<void> => {
    setError(undefined)
    try {
      await face.skillSave(name.trim(), description.trim(), content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setImporting(false)
      setName('')
      setDescription('')
      setContent('')
      await reload()
    } catch (cause: unknown) {
      setError(String((cause as Error).message))
    }
  }

  const remove = async (name: string): Promise<void> => {
    setError(undefined)
    try {
      await face.skillDelete(name)
      await reload()
    } catch (cause: unknown) {
      setError(String((cause as Error).message))
    }
  }

  const bundled = (skills ?? []).filter(skill => skill.source === 'bundled')
  const custom = (skills ?? []).filter(skill => skill.source !== 'bundled')

  return (
    <div className={css.skillsBlock}>
      <div className={css.listHeader}>
        <span className={css.listTitle}>{t('skills.title')}</span>
        <Button size="sm" onClick={() => setImporting(value => !value)}>{t('skills.import')}</Button>
      </div>
      <div className={css.skillsRow}>
        <span className={css.formRowLabel}>{t('skills.bundled')}（{bundled.length}）：</span>
        {bundled.map(skill => <span key={skill.name} className={css.skillChip} title={skill.description}>{skill.name}</span>)}
      </div>
      <div className={css.skillsRow}>
        <span className={css.formRowLabel}>{t('skills.custom')}（{custom.length}）：</span>
        {custom.map(skill => (
          <span key={skill.name} className={css.skillChip} title={skill.description}>
            {skill.name}
            <button type="button" className={css.iconButton} onClick={() => { void remove(skill.name) }}>×</button>
          </span>
        ))}
        {custom.length === 0 && <span className={css.formRowLabel}>—</span>}
      </div>
      {importing && (
        <div className={css.skillsImport}>
          <Input value={name} onChange={event => setName(event.target.value)} placeholder={t('skills.importName')} />
          <Input value={description} onChange={event => setDescription(event.target.value)} placeholder={t('skills.importDesc')} />
          <div className={css.row}>
            <input
              type="file"
              accept=".md"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={event => {
                const file = event.target.files?.[0]
                if (file !== undefined) void loadFile(file)
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>{t('skills.pickFile')}</Button>
            <span className={css.assistLabel}>{t('skills.importContent')}</span>
          </div>
          <textarea
            className={css.textarea}
            value={content}
            onChange={event => setContent(event.target.value)}
            rows={6}
          />
          {error !== undefined && <div className={css.enhanceError}>{error}</div>}
          <div className={css.row}>
            <Button size="sm" disabled={name.trim().length === 0 || content.trim().length === 0} onClick={() => { void save() }}>
              {saved ? '✓' : t('skills.save')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImporting(false)}>{t('action.cancel')}</Button>
          </div>
          {saved && <div className={css.saved}>{t('skills.saved')}</div>}
        </div>
      )}
    </div>
  )
}
