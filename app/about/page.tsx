import type { Metadata } from "next";
import { Numeral } from "@/app/_components/Numeral";
import { getSiteStats } from "@/lib/content";

export const metadata: Metadata = { title: "版权与出处说明" };

export default function AboutPage() {
  const stats = getSiteStats();

  return (
    <div className="max-w-2xl">
      <h1 className="ci-page-title">版权与出处说明</h1>

      <div className="mt-8 space-y-8 leading-8 text-ink-soft">
        <section>
          <h2 className="text-base text-ink">底本</h2>
          <p className="mt-2">
            本站文本悉据《历代名家词集精华录》（全二十二册），上海古籍出版社。所收{" "}
            <Numeral value={stats.volumes} /> 册中，词集十五种、词谱二种、词话词论
            <Numeral value={stats.bookVolumes} />种。
          </p>
        </section>

        <section>
          <h2 className="text-base text-ink">著作权</h2>
          <p className="mt-2">
            所收词作皆为公有领域作品。惟各册之导读、注释、编次，以及辑评中所引近现代学者
            （如俞平伯、夏承焘、龙榆生、刘永济、浦江清诸先生）之论述，其著作权仍归原作者及
            上海古籍出版社所有。本站仅供研读参考，凡引用皆保留原书所注出处。
          </p>
          <p className="mt-2">若权利人认为本站内容有不当之处，请联系删除。</p>
        </section>

        <section>
          <h2 className="text-base text-ink">数据</h2>
          <p className="mt-2">
            共 <Numeral value={stats.poems} /> 首词，<Numeral value={stats.annotations} />{" "}
            条注释与辑评，<Numeral value={stats.tunesWithTemplate} /> 个词牌附有格律谱。
            文本由电子书自动解析而成，注释以「◎」、辑评以「◆」为别，出处依原书括注切分。
            解析或有疏漏，以原书为准。
          </p>
        </section>
      </div>
    </div>
  );
}
