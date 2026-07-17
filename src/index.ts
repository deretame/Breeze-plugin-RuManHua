import type {
  ChapterPage,
  ComicDetailContract,
  ComicDetailPayload,
  FetchImageBytesPayload,
  InfoContract,
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

async function searchComic(
  payload: SearchComicPayload = {},
): Promise<SearchResultContract> {
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

async function getComicDetail(
  payload: ComicDetailPayload = {},
): Promise<ComicDetailContract> {
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
        onTap: {},
        extern: {},
      },
      description: info.description,
      cover: createImage({
        id: comicId,
        url: info.coverUrl,
        name: "cover.jpg",
        path: `comic/${comicId}/cover.jpg`,
      }),
      metadata: [
        // createMetadataActionList("author", "作者", [info.author]),
        // createMetadataActionList("tags", "标签", info.tags),
        // createMetadataActionList("status", "状态", [info.status]),
      ],
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
    allowLike: false,
    allowCollected: false,
    allowDownload: false,
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

async function getReadSnapshot(
  payload: ReadSnapshotPayload = {},
): Promise<ReadSnapshotContract> {
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

  const currentIndex = chapters.findIndex(
    (c) => c.id === chapterId || c.requestId === chapterId,
  );
  const currentChapter =
    currentIndex >= 0
      ? chapters[currentIndex]
      : createChapterSummary(chapterId, "未知章节", 0);

  const pages: ChapterPage[] = imageUrls.map((url, idx) => ({
    id: `${chapterId}-p-${idx + 1}`,
    name: `${idx + 1}.jpg`,
    path: `comic/${comicId}/${chapterId}/${idx + 1}.jpg`,
    url,
    extern: {},
  }));

  const titleMatch = chapterHtml.match(
    /<meta[^>]+property="og:comicname"[^>]+content="([^"]+)"/,
  );
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

  getSettingsBundle,
};
