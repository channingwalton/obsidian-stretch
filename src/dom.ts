/**
 * The DOM adapter: reads Obsidian's rendered list into a tree, and draws the tree as a
 * paragraph whose sentences open in place. Obsidian's DOM helpers are shimmed in jsdom tests.
 */
import { layout, parentKey, toggle, type Node as StretchNode, type Segment } from './stretch'
import type { OpenState } from './state'

export type Content = Node[]

const OPEN_MARK = '»'
const CLOSE_MARK = '«'
const MARKS = '.stretch-open, .stretch-close'
const PROSE = 'stretch-prose'
/** Longer sentences are cut here in a mark's accessible name. */
const LABEL_LENGTH = 80

/** How each mounted paragraph lets go of its state and its listeners, for `unmount`. */
const mounted = new WeakMap<HTMLElement, () => void>()

/** Reads a rendered list into a tree. Each item's content is its inline nodes, with the bullet,
 * fold indicator and sublists left out. A loose list wraps each item in a paragraph; its nodes
 * are taken out of it so the item stays inline. */
export function readList(list: HTMLElement): StretchNode<Content>[] {
  return [...list.children]
    .filter((child): child is HTMLElement => child.tagName === 'LI')
    .map(item => {
      const content: Content = []
      const children: StretchNode<Content>[] = []
      for (const node of item.childNodes) {
        const el = asElement(node)
        if (el === null) content.push(node)
        else if (isList(el)) children.push(...readList(el))
        else if (isChrome(el)) continue
        else if (el.tagName === 'P') content.push(...el.childNodes)
        else content.push(node)
      }
      return { content, children }
    })
}

/** Elements from a pop-out window are not `instanceof` this window's classes, so test by node type. */
const asElement = (node: Node): HTMLElement | null =>
  node.nodeType === 1 ? (node as HTMLElement) : null

/** Only bullet sublists become levels; a numbered sublist stays part of its sentence. */
const isList = (el: HTMLElement) => el.tagName === 'UL'
const isChrome = (el: HTMLElement) =>
  el.classList.contains('list-bullet') || el.classList.contains('list-collapse-indicator')

/** The bullet lists of a rendered section's stretch callout, `> [!stretch]`, in order. Lists
 * elsewhere are left alone, and so are numbered lists, whose numbering a paragraph would lose. A
 * whole note, as Export to PDF hands over, holds its callouts a level down and gives none. */
export const lists = (el: HTMLElement): HTMLElement[] =>
  [...el.querySelectorAll<HTMLElement>(':scope > .callout[data-callout="stretch"] > .callout-content > ul')]

/** Sets each stretch callout holding a bullet list to read as prose: the stylesheet takes away the
 * box and title of a callout with this class. These are the callouts at the top of a section, whose
 * lists `lists` finds to draw, and those at the top of a whole note, as Export to PDF hands over,
 * whose lists print flat. A folded one, `> [!stretch]-`, is unfolded, as its hidden title could
 * not be clicked. */
export function asProse(el: HTMLElement): void {
  const contents = el.querySelectorAll<HTMLElement>(
    ':scope > .callout[data-callout="stretch"] > .callout-content, :scope > div > .callout[data-callout="stretch"] > .callout-content')
  for (const content of contents) {
    if (content.querySelector(':scope > ul') === null) continue
    const callout = content.parentElement!
    callout.classList.add(PROSE)
    callout.classList.remove('is-collapsed')
    content.style.removeProperty('display')
  }
}

/** Replaces the list with a stretchtext paragraph and returns it. A click or a keypress changes
 * the state; the paragraph redraws from the state through its subscription, as does every other
 * view of the list. Each sentence's rendered nodes are moved into one span, made once, so whatever
 * other post-processors add to them later is kept across redraws. */
export function mount(list: HTMLElement, state: OpenState): HTMLElement {
  const tree = readList(list)
  const doc = list.ownerDocument
  const paragraph = list.createEl('p', { cls: 'stretch' })
  paragraph.remove()
  list.replaceWith(paragraph)

  const spans = new Map<string, HTMLElement>()
  const spanFor = (segment: Segment<Content>): HTMLElement => {
    const made = spans.get(segment.key)
    if (made !== undefined) return made
    const node = paragraph.createSpan({ cls: 'stretch-node' })
    node.classList.toggle('has-children', segment.hasChildren)
    node.dataset['key'] = segment.key
    node.dataset['depth'] = `${segment.depth}`
    node.append(...segment.content)
    // A task checkbox shows its state only: Obsidian's own handler needs the list item we replaced.
    for (const box of node.querySelectorAll('input')) box.disabled = true
    spans.set(segment.key, node)
    return node
  }

  /** The » or « after a sentence that can open: a button the keyboard can reach, named after the
   * sentence. Made once per key, like the sentence's span, so focus on it survives a redraw. */
  const marks = new Map<string, HTMLElement>()
  const markFor = (segment: Segment<Content>): HTMLElement => {
    let mark = marks.get(segment.key)
    if (mark === undefined) {
      mark = paragraph.createSpan()
      mark.dataset['key'] = segment.key
      mark.setAttribute('role', 'button')
      mark.tabIndex = 0
      marks.set(segment.key, mark)
    }
    mark.classList.toggle('stretch-open', !segment.open)
    mark.classList.toggle('stretch-close', segment.open)
    mark.textContent = segment.open ? CLOSE_MARK : OPEN_MARK
    mark.setAttribute('aria-expanded', `${segment.open}`)
    mark.setAttribute('aria-label', `${segment.open ? 'Close' : 'Open'}: ${excerpt(segment.content)}`)
    return mark
  }

  /** Redraws from the state. Focus inside the paragraph is put back where it was; where that
   * place has gone, it moves to the mark of the nearest sentence still shown. */
  const draw = () => {
    const focused = focusedElement()
    const focusedKey = focused === null ? undefined : ownKeyAround(focused)
    paragraph.replaceChildren()
    for (const segment of layout(tree, state.get())) {
      const node = spanFor(segment)
      node.classList.toggle('is-open', segment.open)
      paragraph.append(node)
      if (segment.hasChildren) paragraph.append(' ', markFor(segment))
      paragraph.append(' ')
    }
    if (focused === null) return
    // Without scrolling: another view's click must not move this one.
    if (paragraph.contains(focused)) focused.focus({ preventScroll: true })
    else if (focusedKey !== undefined) nearestMark(focusedKey)?.focus({ preventScroll: true })
  }

  /** The key of this paragraph's own sentence or mark around an element; a nested stretch
   * paragraph's keys are its own and are passed over. */
  const ownKeyAround = (el: HTMLElement): string | undefined => {
    for (let keyed = el.closest<HTMLElement>('[data-key]'); keyed !== null; keyed = keyed.parentElement?.closest<HTMLElement>('[data-key]') ?? null) {
      if (keyed.parentElement === paragraph) return keyed.dataset['key']
    }
    return undefined
  }

  const focusedElement = (): HTMLElement | null => {
    const active = doc.activeElement
    return active !== null && paragraph.contains(active) ? (active as HTMLElement) : null
  }

  /** This paragraph's own mark for the key or, failing that, for the closest ancestor key. */
  const nearestMark = (key: string): HTMLElement | null => {
    for (let k: string | undefined = key; k !== undefined; k = parentKey(k)) {
      const mark = marks.get(k)
      if (mark?.parentElement === paragraph) return mark
    }
    return null
  }

  /** The control an event lands on, if it is one of this paragraph's own. */
  const controlFor = (event: Event, selector: string): HTMLElement | null => {
    const target = asElement(event.target as Node)
    // A link or a task checkbox keeps its own click.
    if (target === null || target.closest('a, input')) return null
    // A stretch paragraph nested in one of our sentences handles its own clicks.
    if (target.closest('.stretch') !== paragraph) return null
    return target.closest<HTMLElement>(selector)
  }

  const onClick = (event: MouseEvent) => {
    const control = controlFor(event, `${MARKS}, .stretch-node.has-children`)
    const key = control?.dataset['key']
    if (control === null || key === undefined) return
    // A click on an open sentence's text is reading, not closing; its « does that.
    if (control.classList.contains('stretch-node') && state.get().has(key)) return
    event.preventDefault()
    state.set(toggle(state.get(), key))
  }

  const onKeydown = (event: KeyboardEvent) => {
    if ((event.key !== 'Enter' && event.key !== ' ') || event.repeat) return
    const key = controlFor(event, MARKS)?.dataset['key']
    if (key === undefined) return
    event.preventDefault()
    state.set(toggle(state.get(), key))
  }

  paragraph.addEventListener('click', onClick)
  paragraph.addEventListener('keydown', onKeydown)
  const stop = state.subscribe(draw)
  mounted.set(paragraph, () => {
    stop()
    paragraph.removeEventListener('click', onClick)
    paragraph.removeEventListener('keydown', onKeydown)
  })
  draw()
  return paragraph
}

/** Stops a mounted paragraph following its state and taking clicks. Called when Obsidian discards
 * the rendering. */
export function unmount(paragraph: HTMLElement): void {
  mounted.get(paragraph)?.()
  mounted.delete(paragraph)
}

/** The start of a sentence's own text, for a mark's accessible name. Read at each draw, so what
 * an embed fills in later is included; what other post-processors append to the sentence's span
 * is not part of it. Cut between characters, never inside one. */
const excerpt = (content: Content): string => {
  const chars = [...content.map(n => n.textContent ?? '').join('').replace(/\s+/g, ' ').trim()]
  return chars.length > LABEL_LENGTH ? `${chars.slice(0, LABEL_LENGTH - 1).join('')}…` : chars.join('')
}
