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
    'cellspacing'
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style', 'onclick', 'onerror', 'onload', 'onmouseover']
};

/**
 * Safely convert markdown to sanitized HTML
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown) return '';
  
  try {
    // Convert markdown to HTML
    const html = await marked(markdown);
    
    // Sanitize the HTML
    return typeof html === 'string' ? purify.sanitize(html, sanitizeOptions) : '';
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
