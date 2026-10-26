// Draws curved lines between Map nodes; hover lights them up.
// Measures the laid-out page, so it runs after rendering.

/** Lowest point a line meets a node, from its top. */
const ANCHOR_LIMIT = 17;



/**
 * Finds where a line meets one side of a node.
 *
 * Purpose: Meet a node's header, or one row inside it.
 *
 * @param element Node element.
 * @param box Graph bounding box.
 * @param side Which edge to use: left or right.
 * @param row Optional row inside the node to meet.
 * @returns Point relative to the graph.
 */
function anchor(element, box, side, row = null) {
  // Expanded nodes anchor at the row, or near their top.
  const rect = element.getBoundingClientRect();
  const target = row?.getBoundingClientRect();
  const y = target ? target.top + target.height / 2 : rect.top + Math.min(rect.height / 2, ANCHOR_LIMIT);
  return { x: rect[side] - box.left, y: y - box.top };
}



/**
 * Builds one SVG path between two nodes.
 *
 * Purpose: Curve into the exact part, from either side.
 *
 * @param graph Graph element holding the nodes.
 * @param box Graph bounding box.
 * @param edge Line with from and to keys.
 * @returns SVG path markup, empty when a node is missing.
 */
function edgePath(graph, box, edge) {
  // Both ends must be on screen.
  const from = graph.querySelector(`[data-key="${edge.from}"]`);
  const to = graph.querySelector(`[data-key="${edge.to}"]`);
  if (!from || !to) return "";
  const rightward = edge.kind !== "question";
  const a = anchor(from, box, rightward ? "right" : "left");
  const b = anchor(to, box, rightward ? "left" : "right", to.querySelector(`[data-anchor="${edge.exact}"]`));
  const bend = (rightward ? 1 : -1) * Math.max(30, Math.abs(b.x - a.x) / 2);
  return `<path class="edge ${edge.kind}${edge.folded ? " folded" : ""}" data-from="${edge.from}" data-to="${edge.to}" d="M${a.x},${a.y} C${a.x + bend},${a.y} ${b.x - bend},${b.y} ${b.x},${b.y}"/>`;
}



/**
 * Draws every line into the graph's SVG layer.
 *
 * Purpose: Connect decisions and questions to their work.
 *
 * @param graph Graph element with an svg.map-edges child.
 * @param edges Lines from the view model.
 * @returns No value.
 */
export function drawEdges(graph, edges) {
  // The SVG covers the graph; coordinates are graph-relative.
  const svg = graph.querySelector(".map-edges");
  const box = graph.getBoundingClientRect();
  svg.setAttribute("width", box.width);
  svg.setAttribute("height", box.height);
  svg.innerHTML = edges.map((edge) => edgePath(graph, box, edge)).join("");
  if (graph.dataset.hover) highlight(graph, edges, graph.dataset.hover, graph.dataset.alone === "yes");
}



/**
 * Lights one node, its neighbors, and their lines.
 *
 * Purpose: Answer "what does this decision affect?" on hover.
 *
 * @param graph Graph element.
 * @param edges Lines from the view model.
 * @param key Hovered node key, or null to clear.
 * @param alone Whether a node without lines lights too.
 * @returns No value.
 */
function highlight(graph, edges, key, alone = false) {
  // Everything else dims while something is lit.
  const touching = key ? edges.filter((edge) => edge.from === key || edge.to === key) : [];
  const lit = new Set(touching.flatMap((edge) => [edge.from, edge.to]));
  if (key && alone) lit.add(key);
  const nodes = [...graph.querySelectorAll("[data-key]")];
  graph.classList.toggle("focused", nodes.some((node) => lit.has(node.dataset.key)));
  for (const node of nodes) node.classList.toggle("lit", lit.has(node.dataset.key));
  for (const path of graph.querySelectorAll(".edge")) path.classList.toggle("lit", path.dataset.from === key || path.dataset.to === key);
}



/**
 * Lights connections while the pointer rests on a node.
 *
 * Purpose: Make many-to-many links readable without clutter.
 *
 * @param graph Graph element.
 * @param edges Lines from the view model.
 * @param source Hovered element, such as Today; default: the graph.
 * @returns No value.
 */
export function wireHighlight(graph, edges, source = graph) {
  // Outside hovers, such as Today, light lone nodes too.
  const alone = source !== graph;
  source.onmouseover = (event) => {
    // The nearest keyed ancestor is the hovered node.
    const key = event.target.closest("[data-key]")?.dataset.key ?? "";
    if (key === (graph.dataset.hover ?? "")) return;

    // Remember it, so redrawn lines keep the highlight.
    Object.assign(graph.dataset, { hover: key, alone: alone ? "yes" : "" });
    highlight(graph, edges, key || null, alone);
  };
  source.onmouseleave = () => {
    // Leaving the hovered area clears every highlight.
    graph.dataset.hover = "";
    highlight(graph, edges, null);
  };
}
