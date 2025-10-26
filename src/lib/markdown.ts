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
    "sup",
    "sub"
  ],
  allowedAttributes: {
    a: ["href", "title", "class", "target"],
    img: ["src", "alt", "title", "class", "width", "height", "align"],
    table: ["class", "width", "height", "border", "cellpadding", "cellspacing", "align"],
    th: ["class", "align"],
    td: ["class", "align"],
    ol: ["start", "value", "class"],
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
export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown) return "";

  try {
    // Convert markdown to HTML
    const html = await marked(markdown);
    const adjusted = typeof html === "string" ? adjustOrderedLists(html) : html;
    const withTables = typeof adjusted === "string" ? wrapTables(adjusted) : adjusted;

    // Sanitize the HTML
    return typeof withTables === "string" ? sanitizeHtml(withTables, sanitizeOptions) : "";
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
