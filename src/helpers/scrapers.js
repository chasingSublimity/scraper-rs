// @flow
import async from 'async';

import type { Page, Browser } from 'puppeteer';

// Scrapes fonts from stylesheets, both inline and external
async function scrapeSheets(page: Page, url: string): Promise<string[]> {
  await page.goto(url);

  const data = await page.evaluate(() => {
    const styleSheets: Array<any> = Array.from(document.styleSheets);

    const fonts: Set<string> = new Set([]);

    styleSheets.forEach(sheet => {
      let rules: Array<any>;
      try {
        rules = Array.from(sheet.cssRules);
      } catch {
        console.warn('Could not access all style sheets for: ', document.URL);
        return;
      }

      rules.forEach(rule => {
        if (rule.style && rule.style['font-family']) {
          rule.style['font-family']
            .split(', ') // handle potential font stacks
            .forEach(font => {
              fonts.add(font);
            });
        }
      });
    });

    return Array.from(fonts);
  });

  await page.close();
  return data;
}

// Scrapes fonts from the style attributes of tags
async function scrapeTags(page: Page, url: string): Promise<string[]> {
  await page.goto(url);

  const data = await page.evaluate(() => {
    const tags: ?NodeList<any> = document.querySelectorAll('[style*="font-family"]');
    if (!tags) { return []; }

    const fonts: Set<string> = new Set([]);

    tags.forEach(tag => {
      tag.style['font-family']
        .split(', ')
        .forEach(font => {
          fonts.add(font);
        });
    });

    return Array.from(fonts);
  });

  await page.close();
  return data;
}

// Scrapes hrefs from relative links
export async function scrapeRelativeLinks(page: Page, url: string): Promise<string[]> {
  await page.goto(url);

  const data = await page.evaluate(() => {
    const  links: Array<HTMLElement> = Array.from(document.links);

    if (!links.length) { return []; }
    /**
      * Regex used to match origin-relative ('/en-US/docs')
      * and directory relative ('./en-US/docs/') urls.
      *
      * Technically, it is a negative lookahead that asserts that
      * the string does not match: absolute, scheme/protocol relative,
      * mailto urls or url fragments. ie:
      *
      * Matches:
      * ./funky/town.html
      * /funky/town.html
      * funky/town.html
      *
      * Does not match:
      * https://www.example.com/funky/town.html
      * //example.com/funky/town.html
      * mailto:funky@town.com
      * #
    */
    const relativeUrlRegex = new RegExp(/^(?!www\.|#|tel:|mailto:|(?:http|ftp)s?:\/\/|[A-Za-z]:\\|\/\/).*/);

    const uniqueLinks: Set<string> = new Set([]);

    // because these links are consumed by ephemeral pupteteer pages,
    // we send the `href` property, which is a computed absolute url.
    links.forEach((link: any) => {
      const href: ?string = link.getAttribute('href');
      if (href && href.match(relativeUrlRegex)) {
        uniqueLinks.add(link.href);
      }
    });

    return Array.from(uniqueLinks);
  });

  await page.close();
  return data;
}

export async function scrapeFonts(browser: Browser, url: string): Promise<string[]> {
  const fonts = await async.parallel([
    async () => await scrapeSheets(await browser.newPage(), url),
    async () => await scrapeTags(await browser.newPage(), url)
  ]);

  return fonts.flat();
}

export async function grabLinkFromLandingPage(page: Page, url: string): Promise<string|null> {
  await page.goto(url);

  const link = await page.evaluate(() => {
    const anchor: ?HTMLElement = document.querySelector('a.site-link');
    if (anchor && !(anchor instanceof HTMLAnchorElement)) { throw new Error("Expected an 'anchor' element."); }

    return anchor ? anchor.href : null;
  });

  await page.close();
  return link;
}

export async function scrapeLandingPages(page: Page, url: string): Promise<string[]> {
  await page.goto(url);

  const landingPages = await page.evaluate(() => {
    // these anchors store the url we want
    const anchors: ?NodeList<any> = document.querySelectorAll('a.preview');

    return Array.from(anchors||[]).map(anchor => anchor.href);
  });

  await page.close();
  return landingPages;
}
