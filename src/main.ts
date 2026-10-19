/** Obsidian wiring: a thin adapter. Reads the context, keeps open state, mounts each list, and
 * offers to make a note stretchable from the file menu. */
import { MarkdownRenderChild, MarkdownView, Notice, Plugin, TFile } from 'obsidian'
import { lists, mount, unmount } from './dom'
import { canOptIn, listId, optIn, optsIn } from './note'
import { openState, type OpenState } from './state'

/** Post-processor sort order: later than anything that wants the list items. */
const LAST = 10_000

export default class StretchPlugin extends Plugin {
  /** Open state per list, for the session, shared by every view of the list. */
  private readonly states = new Map<string, OpenState>()
  /** Notes just made stretchable, whose views redraw once Obsidian has read the new frontmatter. */
  private readonly optingIn = new Set<TFile>()

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

    // The file menu: a note tab's, the file explorer's and the view's own.
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile) || !canOptIn(file.extension, this.app.metadataCache.getFileCache(file)?.frontmatter)) return
      menu.addItem(item => item
        .setTitle('Make stretchable')
        .setIcon('unfold-vertical')
        .onClick(() => this.makeStretchable(file)))
    }))

    // Open views load a note's new text before the metadata cache reports the change. An earlier
    // change, still without the class, must not take the redraw.
    this.registerEvent(this.app.metadataCache.on('changed', (file, _data, cache) => {
      if (optsIn(cache.frontmatter) && this.optingIn.delete(file)) this.rerender(file)
    }))
  }

  private async makeStretchable(file: TFile): Promise<void> {
    // Added before the write, which the metadata cache may report before it resolves.
    this.optingIn.add(file)
    let changed = false
    try {
      await this.app.fileManager.processFrontMatter(file, frontmatter => {
        changed = optIn(frontmatter)
      })
    } catch (error) {
      changed = false
      new Notice(`Stretch could not change the frontmatter: ${String(error)}`)
    }
    // No change, no report to wait for.
    if (!changed) this.optingIn.delete(file)
  }

  /** Obsidian keeps a section's rendering while its text is unchanged, so the lists of a note
   * that has just opted in would stay outlines until it is reopened. */
  private rerender(file: TFile): void {
    this.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
      if (leaf.view instanceof MarkdownView && leaf.view.file === file) leaf.view.previewMode.rerender(true)
    })
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
