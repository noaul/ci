/**
 * The four scenes the home stage can open on. The id keys the palette and the
 * reveal motion in `globals.css`, so it is part of the design contract rather
 * than an internal label.
 */
export type SceneId = "cold-cicada" | "lantern" | "lotus-dusk" | "plum-rain";

/** One display line of the poem, as the reading pages also print it. */
export type StageLine = {
  text: string;
  /** True when this line opens a 片. */
  opensStanza: boolean;
};

/**
 * A poem prepared for the stage: exact corpus text, plus where its movements
 * fall. Everything here is serialisable — the home page is a server component
 * and hands this straight to the client stage.
 */
export type StageTheme = {
  id: SceneId;
  /** Corpus poem id, e.g. "liu-yong/0041-yu-lin-ling". */
  poemId: string;
  href: string;
  /**
   * The heading the stage prints — the name the poem is known by, 词牌·首句
   * where the volume gives no 词题. Editorial, and deliberately separate from
   * the corpus fields below: 贺铸's poem is filed under 横塘路 with 青玉案 as
   * its 词题, and the provenance must keep saying so even while the heading
   * reads 青玉案·凌波不过横塘路.
   */
  heading: string;
  /** 词牌, exactly as the volume prints it. */
  tune: string;
  /** 词谱 page for the tune, where the indexes carry one. */
  tuneHref: string | null;
  /** 词题, where the volume prints one. */
  title: string | null;
  poet: string;
  poetHref: string;
  dynasty: string;
  /** The 分册 the poem is printed in, and its page. */
  volumeTitle: string;
  volumeHref: string;
  /** Four characters naming the scene — used for announcements and the seal. */
  scene: string;
  /** Three motifs, taken from the poem's own words. */
  motifs: string[];
  lines: StageLine[];
  /** The held line that closes the opening movement; revealed unprompted. */
  pauseIndex: number;
  /** The 转 — the line the reader is invited to supply. */
  turnIndex: number;
  /** A short editorial residue, printed once the poem stands whole. */
  aftertaste: string;
  /** ◎ 注释 waiting on the poem page. */
  noteCount: number;
  /** ◆ 历代辑评 waiting on the poem page. */
  commentaryCount: number;
};
