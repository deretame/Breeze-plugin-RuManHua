# Breeze Plugin 如漫画

Breeze 插件：如漫画源（rumanhua2.com）。

支持搜索漫画、查看漫画详情（含全部章节）、在线阅读、下载图片。

## 已导出的 fnPath

- `getInfo` — 插件信息
- `searchComic` — 搜索漫画
- `getComicDetail` — 漫画详情（含全部章节）
- `getReadSnapshot` — 阅读快照（解密章节图片）
- `fetchImageBytes` — 下载图片

## 开发

```bash
pnpm install
pnpm run dev
```

dev server 启动后输出 bundle 地址，在 Breeze 中通过"网络安装"加载即可调试。

## 构建

```bash
pnpm run build
```

构建流程：typecheck → 同步版本号 → 生成 `manifest.json` → rspack 打包 → Brotli 压缩。

**构建前请先更新 `src/get-info.ts` 中的 `version` 字段。**
