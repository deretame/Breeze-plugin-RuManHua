import type {
  ChapterPage,
  ComicDetailContract,
  ComicDetailPayload,
  ComicListScene,
  ComicPagedListContract,
  FetchImageBytesPayload,
  FilterBundleContract,
  GetPluginHomePagesBundlePayload,
  InfoContract,
  PluginHomePagesBundleContract,
  PluginHomeTab,
  ReadSnapshotContract,
  ReadSnapshotPayload,
  SearchComicPayload,
  SearchResultContract,
  SettingsBundleContract,
} from "breeze-plugin-kit";
import {
  BASE_URL,
  PLUGIN_ID,
  createActionItem,
  createChapterSummary,
  createImage,
  createPaging,
  decryptChapterImages,
  extractCipher,
  extractReaderId,
  fetchAllChapters,
  fetchText,
  parseComicDetailInfo,
  parseRankItems,
  parseSearchItems,
  postForm,
} from "./common";
import { buildPluginInfo } from "./get-info";

// ---------------------------------------------------------------------------
// getInfo
// ---------------------------------------------------------------------------

async function getInfo(): Promise<InfoContract> {
  return buildPluginInfo();
}

// ---------------------------------------------------------------------------
// searchComic
// ---------------------------------------------------------------------------

async function searchComic(payload: SearchComicPayload = {}): Promise<SearchResultContract> {
  const keyword = String(payload.keyword ?? "").trim();
  if (!keyword) {
    throw new Error("关键词不能为空");
  }

  const html = await postForm(`${BASE_URL}/s`, { k: keyword });
  const items = parseSearchItems(html);

  const paging = createPaging(1, 1, items.length);
  return {
    source: PLUGIN_ID,
    extern: payload.extern ?? null,
    scheme: {
      version: "1.0.0",
      type: "searchResult",
      source: PLUGIN_ID,
      list: "comicGrid",
    },
    data: { paging, items },
    paging,
    items,
  };
}

// ---------------------------------------------------------------------------
// getComicDetail
// ---------------------------------------------------------------------------

async function getComicDetail(payload: ComicDetailPayload = {}): Promise<ComicDetailContract> {
  const comicId = String(payload.comicId ?? "").trim();
  if (!comicId) {
    throw new Error("comicId 不能为空");
  }

  const html = await fetchText(`${BASE_URL}/${comicId}/`, {
    headers: { Referer: BASE_URL },
  });
  const info = parseComicDetailInfo(html, comicId);
  // 页面含较新章节，/morechapter 含更早章节，需合并
  const chapters = await fetchAllChapters(comicId, html);

  const normal = {
    comicInfo: {
      id: comicId,
      title: info.title,
      titleMeta: [
        createActionItem(`作者：${info.author}`),
        createActionItem(`更新时间：${info.updateTime}`),
        createActionItem(`标签：${info.tags.join(" ")}`),
        createActionItem(`状态：${info.status}`),
      ],
      creator: {
        id: "",
        name: "",
        avatar: createImage({
          id: "",
          url: "",
          name: "",
          path: "",
        }),
        onTap: null,
        extern: {},
      },
      description: info.description,
      cover: createImage({
        id: comicId,
        url: info.coverUrl,
        name: "cover.jpg",
        path: `comic/${comicId}/cover.jpg`,
      }),
      metadata: [],
      extern: {},
    },
    eps: chapters,
    recommend: [],
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    isFavourite: false,
    isLiked: false,
    allowComments: false,
    allowCommentsReason: "如漫画暂不支持评论",
    allowLike: false,
    allowLikeReason: "如漫画暂不支持点赞",
    allowCollected: false,
    allowCollectedReason: "如漫画暂不支持收藏",
    allowDownload: false,
    allowDownloadReason: "如漫画暂不支持下载",
    extern: {},
  };

  return {
    source: PLUGIN_ID,
    comicId,
    extern: payload.extern ?? null,
    scheme: {
      version: "1.0.0",
      type: "comicDetail",
      source: PLUGIN_ID,
    },
    data: { normal, raw: { info, chapters } },
  };
}

// ---------------------------------------------------------------------------
// getReadSnapshot
// ---------------------------------------------------------------------------

async function getReadSnapshot(payload: ReadSnapshotPayload = {}): Promise<ReadSnapshotContract> {
  const comicId = String(payload.comicId ?? "").trim();
  const chapterId = String(payload.chapterId ?? "").trim();
  if (!comicId) {
    throw new Error("comicId 不能为空");
  }
  if (!chapterId) {
    throw new Error("chapterId 不能为空");
  }

  const [chapterHtml, chapters] = await Promise.all([
    fetchText(`${BASE_URL}/${comicId}/${chapterId}.html`, {
      headers: { Referer: `${BASE_URL}/${comicId}/` },
    }),
    fetchAllChapters(comicId),
  ]);

  const readerId = extractReaderId(chapterHtml);
  const cipher = extractCipher(chapterHtml);
  const imageUrls = decryptChapterImages(cipher, readerId);

  const currentIndex = chapters.findIndex((c) => c.id === chapterId || c.requestId === chapterId);
  const currentChapter =
    currentIndex >= 0 ? chapters[currentIndex] : createChapterSummary(chapterId, "未知章节", 0);

  const pages: ChapterPage[] = imageUrls.map((url, idx) => ({
    id: `${chapterId}-p-${idx + 1}`,
    name: `${idx + 1}.jpg`,
    path: `comic/${comicId}/${chapterId}/${idx + 1}.jpg`,
    url,
    extern: {},
  }));

  const titleMatch = chapterHtml.match(/<meta[^>]+property="og:comicname"[^>]+content="([^"]+)"/);
  const comicTitle = titleMatch?.[1] ?? "";

  return {
    source: PLUGIN_ID,
    extern: payload.extern ?? null,
    data: {
      comic: {
        id: comicId,
        source: PLUGIN_ID,
        title: comicTitle,
        extern: {},
      },
      chapter: { ...currentChapter, pages },
      chapters: chapters.map((c) => ({
        id: c.id,
        name: c.name,
        order: c.order,
        extern: {},
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// fetchImageBytes
// ---------------------------------------------------------------------------

async function fetchImageBytes(
  payload: FetchImageBytesPayload = {},
): Promise<Uint8Array<ArrayBufferLike>> {
  const url = String(payload.url ?? "").trim();
  if (!url) {
    throw new Error("url 不能为空");
  }

  const res = await fetch(url, {
    headers: {
      "x-rquickjs-host-offload-binary-v1": "1",
      Referer: BASE_URL,
    },
    signal: AbortSignal.timeout(payload.timeoutMs ?? 30000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText} (${url})`);
  }

  return new Uint8Array(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// 榜单 / 分类列表（首页 scene 数据源）
// ---------------------------------------------------------------------------

const RANK_TITLES: Record<string, string> = {
  "1": "精品榜",
  "2": "人气榜",
  "3": "推荐榜",
  "4": "黑马榜",
  "5": "最近更新",
  "6": "新漫画",
};

/** 榜单分页数据：extern.type 取 rank id（默认 5 最近更新），站内榜单页无分页，一次返回全部 */
async function getRankingData(payload: SearchComicPayload = {}): Promise<ComicPagedListContract> {
  const extern = payload.extern ?? {};
  const type = String(extern.type ?? "5").trim() || "5";
  const html = await fetchText(`${BASE_URL}/rank/${encodeURIComponent(type)}`, {
    headers: { Referer: BASE_URL },
  });
  const items = parseRankItems(html);
  return {
    source: PLUGIN_ID,
    extern: payload.extern ?? null,
    scheme: {
      version: "1.0.0",
      type: "rankingFeed",
      card: "comicGrid",
    },
    data: { items, hasReachedMax: true },
  };
}

/** 榜单筛选：choice 切换 6 个榜单 */
async function getRankingFilterBundle(): Promise<FilterBundleContract> {
  return {
    source: PLUGIN_ID,
    scheme: {
      version: "1.0.0",
      fields: [
        {
          key: "type",
          kind: "choice" as const,
          label: "榜单",
          options: Object.entries(RANK_TITLES).map(([value, label]) => ({
            label,
            value,
            result: { extern: { type: value } },
          })),
        },
      ],
    },
    data: { values: { type: "5" } },
  };
}

/** 首页排行榜 scene（与榜单数据函数同源，供首页 tab 复用） */
function buildRankingScene(): ComicListScene {
  return {
    title: "最近更新",
    source: PLUGIN_ID,
    body: {
      type: "pluginPagedComicList" as const,
      request: {
        fnPath: "getRankingData",
        core: {},
        extern: { type: "5" },
      },
    },
    filter: {
      fnPath: "getRankingFilterBundle",
      core: {},
      extern: {},
    },
  };
}

/** 插件首页 — 最近更新 tab（无登录插件只补第一页，不置 haveCloudFavorite） */
async function getPluginHomePagesBundle(
  _payload: GetPluginHomePagesBundlePayload = {},
): Promise<PluginHomePagesBundleContract> {
  const tabs: PluginHomeTab[] = [{ id: "recent", title: "最近更新", scene: buildRankingScene() }];
  return {
    source: PLUGIN_ID,
    scheme: {
      version: "1.0.0" as const,
      type: "homePagesBundle" as const,
    },
    data: { tabs },
  };
}

async function getSettingsBundle(): Promise<SettingsBundleContract> {
  return {
    source: PLUGIN_ID,
    scheme: {
      version: "1.0.0" as const,
      type: "settings" as const,
      sections: [],
    },
    data: {
      canShowUserInfo: false,
      values: {},
    },
  };
}

// ---------------------------------------------------------------------------
// default export
// ---------------------------------------------------------------------------

export default {
  getInfo,
  searchComic,
  getComicDetail,
  getReadSnapshot,
  fetchImageBytes,

  getRankingData,
  getRankingFilterBundle,
  getPluginHomePagesBundle,

  getSettingsBundle,
};
