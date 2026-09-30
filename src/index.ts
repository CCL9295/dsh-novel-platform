/**
 * Novel platform, Host half: the shared store, the Remote namespace the
 * writing-desk panel consumes, the agent tools, and the bundled writing
 * skills. One plugin provides all four so the chat agent and the desk stay
 * on one dataset.
 *
 * @module @deepseek-ai/dsh-novel-platform
 */

import type { Context } from '@deepseek-ai/cordis'
import { NovelController } from './controller.ts'
import { NovelStoreService } from './store.ts'
import { registerBundledSkills } from './skills.ts'
import { registerNovelTools } from './tools.ts'

export const name = 'novel-platform'

export const inject = ['tools', 'skills', 'llm', 'agentDefaultModel']

/**
 * Provide the store, the Remote controller, the agent tools, and the bundled
 * 弧光 writing skills.
 * @param ctx - host plugin context.
 */
export function apply(ctx: Context): void {
  const store = new NovelStoreService(ctx)
  new NovelController(ctx, store)
  registerNovelTools(ctx, store)
  void registerBundledSkills(ctx)
}

export { NovelController } from './controller.ts'
export { NovelStoreService, countWords } from './store.ts'
export type * from './types.ts'
