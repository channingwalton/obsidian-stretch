/** Which notes opt in, and how each list in a note is told apart for its open state. Pure. */

export const CSS_CLASS = 'stretch'

/** A note opts in with `stretch` among its `cssclasses` (or the older `cssclass`). */
export function optsIn(frontmatter: unknown): boolean {
  if (typeof frontmatter !== 'object' || frontmatter === null) return false
  const fm = frontmatter as Record<string, unknown>
  return [fm['cssclasses'], fm['cssclass']].some(value => classes(value).includes(CSS_CLASS))
}

const classes = (value: unknown): string[] =>
  typeof value === 'string' ? value.split(/\s+/) : Array.isArray(value) ? value.filter(v => typeof v === 'string') : []

/** Identifies one list: the note, the rendered section's first line, and the list's position
 * within that section. Where Obsidian gives no section (hover previews, direct renders), a
 * fingerprint of the list's text stands in for the line, so lists never share state by accident. */
export const listId = (path: string, lineStart: number | null, index: number, text = ''): string =>
  `${path}#${lineStart ?? `~${fingerprint(text)}`}:${index}`

const fingerprint = (text: string): string => {
  let hash = 0
  for (const ch of text) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return hash.toString(36)
}
