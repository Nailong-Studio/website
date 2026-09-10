# 奶龙艺术宇宙 · 数字美术馆（Nailong Gallery v2）

> 134 件奶龙主题艺术作品，五大展厅，一次策展式浏览。
> 线上地址：https://nailong-studio.github.io/website/

上一版是 Vite + glightbox 的单页画廊，存在两个线上缺陷（灯箱大图 404、家族导航链接 404），
本站为按重构计划 v2.0 的完整重写：Astro 静态站 + 构建期内容管线 + 零运行时依赖的交互层。

## 亮点

- **零框架运行时**：Astro 默认输出纯 HTML，交互（灯箱 / 筛选 / 主题 / 专注模式）用一个约 9KB 的原生 TS 脚本搞定。
- **构建期内容管线**：扫描 134 件作品的清单，自动生成 slug、主色、LQIP 模糊占位、CDN 多档 srcset，构建产物不含原图（原图走 CDN）。
- **图片策略**：缩略图本地 WebP（400px），大图走 wsrv.nl 按 `640/1024/1600/2048` 四档 WebP 转码，`loading=lazy` + `fetchpriority` 分级，宽高比占位防 CLS。
- **无障碍与体感**：`prefers-reduced-motion` 全量降级、一键专注模式（关动效 + 强对比）、键盘可达灯箱、语义化标题层级。
- **质量门禁**：内容校验 + 单元测试 + 类型检查 + 构建产物链接自检 + 体积预算，全部进 CI。

## 目录结构

```
src/
  data/
    site.json          # 站点配置（base/title/仓库地址）——单一事实源
    gallery.json       # 原始作品清单（134 条，来自旧站，保持兼容）
    artworks.meta.json # 人工策展覆盖（标题/故事/标签/精选）
    themes.json        # 五大展厅定义（slogan/描述/主色）
    manifest.json      # 构建产物：由脚本生成，勿手改
  lib/                 # url()、作品查询、类型定义
  layouts/BaseLayout.astro
  components/          # Nav / Hero / ThemeRail / FilterBar / MasonryGrid / ArtCard / Lightbox / Footer
  pages/
    index.astro                    # 首页：滚动叙事 Hero + 展厅索引 + 编辑精选
    gallery/index.astro            # 全部作品（含即时筛选）
    gallery/[category].astro       # 单展厅
    artwork/[category]/[slug].astro # 作品详情（143 页之一，可分享）
    about.astro / 404.astro
  scripts/site.ts      # 交互层（原生 TS，无依赖）
scripts/
  build-artworks.mjs   # 内容管线：清单 → manifest.json（slug/主色/LQIP/CDN srcset）
  verify-content.mjs   # 内容校验：数量/唯一性/字段/缩略图存在
  check-links.mjs      # 构建产物自检：内部链接与缩略图必须命中
public/thumbs/…        # 134 张 400px WebP 缩略图（提交入库）
```

## 常用命令

```bash
npm install          # 安装依赖（Node ≥ 20.3）
npm run dev          # 本地开发 http://localhost:4321/website/
npm run build        # 内容管线 + 校验 + 构建 + 链接自检 → dist/
npm run test         # Vitest 单元测试（数据完整性 / 过滤 / 链接构造）
npm run lint         # tsc --noEmit 类型检查
npm run content:verify   # 只跑内容校验
npm run check        # 内容校验 + 测试 + 类型检查（CI 同款）
npm run preview      # 预览构建产物
```

## 部署

推送到 `main` 后由 GitHub Actions 自动部署到 GitHub Pages：

- `.github/workflows/ci.yml`：内容校验 → 测试 → 类型检查 → 构建 → 体积预算（JS ≤ 64KB / CSS ≤ 48KB）→ 上传 dist 构件。
- `.github/workflows/deploy.yml`：同样的校验步骤 + `upload-pages-artifact` + `deploy-pages`（需仓库 Settings → Pages → Source 选 GitHub Actions）。

本站按子路径部署，`base` 只在 `src/data/site.json` 里定义一次，`astro.config.mjs` 与 `src/lib/url.ts` 都读它 —— 改域名/子路径只动一个文件。

## 内容管线怎么工作

1. `scripts/build-artworks.mjs` 读 `src/data/gallery.json` + `src/data/artworks.meta.json`。
2. 从文件名解析标题与变体（如 `孤独奶龙主义_10s.png` → 标题「孤独奶龙主义」/ 变体「10s」），生成 URL 安全 slug 与中文标题。
3. 用 sharp 从本地缩略图算出**主色**与 **24px LQIP**（base64，缓存于 `.cache/`，幂等）。
4. 组装 CDN 多档 `srcset`（wsrv.nl + raw.githubusercontent.com），输出 `src/data/manifest.json`。
5. `verify-content.mjs` 断言数量、slug 唯一性、字段合法性、缩略图存在；`check-links.mjs` 在构建后复查所有内部链接。

新增作品：把图丢进 [wallpaper 仓](https://github.com/Nailong-Studio/wallpaper) 对应分类目录，本地生成 400px WebP 缩略图放进 `public/thumbs/<分类>/`，更新 `gallery.json`，跑 `npm run build`。

## 已知待办

- 图库原图约 280MB，继续走 CDN 不入构建产物；如需完全自托管，建议接 Cloudflare Images 或对象存储。
- 详情页「深缩放」浏览、WebGL 展陈（Three.js）为计划中的下一阶段，当前以 2D canvas Hero 与原生灯箱打底。
- Lighthouse / axe 自动化门禁需要无头浏览器，尚未纳入 CI（体积预算与链接自检已覆盖最主要回归面）。

---

- 主仓：[Nailong-Studio/NaiLong-Universe](https://github.com/Nailong-Studio/NaiLong-Universe) — palette.json 单源 + 主题
- 壁纸库：[Nailong-Studio/wallpaper](https://github.com/Nailong-Studio/wallpaper) — 134 张原图
- VSCode 主题：[Nailong-Studio/nailong-vscode-theme](https://github.com/Nailong-Studio/nailong-vscode-theme)
