// Tests the template engine's values, blocks, and blank-line handling.
// Templates must render exactly, or rules read wrong.

import assert from "node:assert/strict";
import test from "node:test";
import { isTemplate, isTrue, renderText } from "./engine.mjs";



test("substitutes values and empties unknown names", () => {
  // Spaces inside braces are allowed.
  assert.equal(renderText("{{owner}} owns {{ project }}{{missing}}.", { owner: "Will", project: "Acme" }), "Will owns Acme.");
});



test("renders if and unless blocks by truthiness", () => {
  // Empty strings and false hide if blocks.
  const text = "{{#if production}}ship to {{production}}{{/if}}{{#unless production}}no production{{/unless}}";
  assert.equal(renderText(text, { production: "production" }), "ship to production");
  assert.equal(renderText(text, { production: "" }), "no production");
});



test("standalone block tags leave no blank lines", () => {
  // Tag lines vanish whether the block renders or not.
  const text = "a\n{{#if on}}\nb\n{{/if}}\n{{#unless on}}\nc\n{{/unless}}\nd\n";
  assert.equal(renderText(text, { on: true }), "a\nb\nd\n");
  assert.equal(renderText(text, { on: false }), "a\nc\nd\n");
});



test("different block kinds nest", () => {
  // An unless inside an if, and the reverse.
  assert.equal(renderText("{{#if a}}x{{#unless b}}y{{/unless}}{{/if}}", { a: true, b: false }), "xy");
  assert.equal(renderText("{{#unless a}}x{{#if b}}y{{/if}}{{/unless}}", { a: false, b: true }), "xy");
});



test("truthiness and template detection", () => {
  // Empty arrays are false; only Markdown renders.
  assert.equal(isTrue([]), false);
  assert.equal(isTrue(["apps/server"]), true);
  assert.equal(isTemplate("SKILL.md"), true);
  assert.equal(isTemplate("check.py"), false);
});
