// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

/** The plugin's stylesheet. Export to PDF copies it into the window it prints from. */
const CSS = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')

/** A stretch note as Export to PDF renders it: each block in its own div, with no bullets or fold
 * indicators. The post-processor draws no paragraphs there, so the lists arrive as lists. */
const NOTE = `
<div class="print"><div class="markdown-preview-view markdown-rendered stretch">
<div><ul id="stretch">
<li>The build fails on a stale cache.
<ul>
<li>The CI cache is keyed only by <code>package.json</code>.
<ul><li>About one run in five hits it.</li></ul>
</li>
</ul>
</li>
<li>The fix is to key the cache on the lockfile.</li>
</ul></div>
<div><ul id="loose">
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
</ul></div>
<div><div class="callout"><div class="callout-content"><ul id="callout"><li>A callout bullet<ul><li>Its child</li></ul></li></ul></div></div></div>
<div><blockquote><ul id="quote"><li>A quote bullet<ul><li>Its child</li></ul></li></ul></blockquote></div>
<div><ol id="numbered"><li>A numbered item<ul><li>A bullet under it</li></ul></li></ol></div>
<div><span class="internal-embed markdown-embed inline-embed is-loaded"><div class="markdown-embed-content"><div class="markdown-preview-view markdown-rendered">
<ul id="embed"><li>A bullet of a note without the class<ul><li>Its child</li></ul></li></ul>
</div></div></span></div>
<div><ul id="holding">
<li>A sentence holding a quote.
<blockquote><ul id="held"><li>A quoted bullet<ul><li>Its child</li></ul></li></ul></blockquote>
</li>
</ul></div>
<div><div class="html-block"><ul id="html"><li>An HTML item<ul><li>Its child</li></ul></li></ul></div></div>
<div><div class="block-language-dataview"><ul id="query" class="dataview list-view-ul"><li>A query result<ul><li>Its child</li></ul></li></ul></div></div>
</div></div>`

const page = (css: string, html: string): Document => new JSDOM(`<style>${css}</style>${html}`).window.document

/** The style rules inside the stylesheet's print media rules. */
const printRules = (doc: Document): CSSStyleRule[] =>
  [...doc.querySelector('style')!.sheet!.cssRules]
    .filter((rule): rule is CSSMediaRule => rule instanceof doc.defaultView!.CSSMediaRule && rule.media.mediaText.includes('print'))
    .flatMap(rule => [...rule.cssRules])
    .filter((rule): rule is CSSStyleRule => rule instanceof doc.defaultView!.CSSStyleRule)

/** The value the print rules give a property of an element, from the last rule that sets it, or ''
 * where none does. Enough here, where the plugin's own rules do not compete on specificity. */
const printed = (el: Element, property: string): string =>
  printRules(el.ownerDocument)
    .filter(rule => el.matches(rule.selectorText))
    .map(rule => rule.style.getPropertyValue(property))
    .filter(value => value !== '')
    .pop() ?? ''

const within = (doc: Document, id: string, selector: string): Element[] =>
  [...doc.getElementById(id)!.querySelectorAll(selector)]

describe('styles in print', () => {
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

  it('keeps each top-level list a block of its own, as a paragraph is', () => {
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

  it('leaves lists in callouts and quotes, and numbered lists with any bullets under them, as lists', () => {
    const doc = page(CSS, NOTE)
    const kept = ['callout', 'quote', 'numbered', 'steps'].flatMap(id => [doc.getElementById(id)!, ...within(doc, id, 'li, ul')])
    expect(kept).toHaveLength(16)
    for (const el of kept) expect(printed(el, 'display'), el.outerHTML).toBe('')
  })

  it('leaves the lists of an embedded note to that note, which reading view draws by its own class', () => {
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

  it('leaves the lists of a note without the class alone', () => {
    const doc = page(CSS, NOTE.replace('markdown-rendered stretch', 'markdown-rendered'))
    for (const el of doc.querySelectorAll('li, ul, p')) expect(printed(el, 'display')).toBe('')
  })
})
