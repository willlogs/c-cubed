// Packs decision bubbles into one day's band without overlaps.
// Biggest first, spiraling out from the band's center.

/** Space kept between neighboring bubbles, in pixels. */
const GAP = 2;



/**
 * Tells whether a circle fits at a spot.
 *
 * Purpose: Keep bubbles inside the band and apart.
 *
 * @param x Candidate center x.
 * @param y Candidate center y.
 * @param r Radius, ring included.
 * @param placed Circles already placed.
 * @param box Band width and height.
 * @returns True when nothing overlaps.
 */
function fits(x, y, r, placed, box) {
  // Inside the band first, then clear of neighbors.
  if (x - r < 1 || y - r < 1 || x + r > box.width - 1 || y + r > box.height - 1) return false;
  return placed.every((other) => Math.hypot(other.x - x, other.y - y) >= r + other.r + GAP);
}



/**
 * Finds the free spot nearest the band's center.
 *
 * Purpose: Big bubbles sit central; small ones fill around.
 *
 * @param r Radius, ring included.
 * @param placed Circles already placed.
 * @param box Band width and height.
 * @returns Center, or null when the band is full.
 */
function findSpot(r, placed, box) {
  // Archimedean spiral, stretched to the band's shape.
  const stretch = box.width / box.height;
  for (let turn = 0; turn < 160; turn += 0.2) {
    const x = box.width / 2 + 1.1 * turn * Math.cos(turn) * stretch;
    const y = box.height / 2 + 1.1 * turn * Math.sin(turn);
    if (fits(x, y, r, placed, box)) return { x, y };
  }
  return null;
}



/**
 * Packs bubbles into a band.
 *
 * Purpose: Lay out one day's decisions.
 *
 * @param bubbles Bubbles with r, biggest first.
 * @param box Band width and height.
 * @returns Placed bubbles, and how many did not fit.
 */
export function packBand(bubbles, box) {
  // Bubbles that cannot fit are counted, not drawn.
  const placed = [];
  let hidden = 0;
  for (const bubble of bubbles) {
    const spot = findSpot(bubble.r, placed, box);
    if (spot) placed.push({ ...bubble, ...spot });
    else hidden += 1;
  }
  return { placed, hidden };
}



/**
 * Picks a band height that fits the busiest day.
 *
 * Purpose: Every day shares one height, sized to need.
 *
 * @param days Each day's bubbles with r.
 * @param width Band width.
 * @returns Height in pixels.
 */
export function bandHeight(days, width) {
  // Circles fill about half of the space they need.
  const need = Math.max(0, ...days.map((bubbles) => bubbles.reduce((sum, bubble) => sum + Math.PI * (bubble.r + GAP) ** 2, 0)));
  return Math.round(Math.min(420, Math.max(140, need / (width * 0.5))));
}
