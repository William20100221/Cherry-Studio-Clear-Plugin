/**
 * Update reminder: asks GitHub once for the latest release and words a one-line reminder when this
 * copy is older. Never throws and never delays a clear; offline or rate-limited means no reminder.
 * Opt out with the environment variable DSH_CLEAR_CONVERSATION_NO_UPDATE_CHECK=1.
 */

export const REPO = 'William20100221/dsh-clear-conversation'
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`
const INSTALL_SPEC = `github:${REPO}`

const parts = (version) => String(version).replace(/^v/, '').split(/[-+]/)[0].split('.').map(Number)

/** True when `latest` has a higher major.minor.patch than `current`; prerelease tags are ignored. */
export function isNewer(latest, current) {
  const a = parts(latest)
  const b = parts(current)
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) return false
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

/** The latest release tag without its leading "v", or undefined when it cannot be read in time. */
export async function fetchLatestVersion({ fetchImpl = globalThis.fetch, timeoutMs = 3000 } = {}) {
  try {
    const response = await fetchImpl(LATEST_API, {
      headers: { accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!response.ok) return undefined
    const tag = (await response.json())?.tag_name
    return typeof tag === 'string' ? tag.replace(/^v/, '') : undefined
  } catch {
    return undefined
  }
}

/** One line telling the user how to update, or undefined when this copy is current. */
export function updateNotice(latest, current) {
  if (!latest || !isNewer(latest, current)) return undefined
  return `dsh-clear-conversation ${latest} is available (you have ${current}). To update, open Plugins, remove dsh-clear-conversation, then add ${INSTALL_SPEC} again.`
}

/** Start the check now; `current()` returns the notice once the answer has arrived. */
export function startUpdateCheck(version, { env = process.env, ...options } = {}) {
  let notice
  if (!env.DSH_CLEAR_CONVERSATION_NO_UPDATE_CHECK) {
    void fetchLatestVersion(options).then((latest) => {
      notice = updateNotice(latest, version)
    })
  }
  return { current: () => notice }
}
