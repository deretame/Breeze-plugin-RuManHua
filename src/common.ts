import type {
  ActionItem,
  ChapterSummary,
  ComicListItem,
  ImageItem,
  MetadataListItem,
  PagingInfo,
  StringMap,
} from "breeze-plugin-kit";

export const PLUGIN_ID = "4c2f8df0-3916-4924-b4cd-4e6b8d340a73";
export const BASE_URL = "http://www.rumanhua2.com";
export const PLACEHOLDER_IMAGE_URL =
  "https://www.rumanhua2.com/static/images/logo.png";

/**
 * 阅读页图片解密 key 表。
 * 下标对应 HTML 中 `.readerContainer` 的 `data-id`。
 */
export const IMAGE_KEYS = [
  "smkhy258",
  "smkd95fv",
  "md496952",
  "cdcsdwq",
  "vbfsa256",
  "cawf151c",
  "cd56cvda",
  "8kihnt9",
  "dso15tlo",
  "5ko6plhy",
];

export function toStringMap(value: unknown): StringMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function createActionItem(
  name: unknown,
  onTap: StringMap = {},
  extern: StringMap = {},
): ActionItem {
  return {
    name: String(name ?? ""),
    onTap,
    extern,
  };
}

export const PLACEHOLDER_IMAGE_PATH = "placeholder/image-404.png";

export function createImage(
  input: {
    id?: string;
    url?: string;
    name?: string;
    path?: string;
    extern?: StringMap;
  } = {},
): ImageItem {
  const url = String(input.url ?? "").trim();
  return {
    id: String(input.id ?? ""),
    url: url || PLACEHOLDER_IMAGE_URL,
    name: String(input.name ?? ""),
    path: String(input.path ?? "").trim() || PLACEHOLDER_IMAGE_PATH,
    extern: input.extern ?? {},
  };
}

export function createMetadataActionList(
  type: string,
  name: string,
  values: unknown,
): MetadataListItem {
  const list = Array.isArray(values) ? values : values == null ? [] : [values];
  return {
    type,
    name,
    value: list
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0)
      .map((item) => createActionItem(item)),
  };
}

export function createComicItem(
  id: string,
  title: string,
  coverUrl?: string,
  author?: string,
): ComicListItem {
  const path = `comic/${id}/cover.png`;
  return {
    source: PLUGIN_ID,
    id,
    title,
    subtitle: author ? `作者：${author}` : "",
    finished: false,
    likesCount: 0,
    viewsCount: 0,
    updatedAt: "",
    cover: createImage({
      id,
      url: coverUrl,
      path,
      name: "cover.png",
      extern: { path },
    }),
    metadata: [
      createMetadataActionList("author", "作者", author ? [author] : []),
    ],
    raw: { id, name: title, author },
    extern: {},
  };
}

export function createPaging(page = 1, pages = 1, total = 1): PagingInfo {
  return {
    page,
    pages,
    total,
    hasReachedMax: true,
  };
}

export function createChapterSummary(
  chapterId: string,
  name: string,
  order: number,
): ChapterSummary {
  return {
    id: chapterId,
    requestId: chapterId,
    logicalKey: chapterId,
    storageChapterId: chapterId,
    name,
    order,
    extern: {},
  };
}

// ---------------------------------------------------------------------------
// network
// ---------------------------------------------------------------------------

const DEFAULT_HEADERS: Record<string, string> = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export async function fetchText(
  url: string,
  init?: RequestInit,
): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { ...DEFAULT_HEADERS, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText} (${url})`);
  }
  return res.text();
}

export async function postForm(
  url: string,
  body: Record<string, string>,
  init?: Omit<RequestInit, "body" | "method">,
): Promise<string> {
  const params = new URLSearchParams(body);
  return fetchText(url, {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: BASE_URL,
      ...(init?.headers ?? {}),
    },
    body: params.toString(),
  });
}

function loadHtml(html: string) {
  return BreezeHtml.load(html);
}

function spanTextAfter($: ReturnType<typeof loadHtml>, label: string): string {
  const normalizedLabel = label.replace(/[：:]/g, "");
  const regex = new RegExp(
    `${normalizedLabel.split("").join("\\s*")}\\s*[：:]\\s*(.+?)\\s*$`,
  );
  const found = $("span")
    .filter((_, el) => regex.test($(el).text().trim()))
    .first()
    .text()
    .trim();
  const match = found.match(regex);
  return match?.[1]?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// page parsing
// ---------------------------------------------------------------------------

export function parseSearchItems(html: string): ComicListItem[] {
  const $ = loadHtml(html);
  const items: ComicListItem[] = [];
  $(".col-auto").each((_, el) => {
    const $el = $(el);
    const link = $el.find("a").first().attr("href") ?? "";
    const id = link.replace(/^\//, "").replace(/\/$/, "");
    const $img = $el.find("img").first();
    const coverUrl = $img.attr("data-src") ?? $img.attr("src") ?? "";
    const altTitle = $img.attr("alt") ?? "";
    const title = $el.find(".e-title").first().text().trim();
    const author = $el.find(".tip").first().text().trim();
    if (!id) return;
    items.push(createComicItem(id, title || altTitle, coverUrl, author));
  });
  return items;
}

export interface ComicDetailInfo {
  title: string;
  author: string;
  updateTime: string;
  tags: string[];
  status: string;
  description: string;
  coverUrl: string;
}

export function parseComicDetailInfo(
  html: string,
  _comicId: string,
): ComicDetailInfo {
  const $ = loadHtml(html);

  const title = $("h1.name_mh").first().text().trim();
  const author = spanTextAfter($, "作者：");
  const updateTime = spanTextAfter($, "更新时间：");
  const tagsText = spanTextAfter($, "标签：");
  const status = spanTextAfter($, "状态：");
  const description = $("p.content").first().text().replace(/\s+/g, " ").trim();
  const coverUrl = $('meta[property="og:image"]').first().attr("content") ?? "";

  return {
    title,
    author,
    updateTime,
    tags: tagsText.split(/\s+/).filter(Boolean),
    status,
    description,
    coverUrl,
  };
}

export async function fetchAllChapters(
  comicId: string,
): Promise<ChapterSummary[]> {
  const json = await postForm(`${BASE_URL}/morechapter`, { id: comicId });
  const parsed = JSON.parse(json) as {
    code: string;
    msg?: string;
    data?: Array<{ chapterid: string; chaptername: string }>;
  };
  if (parsed.code !== "200") {
    throw new Error(parsed.msg || "获取章节列表失败");
  }

  const list = parsed.data ?? [];
  // /morechapter 返回最新章节在前，需要反转成阅读顺序
  const reversed = [...list].reverse();
  return reversed.map((item, index) =>
    createChapterSummary(item.chapterid, item.chaptername, index + 1),
  );
}

// ---------------------------------------------------------------------------
// chapter image decryption
// ---------------------------------------------------------------------------

/**
 * 从 HTML 中提取 eval(...) 里的 packed JS 函数调用体。
 * 返回：(function(p,a,c,k,e,d){...}(...))
 */
function extractPackedScript(html: string): string {
  const $ = loadHtml(html);
  let packed = "";
  $("script").each((_, el) => {
    const text = $(el).text();
    if (text.includes("eval(function(p,a,c,k,e,d)")) {
      packed = text;
      return false; // break
    }
  });
  if (!packed) {
    throw new Error("未找到 packed JS");
  }

  const start = packed.indexOf("eval(function(p,a,c,k,e,d)");
  if (start === -1) {
    throw new Error("未找到 packed JS");
  }

  let paren = 0;
  let inString = false;
  let stringChar = "";
  let i = start + 4;
  for (; i < packed.length; i++) {
    const ch = packed[i];
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "(") paren++;
    else if (ch === ")") {
      paren--;
      if (paren === 0) {
        i++;
        break;
      }
    }
  }
  return packed.slice(start + 4, i).trim();
}

function splitTopLevel(str: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  let depth = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      current += ch;
      if (ch === "\\") {
        current += str[++i] ?? "";
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      current += ch;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      current += ch;
      continue;
    }
    if (ch === delimiter && depth === 0) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    result.push(current);
  }
  return result;
}

function parseStringLiteral(str: string): string {
  const trimmed = str.trim();
  const quote = trimmed[0];
  if (
    (quote !== '"' && quote !== "'" && quote !== "`") ||
    trimmed[trimmed.length - 1] !== quote
  ) {
    throw new Error(`不是合法字符串字面量: ${trimmed}`);
  }

  return unquoteStringLiteral(trimmed, quote);
}

function unquoteStringLiteral(trimmed: string, quote: string): string {
  let result = "";
  for (let i = 1; i < trimmed.length - 1; i++) {
    const ch = trimmed[i];
    if (ch === "\\") {
      const next = trimmed[++i];
      switch (next) {
        case "n":
          result += "\n";
          break;
        case "t":
          result += "\t";
          break;
        case "r":
          result += "\r";
          break;
        case "b":
          result += "\b";
          break;
        case "f":
          result += "\f";
          break;
        case "v":
          result += "\v";
          break;
        case "0":
          result += "\0";
          break;
        case "\\":
          result += "\\";
          break;
        case '"':
          result += '"';
          break;
        case "'":
          result += "'";
          break;
        case "`":
          result += "`";
          break;
        default:
          result += next ?? "";
          break;
      }
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * 解析 packed JS 的字典参数。
 * 兼容两种形式：
 * 1. 纯字符串字面量：'a|b|c'
 * 2. 字符串调用 split：'a|b|c'.split('|')
 */
function parseDictionaryArg(arg: string): string {
  const trimmed = arg.trim();
  const quote = trimmed[0];
  if (quote !== '"' && quote !== "'" && quote !== "`") {
    throw new Error(`字典参数必须以字符串字面量开头: ${trimmed.slice(0, 80)}`);
  }

  // 找到配对的结束引号（支持转义）
  let escaped = false;
  for (let i = 1; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === quote) {
      return unquoteStringLiteral(trimmed.slice(0, i + 1), quote);
    }
  }

  throw new Error(`字典参数字符串未闭合: ${trimmed.slice(0, 80)}`);
}

interface PackedArgs {
  p: string;
  a: number;
  c: number;
  k: string;
}

function parsePackedArgs(call: string): PackedArgs {
  // call 形如：(function(p,a,c,k,e,d){...body...}(args))
  // 先找到函数体的起始 '{'
  const sigEnd = call.indexOf("{");
  if (sigEnd === -1) {
    throw new Error("无法找到 packed JS 函数体开始");
  }

  // 找配对的 '}'
  let braceDepth = 1;
  let bodyEnd = sigEnd + 1;
  for (; bodyEnd < call.length; bodyEnd++) {
    const ch = call[bodyEnd];
    if (ch === "{") {
      braceDepth++;
    } else if (ch === "}") {
      braceDepth--;
      if (braceDepth === 0) {
        break;
      }
    }
  }
  if (braceDepth !== 0) {
    throw new Error("packed JS 函数体括号不匹配");
  }

  const argsStr = call.slice(bodyEnd + 1).trim();
  if (!argsStr.startsWith("(") || !argsStr.endsWith(")")) {
    throw new Error("packed JS 参数格式异常");
  }

  const args = splitTopLevel(argsStr.slice(1, -1), ",");
  if (args.length < 4) {
    throw new Error("packed JS 参数不足");
  }

  return {
    p: parseStringLiteral(args[0]),
    a: parseInt(args[1].trim(), 10),
    c: parseInt(args[2].trim(), 10),
    k: parseDictionaryArg(args[3]),
  };
}

/**
 * Dean Edwards JavaScript Packer 纯函数解码。
 *
 * 把 `function(p,a,c,k,e,d){...}('...', a, c, '...')` 还原成原始 JS 字符串。
 */
function unpackEdwards(p: string, a: number, c: number, k: string): string {
  const dict = k.split("|");

  function encode(num: number): string {
    const remainder = num % a;
    const prefix = num < a ? "" : encode(Math.floor(num / a));
    const suffix =
      remainder > 35
        ? String.fromCharCode(remainder + 29)
        : remainder.toString(36);
    return prefix + suffix;
  }

  let result = p;
  for (let i = c - 1; i >= 0; i--) {
    const value = dict[i];
    if (!value) {
      continue;
    }
    const token = encode(i);
    result = result.split(new RegExp(`\\b${token}\\b`, "g")).join(value);
  }

  return result;
}

export function extractCipher(html: string): string {
  const call = extractPackedScript(html);
  const { p, a, c, k } = parsePackedArgs(call);
  const decoded = unpackEdwards(p, a, c, k);
  const match = decoded.match(/var __c0rst96="([^"]*)"/);
  if (!match) {
    throw new Error("未找到图片加密数据 __c0rst96");
  }
  return match[1];
}

export function extractReaderId(html: string): number {
  const match = html.match(/class="readerContainer"[^>]*data-id="(\d+)"/);
  if (!match) {
    throw new Error("未找到 readerContainer data-id");
  }
  return parseInt(match[1], 10);
}

/**
 * 解密阅读页图片地址。
 *
 * 流程：base64 解码密文 → 与 key 循环 XOR → 再 base64 解码 → JSON.parse
 */
export function decryptChapterImages(
  cipher: string,
  readerId: number,
): string[] {
  const key = IMAGE_KEYS[readerId];
  if (!key) {
    throw new Error(`不支持的 data-id: ${readerId}`);
  }

  const cipherBuf = Buffer.from(cipher, "base64");
  const keyBuf = Buffer.from(key, "utf8");

  let xored = "";
  for (let i = 0; i < cipherBuf.length; i++) {
    xored += String.fromCharCode(cipherBuf[i] ^ keyBuf[i % keyBuf.length]);
  }

  const jsonStr = Buffer.from(xored, "base64").toString("utf8");
  return JSON.parse(jsonStr) as string[];
}
