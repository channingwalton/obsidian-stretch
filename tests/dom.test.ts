import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { lists, mount, readList, unmount } from '../src/dom'
import { openState } from '../src/state'

/** The Obsidian DOM helpers this adapter uses, installed in each jsdom window. */
const installDomHelpers = (doc: Document): void => {
  const prototype = doc.defaultView!.Node.prototype
  prototype.createEl = function (tag, options, callback) {
    const el = (this.ownerDocument ?? doc).createElement(tag)
    const cls = typeof options === 'string' ? options : options?.cls
    if (cls !== undefined) el.className = Array.isArray(cls) ? cls.join(' ') : cls
    callback?.(el)
    this.appendChild(el)
    return el
  }
  prototype.createSpan = function (options, callback) {
    return this.createEl('span', options, callback)
  }
}

installDomHelpers(document)

/** Obsidian's reading-view markup for a nested list, as it renders it. */
const LIST = `
<ul class="has-list-bullet">
<li data-line="0"><span class="list-bullet"></span><span class="list-collapse-indicator collapse-indicator collapse-icon"><svg></svg></span>The <a class="internal-link" href="Plugin">plugin</a> is <strong>cheap</strong>.
<ul class="has-list-bullet">
<li data-line="1"><span class="list-bullet"></span>It makes no <a class="internal-link" href="Model">model</a> calls.</li>
<li data-line="2"><span class="list-bullet"></span><span class="list-collapse-indicator"></span>Its token cost is small.
<ul><li data-line="3"><span class="list-bullet"></span>The guide is 340 words.</li></ul>
</li>
</ul>
</li>
<li data-line="4"><span class="list-bullet"></span>Nobody has shipped one.</li>
</ul>`

const obsidianList = (doc: Document = document) => {
  const root = doc.createElement('div')
  root.innerHTML = LIST
  return root.querySelector('ul') as HTMLElement
}

const memory = openState

const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim()

describe('readList', () => {
  it('turns the list into a tree, keeping inline markup and dropping bullets, indicators and sublists', () => {
    const tree = readList(obsidianList())
    expect(tree).toHaveLength(2)
    const html = (nodes: Node[]) =>
      nodes
        .map(n => (n instanceof Element ? n.outerHTML : n.textContent))
        .join('')
        .trim()
    expect(html(tree[0]!.content)).toBe('The <a class="internal-link" href="Plugin">plugin</a> is <strong>cheap</strong>.')
    expect(tree[0]!.children).toHaveLength(2)
    expect(html(tree[0]!.children[0]!.content)).toBe('It makes no <a class="internal-link" href="Model">model</a> calls.')
    expect(tree[0]!.children[1]!.children).toHaveLength(1)
    expect(tree[1]!.children).toHaveLength(0)
  })
})

describe('readList', () => {
  it('unwraps the paragraphs of a loose list so the items stay inline', () => {
    const root = document.createElement('div')
    root.innerHTML = `<ul>
<li><span class="list-bullet"></span>
<p>A loose <em>item</em>.</p>
<ul><li><span class="list-bullet"></span><p>Its child.</p></li></ul>
</li>
</ul>`
    const tree = readList(root.querySelector('ul') as HTMLElement)
    const tags = (nodes: Node[]) => nodes.filter((n): n is Element => n instanceof Element).map(n => n.tagName)
    expect(tags(tree[0]!.content)).toEqual(['EM'])
    expect(tags(tree[0]!.children[0]!.content)).toEqual([])
    expect(tree[0]!.content.map(n => n.textContent).join('').trim()).toBe('A loose item.')
  })
})

describe('readList', () => {
  it('keeps a numbered sublist as part of its sentence rather than flattening it', () => {
    const root = document.createElement('div')
    root.innerHTML = '<ul><li>Steps:<ol><li>Unplug.</li><li>Wait.</li></ol></li></ul>'
    const tree = readList(root.querySelector('ul') as HTMLElement)
    expect(tree[0]!.children).toHaveLength(0)
    expect(tree[0]!.content.some(n => (n as Element).tagName === 'OL')).toBe(true)
  })
})

describe('mount', () => {
  it('replaces the list with a paragraph showing only the top level', () => {
    const list = obsidianList()
    const holder = document.createElement('div')
    holder.append(list)
    const p = mount(list, memory())
    expect(holder.querySelector('ul')).toBeNull()
    expect(holder.firstElementChild).toBe(p)
    expect(p.classList.contains('stretch')).toBe(true)
    expect(text(p)).toBe('The plugin is cheap. » Nobody has shipped one.')
  })

  it('marks the sentences that can open', () => {
    const p = mount(obsidianList(), memory())
    const nodes = [...p.querySelectorAll('.stretch-node')]
    expect(nodes.map(n => n.classList.contains('has-children'))).toEqual([true, false])
  })

  it('opens one level in place when its sentence is clicked, and closes it from the « mark', () => {
    const p = mount(obsidianList(), memory())
    const first = p.querySelector<HTMLElement>('.stretch-node')!
    first.click()
    expect(text(p)).toBe('The plugin is cheap. « It makes no model calls. Its token cost is small. » Nobody has shipped one.')
    expect(p.querySelector('.stretch-node')!.classList.contains('is-open')).toBe(true)

    p.querySelector<HTMLElement>('.stretch-close')!.click()
    expect(text(p)).toBe('The plugin is cheap. » Nobody has shipped one.')
  })

  it('opens a nested level beneath an open one', () => {
    const p = mount(obsidianList(), memory())
    p.querySelector<HTMLElement>('.stretch-node')!.click()
    p.querySelector<HTMLElement>('.stretch-node[data-key="0.1"]')!.click()
    expect(text(p)).toContain('Its token cost is small. « The guide is 340 words.')
  })

  it('leaves a click on a link to the link, even inside a sentence that could open', () => {
    const p = mount(obsidianList(), memory())
    const skim = text(p)
    p.querySelector<HTMLElement>('.stretch-node.has-children a')!.click()
    expect(text(p)).toBe(skim)
    expect(p.querySelector('.stretch-node')!.classList.contains('is-open')).toBe(false)
  })

  it('ignores a click that bubbles up from a stretch paragraph nested inside one of its sentences', () => {
    const outer = mount(obsidianList(), memory())
    outer.querySelector<HTMLElement>('.stretch-node')!.click()
    // An embedded stretch note, filled in by another post-processor, lands inside sentence "0".
    const inner = mount(obsidianList(), memory())
    outer.querySelector<HTMLElement>('.stretch-node[data-key="0"]')!.append(inner)
    inner.querySelector<HTMLElement>('.stretch-node[data-key="0"]')!.click()
    inner.querySelector<HTMLElement>('.stretch-close[data-key="0"]')!.click()
    expect(inner.querySelector('.stretch-node[data-key="0"]')!.classList.contains('is-open')).toBe(false)
    expect(outer.querySelector('.stretch-node[data-key="0"]')!.classList.contains('is-open')).toBe(true)
  })

  it('shows a task checkbox read-only, and a click reaching the handler through it does not open the sentence', () => {
    const root = document.createElement('div')
    root.innerHTML = '<ul><li><input type="checkbox" class="task-list-item-checkbox" checked>Call the bank<ul><li>Ask about the fee.</li></ul></li></ul>'
    const p = mount(root.querySelector('ul') as HTMLElement, memory())
    const box = p.querySelector<HTMLInputElement>('input')!
    expect(box.checked).toBe(true)
    expect(box.disabled).toBe(true)
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(p.querySelector('.stretch-node')!.classList.contains('is-open')).toBe(false)
  })

  it('moves the rendered content into the paragraph rather than copying it, so later changes to it survive a redraw', () => {
    const list = obsidianList()
    const strong = list.querySelector('strong')!
    const p = mount(list, memory())
    expect(p.querySelector('strong')).toBe(strong)
    // Another post-processor fills an embed in asynchronously, after we mounted.
    strong.append(' indeed')
    p.querySelector<HTMLElement>('.stretch-node')!.click()
    p.querySelector<HTMLElement>('.stretch-close')!.click()
    expect(text(p)).toBe('The plugin is cheap indeed. » Nobody has shipped one.')
  })

  it('keeps what the reader opened in the given state, so a remount restores it', () => {
    const state = memory()
    mount(obsidianList(), state).querySelector<HTMLElement>('.stretch-node')!.click()
    expect([...state.get()]).toEqual(['0'])
    const again = mount(obsidianList(), state)
    expect(again.querySelector('.stretch-node')!.classList.contains('is-open')).toBe(true)
  })

  it('gives a sentence that is only a link an open mark, so its children can still be reached', () => {
    const root = document.createElement('div')
    root.innerHTML = '<ul><li><a class="internal-link" href="Topic">Topic</a><ul><li>What it covers.</li></ul></li></ul>'
    const p = mount(root.querySelector('ul') as HTMLElement, memory())
    expect(text(p)).toBe('Topic »')
    p.querySelector<HTMLElement>('.stretch-open')!.click()
    expect(text(p)).toBe('Topic « What it covers.')
  })

  it('opens and closes from the keyboard: the marks are buttons that say what they do, and focus follows', () => {
    const p = mount(obsidianList(), memory())
    document.body.append(p)
    const open = p.querySelector<HTMLElement>('.stretch-open')!
    expect(open.getAttribute('role')).toBe('button')
    expect(open.tabIndex).toBe(0)
    expect(open.getAttribute('aria-expanded')).toBe('false')
    expect(open.getAttribute('aria-label')).toBe('Open: The plugin is cheap.')
    open.focus()
    open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(text(p)).toContain('« It makes no model calls.')
    const close = p.querySelector<HTMLElement>('.stretch-close[data-key="0"]')!
    expect(close.getAttribute('role')).toBe('button')
    expect(close.getAttribute('aria-expanded')).toBe('true')
    expect(close.getAttribute('aria-label')).toBe('Close: The plugin is cheap.')
    expect(document.activeElement).toBe(close)
    close.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
    expect(text(p)).toBe('The plugin is cheap. » Nobody has shipped one.')
    expect(document.activeElement).toBe(p.querySelector('.stretch-open[data-key="0"]'))
    p.remove()
  })

  it('keeps two views of the same list in step: a click in one redraws the other, and the other can close it', () => {
    const state = memory()
    const a = mount(obsidianList(), state)
    const b = mount(obsidianList(), state)
    document.body.append(a, b)
    a.querySelector<HTMLElement>('.stretch-node')!.click()
    expect(b.querySelector('.stretch-node')!.classList.contains('is-open')).toBe(true)
    b.querySelector<HTMLElement>('.stretch-close')!.click()
    expect(a.querySelector('.stretch-node')!.classList.contains('is-open')).toBe(false)
    expect(text(a)).toBe(text(b))
    a.remove()
    b.remove()
  })

  it('stops redrawing a view once it is unmounted, as Obsidian does when the rendering goes away', () => {
    const state = memory()
    const a = mount(obsidianList(), state)
    const b = mount(obsidianList(), state)
    unmount(b)
    a.querySelector<HTMLElement>('.stretch-node')!.click()
    expect(a.querySelector('.stretch-node')!.classList.contains('is-open')).toBe(true)
    expect(b.querySelector('.stretch-node')!.classList.contains('is-open')).toBe(false)
  })

  it('keeps following the state while detached, since Obsidian renders sections before attaching them', () => {
    const state = memory()
    const a = mount(obsidianList(), state)
    const b = mount(obsidianList(), state)
    a.querySelector<HTMLElement>('.stretch-node')!.click()
    a.querySelector<HTMLElement>('.stretch-close')!.click()
    document.body.append(b)
    a.querySelector<HTMLElement>('.stretch-node')!.click()
    expect(b.querySelector('.stretch-node')!.classList.contains('is-open')).toBe(true)
    b.remove()
  })

  it('keeps keyboard focus on a mark when another view redraws this one', () => {
    const state = memory()
    const a = mount(obsidianList(), state)
    const b = mount(obsidianList(), state)
    document.body.append(a, b)
    b.querySelector<HTMLElement>('.stretch-open[data-key="0"]')!.focus()
    a.querySelector<HTMLElement>('.stretch-node')!.click()
    expect(document.activeElement).toBe(b.querySelector('.stretch-close[data-key="0"]'))
    a.remove()
    b.remove()
  })

  it('falls back to the nearest enclosing mark when the focused mark leaves the layout', () => {
    const state = memory()
    const a = mount(obsidianList(), state)
    const b = mount(obsidianList(), state)
    document.body.append(a, b)
    a.querySelector<HTMLElement>('.stretch-node[data-key="0"]')!.click()
    a.querySelector<HTMLElement>('.stretch-node[data-key="0.1"]')!.click()
    b.querySelector<HTMLElement>('.stretch-close[data-key="0.1"]')!.focus()
    a.querySelector<HTMLElement>('.stretch-close[data-key="0"]')!.click()
    expect(document.activeElement).toBe(b.querySelector('.stretch-open[data-key="0"]'))
    a.remove()
    b.remove()
  })

  it('keeps focus on a link inside a sentence when another view redraws this one', () => {
    const state = memory()
    const a = mount(obsidianList(), state)
    const b = mount(obsidianList(), state)
    document.body.append(a, b)
    const link = b.querySelector<HTMLElement>('a')!
    link.focus()
    expect(document.activeElement).toBe(link)
    a.querySelector<HTMLElement>('.stretch-node')!.click()
    expect(document.activeElement).toBe(link)
    a.remove()
    b.remove()
  })

  it('names a mark after its sentence alone, not what other post-processors nest inside it', () => {
    const outer = mount(obsidianList(), memory())
    const inner = mount(obsidianList(), memory())
    outer.querySelector<HTMLElement>('.stretch-node[data-key="0"]')!.append(inner)
    outer.querySelector<HTMLElement>(':scope > .stretch-open[data-key="0"]')!.click()
    expect(outer.querySelector(':scope > .stretch-close[data-key="0"]')!.getAttribute('aria-label')).toBe(
      'Close: The plugin is cheap.',
    )
  })

  it('ignores clicks and keys on an unmounted paragraph, so it cannot change state it no longer shows', () => {
    const state = memory()
    const p = mount(obsidianList(), state)
    unmount(p)
    p.querySelector<HTMLElement>('.stretch-node')!.click()
    expect([...state.get()]).toEqual([])
    p.querySelector<HTMLElement>('.stretch-open')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    expect([...state.get()]).toEqual([])
  })

  it('falls back to its own enclosing mark when the focus was in a nested paragraph that left the layout', () => {
    const state = memory()
    const outer = mount(obsidianList(), state)
    const other = mount(obsidianList(), state)
    document.body.append(outer, other)
    other.querySelector<HTMLElement>('.stretch-node[data-key="0"]')!.click()
    // The inner paragraph's sentence "1" can open; the outer one's cannot, so its key means nothing outside.
    const root = document.createElement('div')
    root.innerHTML = '<ul><li>A<ul><li>a</li></ul></li><li>B<ul><li>b</li></ul></li></ul>'
    const inner = mount(root.querySelector('ul') as HTMLElement, memory())
    outer.querySelector<HTMLElement>('.stretch-node[data-key="0.1"]')!.append(inner)
    inner.querySelector<HTMLElement>('.stretch-open[data-key="1"]')!.focus()
    other.querySelector<HTMLElement>('.stretch-close[data-key="0"]')!.click()
    expect(document.activeElement).toBe(outer.querySelector(':scope > .stretch-open[data-key="0"]'))
    outer.remove()
    other.remove()
  })

  it('cuts a long accessible name between characters, never inside one', () => {
    const root = document.createElement('div')
    root.innerHTML = `<ul><li>${'x'.repeat(78)}😀 and more text here<ul><li>Child.</li></ul></li></ul>`
    const p = mount(root.querySelector('ul') as HTMLElement, memory())
    expect(p.querySelector('.stretch-open')!.getAttribute('aria-label')).toBe(`Open: ${'x'.repeat(78)}😀…`)
  })

  it('acts once on a held key, ignoring its repeats', () => {
    const p = mount(obsidianList(), memory())
    const open = p.querySelector<HTMLElement>('.stretch-open')!
    open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    p.querySelector<HTMLElement>('.stretch-close')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }),
    )
    expect(p.querySelector('.stretch-node')!.classList.contains('is-open')).toBe(true)
  })

  it('moves focus to the mark of its own paragraph, not one with the same key in a nested paragraph', () => {
    const outer = mount(obsidianList(), memory())
    const inner = mount(obsidianList(), memory())
    document.body.append(outer)
    outer.querySelector<HTMLElement>('.stretch-node[data-key="0"]')!.append(inner)
    const close = outer.querySelector<HTMLElement>(':scope > .stretch-open[data-key="0"]')!
    close.focus()
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(outer.querySelector(':scope > .stretch-close[data-key="0"]'))
    outer.remove()
  })

  it('leaves a click on a nested paragraph\'s leaf sentence alone, rather than opening the sentence around it', () => {
    const outer = mount(obsidianList(), memory())
    const inner = mount(obsidianList(), memory())
    outer.querySelector<HTMLElement>('.stretch-node[data-key="0"]')!.append(inner)
    inner.querySelector<HTMLElement>('.stretch-node[data-key="1"]')!.click()
    expect(outer.querySelector('.stretch-node[data-key="0"]')!.classList.contains('is-open')).toBe(false)
  })
})

describe('lists', () => {
  /** A section holding a callout, as Obsidian renders `> [!type]`, which it lowercases. */
  const section = (type: string, content: string): HTMLElement => {
    const el = document.createElement('div')
    el.innerHTML = `<div data-callout="${type}" class="callout"><div class="callout-title"><div class="callout-title-inner">Title</div></div><div class="callout-content">${content}</div></div>`
    return el
  }

  it('finds every bullet list of a stretch callout, not nested ones and not numbered ones, whose order would be lost', () => {
    const el = section('stretch', '<ul id="a"><li>a<ul><li>b</li></ul></li></ul><p>x</p><ol><li>c</li></ol><blockquote><ul><li>d</li></ul></blockquote><ul id="e"><li>e</li></ul>')
    expect(lists(el).map(l => l.id)).toEqual(['a', 'e'])
  })

  it('leaves a list outside a stretch callout as a list', () => {
    const el = document.createElement('div')
    el.innerHTML = '<ul><li>a<ul><li>b</li></ul></li></ul>'
    expect(lists(el)).toEqual([])
  })

  it('leaves the lists of other callouts alone', () => {
    expect(lists(section('note', '<ul><li>a</li></ul>'))).toEqual([])
  })

  it('leaves a stretch callout nested in another block alone', () => {
    const nested = section('note', section('stretch', '<ul><li>a</li></ul>').innerHTML)
    expect(lists(nested)).toEqual([])
  })

  it('finds nothing when handed a whole note rather than a section, as Export to PDF does', () => {
    const note = document.createElement('div')
    note.append(section('stretch', '<ul><li>a</li></ul>'))
    expect(lists(note)).toEqual([])
  })
})

describe('in another window', () => {
  // Obsidian pop-out windows have their own HTMLElement class, so `instanceof` from this realm fails.
  const other = new JSDOM('<!doctype html><body></body>').window.document
  installDomHelpers(other)

  it('reads the list the same way', () => {
    const tree = readList(obsidianList(other))
    expect(tree).toHaveLength(2)
    expect(tree[0]!.children).toHaveLength(2)
    expect(tree[0]!.content.some(n => (n as Element).classList?.contains('list-bullet'))).toBe(false)
  })

  it('mounts in that window and responds to clicks there', () => {
    const list = obsidianList(other)
    other.body.append(list)
    const p = mount(list, memory())
    expect(p.ownerDocument).toBe(other)
    p.querySelector<HTMLElement>('.stretch-node')!.click()
    expect(text(p)).toContain('« It makes no model calls.')
  })
})
