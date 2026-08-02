import type { Metadata } from "next";
import { getAllPoems, getTunes, getVolumes } from "@/lib/content";

export const metadata: Metadata = { title: "版权与出处说明" };

export default function AboutPage() {
  const poems = getAllPoems();
  const annotations = poems.reduce((n, p) => n + p.notes.length + p.commentary.length, 0);

  return (
    <div className="max-w-2xl space-y-6 leading-8 text-ink-soft">
      <h1 className="text-2xl text-ink">版权与出处说明</h1>

      <section>
        <h2 className="text-lg text-ink">底本</h2>
        <p className="mt-2">
          本站文本悉据《历代名家词集精华录》（全二十二册），上海古籍出版社。所收
          {getVolumes().length} 册中，词集十五种、词谱二种、词话词论五种。
        </p>
      </section>

      <section>
        <h2 className="text-lg text-ink">著作权</h2>
        <p className="mt-2">
          所收词作皆为公有领域作品。惟各册之导读、注释、编次，以及辑评中所引近现代学者
          （如俞平伯、夏承焘、龙榆生、刘永济、浦江清诸先生）之论述，其著作权仍归原作者及
          上海古籍出版社所有。本站仅供研读参考，凡引用皆保留原书所注出处。
        </p>
        <p className="mt-2">
          若权利人认为本站内容有不当之处，请联系删除。
        </p>
      </section>

      <section>
        <h2 className="text-lg text-ink">数据</h2>
        <p className="mt-2">
          共 {poems.length.toLocaleString()} 首词，{annotations.toLocaleString()} 条注释与辑评，
          {getTunes().filter((t) => t.sourceBooks.length > 0).length} 个词牌附有格律谱。
          文本由电子书自动解析而成，注释以「◎」、辑评以「◆」为别，出处依原书括注切分。
          解析或有疏漏，以原书为准。
        </p>
      </section>
    </div>
  );
}
