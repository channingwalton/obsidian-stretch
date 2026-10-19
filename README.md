# Stretch

Stretchtext for Obsidian. A nested bullet list reads as a paragraph in reading view. Top-level
bullets are what you see first. Click a sentence that can open, or the `»` after it, and its
children appear after it, in place; click `«` to close them again. Each click opens one level.
The marks are buttons, so Tab reaches them and Enter or Space works them.

![A note in reading view: clicking an underlined sentence opens its children after it, in place](docs/stretch.gif)

The idea is Ted Nelson's (1967). The markup is just an outline, so a note stays an ordinary nested
list everywhere else, including Live Preview.

## Use

Add the class to a note's frontmatter:

```yaml
---
cssclasses:
  - stretch
---
```

Then write nested bullets where every bullet is a sentence that stands on its own:

```markdown
- The build fails on a stale cache.
	- The CI cache is keyed only by `package.json`, so a lockfile change leaves it stale.
		- About one run in five hits it.
- The fix is to key the cache on the lockfile.
```

In reading view that renders as "The build fails on a stale cache. The fix is to key the cache on
the lockfile." with the first sentence underlined. Click it and the second level opens after it.

What the reader has opened is remembered for the session, per note, not saved. It is kept by the
list's position in the note, so editing the list while reading it may move or drop what was open.

## Limits

- Reading view only. Live Preview shows the outline as usual.
- Only top-level lists of a note are drawn as stretchtext. Lists inside callouts and quotes are left alone.
- A task checkbox in a stretch list shows its state but cannot be ticked there; Obsidian's handler
  needs the list item the plugin replaced.
- Bullets are meant to hold sentences. A numbered sublist stays inside its sentence, unopened. A
  code block, table or quote inside a bullet is kept but breaks the paragraph's flow.

## Develop

```
npm test             # vitest: the core and the DOM adapter, under jsdom
npm run typecheck
npm run build        # main.js
npm run install:vault   # copy into ~/Documents/Notes/.obsidian/plugins/stretch (or $VAULT)
```

`src/stretch.ts` is the core: which nodes show, given what is open. `src/dom.ts` reads Obsidian's
rendered list and draws the paragraph. `src/main.ts` is the Obsidian plugin, kept thin.
