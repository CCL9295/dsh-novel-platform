/**
 * AI enhance actions for the writing desk: skill-steered one-shot model calls.
 *
 * Every action binds one bundled (弧光) skill; the skill's SKILL.md body is
 * fetched through the skill registry and prepended to the task so the model
 * writes with the craft discipline that skill encodes. The call runs through
 * the Host's own LLM runtime (`ctx.llm.stream`) with the deployment's default
 * model selection, so the desk uses exactly the model the user configured.
 * Results are suggestions only — the panel decides whether to apply them.
 *
 * @module @deepseek-ai/dsh-novel-platform/enhance
 */

import type { Context } from '@deepseek-ai/cordis'
import type { GenerateOptions, RequestMessage } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-skill'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { NovelStoreService } from './store.ts'
import type {
  EnhanceActionInfo, EnhanceKind, EnhanceResult, GuideStepInfo, NovelDetail,
} from './types.ts'

/** Chapter-surface actions, each bound to one 弧光 skill. */
export const CHAPTER_ACTIONS: readonly EnhanceActionInfo[] = [
  { actionId: 'chapter-polish', kind: 'chapter', label: '润色', skill: 'novel-polishing', hint: '按弧光润色技法提升文笔、画面感与代入感' },
  { actionId: 'chapter-humanize', kind: 'chapter', label: '去AI味', skill: 'humanizer-zh', hint: '按弧光人性化系统清除机翻感与AI腔' },
  { actionId: 'chapter-review', kind: 'chapter', label: '审稿', skill: 'novel-pacing', hint: '以编辑视角审读节奏、钩子与逻辑，给出修改清单' },
  { actionId: 'chapter-style', kind: 'chapter', label: '文风', skill: 'novel-language-style', hint: '调整叙事视角、修辞与语言风格' },
  { actionId: 'chapter-pleasure', kind: 'chapter', label: '爽点', skill: 'novel-pleasure-points', hint: '强化打脸、反转、期待感等爽点密度' },
  { actionId: 'chapter-consistency', kind: 'chapter', label: '设定核查', skill: 'novel-worldbuilding', hint: '对照设定集检查正文的规则与事实冲突' },
]

/** Outline-surface actions: what each skill can do at the outline level. */
export const OUTLINE_ACTIONS: readonly EnhanceActionInfo[] = [
  { actionId: 'outline-pacing', kind: 'outline', label: '节奏结构', skill: 'novel-pacing', hint: '多幕结构、章节钩子与卡点排布' },
  { actionId: 'outline-genres', kind: 'outline', label: '题材适配', skill: 'novel-genres', hint: '按题材的流量逻辑调整剧情走向' },
  { actionId: 'outline-innovation', kind: 'outline', label: '反套路', skill: 'novel-innovation', hint: '识别陈词滥调并给出替换方案' },
  { actionId: 'outline-pleasure', kind: 'outline', label: '爽点布局', skill: 'novel-pleasure-points', hint: '在大纲层面铺设爽点与期待感' },
  { actionId: 'outline-emotion', kind: 'outline', label: '情绪曲线', skill: 'novel-emotion', hint: '安排情绪起伏、共情点与释放节奏' },
  { actionId: 'outline-character', kind: 'outline', label: '人物弧光', skill: 'novel-character-design', hint: '角色成长线、关系与反派塑造' },
]

/** All actions in UI order: chapter buttons first, then outline cards. */
export function listActions(): EnhanceActionInfo[] {
  return [...CHAPTER_ACTIONS, ...OUTLINE_ACTIONS]
}

/** Find one action or fail with the domain code. */
function findAction(kind: EnhanceKind, actionId: string): EnhanceActionInfo {
  const action = listActions().find(candidate => candidate.kind === kind && candidate.actionId === actionId)
  if (action === undefined) {
    throw new RemoteError('novel/action-not-found', `no enhance action "${actionId}"`, { actionId })
  }
  return action
}

/** Task instruction per action, composed with the skill body in the prompt. */
function taskInstruction(action: EnhanceActionInfo): string {
  switch (action.actionId) {
    case 'chapter-polish':
      return '请对下面的章节正文进行润色：保持剧情、人物、事实完全不变，只提升文笔、节奏与画面感，直接输出润色后的完整正文，不要任何解释。'
    case 'chapter-humanize':
      return '请按技能要求把下面的章节正文改写为更像人类作者的中文网文：去除AI腔、翻译腔与模板化表达，保持剧情与人物不变，直接输出改写后的完整正文，不要任何解释。'
    case 'chapter-review':
      return '请作为资深网文编辑审读下面的章节正文：从节奏、钩子、情绪、逻辑一致性四个方面给出审稿意见（问题清单 + 每条附示例改写）。不要输出全文改写。'
    case 'chapter-style':
      return '请按技能要求调整下面的章节正文的叙事视角与语言风格（保持剧情不变），先一句话说明你选择的风格方向，再输出调整后的完整正文。'
    case 'chapter-pleasure':
      return '请按技能要求强化下面的章节正文的爽点密度与期待感（保持主线剧情不变），直接输出强化后的完整正文，不要任何解释。'
    case 'chapter-consistency':
      return '请对照下面的设定集审读章节正文：逐条指出违反力量体系、地理、势力、规则或历史设定的地方（引用正文原句 + 对应设定条目 + 修改建议）；没有冲突的方面不必展开。不要输出全文改写。'
    case 'outline-pacing':
      return '请按技能要求审读并优化下面的作品大纲：给出多幕结构、章节钩子与卡点的具体调整建议（按大纲条目逐一说明），最后输出调整后的完整大纲。'
    case 'outline-genres':
      return '请按技能要求（结合该题材的流量逻辑）审读下面的作品大纲，给出题材适配的调整建议，最后输出调整后的完整大纲。'
    case 'outline-innovation':
      return '请按技能要求识别下面作品大纲中的陈词滥调与套路化桥段，逐条指出并给出替换方案，最后输出反套路化后的完整大纲。'
    case 'outline-pleasure':
      return '请按技能要求在下面的作品大纲层面铺设爽点与期待感，逐条说明设计意图，最后输出调整后的完整大纲。'
    case 'outline-emotion':
      return '请按技能要求为下面的作品大纲安排情绪曲线（压抑、共情、释放的节奏），逐条说明，最后输出调整后的完整大纲。'
    case 'outline-character':
      return '请按技能要求审视下面的作品大纲中的人物成长线、关系与反派塑造，逐条给出建议，最后输出补充人物线后的完整大纲。'
    default:
      return '请按技能要求处理下面的文本。'
  }
}

/** Render the outline into numbered text for the model. */
function outlineText(novel: { title: string; genre: string; description: string }, outline: readonly { order: number; volume: string; summary: string }[]): string {
  const entries = outline.slice().sort((left, right) => left.order - right.order)
    .map(entry => `${entry.order}. 【${entry.volume}】${entry.summary}`)
    .join('\n')
  return `《${novel.title}》（题材：${novel.genre}）\n简介：${novel.description}\n\n大纲：\n${entries.length === 0 ? '（暂无条目）' : entries}`
}

export const GUIDE_STEPS: readonly GuideStepInfo[] = [
  { stepId: 'premise', order: 1, label: '世界基调', skill: 'novel-genres', category: 'premise', title: '世界基调', question: '这是一个什么样的世界？题材、时代背景、科技/修为水平、整体基调（热血/黑暗/轻松）？' },
  { stepId: 'power', order: 2, label: '力量体系', skill: 'novel-worldbuilding', category: 'power', title: '力量体系', question: '这个世界的人如何获得力量？境界/等级如何划分？修炼或晋升的代价与限制是什么？' },
  { stepId: 'geography', order: 3, label: '地理格局', skill: 'novel-worldbuilding', category: 'geography', title: '地理格局', question: '世界有哪些重要地域？它们之间的关系（贸易/战争/隔离）？故事主要发生在哪里？' },
  { stepId: 'faction', order: 4, label: '势力阵营', skill: 'novel-worldbuilding', category: 'faction', title: '势力阵营', question: '有哪些主要势力（宗门/公司/国家/组织）？各自的立场、资源与矛盾是什么？' },
  { stepId: 'rule', order: 5, label: '规则禁忌', skill: 'novel-worldbuilding', category: 'rule', title: '规则与禁忌', question: '这个世界不可违背的规则是什么？违反的代价？有哪些社会禁忌？' },
  { stepId: 'history', order: 6, label: '历史冲突', skill: 'novel-worldbuilding', category: 'history', title: '历史与核心冲突', question: '历史上发生过什么大事？当下世界的核心矛盾是什么？主角将卷入什么？' },
  { stepId: 'cast', order: 7, label: '角色阵容', skill: 'novel-character-design', category: 'character', title: '核心角色阵容', question: '主角是谁（出身/目标/缺陷）？核心配角与反派是谁？他们与世界设定如何勾连？' },
]

/** Render a novel's setting bible (world entries + character cards) as model context. */
export function settingsContext(detail: NovelDetail): string {
  const world = (detail.world ?? []).map(entry => `- 【${entry.title}】${entry.content}`).join('\n')
  const cast = detail.characters.map(role => `- 【${role.name}·${role.role}】${role.profile}`).join('\n')
  return [
    world.length > 0 ? `【世界设定】\n${world}` : '',
    cast.length > 0 ? `【角色卡】\n${cast}` : '',
  ].filter(section => section.length > 0).join('\n\n')
}

/** Build the guide prompt for one wizard step from the skill + existing settings. */
function guidePrompt(step: GuideStepInfo, skillBody: string, settings: string, userNote: string): string {
  return [
    skillBody.length > 0 ? `【技能指引（${step.skill}）】\n${skillBody}` : '',
    `【任务】\n你正在引导一位网文作者搭建小说世界。当前步骤：「${step.title}」。\n${step.question}\n${userNote.trim().length > 0 ? `\n作者补充的想法：${userNote.trim()}` : ''}\n\n请给出这一步的设定草案：2-4 个具体条目（每条带小标题），与已有设定保持一致；语言具体、可直接使用，不要空泛的写作方法论。`,
    settings.length > 0 ? `【已有设定】\n${settings}` : '',
  ].filter(section => section.length > 0).join('\n\n')
}

/** Run one wizard step draft call. */
export async function guideDraft(
  ctx: Context,
  store: NovelStoreService,
  novelId: string,
  stepId: string,
  userNote: string,
): Promise<EnhanceResult> {
  const step = GUIDE_STEPS.find(candidate => candidate.stepId === stepId)
  if (step === undefined) {
    throw new RemoteError('novel/step-not-found', `no guide step "${stepId}"`, { stepId })
  }
  const detail = await store.getNovel(novelId)
  const settings = settingsContext(detail)
  const skill = await ctx.skills.get(step.skill).catch(() => undefined)
  const selection = ctx.agentDefaultModel?.currentSelection()
  if (selection === undefined || selection.provider.length === 0 || selection.model.length === 0) {
    throw new RemoteError('novel/no-model', '没有可用的默认模型：请先在设置里配置模型', { reason: 'no default model selection' })
  }
  const prompt = guidePrompt(step, skill?.content ?? '', settings, userNote)
  const messages: RequestMessage[] = [
    Object.freeze({ role: 'user', content: [{ type: 'text' as const, text: prompt }] }),
  ]
  const options: GenerateOptions = {
    provider: selection.provider,
    model: selection.model,
    ...selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort },
    messages,
    maxTokens: 8192,
  }
  const parts: string[] = []
  let finish: { kind: string; message?: string } | undefined
  for await (const chunk of ctx.llm.stream(options)) {
    if (chunk.type === 'text-delta') parts.push(chunk.text)
    if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
      finish = { kind: chunk.reason.kind, message: chunk.reason.failure.message }
    }
  }
  if (finish !== undefined) {
    throw new RemoteError('novel/rejected', `模型调用失败（${finish.kind}）${finish.message === undefined ? '' : `：${finish.message}`}`, { reason: finish.message ?? finish.kind })
  }
  const suggestion = parts.join('').trim()
  if (suggestion.length === 0) {
    throw new RemoteError('novel/rejected', '模型没有返回内容，请稍后重试', { reason: 'empty generation' })
  }
  return { actionId: step.stepId, kind: 'outline', label: `引导 · ${step.label}`, skill: step.skill, suggestion }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** No enhance action carries that id. */
    'novel/action-not-found': { readonly actionId: string }
    /** No guide step carries that id. */
    'novel/step-not-found': { readonly stepId: string }
    /** The deployment has no usable default model selection. */
    'novel/no-model': { readonly reason: string }
  }
}

/** Run one skill-steered enhance call and return the raw suggestion. */
export async function enhance(
  ctx: Context,
  store: NovelStoreService,
  kind: EnhanceKind,
  targetId: string,
  actionId: string,
): Promise<EnhanceResult> {
  const action = findAction(kind, actionId)

  // Target text: the chapter body, or the whole-novel outline rendered flat.
  // Chapter actions ride the novel's setting bible so the model honors it.
  let target: string
  let settings = ''
  if (kind === 'chapter') {
    const chapter = await store.getChapter(targetId)
    const novel = await store.getNovel(chapter.novelId)
    settings = settingsContext(novel)
    target = `《${chapter.title}》\n\n${chapter.content}`
  } else {
    const novel = await store.getNovel(targetId)
    target = outlineText(novel.novel, novel.outline)
  }

  // The 弧光 skill body steers the model; a missing registration degrades to
  // the bare task instruction rather than failing the action.
  const skill = await ctx.skills.get(action.skill).catch(() => undefined)
  const skillBody = skill?.content ?? ''

  const selection = ctx.agentDefaultModel?.currentSelection()
  if (selection === undefined || selection.provider.length === 0 || selection.model.length === 0) {
    throw new RemoteError('novel/no-model', '没有可用的默认模型：请先在设置里配置模型', { reason: 'no default model selection' })
  }

  const prompt = [
    skillBody.length > 0 ? `【技能指引（${action.skill}）】\n${skillBody}` : '',
    settings.length > 0 ? `【设定集（必须保持一致）】\n${settings}` : '',
    `【任务】\n${taskInstruction(action)}`,
    `【目标文本】\n${target}`,
  ].filter(section => section.length > 0).join('\n\n')

  const messages: RequestMessage[] = [
    Object.freeze({ role: 'user', content: [{ type: 'text' as const, text: prompt }] }),
  ]
  const options: GenerateOptions = {
    provider: selection.provider,
    model: selection.model,
    ...selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort },
    messages,
    maxTokens: 16384,
  }

  const parts: string[] = []
  let finish: { kind: string; message?: string } | undefined
  for await (const chunk of ctx.llm.stream(options)) {
    if (chunk.type === 'text-delta') parts.push(chunk.text)
    if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
      finish = { kind: chunk.reason.kind, message: chunk.reason.failure.message }
    }
  }
  if (finish !== undefined) {
    throw new RemoteError('novel/rejected', `模型调用失败（${finish.kind}）${finish.message === undefined ? '' : `：${finish.message}`}`, { reason: finish.message ?? finish.kind })
  }
  const suggestion = parts.join('').trim()
  if (suggestion.length === 0) {
    throw new RemoteError('novel/rejected', '模型没有返回内容，请稍后重试', { reason: 'empty generation' })
  }
  return { actionId: action.actionId, kind, label: action.label, skill: action.skill, suggestion }
}
