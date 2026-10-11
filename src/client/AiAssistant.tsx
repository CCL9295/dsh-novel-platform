/**
 * The AI assistant: a movable, resizable chat popup. It helps the writer
 * with every stage of novel creation — one-sentence world generation, plot
 * questions, skill-guided advice — with the novel's settings bible, outline,
 * memos, and chapters injectable as context.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Dropdown } from './Dropdown.tsx'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { NovelFace } from './face.ts'
import type { NovelLocaleKey } from './locales.ts'
import type { ModelRouteInfo, NovelDetail } from '@deepseek-ai/dsh-novel-platform/types'
import css from './NovelPage.module.css'

type Translate = (key: NovelLocaleKey, params?: Record<string, string | number>) => string

interface ChatMessage {
  readonly role: 'user' | 'assistant'
  readonly text: string
}

const DEFAULT_POS = { x: 200, y: 60 }
const DEFAULT_SIZE = { w: 460, h: 560 }

/** The AI assistant popup. */
export function AiAssistant(props: {
  novelId: string | undefined
  detail: NovelDetail | undefined
  face: NovelFace
  t: Translate
  onClose: () => void
}): ReactNode {
  const { novelId, face, t, onClose } = props
  void detail
  const [routes, setRoutes] = useState<readonly ModelRouteInfo[]>([])
  const [customs, setCustoms] = useState<readonly { modelKey: string; displayName: string; baseUrl: string; apiKey: string; model: string }[]>([])
  const [provider, setProvider] = useState<string | undefined>(undefined)
  const [model, setModel] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<readonly ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [pos, setPos] = useState(DEFAULT_POS)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | undefined>(undefined)
  const resizeRef = useRef<{ startX: number; startY: number; baseW: number; baseH: number } | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void face.modelList().then((list) => {
      setRoutes(list)
      const first = list[0]
      if (first !== undefined) {
        setProvider(first.provider)
        setModel(first.models[0])
      }
    }).catch(() => setRoutes([]))
    void face.customModelList().then(setCustoms).catch(() => setCustoms([]))
  }, [face])

  useEffect(() => {
    if (scrollRef.current !== null) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, running])

  const onBarMouseDown = (event: React.MouseEvent): void => {
    dragRef.current = { startX: event.clientX, startY: event.clientY, baseX: pos.x, baseY: pos.y }
    const move = (e: MouseEvent): void => {
      const drag = dragRef.current
      if (drag === undefined) return
      setPos({ x: Math.max(0, drag.baseX + e.clientX - drag.startX), y: Math.max(0, drag.baseY + e.clientY - drag.startY) })
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
    resizeRef.current = { startX: event.clientX, startY: event.clientY, baseW: size.w, baseH: size.h }
    const move = (e: MouseEvent): void => {
      const r = resizeRef.current
      if (r === undefined) return
      setSize({ w: Math.max(380, r.baseW + e.clientX - r.startX), h: Math.max(360, r.baseH + e.clientY - r.startY) })
    }
    const up = (): void => {
      resizeRef.current = undefined
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // Assemble the full novel context: settings bible + outline + memos.
  const buildContext = useCallback(async (): Promise<string> => {
    if (novelId === undefined) return ''
    try {
      const snapshot = await face.getNovel(novelId)
      const sections: string[] = []
      const world = (snapshot.world ?? []).map(entry => `- 【${entry.title}】${entry.content}`).join('\n')
      if (world.length > 0) sections.push(`【世界设定】\n${world}`)
      const cast = snapshot.characters.map(role => `- 【${role.name}·${role.role}】${role.profile}`).join('\n')
      if (cast.length > 0) sections.push(`【角色卡】\n${cast}`)
      const outline = snapshot.outline.slice().sort((a, b) => a.order - b.order)
        .map(entry => `${entry.order}. 【${entry.volume}】${entry.summary}`).join('\n')
      if (outline.length > 0) sections.push(`【大纲】\n${outline}`)
      return sections.join('\n\n')
    } catch {
      return ''
    }
  }, [face, novelId])

  const send = async (text: string): Promise<void> => {
    if (text.trim().length === 0 || running) return
    setMessages(current => [...current, { role: 'user', text: text.trim() }])
    setInput('')
    setRunning(true)
    try {
      const settings = await buildContext()
      const custom = customs.find(candidate => `${candidate.displayName}::${candidate.modelKey}` === `${model}`)
      const result = await face.enhanceWith('outline', novelId ?? '', 'assistant-chat', {
        ...(provider !== undefined && custom === undefined ? { provider } : {}),
        ...(model !== undefined && custom === undefined ? { model } : {}),
        ...(custom !== undefined
          ? { custom: { modelKey: custom.modelKey, displayName: custom.displayName, baseUrl: custom.baseUrl, apiKey: custom.apiKey, model: custom.model } }
          : {}),
        note: text.trim(),
        ...(settings.length > 0 ? { memoContext: settings } : {}),
      })
      setMessages(current => [...current, { role: 'assistant', text: result.suggestion }])
    } catch (cause: unknown) {
      setMessages(current => [...current, { role: 'assistant', text: `⚠ ${String((cause as Error).message)}` }])
    } finally {
      setRunning(false)
    }
  }

  const modelOptions = [
    ...routes.flatMap(route => route.models.map(modelId => ({
      value: `${route.provider}::${modelId}`,
      label: `${route.provider} / ${modelId}`,
    }))),
    ...customs.map(customModel => ({
      value: `${customModel.displayName}::${customModel.modelKey}`,
      label: `${customModel.displayName}（自定义）`,
    })),
  ]

  const quickActions: readonly { label: string; prompt: string }[] = [
    { label: '一句话生成完整小说世界', prompt: '请根据我的想法，生成一套完整的小说世界设定（含力量体系、地理格局、势力阵营、规则禁忌、历史冲突），用分节格式输出，每节带小标题。' },
    { label: '帮我构思下一个章节', prompt: '请根据已有的大纲和设定，帮我构思下一个章节的详细内容安排（场景、冲突、钩子）。' },
    { label: '检查设定一致性', prompt: '请检查我的设定和大纲有没有互相矛盾的地方，逐条指出。' },
  ]

  return (
    <div
      className={css.memoPad}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <div className={css.memoPadBar} onMouseDown={onBarMouseDown}>
        <span className={css.memoPadTitle}>{t('assistant.title')}</span>
        <span className={css.memoPadSpacer} />
        <button type="button" className={css.assistClose} onClick={onClose}>×</button>
      </div>
      <div className={css.assistantModelRow}>
        <Dropdown
          options={modelOptions}
          value={provider !== undefined && model !== undefined ? `${provider}::${model}` : undefined}
          onChange={(value) => {
            const [p, m] = value.split('::')
            setProvider(p)
            setModel(m)
          }}
          placeholder={t('assistant.pickModel')}
          emptyHint={t('assistant.noModel')}
          width="100%"
        />
      </div>
      <div className={css.assistantChat} ref={scrollRef}>
        {messages.length === 0 && (
          <div className={css.assistantWelcome}>
            <p>{t('assistant.welcome')}</p>
            {quickActions.map(action => (
              <button
                key={action.label}
                type="button"
                className={css.assistantQuick}
                onClick={() => { void send(action.prompt) }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={message.role === 'user' ? css.assistantMsgUser : css.assistantMsgAi}>
            {message.text}
          </div>
        ))}
        {running && <div className={css.assistantMsgAi}>{t('action.saving')}</div>}
      </div>
      <div className={css.assistantInputRow}>
        <textarea
          className={css.assistantInput}
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder={t('assistant.inputPlaceholder')}
          rows={2}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send(input)
            }
          }}
        />
        <Button size="sm" disabled={running || input.trim().length === 0} onClick={() => { void send(input) }}>
          {t('panel.generate')}
        </Button>
      </div>
      <div className={css.memoHandle} onMouseDown={onHandleMouseDown} />
    </div>
  )
}
