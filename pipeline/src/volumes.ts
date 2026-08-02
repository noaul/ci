import { pinyin } from "pinyin-pro";
import type { VolumeKind } from "./types.js";

export type VolumeDef = {
  id: string;
  /** Exact toc.ncx label — the join key against the EPUB. */
  label: string;
  title: string;
  kind: VolumeKind;
  /** Poet for sections that do not name one (苏轼's 卷一, 姜夔's 卷三, …). */
  defaultPoet?: string;
};

/** In toc.ncx order. 词品 genuinely sits between 辛弃疾 and 纳兰. */
export const VOLUMES: VolumeDef[] = [
  { id: "wen-wei", label: "温庭筠词集·韦庄词集", title: "温庭筠词集·韦庄词集", kind: "anthology", defaultPoet: "温庭筠" },
  { id: "li-yu", label: "李煜词集（附：李璟词集 冯延巳词集）", title: "李煜词集", kind: "anthology", defaultPoet: "李煜" },
  { id: "liu-yong", label: "柳永词集", title: "柳永词集", kind: "anthology", defaultPoet: "柳永" },
  { id: "er-yan", label: "晏殊词集·晏幾道词集", title: "晏殊词集·晏幾道词集", kind: "anthology", defaultPoet: "晏殊" },
  { id: "ouyang-xiu", label: "欧阳修词集", title: "欧阳修词集", kind: "anthology", defaultPoet: "欧阳修" },
  { id: "su-shi", label: "苏轼词集", title: "苏轼词集", kind: "anthology", defaultPoet: "苏轼" },
  { id: "huang-tingjian", label: "黄庭坚词集", title: "黄庭坚词集", kind: "anthology", defaultPoet: "黄庭坚" },
  { id: "qin-guan", label: "秦观词集", title: "秦观词集", kind: "anthology", defaultPoet: "秦观" },
  { id: "he-zhu", label: "贺铸词集", title: "贺铸词集", kind: "anthology", defaultPoet: "贺铸" },
  { id: "zhou-bangyan", label: "周邦彦词集", title: "周邦彦词集", kind: "anthology", defaultPoet: "周邦彦" },
  { id: "li-qingzhao", label: "李清照词集", title: "李清照词集", kind: "anthology", defaultPoet: "李清照" },
  { id: "lu-you", label: "陆游词集", title: "陆游词集", kind: "anthology", defaultPoet: "陆游" },
  { id: "jiang-kui", label: "姜夔词集", title: "姜夔词集", kind: "anthology", defaultPoet: "姜夔" },
  { id: "xin-qiji", label: "辛弃疾词集", title: "辛弃疾词集", kind: "anthology", defaultPoet: "辛弃疾" },
  { id: "ci-pin", label: "词品", title: "词品", kind: "cihua" },
  { id: "nalan", label: "纳兰词集", title: "纳兰词集", kind: "anthology", defaultPoet: "纳兰性德" },
  { id: "bai-xiang-ci-pu", label: "白香词谱", title: "白香词谱", kind: "cipu" },
  { id: "ci-xue-tong-lun", label: "词学通论", title: "词学通论", kind: "cihua" },
  { id: "bai-yu-zhai-ci-hua", label: "白雨斋词话", title: "白雨斋词话", kind: "cihua" },
  { id: "ci-shi", label: "词史", title: "词史", kind: "cihua" },
  { id: "tang-song-ci-ge-lv", label: "唐宋词格律", title: "唐宋词格律", kind: "cipu" },
  { id: "ren-jian-ci-hua", label: "人间词话", title: "人间词话", kind: "cihua" },
];

export type PoetDef = { id: string; name: string; dynasty: string; lifespan: string | null };

export const POETS: PoetDef[] = [
  { id: "wen-tingyun", name: "温庭筠", dynasty: "唐", lifespan: "约812—约866" },
  { id: "wei-zhuang", name: "韦庄", dynasty: "唐末五代", lifespan: "约836—910" },
  { id: "li-yu", name: "李煜", dynasty: "五代·南唐", lifespan: "937—978" },
  { id: "li-jing", name: "李璟", dynasty: "五代·南唐", lifespan: "916—961" },
  { id: "feng-yansi", name: "冯延巳", dynasty: "五代·南唐", lifespan: "903—960" },
  { id: "liu-yong", name: "柳永", dynasty: "北宋", lifespan: "约984—约1053" },
  { id: "yan-shu", name: "晏殊", dynasty: "北宋", lifespan: "991—1055" },
  { id: "yan-jidao", name: "晏幾道", dynasty: "北宋", lifespan: "约1038—约1110" },
  { id: "ouyang-xiu", name: "欧阳修", dynasty: "北宋", lifespan: "1007—1072" },
  { id: "su-shi", name: "苏轼", dynasty: "北宋", lifespan: "1037—1101" },
  { id: "huang-tingjian", name: "黄庭坚", dynasty: "北宋", lifespan: "1045—1105" },
  { id: "qin-guan", name: "秦观", dynasty: "北宋", lifespan: "1049—1100" },
  { id: "he-zhu", name: "贺铸", dynasty: "北宋", lifespan: "1052—1125" },
  { id: "zhou-bangyan", name: "周邦彦", dynasty: "北宋", lifespan: "1056—1121" },
  { id: "li-qingzhao", name: "李清照", dynasty: "两宋之交", lifespan: "1084—约1155" },
  { id: "lu-you", name: "陆游", dynasty: "南宋", lifespan: "1125—1210" },
  { id: "jiang-kui", name: "姜夔", dynasty: "南宋", lifespan: "约1155—约1221" },
  { id: "xin-qiji", name: "辛弃疾", dynasty: "南宋", lifespan: "1140—1207" },
  { id: "nalan-xingde", name: "纳兰性德", dynasty: "清", lifespan: "1655—1685" },
];

const POET_BY_NAME = new Map(POETS.map((p) => [p.name, p]));
/** 纳兰词集's sections say 纳兰; the poet is 纳兰性德. */
const POET_ALIASES = new Map([["纳兰", "纳兰性德"]]);

export function poetByName(name: string): PoetDef | undefined {
  return POET_BY_NAME.get(POET_ALIASES.get(name) ?? name);
}

/**
 * Poet named by a section heading, if any.
 *
 * Handles 温庭筠词集, 秦观词集卷上, 柳永词卷上, 辛弃疾词集补遗. Returns undefined for
 * headings that name no poet (卷一, 补遗, 存疑词, 附录词) so the caller can carry
 * the previous section's poet forward.
 */
export function poetFromSection(label: string): PoetDef | undefined {
  const m = /^(.{1,4}?)词(?:集|卷)/.exec(label);
  return m ? poetByName(m[1]!) : undefined;
}

/** Section headings that hold prose rather than poems. */
const PROSE_SECTION_LABELS = new Set(["总评", "词论"]);

export function isProseEntry(label: string): boolean {
  return PROSE_SECTION_LABELS.has(label.trim());
}

/**
 * Pinyin initial of a string's first character, A–Z, or "#" when it has none
 * (rare-character images, punctuation). Drives the 首句索引 grouping.
 */
export function pinyinInitial(s: string): string {
  const first = [...s.replace(/\{\{IMG:[^}]+\}\}/g, "")][0];
  if (!first) return "#";
  const [roman] = pinyin(first, { toneType: "none", type: "array", nonZh: "removed" });
  const letter = roman?.[0]?.toUpperCase() ?? "";
  return /^[A-Z]$/.test(letter) ? letter : "#";
}

/**
 * Romanised slug for use in URLs. Non-Han characters are dropped; if nothing
 * survives (rare-character tunes) the caller falls back to the ordinal.
 */
export function slugify(s: string): string {
  const cleaned = s.replace(/[（）()《》〔〕\[\]　\s]/g, "");
  if (!cleaned) return "";
  const romanised = pinyin(cleaned, { toneType: "none", type: "array", nonZh: "removed" });
  return romanised
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
