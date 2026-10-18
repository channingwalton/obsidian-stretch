/**
 * The DOM adapter: reads Obsidian's rendered list into a tree, and draws the tree as a
 * paragraph whose sentences open in place. No Obsidian API here, so it runs under jsdom.
 */
import { layout, toggle, type Node, type Open, type Segment } from './stretch'

export type Content = globalThis.Node[]

/** Where the reader's open keys live between renders. */
export interface OpenState {
  get(): Open
  set(open: Open): void
}

const CLOSE_MARK = '«'

/** Reads a rendered list into a tree. Each item's content is its inline nodes, with the bullet,
 * fold indicator and sublists left out. A loose list wraps each item in a paragraph; its nodes
 * are taken out of it so the item stays inline. */
export function readList(list: HTMLElement): Node<Content>[] {
  return [...list.children]
    .filter((child): child is HTMLElement => child.tagName === 'LI')
    .map(item => {
      const content: Content = []
      const children: Node<Content>[] = []
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
const asElement = (node: globalThis.Node): HTMLElement | null =>
  node.nodeType === 1 ? (node as HTMLElement) : null

/** Only bullet sublists become levels; a numbered sublist stays part of its sentence. */
const isList = (el: HTMLElement) => el.tagName === 'UL'
const isChrome = (el: HTMLElement) =>
  el.classList.contains('list-bullet') || el.classList.contains('list-collapse-indicator')

/** The top-level bullet lists of a rendered element, in order. Lists inside quotes or callouts are
 * left alone, and so are numbered lists, whose numbering a paragraph would lose. */
export const lists = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>(':scope > ul')]

/** Replaces the list with a stretchtext paragraph and returns it. Clicks redraw the paragraph.
 * Each sentence's rendered nodes are moved into one span, made once, so whatever other
 * post-processors add to them later is kept across redraws. */
export function mount(list: HTMLElement, state: OpenState): HTMLElement {
  const tree = readList(list)
  const doc = list.ownerDocument
  const paragraph = doc.createElement('p')
  paragraph.classList.add('stretch')
  list.replaceWith(paragraph)

  const spans = new Map<string, HTMLElement>()
  const spanFor = (segment: Segment<Content>): HTMLElement => {
    const made = spans.get(segment.key)
    if (made !== undefined) return made
    const node = doc.createElement('span')
    node.classList.add('stretch-node')
    node.classList.toggle('has-children', segment.hasChildren)
    node.dataset['key'] = segment.key
    node.dataset['depth'] = `${segment.depth}`
    node.append(...segment.content)
    // A task checkbox shows its state only: Obsidian's own handler needs the list item we replaced.
    for (const box of node.querySelectorAll('input')) box.disabled = true
    spans.set(segment.key, node)
    return node
  }

  const draw = () => {
    paragraph.replaceChildren()
    for (const segment of layout(tree, state.get())) {
      const node = spanFor(segment)
      node.classList.toggle('is-open', segment.open)
      paragraph.append(node)
      if (segment.open) {
        const close = doc.createElement('span')
        close.classList.add('stretch-close')
        close.dataset['key'] = segment.key
        close.textContent = CLOSE_MARK
        paragraph.append(' ', close)
      }
      paragraph.append(' ')
    }
  }

  paragraph.addEventListener('click', event => {
    const target = asElement(event.target as globalThis.Node)
    if (target === null) return
    // A link or a task checkbox keeps its own click.
    if (target.closest('a, input')) return
    const close = target.closest<HTMLElement>('.stretch-close')
    const node = close ?? target.closest<HTMLElement>('.stretch-node.has-children')
    const key = node?.dataset['key']
    if (node === null || key === undefined) return
    // A stretch paragraph nested in one of our sentences handles its own clicks.
    if (node.closest('.stretch') !== paragraph) return
    if (close === null && node.classList.contains('is-open')) return
    event.preventDefault()
    state.set(toggle(state.get(), key))
    draw()
  })

  draw()
  return paragraph
}
