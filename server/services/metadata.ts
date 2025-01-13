import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

interface ToolMetadata {
  description?: string;
  pricing?: string;
  logo?: string;
}

export async function extractMetadata(url: string): Promise<ToolMetadata> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Try to get meta description
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                       document.querySelector('meta[property="og:description"]')?.getAttribute('content');

    // Try to find pricing information (common patterns)
    const pricingSelectors = [
      '.pricing',
      '#pricing',
      '[data-testid="pricing"]',
      'section:contains("Pricing")',
      'div:contains("Price")',
    ];

    let pricing: string | undefined;
    for (const selector of pricingSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        pricing = element.textContent?.trim();
        break;
      }
    }

    // Try to get logo
    const logo = document.querySelector('link[rel="icon"]')?.getAttribute('href') ||
                document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
                document.querySelector('meta[property="og:image"]')?.getAttribute('content');

    return {
      description: description?.trim(),
      pricing: pricing?.trim(),
      logo: logo ? new URL(logo, url).toString() : undefined
    };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {};
  }
}
