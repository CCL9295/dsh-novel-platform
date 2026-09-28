/**
 * Novel platform, browser half: the **Writing Desk** entry of the sidebar and
 * the main panel it opens. Data flows through the NovelFace over the mounted
 * `remote.novel` namespace; the page stays wire-free.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Generated Remote namespace declaration merge (novel/* vocabulary).
import type {} from '@deepseek-ai/dsh-novel-platform/remote'
import { NovelPage } from './NovelPage.tsx'
import { NovelPanelIcon } from './NovelIcon.tsx'
import { createNovelFace } from './face.ts'
import { en, NS, zh, type NovelLocaleKey } from './locales.ts'

export { NovelPage, type NovelPageProps } from './NovelPage.tsx'
export { NovelPanelIcon } from './NovelIcon.tsx'
export { createNovelFace, type NovelFace } from './face.ts'
export { NS as NOVEL_LOCALE_NAMESPACE, type NovelLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Writing-desk panel copy. */
    'novel': NovelLocaleKey
  }
}

/** The id shared by the sidebar entry and the main panel it opens. */
export const PANEL_ID = 'novel' as MainPanelId

/** Services required by the panel, the sidebar entry, and the Remote face. */
export const inject = ['slots', 'locale', 'remote', 'remote.novel']

/**
 * Contribute the Writing Desk entry to the sidebar with the main panel it
 * opens.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'novel-platform: dictionaries')
  const t = ctx.locale.bind(NS)
  const face = createNovelFace(ctx)

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: () => face,
  }, NovelPage))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 90,
    label: () => t('panel'),
    locale: NS,
  }, NovelPanelIcon))
}
