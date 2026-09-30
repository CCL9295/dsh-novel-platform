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
// Generated Remote namespace: runtime contribution (mounted below) and the
// declaration merge for the `novel/*` failure vocabulary. The monorepo build
// inlines the self-referenced `*/remote` artifact (GENERATED_REMOTE); the
// standalone build aliases the same specifier to its committed artifact
// (scripts/build.mjs).
import novelRemote from '@deepseek-ai/dsh-novel-platform/remote'
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

/** Services required by the mount; the panel registration waits for `remote.novel`. */
export const inject = ['slots', 'locale', 'remote']

/**
 * Mount the plugin's own Remote namespace, then contribute the Writing Desk
 * entry to the sidebar with the main panel it opens.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'novel-platform: dictionaries')
  // Self-mount the generated contribution: a third-party bundle cannot edit
  // the application's api-remotes facade, and $mount is the Gateway's public
  // extension seam. The mount is deferred one macrotask past this entry's
  // activation window: mounting synchronously here makes the Gateway create
  // the namespace's dynamic plugin fiber inside the boot activation pass,
  // which deadlocks the initial module composition. A re-materialized entry
  // (HMR/code reload) may race its own previous mount; the already-mounted
  // rejection is swallowed and the fresh effect's disposer chain wins.
  ctx.effect(() => {
    let dispose: (() => Promise<void>) | undefined
    const timer = setTimeout(() => {
      void ctx.remote.$mount(novelRemote).then((d) => { dispose = d }).catch((error: unknown) => {
        if (!/already mounted/.test(String((error as Error)?.message))) throw error
      })
    }, 0)
    return () => {
      clearTimeout(timer)
      void dispose?.()
    }
  }, 'novel-platform: mount remote.novel')

  // `remote.novel` is a flat service key: access from a context requires the
  // inject declaration, so the panel (and its face) are registered from a
  // child context that waits for the namespace this plugin itself mounts.
  ctx.inject(['remote.novel'], (child) => {
    child.effect(function* () {
      const t = child.locale.bind(NS)
      const face = createNovelFace(child)

      yield child.slots.inject('main', () => child.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => face,
      }, NovelPage))

      yield child.slots.inject('sidebar.panellist', () => child.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 90,
        label: () => t('panel'),
        locale: NS,
      }, NovelPanelIcon))
    }, 'novel-platform: writing-desk slots')
  })
}
