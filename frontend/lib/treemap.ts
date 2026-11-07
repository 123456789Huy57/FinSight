// Squarified treemap (Bruls, Huizing & van Wijk, 2000).
// Pure function: takes weighted items and a rectangle, returns one rectangle per item.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Placed<T> = Rect & { item: T };

interface Node<T> {
  item: T;
  area: number;
}

function worst<T>(row: Node<T>[], side: number): number {
  if (row.length === 0) return Infinity;
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const n of row) {
    sum += n.area;
    if (n.area > max) max = n.area;
    if (n.area < min) min = n.area;
  }
  const s2 = sum * sum;
  const side2 = side * side;
  return Math.max((side2 * max) / s2, s2 / (side2 * min));
}

function layoutRow<T>(row: Node<T>[], r: Rect, out: Placed<T>[]): Rect {
  const sum = row.reduce((s, n) => s + n.area, 0);
  if (r.w >= r.h) {
    // Column on the left edge
    const colW = sum / r.h;
    let y = r.y;
    for (const n of row) {
      const h = n.area / colW;
      out.push({ x: r.x, y, w: colW, h, item: n.item });
      y += h;
    }
    return { x: r.x + colW, y: r.y, w: r.w - colW, h: r.h };
  }
  // Row on the top edge
  const rowH = sum / r.w;
  let x = r.x;
  for (const n of row) {
    const w = n.area / rowH;
    out.push({ x, y: r.y, w, h: rowH, item: n.item });
    x += w;
  }
  return { x: r.x, y: r.y + rowH, w: r.w, h: r.h - rowH };
}

export function squarify<T>(items: T[], value: (t: T) => number, rect: Rect): Placed<T>[] {
  const total = items.reduce((s, i) => s + Math.max(0, value(i)), 0);
  if (!total || rect.w <= 0 || rect.h <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  const nodes: Node<T>[] = items
    .map((item) => ({ item, area: Math.max(0, value(item)) * scale }))
    .filter((n) => n.area > 0)
    .sort((a, b) => b.area - a.area);

  const out: Placed<T>[] = [];
  let r = { ...rect };
  let row: Node<T>[] = [];
  let i = 0;
  while (i < nodes.length) {
    const side = Math.min(r.w, r.h);
    const next = nodes[i];
    if (row.length === 0 || worst([...row, next], side) <= worst(row, side)) {
      row.push(next);
      i++;
    } else {
      r = layoutRow(row, r, out);
      row = [];
    }
  }
  if (row.length) layoutRow(row, r, out);
  return out;
}
