/**
 * Ambient declaration for the generated Typert Remote contribution, imported
 * through a build-resolved virtual specifier so the same source builds both
 * inside the dsh monorepo and as a standalone bundle. No top-level imports:
 * this must stay a global script for `declare module` to apply.
 */
declare module 'virtual:novel-remote-contribution' {
  import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
  const contribution: TypertRemoteContribution
  export default contribution
}
