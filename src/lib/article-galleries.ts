import { load } from "cheerio";
import type { Element } from "domhandler";

function isImageBlock($: ReturnType<typeof load>, node: Element): boolean {
  if (node.type !== "tag") return false;
  const tagName = node.name.toLowerCase();
  if (tagName === "table") return false;
  const element = $(node);
  if (element.text().trim().length) return false;
  if (tagName === "img") return true;
  const images = element.find("img");
  if (images.length !== 1) return false;
  return true;
}

export function buildImageGalleries(html: string): string {
  if (!html?.trim()) return html;

  const $ = load(`<div data-article-root>${html}</div>`);
  const root = $("[data-article-root]");
  const nodes = root.children().toArray();
  const output: string[] = [];

  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index];
    if (!isImageBlock($, node)) {
      output.push($.html(node));
      index += 1;
      continue;
    }

    const group: Element[] = [];
    let cursor = index;
    while (cursor < nodes.length && isImageBlock($, nodes[cursor])) {
      group.push(nodes[cursor]);
      cursor += 1;
    }

    if (group.length === 1 || group.length > 4) {
      group.forEach((entry) => output.push($.html(entry)));
      index = cursor;
      continue;
    }

    const gallery = $("<div>").addClass("article-gallery").attr("data-count", String(group.length));
    for (const entry of group) {
      const item = $("<div>").addClass("article-gallery__item");
      item.append($(entry).clone());
      gallery.append(item);
    }

    output.push($.html(gallery));
    index = cursor;
  }

  return output.join("");
}
