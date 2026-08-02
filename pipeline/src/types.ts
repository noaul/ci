/**
 * An ◎/◆ paragraph, split into its parts.
 *
 * ◎ paragraphs come in two shapes: a quoted allusion carrying a trailing
 * 出处 ("黯然销魂者，唯别而已矣。（南朝江淹《别赋》）"), and an editorial gloss
 * keyed to a word in the poem ("谢娘：唐宰相李德裕家谢秋娘为名歌妓。"). The
 * latter has no external source because the volume's editor wrote it.
 */
export type Annotation = {
  text: string;
  /** e.g. "清陈廷焯《白雨斋词话》". Null for editorial glosses and unsourced remarks. */
  source: string | null;
  /** The word being glossed, when this is a dictionary-style note. */
  headword: string | null;
};

export type Poem = {
  /** Stable slug, e.g. "su-shi/xing-xiang-zi-0042". */
  id: string;
  volumeId: string;
  poetId: string;
  poet: string;
  /** Section heading the poem sits under, e.g. "苏轼词集卷一" or "补遗". */
  juan: string;
  /** Reading order across the whole volume. */
  order: number;
  /** 词牌. "又" in the source is resolved to the tune it repeats. */
  tune: string;
  /** True when the source printed 又 rather than naming the tune. */
  tuneRepeated: boolean;
  /** 词题, e.g. "丹阳寄述古". */
  title: string | null;
  /** 小序 — the prose preface some poems carry. */
  preface: string | null;
  /**
   * 上片 / 下片, each as its lines. Volumes that print a 片 as one continuous
   * block yield a single line; 李清照 and 李煜 preserve the printed line breaks.
   */
  stanzas: string[][];
  /** ◎ — allusion sources and glosses. */
  notes: Annotation[];
  /** ◆ — 历代辑评, collected critical commentary. */
  commentary: Annotation[];
  /** Originating EPUB document, kept for traceability. */
  sourceFile: string;
};

export type Poet = {
  id: string;
  name: string;
  dynasty: string;
  lifespan: string | null;
  volumeIds: string[];
  poemCount: number;
};

export type ProseBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "para"; source: string | null; text: string };

export type ProseDocKind = "导读" | "总评" | "词论" | "附录" | "其他";

/** Volume introductions, per-poet 总评 overviews, and appended essays. */
export type ProseDoc = {
  id: string;
  volumeId: string;
  poetId: string | null;
  kind: ProseDocKind;
  title: string;
  blocks: ProseBlock[];
  sourceFile: string;
};

export type VolumeKind = "anthology" | "cipu" | "cihua";

export type Volume = {
  id: string;
  /** Exact toc.ncx label. */
  label: string;
  /** Display title, shortened where the label carries a parenthetical. */
  title: string;
  kind: VolumeKind;
  order: number;
  poetIds: string[];
  poemCount: number;
};
