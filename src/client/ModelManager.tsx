/**
 * Model manager popup: lists host provider routes and user-added custom
 * models (OpenAI-compatible chat endpoints), with add/delete for customs.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { NovelFace } from './face.ts'
import type { NovelLocaleKey } from './locales.ts'
import type { ModelRouteInfo } from '@deepseek-ai/dsh-novel-platform/types'
import css from './NovelPage.module.css'

type Translate = (key: NovelLocaleKey, params?: Record<string, string | number>) => string

/** The model manager popup. */
export function ModelManager(props: {
  face: NovelFace
  t: Translate
  onClose: () => void
}): ReactNode {
  const { face, t, onClose } = props
  const [routes, setRoutes] = useState<readonly ModelRouteInfo[]>([])
  const [customs, setCustoms] = useState<readonly { modelKey: string; displayName: string; baseUrl: string; apiKey: string; model: string }[]>([])
  const [adding, setAdding] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(false)

  const reload = useCallback(async (): Promise<void> => {
    setRoutes(await face.modelList())
    setCustoms(await face.customModelList())
  }, [face])

  useEffect(() => { void reload() }, [reload])

  const save = async (): Promise<void> => {
    setError(undefined)
    if (displayName.trim().length === 0 || baseUrl.trim().length === 0 || model.trim().length === 0) return
    try {
      await face.customModelSave({
        modelKey: `custom-${model.trim().replace(/[^a-z0-9]+/giu, '-')}-${Date.now().toString(36)}`,
        displayName: displayName.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setAdding(false)
      setDisplayName('')
      setBaseUrl('https://api.deepseek.com/v1')
      setApiKey('')
      setModel('')
      await reload()
    } catch (cause: unknown) {
      setError(String((cause as Error).message))
    }
  }

  const remove = async (modelKey: string): Promise<void> => {
    await face.customModelDelete(modelKey)
    await reload()
  }

  return (
    <div className={css.memoPad} style={{ left: 200, top: 90, width: 620, height: 480 }}>
      <div className={css.memoPadBar}>
        <span className={css.memoPadTitle}>{t('model.title')}</span>
        <span className={css.memoPadSpacer} />
        <button type="button" className={css.assistClose} onClick={onClose}>×</button>
      </div>
      <div className={css.breakdownPage}>
        <div className={css.listHeader}>
          <span className={css.listTitle}>{t('model.hostRoutes')}</span>
          <Button size="sm" onClick={() => setAdding(value => !value)}>{t('model.addCustom')}</Button>
        </div>
        <ul className={css.breakdownList}>
          {routes.map(route => route.models.map(modelId => (
            <li key={`${route.provider}::${modelId}`} className={css.breakdownSection}>
              <div className={css.breakdownSectionHeader}>
                <strong>{route.provider}</strong>
                <span className={css.tag}>{modelId}</span>
              </div>
            </li>
          )))}
        </ul>
        {customs.length > 0 && (
          <>
            <div className={css.listHeader}>
              <span className={css.listTitle}>{t('model.customRoutes')}</span>
            </div>
            <ul className={css.breakdownList}>
              {customs.map(custom => (
                <li key={custom.modelKey} className={css.breakdownSection}>
                  <div className={css.breakdownSectionHeader}>
                    <strong>{custom.displayName}</strong>
                    <span className={css.tag}>{custom.model}</span>
                    <span className={css.suggestionSpacer} />
                    <button type="button" className={css.iconButton} onClick={() => { void remove(custom.modelKey) }}>×</button>
                  </div>
                  <p className={css.cardBody}>{custom.baseUrl}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        {adding && (
          <div className={css.skillsImport}>
            <Input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder={t('model.displayName')} />
            <Input value={baseUrl} onChange={event => setBaseUrl(event.target.value)} placeholder={t('model.baseUrl')} />
            <Input value={model} onChange={event => setModel(event.target.value)} placeholder={t('model.modelId')} />
            <Input value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={t('model.apiKey')} />
            {error !== undefined && <div className={css.enhanceError}>{error}</div>}
            <div className={css.row}>
              <Button size="sm" onClick={() => { void save() }}>{saved ? '✓' : t('world.saveEntry')}</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>{t('action.cancel')}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
