import { Epub } from "./epub.js";

const epub = new Epub("source/corpus.epub");

for (const vol of epub.nav) {
  console.log(`\n=== ${vol.label}  [spine ${epub.indexOf(vol.href)}]  children=${vol.children.length}`);
  for (const child of vol.children) {
    const grand = child.children.length;
    const sample = child.children.slice(0, 3).map((g) => g.label).join(" / ");
    console.log(
      `    - ${child.label.padEnd(24)} spine=${String(epub.indexOf(child.href)).padStart(4)} sub=${String(grand).padStart(3)}  ${sample}`,
    );
  }
}
