// @flow

/**
 * The server for the font scraper.
 */

import express from 'express';
import puppeteer from 'puppeteer';
import { TimeoutError } from 'puppeteer/Errors';
import async from 'async';
import { parse as parseUrl} from 'url';

import { crawl } from './helpers/crawlers';
import { scrapeFonts, grabLinkFromLandingPage, scrapeLandingPages } from './helpers/scrapers';

// used to change color of logs
const cyan = '\x1b[36m%s\x1b[0m';
const red = '\u001b[31m';

export default async function serve({port}: {port: number}) {
  const app = express();
  app.use(express.json());

  app.post('/parseFonts', async (req, res, next) => {
    const requestError = validateRequest(req.body);
    if (requestError) {
      console.error(requestError, req.body);
      return res.status(400).json({ok: false, reason: requestError });
    }

    // normalize url
    const url: string = parseUrl(req.body.url).href;
    const crawlRelative: string|boolean = req.body.crawlRelative || false;
    const pageLimit: number = req.body.pageLimit || 1;

    const browser = await puppeteer.launch({ args: ['--disable-web-security', '--no-sandbox'] });

    const scrapeResults = await crawl(url, pageLimit, browser, crawlRelative);

    await browser.close();
    if (scrapeResults.err) {
      return res.status(500).json({ok: false, reason: scrapeResults.err });
    } else {
      console.info(cyan, 'Parsing complete');
      res.json({
        ok: true,
        fontFamilies: scrapeResults.fonts
      });
    }
  });

  app.get('/parsePopularFonts', async (req, res, next) => {
    const concurrency: number = req.query.concurrency === undefined
      ? 2
      : Number(req.query.concurrency);
    const sentFonts: { [key: string]: boolean} = {};
    const pageLimit: number = 100;
    const browser = await puppeteer.launch({args: ['--disable-web-security',  '--no-sandbox']});

    res.set('Content-Type', 'application/json');

    if (isNaN(concurrency) || concurrency === 0) {
      return res.status(400).json({err: 'If provided, concurrency must be a number greater than 0'});
    }

    // The callback defined here begins firing once items start entering the queue
    const queue = async.queue(async (landingPageUrl: string) => {
      let urlToScrape = '';
      let fonts = [];
      try {
        urlToScrape = await grabLinkFromLandingPage(await browser.newPage(), landingPageUrl);

        // Handles the odd case of a landing page
        // not having a link to the actual project. ex: https://webflow.com/website/Andre-Givenchy-Portfolio
        if (!urlToScrape) {
          console.warn('Unable to scrape url from ', landingPageUrl);
          return;
        }

        console.info('Scraping ', urlToScrape);
        fonts = await scrapeFonts(browser, urlToScrape);
      } catch (e) {
        if (e instanceof TimeoutError) {
          console.warn('Timeout while scraping: ', landingPageUrl);
          return;
        }
      }

      fonts.forEach(font => {
        if (!sentFonts[font]) {
          res.write(JSON.stringify({font}));
          sentFonts[font] = true;
        }
      });
    }, concurrency);

    // Called when queue is emptied
    queue.drain(async () => {
      console.info(cyan, 'Scraping complete, closing browser');
      await browser.close();
      res.end();
    });

    // Fires on major errors. Recoverable errors
    // are handled in the queue.
    queue.error((err, task) => {
      queue.kill();
      const message = 'Something went wrong parsing: ' + task;
      console.error(red, message, err);
      res.status(500).write(JSON.stringify({err: message}));
      res.end();
    });

    let galleryPage: number = 1;
    let landingPagesScraped: number = 0;
    // populate the async queue, which kicks off the callback
    while (landingPagesScraped < pageLimit) {
      console.info(cyan, 'Scraping landing page ', galleryPage);

      const page = await browser.newPage();
      const url = `https://webflow.com/discover/popular?page=${galleryPage}`;
      const landingPages = await scrapeLandingPages(page, url);

      landingPages.forEach(link => {
        if (landingPagesScraped < pageLimit) {
          landingPagesScraped++;
          queue.push(link);
        }
      });
      galleryPage++;
    }
  });

  return new Promise((resolve, reject) => {
    const _server = app.listen(port, err => {
      if (err) {
        reject(err);
        return;
      }
      console.log(`App listening on port ${port}.`);
      resolve(_server);
    });
  });
}

const validateRequest = (requestBody: { url: string, pageLimit: number, crawlRelative: boolean | string}): string|void => {
  if (!requestBody.url) {
    return 'No url provided in request body';
  }

  if (requestBody.pageLimit && (typeof requestBody.pageLimit !== 'number' || requestBody.pageLimit < 1)) {
    return 'pageLimit must be an integer greater than 0';
  }

  const valid = ['breadth-first', 'depth-first'];
  if (requestBody.crawlRelative && !valid.includes(requestBody.crawlRelative)) {
    return 'crawlRelative must be either false, "breadth-first", or "depth-first"';
  }
};
