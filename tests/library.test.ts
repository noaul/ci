import assert from "node:assert/strict";
import test from "node:test";
import { buildLibraryGroups, navCurrent, type CurrentWork } from "@/lib/library";

test("navigation distinguishes exact pages, enclosing sections, and poem ownership", () => {
  assert.equal(navCurrent("/poets/", "/poets/"), "page");
  assert.equal(navCurrent("/poets/liu-yong/", "/poets/"), "location");
  assert.equal(navCurrent("/poems/liu-yong/0041-yu-lin-ling/", "/poets/"), "location");
  assert.equal(navCurrent("/poems/liu-yong/0041-yu-lin-ling/", "/tunes/"), undefined);
});

test("the shared drawer lists the current poem before all six book indexes", () => {
  const work: CurrentWork = {
    title: "雨霖铃·寒蝉凄切",
    href: "/poems/liu-yong/0041-yu-lin-ling/",
    poet: "柳永",
    poetHref: "/poets/liu-yong/",
    dynasty: "北宋",
    tune: "雨霖铃",
    tuneHref: "/tunes/yu-lin-ling/",
    volume: "乐章集",
    volumeHref: "/volumes/liu-yong/",
    notes: 2,
    commentary: 3,
  };
  const groups = buildLibraryGroups("/", work);
  assert.deepEqual(groups.map((group) => group.id), ["work", "library"]);
  assert.equal(groups[0]?.links[0]?.label, work.title);
  assert.equal(groups[0]?.links[1]?.note, "5 条");
  assert.equal(groups[1]?.links.length, 6);
  assert.deepEqual(
    groups[1]?.links.map((link) => link.href),
    ["/poets/", "/tunes/", "/first-lines/", "/books/", "/volumes/", "/about/"],
  );
});

test("an index route omits the empty current-work group", () => {
  const groups = buildLibraryGroups("/books/", null);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.id, "library");
  assert.equal(groups[0]?.links.find((link) => link.href === "/books/")?.current, "page");
});
