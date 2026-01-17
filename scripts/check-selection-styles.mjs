#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const files = args.length
  ? args
  : execSync("rg --files -g '*.css' src", { encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

const blockRe = /([^{}]+)\{([^}]*)\}/g;
const ruleRe = /\b(color|background(?:-color)?)\s*:\s*([^;]+);/g;
const hardColorRe = /#|\brgb\(|\brgba\(|\bwhite\b|\bblack\b/i;
const allowedBgTokens = [/var\(--accent-bg\)/];
const allowedColorTokens = [/var\(--accent-primary\)/, /inherit\b/i, /currentColor\b/i];

const selectionSelectorRe = /\.(selected|active)\b/;
const enforceSelectorRe = /\.(trigger-menu|menu|popup|picker|dropdown)\b/;

const violations = [];

function shouldEnforce(selector) {
  return selectionSelectorRe.test(selector) && enforceSelectorRe.test(selector);
}

function isAllowedValue(property, value) {
  const tokens = property.startsWith("background") ? allowedBgTokens : allowedColorTokens;
  return tokens.some((re) => re.test(value));
}

for (const file of files) {
  const content = readFileSync(file, "utf8");
  let match;

  while ((match = blockRe.exec(content)) !== null) {
    const selector = match[1].trim();
    const body = match[2];
    if (!shouldEnforce(selector)) continue;

    let ruleMatch;
    while ((ruleMatch = ruleRe.exec(body)) !== null) {
      const property = ruleMatch[1];
      const value = ruleMatch[2].trim();

      if (!isAllowedValue(property, value) && hardColorRe.test(value)) {
        violations.push({ file, selector, property, value });
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Selection style violations (use --accent-bg / --accent-primary):");
  for (const v of violations) {
    console.error(`- ${v.file}: ${v.selector} -> ${v.property}: ${v.value}`);
  }
  process.exit(1);
}

console.log("Selection style check passed.");
