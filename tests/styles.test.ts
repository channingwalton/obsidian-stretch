// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

/** The plugin's stylesheet. Export to PDF copies it into the window it prints from. */
const CSS = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')

/** A callout as Obsidian renders `> [!type]`, holding the given content. */
const callout = (type: string, content: string): string =>
  `<div data-callout="${type}" class="callout"><div class="callout-title"><div class="callout-title-inner">Title</div></div><div class="callout-content">${content}</div></div>`

/** A note as Export to PDF renders it: each block in its own div, with no bullets or fold
 * indicators. The post-processor draws no paragraphs there, so a stretch callout's lists arrive as
 * lists. */
const NOTE = `
<div class="print"><div class="markdown-preview-view markdown-rendered">
<div>${callout('stretch', `<ul id="stretch">
<li>The build fails on a stale cache.
<ul>
<li>The CI cache is keyed only by <code>package.json</code>.
<ul><li>About one run in five hits it.</li></ul>
</li>
</ul>
</li>
<li>The fix is to key the cache on the lockfile.</li>
</ul>`)}</div>
<div>${callout('stretch', `<ul id="loose">
<li><p>A loose list, first sentence.</p>
<ul><li>Its child.</li></ul>
</li>
<li data-task="" class="task-list-item"><p><input type="checkbox" class="task-list-item-checkbox">A task sentence.</p>
<ul class="contains-task-list">
<li data-task="x" class="task-list-item is-checked"><input checked="" type="checkbox" class="task-list-item-checkbox">A done child.</li>
</ul>
</li>
<li><p>A sentence with steps:</p>
<ol id="steps"><li>Step one<ul><li>A bullet under a step</li></ul></li></ol>
</li>
</ul>`)}</div>
<div><ul id="plain"><li>A plain bullet<ul><li>Its child</li></ul></li></ul></div>
<div>${callout('note', '<ul id="callout"><li>A note callout bullet<ul><li>Its child</li></ul></li></ul>')}</div>
<div>${callout('note', callout('stretch', '<ul id="nested"><li>A bullet of a nested stretch callout<ul><li>Its child</li></ul></li></ul>'))}</div>
<div><blockquote><ul id="quote"><li>A quote bullet<ul><li>Its child</li></ul></li></ul></blockquote></div>
<div>${callout('stretch', '<ol id="numbered"><li>A numbered item<ul><li>A bullet under it</li></ul></li></ol>')}</div>
<div><span class="internal-embed markdown-embed inline-embed is-loaded"><div class="markdown-embed-content"><div class="markdown-preview-view markdown-rendered">
<ul id="embed"><li>A bullet of an embedded note<ul><li>Its child</li></ul></li></ul>
</div></div></span></div>
<div>${callout('stretch', `<ul id="holding">
<li>A sentence holding a quote.
<blockquote><ul id="held"><li>A quoted bullet<ul><li>Its child</li></ul></li></ul></blockquote>
</li>
</ul>`)}</div>
<div>${callout('stretch', '<div class="html-block"><ul id="html"><li>An HTML item<ul><li>Its child</li></ul></li></ul></div>')}</div>
<div>${callout('stretch', '<div class="block-language-dataview"><ul id="query" class="dataview list-view-ul"><li>A query result<ul><li>Its child</li></ul></li></ul></div>')}</div>
</div></div>`

const page = (css: string, html: string): Document => new JSDOM(`<style>${css}</style>${html}`).window.document

/** The style rules that apply in a medium, in source order: the stylesheet's own and, for print,
 * those inside its print media rules. */
const rulesFor = (doc: Document, medium: 'screen' | 'print'): CSSStyleRule[] => {
  const view = doc.defaultView!
  return [...doc.querySelector('style')!.sheet!.cssRules].flatMap(rule =>
    rule instanceof view.CSSStyleRule ? [rule]
      : rule instanceof view.CSSMediaRule && medium === 'print' && rule.media.mediaText.includes('print')
        ? [...rule.cssRules].filter((inner): inner is CSSStyleRule => inner instanceof view.CSSStyleRule)
        : [])
}

/** The value the rules for a medium give a property of an element, from the last rule that sets
 * it, or '' where none does. Enough here, where the plugin's own rules do not compete on
 * specificity. */
const styled = (medium: 'screen' | 'print') => (el: Element, property: string): string =>
  rulesFor(el.ownerDocument, medium)
    .filter(rule => el.matches(rule.selectorText))
    .map(rule => rule.style.getPropertyValue(property))
    .filter(value => value !== '')
    .pop() ?? ''

const printed = styled('print')
const shown = styled('screen')

/** The priority, 'important' or '', of the rule `styled` takes a property's value from. */
const priority = (medium: 'screen' | 'print') => (el: Element, property: string): string =>
  rulesFor(el.ownerDocument, medium)
    .filter(rule => el.matches(rule.selectorText) && rule.style.getPropertyValue(property) !== '')
    .map(rule => rule.style.getPropertyPriority(property))
    .pop() ?? ''

const within = (doc: Document, id: string, selector: string): Element[] =>
  [...doc.getElementById(id)!.querySelectorAll(selector)]

/** The callout around an element, its content and its title. */
const parts = (el: Element): Element[] => {
  const box = el.closest('.callout')!
  return [box, box.querySelector(':scope > .callout-content')!, box.querySelector(':scope > .callout-title')!]
}

describe('styles on screen', () => {
  /** Reading view after the post-processor: a stretch callout whose list it drew as a paragraph,
   * one with nothing to draw, as in Live Preview, and another callout holding a paragraph. */
  const VIEW = `<div class="markdown-preview-view markdown-rendered"><div class="markdown-preview-sizer">
<div>${callout('stretch', '<p class="stretch" id="drawn">A sentence.</p>')}</div>
<div>${callout('stretch', '<ul id="undrawn"><li>A bullet</li></ul>')}</div>
<div>${callout('note', '<p class="stretch" id="other">A sentence.</p>')}</div>
</div></div>`

  it('reads a stretch callout the plugin has drawn as prose: its box goes and its title is hidden', () => {
    const doc = page(CSS, VIEW)
    const [box, content, title] = parts(doc.getElementById('drawn')!)
    expect(shown(box!, 'display')).toBe('contents')
    expect(shown(content!, 'display')).toBe('contents')
    expect(shown(title!, 'display')).toBe('none')
  })

  it('shows a folded stretch callout\'s content, which Obsidian hides with an inline style, since its hidden title cannot unfold it', () => {
    const doc = page(CSS, VIEW)
    const [, content] = parts(doc.getElementById('drawn')!)
    expect(priority('screen')(content!, 'display')).toBe('important')
  })

  it('keeps the box and title of a stretch callout with nothing drawn, and of other callouts', () => {
    const doc = page(CSS, VIEW)
    for (const id of ['undrawn', 'other']) {
      for (const el of parts(doc.getElementById(id)!)) expect(shown(el, 'display'), el.outerHTML).toBe('')
    }
  })
})

describe('styles in print', () => {
  it('prints a stretch callout as prose: its box goes and its title is hidden', () => {
    const doc = page(CSS, NOTE)
    for (const id of ['stretch', 'loose']) {
      const [box, content, title] = parts(doc.getElementById(id)!)
      expect(printed(box!, 'display')).toBe('contents')
      expect(printed(content!, 'display')).toBe('contents')
      expect(printed(title!, 'display')).toBe('none')
      // Folded, Obsidian hides the content with an inline style.
      expect(priority('print')(content!, 'display')).toBe('important')
    }
  })

  it('keeps the box and title of other callouts, of a stretch callout nested in one, and of one with no bullet list, as reading view does', () => {
    const doc = page(CSS, NOTE)
    for (const id of ['callout', 'nested', 'numbered', 'html']) {
      for (const el of parts(doc.getElementById(id)!)) expect(printed(el, 'display'), el.outerHTML).toBe('')
    }
  })

  it('prints a stretch list as one paragraph: every item and sublist runs inline, every level open', () => {
    const doc = page(CSS, NOTE)
    const flowing = within(doc, 'stretch', 'li, ul')
    expect(flowing).toHaveLength(6)
    for (const el of flowing) expect(printed(el, 'display'), el.outerHTML).toBe('inline')
    // Obsidian indents each item, and a theme may indent the lists; inline, an indent lands mid-line.
    for (const el of flowing) {
      expect(printed(el, 'margin'), el.outerHTML).toBe('0px')
      expect(printed(el, 'padding'), el.outerHTML).toBe('0px')
    }
  })

  it('keeps each list of a stretch callout a block of its own, as a paragraph is', () => {
    const doc = page(CSS, NOTE)
    for (const id of ['stretch', 'loose']) expect(printed(doc.getElementById(id)!, 'display')).toBe('')
  })

  it('keeps the paragraphs of a loose list in the line', () => {
    const doc = page(CSS, NOTE)
    const paragraphs = within(doc, 'loose', ':scope > li > p')
    expect(paragraphs).toHaveLength(3)
    for (const p of paragraphs) expect(printed(p, 'display')).toBe('inline')
  })

  it('puts a task checkbox in the line, where Obsidian hangs it in the indent the list no longer has', () => {
    const doc = page(CSS, NOTE)
    const boxes = within(doc, 'loose', '.task-list-item-checkbox')
    expect(boxes).toHaveLength(2)
    for (const box of boxes) expect(printed(box, 'margin-inline-start')).toBe('0px')
  })

  it('leaves as lists those outside a stretch callout, in a nested one, and numbered ones with any bullets under them', () => {
    const doc = page(CSS, NOTE)
    const kept = ['plain', 'callout', 'nested', 'quote', 'numbered', 'steps'].flatMap(id => [doc.getElementById(id)!, ...within(doc, id, 'li, ul')])
    expect(kept).toHaveLength(24)
    for (const el of kept) expect(printed(el, 'display'), el.outerHTML).toBe('')
  })

  it('leaves the lists of an embedded note to that note, whose sections reading view draws', () => {
    const doc = page(CSS, NOTE)
    const kept = [doc.getElementById('embed')!, ...within(doc, 'embed', 'li, ul')]
    expect(kept).toHaveLength(4)
    for (const el of kept) expect(printed(el, 'display'), el.outerHTML).toBe('')
  })

  it('leaves the lists that reading view leaves: in an HTML block, in a plugin\'s output, and in a block inside a sentence', () => {
    const doc = page(CSS, NOTE)
    const kept = ['html', 'query', 'held'].flatMap(id => [doc.getElementById(id)!, ...within(doc, id, 'li, ul')])
    expect(kept).toHaveLength(12)
    for (const el of kept) expect(printed(el, 'display'), el.outerHTML).toBe('')
    // The sentence holding the block still runs inline.
    expect(printed(doc.querySelector('#holding > li')!, 'display')).toBe('inline')
  })

  it('leaves a note without stretch callouts alone', () => {
    const doc = page(CSS, NOTE.split('data-callout="stretch"').join('data-callout="note"'))
    for (const el of doc.querySelectorAll('li, ul, p, .callout, .callout > *')) expect(printed(el, 'display')).toBe('')
  })
})
