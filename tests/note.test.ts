import { describe, expect, it } from 'vitest'
import { canOptIn, listId, optIn, optsIn } from '../src/note'

describe('optsIn', () => {
  it('accepts stretch in a cssclasses list', () => {
    expect(optsIn({ cssclasses: ['wide', 'stretch'] })).toBe(true)
  })
  it('accepts stretch in a space-separated cssclasses string', () => {
    expect(optsIn({ cssclasses: 'wide stretch' })).toBe(true)
  })
  it('rejects stretch joined to another class by a comma, which Obsidian reads as one class', () => {
    expect(optsIn({ cssclasses: 'wide,stretch' })).toBe(false)
  })
  it('accepts the older cssclass key', () => {
    expect(optsIn({ cssclass: 'stretch' })).toBe(true)
  })
  it('rejects notes without the class, without frontmatter, and with a different class', () => {
    expect(optsIn({ cssclasses: ['stretchy'] })).toBe(false)
    expect(optsIn(undefined)).toBe(false)
    expect(optsIn(null)).toBe(false)
    expect(optsIn({})).toBe(false)
    expect(optsIn({ cssclasses: 42 })).toBe(false)
  })
})

describe('optIn', () => {
  const optedIn = (frontmatter: Record<string, unknown>): Record<string, unknown> => {
    optIn(frontmatter)
    return frontmatter
  }

  it('adds a cssclasses list to a note without one', () => {
    expect(optedIn({})).toEqual({ cssclasses: ['stretch'] })
    expect(optedIn({ cssclasses: null })).toEqual({ cssclasses: ['stretch'] })
  })
  it('keeps the classes and the other properties already there', () => {
    expect(optedIn({ title: 'Notes', cssclasses: ['wide'] })).toEqual({ title: 'Notes', cssclasses: ['wide', 'stretch'] })
  })
  it('turns a space-separated cssclasses string into a list', () => {
    expect(optedIn({ cssclasses: 'wide  narrow' })).toEqual({ cssclasses: ['wide', 'narrow', 'stretch'] })
    expect(optedIn({ cssclasses: '' })).toEqual({ cssclasses: ['stretch'] })
  })
  it('turns a comma-separated cssclasses string into a list', () => {
    expect(optedIn({ cssclasses: 'wide, narrow' })).toEqual({ cssclasses: ['wide', 'narrow', 'stretch'] })
    expect(optedIn({ cssclasses: 'wide,stretch' })).toEqual({ cssclasses: ['wide', 'stretch'] })
  })
  it('tells whether it changed the frontmatter', () => {
    expect(optIn({ cssclasses: ['wide'] })).toBe(true)
    expect(optIn({ cssclasses: ['stretch'] })).toBe(false)
  })
  it('keeps a cssclasses value that is neither a list nor a string', () => {
    expect(optedIn({ cssclasses: 42 })).toEqual({ cssclasses: [42, 'stretch'] })
  })
  it('leaves a note that already opts in alone', () => {
    expect(optedIn({ cssclasses: ['stretch', 'wide'] })).toEqual({ cssclasses: ['stretch', 'wide'] })
    expect(optedIn({ cssclass: 'stretch' })).toEqual({ cssclass: 'stretch' })
  })
  it('makes a note opt in', () => {
    for (const frontmatter of [{}, { cssclasses: 'wide' }, { cssclasses: ['wide'] }, { cssclass: 'wide' }]) {
      expect(optsIn(optedIn(frontmatter))).toBe(true)
    }
  })
})

describe('canOptIn', () => {
  it('offers a Markdown note that does not opt in yet', () => {
    expect(canOptIn('md', undefined)).toBe(true)
    expect(canOptIn('md', { cssclasses: ['wide'] })).toBe(true)
  })
  it('does not offer a note that already opts in', () => {
    expect(canOptIn('md', { cssclasses: ['stretch'] })).toBe(false)
  })
  it('does not offer other files', () => {
    expect(canOptIn('canvas', undefined)).toBe(false)
    expect(canOptIn('pdf', undefined)).toBe(false)
  })
})

describe('listId', () => {
  it('tells lists apart by note, section line and position within the section', () => {
    expect(listId('a.md', 3, 0)).not.toBe(listId('a.md', 3, 1))
    expect(listId('a.md', 3, 0)).not.toBe(listId('b.md', 3, 0))
    expect(listId('a.md', 3, 0)).not.toBe(listId('a.md', 9, 0))
  })
  it('falls back to the list text when the section line is unknown', () => {
    expect(listId('a.md', null, 0, 'one list')).not.toBe(listId('a.md', null, 0, 'another list'))
    expect(listId('a.md', null, 0, 'one list')).toBe(listId('a.md', null, 0, 'one list'))
    expect(listId('a.md', null, 0)).not.toBe(listId('a.md', null, 1))
  })
})
