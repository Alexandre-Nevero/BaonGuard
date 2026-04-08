/**
 * fix_checks.test.js
 * Verifies all 7 bugs from the BaonGuard bugfix spec are resolved.
 * Run with: node --test src/tests/fix_checks.test.js
 */

import { strict as assert } from "assert";
import { test } from "node:test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

// ── 15.1: src/main.jsx exists ─────────────────────────────────────────────────
test("15.1 src/main.jsx exists", () => {
  const mainJsx = path.join(root, "src", "main.jsx");
  assert.ok(fs.existsSync(mainJsx), "src/main.jsx must exist");
  const content = fs.readFileSync(mainJsx, "utf8");
  assert.ok(content.includes("ReactDOM"), "main.jsx must import ReactDOM");
  assert.ok(content.includes("App"), "main.jsx must reference App");
  assert.ok(content.includes("createRoot"), "main.jsx must use createRoot");
});

// ── 15.2: package.json has buffer dependency ──────────────────────────────────
test("15.2 buffer polyfill is in package.json dependencies", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(pkg.dependencies?.buffer, "package.json must have 'buffer' in dependencies");
});

// ── 15.3: .env has VITE_CONTRACT_ID in KEY=VALUE format ──────────────────────
test("15.3 .env has VITE_CONTRACT_ID in KEY=VALUE format", () => {
  const envPath = path.join(root, ".env");
  assert.ok(fs.existsSync(envPath), ".env must exist");
  const content = fs.readFileSync(envPath, "utf8");
  assert.ok(
    /^VITE_CONTRACT_ID=\S+/m.test(content),
    ".env must contain VITE_CONTRACT_ID=<value>"
  );
  // Must NOT be just a raw address with no key
  assert.ok(
    !content.trim().startsWith("CBKFO3") || content.includes("VITE_CONTRACT_ID="),
    ".env must not be a raw address without a key name"
  );
});

// ── 15.4: backend/main.py exists (FastAPI proxy) ─────────────────────────────
test("15.4 backend/main.py exists (FastAPI proxy eliminates CORS)", () => {
  const mainPy = path.join(root, "backend", "main.py");
  assert.ok(fs.existsSync(mainPy), "backend/main.py must exist");
  const content = fs.readFileSync(mainPy, "utf8");
  assert.ok(content.includes("CORSMiddleware"), "main.py must configure CORSMiddleware");
  assert.ok(content.includes("/vault-info"), "main.py must define GET /vault-info");
});

// ── 15.5: api.js sends amount as Number, not BigInt ──────────────────────────
test("15.5 api.js sends amount as Number (not BigInt) — fixes Bug 1.5", () => {
  const apiJs = path.join(root, "src", "api.js");
  assert.ok(fs.existsSync(apiJs), "src/api.js must exist");
  const content = fs.readFileSync(apiJs, "utf8");
  assert.ok(content.includes("Number(amount)"), "api.js must cast amount to Number");
  // Strip comments before checking for BigInt usage
  const codeOnly = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  assert.ok(!codeOnly.includes("BigInt"), "api.js must not use BigInt in code");
});

// ── 15.6: No AI/ML references remain ─────────────────────────────────────────
test("15.6 No spendClassifier or healthGrader references in src/", () => {
  const srcDir = path.join(root, "src");
  // Exclude test/exploration files — they reference the bug to confirm it existed
  const excluded = new Set(["test_bug_exploration.js"]);
  const files = fs.readdirSync(srcDir).filter(
    (f) => (f.endsWith(".js") || f.endsWith(".jsx")) && !excluded.has(f)
  );
  for (const file of files) {
    const content = fs.readFileSync(path.join(srcDir, file), "utf8");
    assert.ok(!content.includes("spendClassifier"), `${file} must not reference spendClassifier`);
    assert.ok(!content.includes("healthGrader"), `${file} must not reference healthGrader`);
  }
});

// ── 15.7: backend/main.py has global exception handler ───────────────────────
test("15.7 backend/main.py has global exception handler returning {error: ...}", () => {
  const mainPy = path.join(root, "backend", "main.py");
  const content = fs.readFileSync(mainPy, "utf8");
  assert.ok(
    content.includes("exception_handler"),
    "main.py must register a global exception handler"
  );
  assert.ok(
    content.includes('"error"') || content.includes("'error'"),
    "exception handler must return an error field"
  );
});
