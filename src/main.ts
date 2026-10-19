/** Obsidian wiring: a thin adapter. Reads the context, keeps open state, mounts each list. */
import { MarkdownRenderChild, Plugin } from 'obsidian'
import { lists, mount, unmount } from './dom'
import { listId, optsIn } from './note'
import { openState, type OpenState } from './state'

/** Post-processor sort order: later than anything that wants the list items. */
const LAST = 10_000

export default class StretchPlugin extends Plugin {
  /** Open state per list, for the session, shared by every view of the list. */
  private readonly states = new Map<string, OpenState>()

  override onload(): void {
    // Runs after other post-processors, so they still find the list items they look for.
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (!optsIn(ctx.frontmatter)) return
      const lineStart = ctx.getSectionInfo(el)?.lineStart ?? null
      lists(el).forEach((list, index) => {
        const paragraph = mount(list, this.stateFor(listId(ctx.sourcePath, lineStart, index, list.textContent ?? '')))
        ctx.addChild(new Mounted(paragraph))
      })
    }, LAST)
  }

  private stateFor(id: string): OpenState {
    const made = this.states.get(id)
    if (made !== undefined) return made
    const state = openState()
    this.states.set(id, state)
    return state
  }
}

/** Ties a paragraph's life to its rendering: Obsidian unloads it when the rendering is discarded. */
class Mounted extends MarkdownRenderChild {
  override onunload(): void {
    unmount(this.containerEl)
  }
}
