import { getPoemById, getPoet, getTuneByName, getVolume, poemHref } from "@/lib/content";
import { displayLines } from "@/lib/poem-lines";
import type { SceneId, StageLine, StageTheme } from "./types";

/**
 * The four scenes the home page opens on.
 *
 * Only the reading of the poem lives here — the scene name, its motifs and the
 * two structural marks. The text itself is never written down: it is read out
 * of the corpus by id at build time, so the stage can only ever print what the
 * volume prints. `pause` and `turn` are located by their opening characters
 * rather than by line number, so a re-run of the ETL that resets the printed
 * line breaks fails the build instead of silently marking the wrong line.
 */
type SceneSpec = {
  id: SceneId;
  poemId: string;
  /**
   * The heading to print. The volume files three of these under a 词牌 alone
   * and 贺铸's under 横塘路; readers know all four by 词牌·词题 or 词牌·首句,
   * so the stage prints that and the provenance keeps the volume's own words.
   */
  heading: string;
  /** Four characters from the poem, naming the scene. */
  scene: string;
  /** Three motifs, all words the poem itself uses. */
  motifs: [string, string, string];
  /** Opening characters of the line that closes the unprompted 起. */
  pause: string;
  /** Opening characters of the 转 — the line the reader is asked to supply. */
  turn: string;
  /**
   * A short editorial residue, printed under a 余韵 mark. Written for this
   * reading — it is not the volume's 注释 or 辑评 and must not read as either.
   */
  aftertaste: string;
};

const SCENES: readonly SceneSpec[] = [
  {
    id: "cold-cicada",
    poemId: "liu-yong/0041-yu-lin-ling",
    heading: "雨霖铃·寒蝉凄切",
    scene: "寒蝉凄切",
    motifs: ["长亭", "兰舟", "残月"],
    pause: "都门帐饮无绪",
    turn: "今宵酒醒何处",
    aftertaste: "雨歇舟发，秋声一路留在岸上。",
  },
  {
    id: "lantern",
    poemId: "xin-qiji/0013-qing-yu-an",
    heading: "青玉案·元夕",
    scene: "灯火阑珊",
    motifs: ["花千树", "鱼龙舞", "暗香"],
    pause: "更吹落",
    turn: "众里寻他千百度",
    aftertaste: "满城灯火退去，只剩这一眼。",
  },
  {
    id: "lotus-dusk",
    poemId: "li-qingzhao/0001-ru-meng-ling",
    heading: "如梦令·常记溪亭日暮",
    scene: "溪亭日暮",
    motifs: ["回舟", "藕花", "鸥鹭"],
    pause: "沉醉不知归路",
    turn: "惊起一行鸥鹭",
    aftertaste: "藕花乱处，鸥鹭尚未落定。",
  },
  {
    id: "plum-rain",
    poemId: "he-zhu/0085-heng-tang-lu",
    heading: "青玉案·凌波不过横塘路",
    scene: "梅子黄时",
    motifs: ["横塘", "烟草", "风絮"],
    pause: "但目送",
    turn: "一川烟草",
    aftertaste: "闲情有量，以烟草风絮梅雨计。",
  },
] as const;

const RARE_TOKEN = /\{\{IMG:/;

function locate(lines: readonly StageLine[], marker: string, poemId: string, role: string): number {
  const index = lines.findIndex((line) => line.text.startsWith(marker));
  if (index < 0) {
    throw new Error(`Stage scene ${poemId}: no ${role} line beginning 「${marker}」 in the corpus.`);
  }
  return index;
}

function build(spec: SceneSpec): StageTheme {
  const poem = getPoemById(spec.poemId);
  if (!poem) throw new Error(`Stage scene ${spec.poemId} is not in the corpus.`);

  const lines: StageLine[] = poem.stanzas.flatMap((stanza, s) =>
    displayLines(stanza).map((text, i) => ({ text, opensStanza: s > 0 && i === 0 })),
  );

  // The stage renders plain text, so a poem carrying an image-backed rare
  // character would silently lose it. None of the four do; fail loudly if that
  // ever changes rather than printing a hole.
  const rare = lines.find((line) => RARE_TOKEN.test(line.text));
  if (rare) throw new Error(`Stage scene ${spec.poemId} carries a rare-character token.`);

  const pauseIndex = locate(lines, spec.pause, spec.poemId, "pause");
  const turnIndex = locate(lines, spec.turn, spec.poemId, "turn");
  if (!(pauseIndex < turnIndex && turnIndex < lines.length)) {
    throw new Error(`Stage scene ${spec.poemId}: 起 must fall before 转, and 转 before the close.`);
  }

  const tune = getTuneByName(poem.tune);
  const volume = getVolume(poem.volumeId);

  return {
    id: spec.id,
    poemId: poem.id,
    href: poemHref(poem),
    heading: spec.heading,
    tune: poem.tune,
    tuneHref: tune ? `/tunes/${tune.id}/` : null,
    title: poem.title,
    poet: poem.poet,
    poetHref: `/poets/${poem.poetId}/`,
    dynasty: getPoet(poem.poetId)?.dynasty ?? "",
    volumeTitle: volume?.title ?? poem.juan,
    volumeHref: volume ? `/volumes/${volume.id}/` : `/poets/${poem.poetId}/`,
    scene: spec.scene,
    motifs: [...spec.motifs],
    lines,
    pauseIndex,
    turnIndex,
    aftertaste: spec.aftertaste,
    noteCount: poem.notes.length,
    commentaryCount: poem.commentary.length,
  };
}

const themes: StageTheme[] = SCENES.map(build);

/** The four prepared scenes, in a fixed order the selection helpers index into. */
export const getStageThemes = (): StageTheme[] => themes;
