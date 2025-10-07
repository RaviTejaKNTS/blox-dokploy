import { ReactNode } from 'react';
import Link from 'next/link';

type ProcessedHtml = {
  __html: string;
};

export function processHtmlLinks(html: string): ProcessedHtml {
  if (typeof document === 'undefined') {
    // Server-side: Use string manipulation
    const processedHtml = html.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g, (match, quote, href) => {
      if (!href) return match;
      
      // Skip processing if it's a relative URL or bloxodes.com
      if (href.startsWith('/') || 
          href.startsWith('#') || 
          href.startsWith('mailto:') || 
          href.startsWith('tel:') ||
          new URL(href, 'https://bloxodes.com').hostname === 'bloxodes.com') {
        return match;
      }
      
      // Add target="_blank" and rel="noopener noreferrer" to external links
      if (match.includes('target=')) {
        return match.replace(/target=["'][^"']*["']/, 'target="_blank" rel="noopener noreferrer"');
      } else {
        return `${match} target="_blank" rel="noopener noreferrer"`;
      }
    });
    
    return { __html: processedHtml };
  } else {
    // Client-side: Use DOM manipulation
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const links = tempDiv.querySelectorAll('a');
    links.forEach(link => {
      try {
        const url = new URL(link.href, window.location.origin);
        
        // Skip if it's a relative URL or bloxodes.com
        if (link.href.startsWith('/') || 
            link.href.startsWith('#') || 
            link.href.startsWith('mailto:') || 
            link.href.startsWith('tel:') ||
            url.hostname === 'bloxodes.com') {
          return;
        }
        
        // Add target and rel attributes
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      } catch (e) {
        // If URL parsing fails, leave the link as is
        console.warn('Failed to process link:', link.href, e);
      }
    });
    
    return { __html: tempDiv.innerHTML };
  }
}
