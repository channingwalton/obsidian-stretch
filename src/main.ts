/** Obsidian wiring: a thin adapter. Reads the context, keeps open state, mounts each list. */
import { Plugin } from 'obsidian'
import { lists, mount, type OpenState } from './dom'
import { listId, optsIn } from './note'
import type { Open } from './stretch'

/** Post-processor sort order: later than anything that wants the list items. */
const LAST = 10_000

export default class StretchPlugin extends Plugin {
  /** Open keys per list, for the session. */
  private readonly open = new Map<string, Open>()

  override onload(): void {
    // Runs after other post-processors, so they still find the list items they look for.
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (!optsIn(ctx.frontmatter)) return
      const lineStart = ctx.getSectionInfo(el)?.lineStart ?? null
      lists(el).forEach((list, index) =>
        mount(list, this.stateFor(listId(ctx.sourcePath, lineStart, index, list.textContent ?? ''))),
      )
    }, LAST)
  }

  private stateFor(id: string): OpenState {
    return {
      get: () => this.open.get(id) ?? new Set(),
      set: open => this.open.set(id, open),
    }
  }
}
