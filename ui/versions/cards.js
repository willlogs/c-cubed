// Draws one version card: goal, stage, track, issues, and PRs.
// Pure rendering; render.js lays the cards out.

import { escapeHtml } from "../panels.js";

/** Group headings in card order. */
const GROUPS = [["decisions", "Decisions"], ["research", "Research"], ["work", "Work"]];



/**
 * Draws the decide → live track.
 *
 * Purpose: Show at a glance how far a version got.
 *
 * @param track Steps from the server's trackOf.
 * @returns HTML list.
 */
function trackHtml(track) {
  // Skipped steps stay off; issue steps show counts.
  const steps = track.filter((step) => step.state !== "skip").map((step) => {
    const counts = step.total ? ` <span class="count">${step.done}/${step.total}</span>` : "";
    return `<li class="${step.state}">${escapeHtml(step.label)}${counts}</li>`;
  });
  return `<ol class="version-track">${steps.join("")}</ol>`;
}



/**
 * Draws one group of a version's issues.
 *
 * Purpose: List decisions, research, or work by priority.
 *
 * @param label Group heading.
 * @param items Items of the group.
 * @returns HTML details element, or nothing when empty.
 */
function groupHtml(label, items) {
  // Folded; open while the group still has open issues.
  if (!items.length) return "";
  const done = items.filter((item) => !item.open).length;
  const rows = items.map((item) => `<li class="${item.open ? "open" : "closed"}"><a href="${escapeHtml(item.url)}" target="_blank">#${item.number}</a>
    ${item.priority ? `<span class="tag">${item.priority}</span>` : ""}${item.type ? `<span class="tag">${item.type}</span>` : ""} ${escapeHtml(item.title)}</li>`);
  return `<details${done < items.length ? " open" : ""}><summary>${label} <span class="count">${done}/${items.length}</span></summary><ul>${rows.join("")}</ul></details>`;
}



/**
 * Draws links to a version's release and promotion PRs.
 *
 * Purpose: Reach each release step's PR in one click.
 *
 * @param version Version with release and promotion.
 * @returns HTML paragraph, or nothing before release.
 */
function prsHtml(version) {
  // Only PRs that exist get a link.
  const links = [["Release PR", version.release], ["Promotion PR", version.promotion]].filter(([, pr]) => pr)
    .map(([label, pr]) => `<a href="${escapeHtml(pr.url)}" target="_blank">${label} #${pr.number}</a> ${pr.state.toLowerCase()}`);
  return links.length ? `<p class="version-prs">${links.join(" · ")}</p>` : "";
}



/**
 * Draws one open version's card.
 *
 * Purpose: Everything the owner needs about a version, together.
 *
 * @param version Described version from /api/versions.
 * @returns HTML article.
 */
export function openCardHtml(version) {
  // Head, why, track, next step, issues, PRs.
  const about = version.about ? `<p class="about">${escapeHtml(version.about)}</p>` : "";
  const groups = GROUPS.map(([key, label]) => groupHtml(label, version.groups[key])).join("");
  return `<article class="version-card stage-${version.stage}">
    <div class="version-head"><a href="${escapeHtml(version.url)}" target="_blank">${escapeHtml(version.title)}</a><span class="stage">${escapeHtml(version.stageLabel)}</span></div>
    ${about}${trackHtml(version.track)}<p class="next">Next: ${escapeHtml(version.next)}</p>
    <div class="version-groups">${groups}</div>${prsHtml(version)}</article>`;
}



/**
 * Draws one shipped version with its changelog section.
 *
 * Purpose: Read the trail newest first.
 *
 * @param version Shipped version with its notes.
 * @returns HTML article.
 */
export function shippedCardHtml(version) {
  // Release notes live on GitHub under the version's tag.
  const release = version.url.replace(/\/milestone\/\d+$/, `/releases/tag/v${version.number}`);
  const notes = version.notes ? `<details><summary>Changelog</summary><pre class="notes">${escapeHtml(version.notes)}</pre></details>` : "";
  return `<article class="version-card shipped">
    <div class="version-head"><a href="${escapeHtml(release)}" target="_blank">${escapeHtml(version.title)}</a><span class="stage">${escapeHtml(version.next)}</span></div>${notes}</article>`;
}
