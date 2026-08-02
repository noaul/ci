import Link from "next/link";
import { SectionHeading } from "@/app/_components/Annotations";
import { PoemBody } from "@/app/_components/PoemBody";
import { getAllPoems, getPoets, getTunes, getVolumes, poemHref } from "@/lib/content";

/**
 * Pick a poem to feature. Deterministic per build day so the home page is
 * stable within a deployment but changes as the site is rebuilt.
 */
function poemOfTheDay() {
  const poems = getAllPoems();
  const withCommentary = poems.filter((p) => p.commentary.length >= 3 && p.stanzas.length >= 2);
  const day = Math.floor(Date.now() / 86_400_000);
  return withCommentary[day % withCommentary.length] ?? poems[0]!;
}

export default function HomePage() {
  const poems = getAllPoems();
  const poets = getPoets();
  const tunes = getTunes();
  const volumes = getVolumes();
  const featured = poemOfTheDay();
  const annotations = poems.reduce((n, p) => n + p.notes.length + p.commentary.length, 0);

  return (
    <div className="space-y-16">
      <section>
        <h1 className="text-2xl tracking-wide">历代名家词集精华录</h1>
        <p className="mt-3 max-w-2xl leading-8 text-ink-soft">
          自温庭筠、韦庄以迄纳兰性德，共 {poems.length.toLocaleString()} 首词，
          {annotations.toLocaleString()} 条注释与历代辑评；另附《白香词谱》《唐宋词格律》所载
          词调格律，与《人间词话》等词学论著。
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <Stat label="词作" value={poems.length.toLocaleString()} href="/first-lines/" />
          <Stat label="词人" value={String(poets.length)} href="/poets/" />
          <Stat label="词牌" value={String(tunes.filter((t) => t.poemCount > 0).length)} href="/tunes/" />
          <Stat label="分册" value={String(volumes.length)} href="/volumes/" />
        </dl>
      </section>

      <section>
        <SectionHeading>今日一词</SectionHeading>
        <div className="mt-5">
          <h2 className="font-kai text-2xl">
            <Link href={poemHref(featured)} className="hover:text-cinnabar">
              {featured.tune}
              {featured.title && <span className="ml-2 text-lg text-ink-soft">{featured.title}</span>}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink-faint">{featured.poet}</p>
          <div className="mt-5">
            <PoemBody stanzas={featured.stanzas} />
          </div>
          <p className="mt-5 text-sm">
            <Link href={poemHref(featured)} className="text-cinnabar hover:underline">
              读注释与辑评（{featured.notes.length + featured.commentary.length} 条）→
            </Link>
          </p>
        </div>
      </section>

      <section>
        <SectionHeading>词人</SectionHeading>
        <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {poets.map((poet) => (
            <li key={poet.id}>
              <Link href={`/poets/${poet.id}/`} className="group block">
                <span className="text-lg group-hover:text-cinnabar">{poet.name}</span>
                <span className="ml-2 text-xs text-ink-faint">{poet.poemCount}首</span>
                <span className="block text-xs text-ink-faint">{poet.dynasty}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="text-xl">
        <Link href={href} className="hover:text-cinnabar">
          {value}
        </Link>
      </dd>
    </div>
  );
}
