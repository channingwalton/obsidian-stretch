/** Which notes opt in, how a note is opted in, and how each list in a note is told apart for its
 * open state. Pure, but for `optIn`, which edits the frontmatter it is given. */

export const CSS_CLASS = 'stretch'

/** A note opts in with `stretch` among its `cssclasses` (or the older `cssclass`). */
export function optsIn(frontmatter: unknown): boolean {
  if (typeof frontmatter !== 'object' || frontmatter === null) return false
  const fm = frontmatter as Record<string, unknown>
  return [fm['cssclasses'], fm['cssclass']].some(value => classes(value).includes(CSS_CLASS))
}

const classes = (value: unknown): string[] =>
  typeof value === 'string' ? value.split(/\s+/) : Array.isArray(value) ? value.filter(v => typeof v === 'string') : []

/** The entries of a `cssclasses` value, as a list, splitting a string at spaces and commas. */
const entries = (value: unknown): unknown[] =>
  typeof value === 'string'
    ? value.split(/[\s,]+/).filter(c => c !== '')
    : Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]

/** Whether to offer to opt a file in: a Markdown note that does not opt in yet. */
export const canOptIn = (extension: string, frontmatter: unknown): boolean =>
  extension === 'md' && !optsIn(frontmatter)

/** Opts a note in by adding `stretch` to its `cssclasses`, in place, as `processFrontMatter`
 * expects, and tells whether it changed anything. The classes already there are kept, as a list.
 * A note that already opts in is left alone. */
export function optIn(frontmatter: Record<string, unknown>): boolean {
  if (optsIn(frontmatter)) return false
  const kept = entries(frontmatter['cssclasses'])
  frontmatter['cssclasses'] = kept.includes(CSS_CLASS) ? kept : [...kept, CSS_CLASS]
  return true
}

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
