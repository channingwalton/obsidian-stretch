/**
 * The core of stretchtext over an outline: which nodes are shown, in what order, given which
 * ones the reader has opened. Pure; the content type is whatever the adapter renders.
 */

export interface Node<T> {
  content: T
  children: Node<T>[]
}

/** A node's position in the tree: indices from the root joined by dots, such as "0.2.1". */
export type Key = string

export type Open = ReadonlySet<Key>

/** The key of the node a key is beneath: "0.2" for "0.2.1". A top-level key has none. */
export const parentKey = (key: Key): Key | undefined =>
  key.includes('.') ? key.slice(0, key.lastIndexOf('.')) : undefined

export interface Segment<T> {
  key: Key
  content: T
  depth: number
  hasChildren: boolean
  open: boolean
}

/** The segments to show, in reading order: every top-level node, and the children of each open one. */
export function layout<T>(tree: Node<T>[], open: Open): Segment<T>[] {
  const out: Segment<T>[] = []
  const walk = (nodes: Node<T>[], prefix: Key, depth: number) => {
    nodes.forEach((node, i) => {
      const key = prefix === '' ? `${i}` : `${prefix}.${i}`
      const hasChildren = node.children.length > 0
      const isOpen = hasChildren && open.has(key)
      out.push({ key, content: node.content, depth, hasChildren, open: isOpen })
      if (isOpen) walk(node.children, key, depth + 1)
    })
  }
  walk(tree, '', 0)
  return out
}

/** Opens a closed key; closes an open one along with every key beneath it. */
export function toggle(open: Open, key: Key): Open {
  const next = new Set(open)
  if (!next.has(key)) {
    next.add(key)
    return next
  }
  for (const k of next) if (k === key || k.startsWith(`${key}.`)) next.delete(k)
  return next
}
