import plugin from "./src/index";

async function main() {
  console.log("=== searchComic: 我为苍生 ===");
  const search = await plugin.searchComic({ keyword: "我为苍生" });
  console.log("items count:", search.items.length);
  console.log("first:", search.items[0]?.title, search.items[0]?.id);

  const comicId = search.items[0]?.id ?? "DjRybRf";

  console.log("\n=== getComicDetail:", comicId, "===");
  const detail = await plugin.getComicDetail({ comicId });
  console.log("title:", detail.data.normal.comicInfo.title);
  console.log(
    "titleMeta:",
    detail.data.normal.comicInfo.titleMeta.map((m) => m.name).join(" | "),
  );
  console.log("chapters count:", detail.data.normal.eps.length);

  const chapterId = detail.data.normal.eps[0]?.requestId ?? "NJGMxte";

  console.log("\n=== getReadSnapshot:", comicId, chapterId, "===");
  const snapshot = await plugin.getReadSnapshot({ comicId, chapterId });
  console.log("chapter name:", snapshot.data.chapter.name);
  console.log("pages count:", snapshot.data.chapter.pages.length);
  console.log("first page url:", snapshot.data.chapter.pages[0]?.url);

  const imageUrl = snapshot.data.chapter.pages[0]?.url;
  if (imageUrl) {
    console.log("\n=== fetchImageBytes ===");
    const bytes = await plugin.fetchImageBytes({ url: imageUrl });
    console.log("image bytes length:", bytes.length);
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
