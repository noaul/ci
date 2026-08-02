import { Numeral } from "@/app/_components/Numeral";
import Link from "@/app/_components/StaticLink";
import { PoeticStage } from "@/app/_components/stage/PoeticStage";
import { getPoets, getSiteStats } from "@/lib/content";
import { stageMetrics } from "@/lib/stage/select";
import { getStageThemes } from "@/lib/stage/themes";

/**
 * The home page is built like the form it collects: a scene opens (起), the
 * collection's measure holds under it (顿), the indexes turn one poem into
 * three and a half thousand (转), and the poets stay behind (余味).
 */
export default function HomePage() {
  const stats = getSiteStats();
  const themes = getStageThemes();
  const poets = getPoets();

  const ways = [
    { href: "/poets/", label: "词人", note: "自晚唐迄清，按丛书次第", count: stats.poets },
    { href: "/tunes/", label: "词牌", note: "调名、别名与格律谱", count: stats.tunes },
    { href: "/first-lines/", label: "首句", note: "按首字拼音分部", count: stats.poems },
    { href: "/books/", label: "词话", note: "《人间词话》等五种", count: stats.bookVolumes },
    { href: "/volumes/", label: "丛书", note: "全二十二册总目", count: stats.volumes },
    { href: "/about/", label: "出处", note: "底本、著作权与解析说明", count: null },
  ];

  return (
    <div className="-mt-4 sm:-mt-10">
      <h1 className="sr-only">历代名家词集精华录</h1>

      <PoeticStage themes={themes} metrics={stageMetrics(themes)} />

      <div className="mt-6 space-y-14 sm:mt-0">
        <section aria-labelledby="collection">
          <h2 id="collection" className="sr-only">
            全书概况
          </h2>
          <p className="max-w-2xl text-[0.9375rem] leading-8 text-ink-soft">
            自温庭筠、韦庄以迄纳兰性德，共 <Numeral value={stats.poems} /> 首词，
            <Numeral value={stats.annotations} /> 条注释与历代辑评；另附《白香词谱》《唐宋词格律》
            所载 <Numeral value={stats.tunesWithTemplate} /> 调格律，与《人间词话》等词学论著。
          </p>

          <dl className="ci-stats mt-6">
            <Stat label="词作" value={stats.poems} href="/first-lines/" />
            <Stat label="词人" value={stats.poets} href="/poets/" />
            <Stat label="词牌" value={stats.tunes} href="/tunes/" />
            <Stat label="分册" value={stats.volumes} href="/volumes/" />
          </dl>
        </section>

        <nav aria-labelledby="ways">
          <h2 id="ways" className="ci-eyebrow">
            循此而入
          </h2>
          <ul className="mt-4 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {ways.map((way) => (
              <li key={way.href} className="border-t border-rule">
                <Link
                  href={way.href}
                  className="group flex items-baseline justify-between gap-4 py-3.5"
                >
                  <span className="min-w-0">
                    <span className="text-lg group-hover:text-cinnabar">{way.label}</span>
                    <span className="ml-3 text-xs text-ink-faint">{way.note}</span>
                  </span>
                  <span className="shrink-0 text-sm text-ink-faint">
                    {way.count === null ? "" : <Numeral value={way.count} tabular />}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="poets">
          <h2 id="poets" className="ci-eyebrow">
            词人
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-4">
            {poets.map((poet) => (
              <li key={poet.id} className="deferred-list-item">
                <Link href={`/poets/${poet.id}/`} className="group block py-2">
                  <span className="font-kai text-lg group-hover:text-cinnabar">{poet.name}</span>
                  <span className="ml-2 text-xs text-ink-faint">
                    <Numeral value={poet.poemCount} /> 首
                  </span>
                  <span className="block text-xs text-ink-faint">{poet.dynasty}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <div className="ci-stat">
      <dt className="ci-stat-label">{label}</dt>
      <dd className="ci-stat-value">
        <Link href={href}>
          <Numeral value={value} tabular />
        </Link>
      </dd>
    </div>
  );
}
