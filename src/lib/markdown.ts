import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type { IOptions } from "sanitize-html";
import { load, type CheerioAPI, type Cheerio } from "cheerio";
import type { Element } from "domhandler";

// Configure marked with basic options
marked.setOptions({
  gfm: true,
  breaks: true,
  async: true,
  // Only include options that are part of the MarkedOptions type
  // See: https://marked.js.org/using_advanced#options
});

// Configure sanitize-html to allow the elements and attributes we expect from markdown content
const sanitizeOptions: IOptions = {
  allowedTags: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "em",
    "strong",
    "del",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "blockquote",
    "pre",
    "code",
    "hr",
    "div",
    "span",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "iframe",
    "sup",
    "sub"
  ],
  allowedAttributes: {
    a: ["href", "title", "class", "target"],
    img: ["src", "alt", "title", "class", "width", "height", "align"],
    table: [
      "class",
      "width",
      "height",
      "border",
      "cellpadding",
      "cellspacing",
      "align",
      "data-column-count",
      "data-flex-columns"
    ],
    th: ["class", "align"],
    td: ["class", "align"],
    ol: ["start", "value", "class"],
    iframe: ["src", "title", "allow", "allowfullscreen", "loading", "referrerpolicy", "width", "height", "frameborder", "class"],
    '*': ["class"]
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"]
  },
  allowProtocolRelative: false,
  selfClosing: ["img", "br", "hr"],
  disallowedTagsMode: "discard"
};

const BLANK_LINE_MARKER = '<p class="md-spacer"></p>';

type RenderMarkdownOptions = {
  paragraphizeLineBreaks?: boolean;
};

const YOUTUBE_DIRECTIVE = /\{\{\s*youtube\s*:\s*([^\}]+?)\s*\}\}/gi;

function extractYouTubeId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^[a-zA-Z0-9_-]{6,}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.replace(/^\/+/, "").split("/")[0] || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const id = url.searchParams.get("v");
      if (id) return id;
      const pathParts = url.pathname.split("/").filter(Boolean);
      const embedIndex = pathParts.indexOf("embed");
      if (embedIndex >= 0 && pathParts[embedIndex + 1]) return pathParts[embedIndex + 1];
      const shortsIndex = pathParts.indexOf("shorts");
      if (shortsIndex >= 0 && pathParts[shortsIndex + 1]) return pathParts[shortsIndex + 1];
    }
  } catch {
    return null;
  }

  return null;
}

function injectYouTubeEmbeds(markdown: string): string {
  if (!markdown || !markdown.includes("youtube")) {
    return markdown;
  }

  return markdown.replace(YOUTUBE_DIRECTIVE, (_match, rawValue) => {
    const videoId = extractYouTubeId(String(rawValue));
    if (!videoId) return _match;

    return [
      '<div class="video-embed">',
      `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}"`,
      'title="YouTube video player"',
      'frameborder="0"',
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"',
      'allowfullscreen',
      'loading="lazy"',
      'referrerpolicy="strict-origin-when-cross-origin"></iframe>',
      "</div>"
    ].join(" ");
  });
}

function preserveBlankLineSpacing(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let blankCount = 0;
  let inFence = false;
  let fenceMarker: string | null = null;

  const flushBlanks = () => {
    if (blankCount === 0) return;
    output.push("");
    for (let i = 1; i < blankCount; i += 1) {
      output.push(BLANK_LINE_MARKER);
      output.push("");
    }
    blankCount = 0;
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        flushBlanks();
        inFence = true;
        fenceMarker = marker;
        output.push(line);
        continue;
      }
      if (fenceMarker && marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length) {
        inFence = false;
        fenceMarker = null;
        output.push(line);
        continue;
      }
    }

    if (inFence) {
      output.push(line);
      continue;
    }

    if (line.trim() === "") {
      blankCount += 1;
      continue;
    }

    flushBlanks();
    output.push(line);
  }

  return output.join("\n");
}

function splitParagraphsOnLineBreaks(html: string): string {
  if (!html.includes("<br")) {
    return html;
  }

  const $ = load(html);

  $("p").each((_, pNode) => {
    const paragraph = $(pNode);
    const nodes = paragraph.contents().toArray();
    const parts: string[] = [];
    let current: string[] = [];

    nodes.forEach((node) => {
      if (node.type === "tag" && node.name === "br") {
        parts.push(current.join(""));
        current = [];
        return;
      }
      current.push($.html(node));
    });

    parts.push(current.join(""));

    if (parts.length <= 1) {
      return;
    }

    const replacement = parts
      .map((part) => part.trim())
      .map((part) => (part.length ? `<p>${part}</p>` : BLANK_LINE_MARKER))
      .join("");

    paragraph.replaceWith(replacement);
  });

  return $.root().children().toArray().map((node) => $.html(node)).join("");
}

function isImageOnlyElement(element: Cheerio<Element>, $: CheerioAPI): boolean {
  const nodes = element.contents().toArray();
  if (nodes.length === 0) {
    return false;
  }

  return nodes.every((node) => {
    if (node.type === "text") {
      return (node.data ?? "").trim() === "";
    }

    if (node.type === "tag") {
      if (node.name === "img") {
        return true;
      }
      if (node.name === "a") {
        return isImageOnlyElement($(node), $);
      }
    }

    return false;
  });
}

function findPreviousListForContinuation(list: Cheerio<Element>, $: CheerioAPI): Cheerio<Element> | null {
  let sibling = list.prev();

  while (sibling.length) {
    const node = sibling.get(0);
    if (!node) {
      sibling = sibling.prev();
      continue;
    }

    if (node.type === "tag" && node.name === "ol") {
      return sibling as Cheerio<Element>;
    }

    if (node.type === "tag" && isImageOnlyElement(sibling as Cheerio<Element>, $)) {
      sibling = sibling.prev();
      continue;
    }

    return null;
  }

  return null;
}

function nextListStart(
  previous: Cheerio<Element> | null,
  lengths: WeakMap<Element, number>,
  starts: WeakMap<Element, number>
): number | null {
  if (!previous?.length) return null;
  const node = previous.get(0);
  if (!node) return null;
  const prevLength = lengths.get(node) ?? 0;
  if (prevLength === 0) return null;
  const prevStart = starts.get(node) ?? 1;
  return prevStart + prevLength;
}

function adjustOrderedLists(html: string): string {
  if (!html.includes("<ol")) {
    return html;
  }

  const $ = load(html);
  const listLengths = new WeakMap<Element, number>();
  const listStarts = new WeakMap<Element, number>();

  $("ol").each((_, listNode) => {
    const list = $(listNode);
    const items = list.children("li");
    if (!items.length) {
      return;
    }

    const firstItem = items.first();
    const explicitStart = parseInt(firstItem.attr("start") ?? firstItem.attr("value") ?? "", 10);
    const initialStart = Number.isFinite(explicitStart) ? explicitStart : 1;
    listStarts.set(listNode, initialStart);
    listLengths.set(listNode, items.length);
  });

  $("ol").each((_, listNode) => {
    const list = $(listNode);
    const items = list.children("li");
    if (!items.length) {
      return;
    }

    const continuationTarget = findPreviousListForContinuation(list as Cheerio<Element>, $);
    const startValue = nextListStart(continuationTarget, listLengths, listStarts);

    if (startValue && startValue > 1) {
      items.each((index, itemNode) => {
        const value = startValue + index;
        const item = $(itemNode);
        if (index === 0) {
          item.attr("start", String(value));
        } else {
          item.removeAttr("start");
        }
        item.attr("value", String(value));
      });
      listStarts.set(listNode, startValue);
    } else {
      items.each((_, itemNode) => {
        const item = $(itemNode);
        item.removeAttr("start");
        item.removeAttr("value");
      });
      listStarts.set(listNode, 1);
    }

    listLengths.set(listNode, items.length);
  });

  return $.root().children().toArray().map((node) => $.html(node)).join("");
}

function cellHasDisplayableContent(cell: Cheerio<Element>): boolean {
  const text = cell.text().replace(/\u00a0/g, " ").trim();
  if (text.length > 0) {
    return true;
  }

  if (cell.find("img, picture, svg, video, iframe, object, embed").length > 0) {
    return true;
  }

  return false;
}

function pruneEmptyTableSegments(table: Cheerio<Element>, $: CheerioAPI): void {
  const rows = table.find("tr").toArray();
  let maxColumns = 0;

  rows.forEach((rowNode) => {
    const cellCount = $(rowNode).children("th,td").length;
    if (cellCount > maxColumns) {
      maxColumns = cellCount;
    }
  });

  if (maxColumns === 0) {
    table.remove();
    return;
  }

  const columnHasContent = Array.from({ length: maxColumns }, () => false);

  rows.forEach((rowNode) => {
    $(rowNode)
      .children("th,td")
      .each((colIndex, cellNode) => {
        if (cellHasDisplayableContent($(cellNode))) {
          columnHasContent[colIndex] = true;
        }
      });
  });

  for (let colIndex = columnHasContent.length - 1; colIndex >= 0; colIndex--) {
    if (!columnHasContent[colIndex]) {
      rows.forEach((rowNode) => {
        const cells = $(rowNode).children("th,td");
        const target = cells.eq(colIndex);
        if (target.length) {
          target.remove();
        }
      });
    }
  }

  rows.forEach((rowNode) => {
    const row = $(rowNode);
    const cells = row.children("th,td");
    const hasContent = cells.toArray().some((cellNode) => cellHasDisplayableContent($(cellNode)));
    if (!hasContent) {
      row.remove();
    }
  });
}

function wrapTables(html: string): string {
  if (!html.includes("<table")) {
    return html;
  }

  const $ = load(html);

  $("table").each((_, tableNode) => {
    const table = $(tableNode);
    if (table.parent().hasClass("table-scroll-inner")) {
      return;
    }

    pruneEmptyTableSegments(table, $);

    const sanitizedRows = table.find("tr");
    if (!sanitizedRows.length) {
      table.remove();
      return;
    }

    const firstRow = sanitizedRows.first();
    let columnCount = firstRow.children("th,td").length;
    const columnStats: Array<{ score: number; longestWord: number }> = [];

    table.find("tr").each((_, rowNode) => {
      const cells = $(rowNode).children("th,td");
      cells.each((colIndex, cellNode) => {
        const cell = $(cellNode);
        const text = (cell.text() || "").replace(/\s+/g, " ").trim();
        const normalizedLength = text.length;
        const longestWord = text
          ? text.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0)
          : 0;

        if (colIndex + 1 > columnCount) {
          columnCount = colIndex + 1;
        }

        if (!columnStats[colIndex]) {
          columnStats[colIndex] = { score: 0, longestWord: 0 };
        }

        columnStats[colIndex].score += normalizedLength;
        columnStats[colIndex].longestWord = Math.max(columnStats[colIndex].longestWord, longestWord);

        const baseClass = `table-col-${colIndex + 1}`;
        if (!cell.hasClass(baseClass)) {
          cell.addClass(baseClass);
        }
      });
    });

    if (columnCount > 0) {
      table.attr("data-column-count", String(columnCount));
    }

    const scoredColumns = Array.from({ length: columnCount }, (_, index) => ({
      index,
      score: columnStats[index]?.score ?? 0,
      longestWord: columnStats[index]?.longestWord ?? 0
    }));

    const wrapTarget = Math.max(1, Math.ceil(columnCount / 2));
    const flexIndices = new Set<number>();

    scoredColumns
      .slice()
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.longestWord - a.longestWord;
      })
      .slice(0, wrapTarget)
      .forEach((col) => flexIndices.add(col.index));

    scoredColumns.forEach((col) => {
      if (col.longestWord >= 16) {
        flexIndices.add(col.index);
      }
    });

    table.find("tr").each((_, rowNode) => {
      $(rowNode)
        .children("th,td")
        .each((colIndex, cellNode) => {
          const cell = $(cellNode);
          const roleClass = flexIndices.has(colIndex) ? "table-col-flex" : "table-col-compact";
          if (!cell.hasClass(roleClass)) {
            cell.addClass(roleClass);
          }
        });
    });

    if (columnCount > 0) {
      if (flexIndices.size) {
        table.attr(
          "data-flex-columns",
          Array.from(flexIndices)
            .sort((a, b) => a - b)
            .map((index) => String(index + 1))
            .join(" ")
        );
      } else {
        table.removeAttr("data-flex-columns");
      }
    }

    const inner = $('<div class="table-scroll-inner"></div>');
    const wrapper = $('<div class="table-scroll-wrapper"></div>');

    table.replaceWith(wrapper);
    inner.append(table);
    wrapper.append(inner);
  });

  return $.root().children().toArray().map((node) => $.html(node)).join("");
}

/**
 * Safely convert markdown to sanitized HTML
 */
export async function renderMarkdown(markdown: string, options: RenderMarkdownOptions = {}): Promise<string> {
  if (!markdown) return "";

  try {
    // Convert markdown to HTML
    const normalized = preserveBlankLineSpacing(injectYouTubeEmbeds(markdown));
    const html = await marked(normalized);
    const adjusted = typeof html === "string" ? adjustOrderedLists(html) : html;
    const withTables = typeof adjusted === "string" ? wrapTables(adjusted) : adjusted;
    const withParagraphs =
      typeof withTables === "string" && options.paragraphizeLineBreaks
        ? splitParagraphsOnLineBreaks(withTables)
        : withTables;

    // Sanitize the HTML
    return typeof withParagraphs === "string" ? sanitizeHtml(withParagraphs, sanitizeOptions) : "";
  } catch (error) {
    console.error("Error rendering markdown:", error);
    return "";
  }
}

/**
 * Convert markdown to plain text (for previews, meta descriptions, etc.)
 */
export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';
  
  return markdown
    // Remove HTML tags
    .replace(/<[^>]*>?/gm, '')
    // Remove markdown links
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // Remove markdown images
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove markdown formatting
    .replace(/[#*_~`>]/g, '')
    // Remove multiple spaces and line breaks
    .replace(/\s+/g, ' ')
    .trim();
}
