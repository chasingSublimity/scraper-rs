// @flow

import { scrapeFonts, scrapeRelativeLinks } from './scrapers';

import type { Browser } from 'puppeteer';

export async function crawl(initialUrl: string, maxRequests: number, browser: Browser, crawlType: string|boolean): Promise<{fonts?: string[], err?: string}> {
  console.info('\x1b[36m%s\x1b[0m', 'Starting scrape');

  const visitedSites: { [key: string]: boolean}  = {};
  const fontsToReturn: Set<string> = new Set([]);
  const urlsToScrape: string[] = [initialUrl];

  while (urlsToScrape.length) {
    try {
      const url = urlsToScrape.pop();
      if (visitedSites[url] || pageLimitReached(visitedSites, maxRequests)) { continue; }

      console.info('Scraping ' + url);
      const scrapedFonts = await scrapeFonts(browser, url);

      scrapedFonts.forEach(font => fontsToReturn.add(font));
      if (maxRequests === 1 || !crawlType) { break; }
      visitedSites[url] = true;

      const links = await scrapeRelativeLinks(await browser.newPage(), url);

      links.forEach(link => {
        if (!visitedSites[link] && !pageLimitReached(visitedSites, maxRequests)) {
          if (crawlType === 'breadth-first') {
            urlsToScrape.unshift(link);
          } else {
            urlsToScrape.push(link);
          }
        }
      });
    } catch (err) {
      const message = 'Error while scraping: '  + err;
      console.error('\u001b[31m', message);
      // If the first url was bad, there's
      // nothing else we can do
      if (!Object.keys(visitedSites).length) {
        return { err: err.message };
      }
    }
  }

  return { fonts: Array.from(fontsToReturn) };
}

const pageLimitReached = (visitedSites: {}, maxRequests: number): boolean => Object.keys(visitedSites).length >= maxRequests;
