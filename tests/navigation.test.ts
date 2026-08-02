import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { navCurrent } from "@/lib/navigation";

test("navigation distinguishes an exact page from a section location", () => {
  assert.equal(navCurrent("/poets/", "/poets/"), "page");
  assert.equal(navCurrent("/poets/liu-yong/", "/poets/"), "location");
  assert.equal(navCurrent("/poems/liu-yong/0041-yu-lin-ling/", "/poets/"), "location");
  assert.equal(navCurrent("/poems/liu-yong/0041-yu-lin-ling/", "/tunes/"), undefined);
});

test("the shared static link disables App Router prefetch requests", () => {
  const source = readFileSync(
    new URL("../app/_components/StaticLink.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /prefetch=\{false\}/);
});
