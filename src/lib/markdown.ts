import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Create a JSDOM window and get the DOMPurify function
const { window } = new JSDOM('');
const purify = DOMPurify(window as unknown as Window & typeof globalThis);

// Configure marked with basic options
marked.setOptions({
  gfm: true,
  breaks: true,
  async: true,
  // Only include options that are part of the MarkedOptions type
  // See: https://marked.js.org/using_advanced#options
});

// Configure DOMPurify to allow certain attributes and elements
const sanitizeOptions = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'em', 'strong', 'del', 'u', 's',
    'ul', 'ol', 'li', 'a', 'img', 'blockquote',
    'pre', 'code', 'hr', 'div', 'span', 'table',
    'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'alt', 'src', 'class', 'target',
    'width', 'height', 'align', 'border', 'cellpadding',
    'cellspacing', 'start', 'value'
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style', 'onclick', 'onerror', 'onload', 'onmouseover']
};

function isImageOnlyElement(element: Element): boolean {
  const childNodes = Array.from(element.childNodes);
  if (childNodes.length === 0) {
    return false;
  }

  return childNodes.every((node) => {
    if (node.nodeType === window.Node.TEXT_NODE) {
      return node.textContent?.trim() === '';
    }

    if (node.nodeType === window.Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.tagName === 'IMG') {
        return true;
      }
      if (el.tagName === 'A') {
        return isImageOnlyElement(el);
      }
    }

    return false;
  });
}

function findPreviousListForContinuation(list: HTMLOListElement): HTMLOListElement | null {
  let sibling = list.previousElementSibling;

  while (sibling) {
    if (sibling.tagName === 'OL') {
      return sibling as HTMLOListElement;
    }

    if (isImageOnlyElement(sibling)) {
      sibling = sibling.previousElementSibling;
      continue;
    }

    return null;
  }

  return null;
}

function nextListStart(previous: HTMLOListElement | null, lengths: Map<HTMLOListElement, number>, starts: Map<HTMLOListElement, number>): number | null {
  if (!previous) return null;
  const prevLength = lengths.get(previous) ?? Array.from(previous.querySelectorAll(':scope > li')).length;
  const prevStart = starts.get(previous) ?? 1;
  if (prevLength === 0) return null;
  return prevStart + prevLength;
}

function adjustOrderedLists(html: string): string {
  if (!html.includes('<ol')) {
    return html;
  }

  const dom = new JSDOM(`<body>${html}</body>`);
  const { document } = dom.window;
  const lists = Array.from(document.querySelectorAll('ol')) as HTMLOListElement[];
  const listLengths = new Map<HTMLOListElement, number>();
  const listStarts = new Map<HTMLOListElement, number>();

  for (const list of lists) {
    const items = Array.from(list.querySelectorAll(':scope > li'));
    if (items.length === 0) {
      continue;
    }

    const firstItem = items[0];
    const explicitStart = parseInt(firstItem.getAttribute('start') || firstItem.getAttribute('value') || '', 10);
    const initialStart = Number.isFinite(explicitStart) ? explicitStart : 1;
    listStarts.set(list, initialStart);
    listLengths.set(list, items.length);
  }

  for (const list of lists) {
    const items = Array.from(list.querySelectorAll(':scope > li'));
    if (items.length === 0) {
      continue;
    }

    const continuationTarget = findPreviousListForContinuation(list);
    const startValue = nextListStart(continuationTarget, listLengths, listStarts);

    if (startValue && startValue > 1) {
      items.forEach((item, index) => {
        const value = startValue + index;
        if (index === 0) {
          item.setAttribute('start', String(value));
        } else {
          item.removeAttribute('start');
        }
        item.setAttribute('value', String(value));
      });
      listStarts.set(list, startValue);
    } else {
      items.forEach((item) => {
        item.removeAttribute('start');
        item.removeAttribute('value');
      });
      listStarts.set(list, 1);
    }

    listLengths.set(list, items.length);
  }

  return document.body.innerHTML;
}

/**
 * Safely convert markdown to sanitized HTML
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown) return '';
  
  try {
    // Convert markdown to HTML
    const html = await marked(markdown);
    const adjusted = typeof html === 'string' ? adjustOrderedLists(html) : html;
    
    // Sanitize the HTML
    return typeof adjusted === 'string' ? purify.sanitize(adjusted, sanitizeOptions) : '';
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return '';
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
