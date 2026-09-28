/** The sidebar's Writing Desk entry icon; the sidebar owns button and state. */

import type { ReactNode } from 'react'
import { IconEditOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the writing glyph at the size the sidebar asks for.
 * @param props - the sidebar's icon share: the requested edge and selection state.
 * @returns the icon element.
 */
export function NovelPanelIcon({ size }: PropsRuntime<'sidebar.panellist'>): ReactNode {
  return <IconEditOutlineRegular size={size} />
}
