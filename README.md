# 历代名家词集精华录

《历代名家词集精华录》静态在线读本。项目以 Next.js 生成约 4,300 个静态页面，收录
3,508 首词，并提供词人、词牌、首句、丛书分册及词话词论索引。

## 本地运行

需要 Node.js 20.9 或更高版本，建议使用当前 LTS 版本。

```bash
npm ci
npm run dev
```

开发服务器默认位于 <http://localhost:3000>。生产构建和构建后校验如下：

```bash
npm run check
npm run build
npm run validate:site
npm start
```

`npm run check` 依次执行 Next.js 路由类型生成、TypeScript 检查、回归测试和语料一致性校验。
`npm run build` 将完整静态站点输出至 `out/`；`validate:site` 检查本地链接、片段目标、重复
`id`，以及图片替代文本和固有尺寸。`npm start` 在 <http://localhost:3000> 预览已构建的
`out/`，运行前须先完成构建。

## 重新生成语料

底本是商业出版物，不随仓库分发。持有合法 EPUB 的维护者可将其放置为
`source/corpus.epub`，然后运行：

```bash
npm run etl
npm run etl:validate
```

ETL 会重建 `content/` 下的 JSON，并从 EPUB 提取仍需以图片表示的罕见字形至
`public/glyphs/`。当前提交的语料共引用 97 个字形文件：仓库内有 67 个可用资源，另有 30 个
资源未提交。站点会为缺失资源显示带说明的 `□`，不会发出失效图片请求；重新运行 ETL 可从
合法底本补取这些资源。

## 目录

| 路径 | 内容 |
| --- | --- |
| `app/` | Next.js 页面与阅读组件 |
| `lib/` | 语料读取、索引及查询接口 |
| `content/` | ETL 生成并提交的结构化语料 |
| `pipeline/` | EPUB 解析、索引生成与验证脚本 |
| `public/glyphs/` | EPUB 中的罕见字形资源 |
| `tests/` | 组件回归和语料关系测试 |

## 版权边界

古代词作本身属于公有领域；现代出版物的导读、注释、编次及所引近现代学者论述可能仍受
著作权保护，权利归原作者及上海古籍出版社等权利人所有。派生语料仅供研读与校勘，引用或
再分发前应自行确认授权，并以原书为准。原始 EPUB 被 `.gitignore` 排除。

仓库目前未附开源许可证，不应据此推定获得代码或语料的再许可权。
