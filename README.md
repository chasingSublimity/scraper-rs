# Code Submission for RC

Hiya! This repo contains the code submission for my RC application. The code itself is a font scraper I implemented recently for an interview challenge, and uses Express, Puppeteer, and Flow.

## Project Overview

The format of the project is as follows:

- [`index.js`](src/index.js) is the entry point to the program and starts the server.
- [`server.js`](src/server.js) defines the server and endpoints.
- [`apiSchemas.js`](src/apiSchemas.js) contains the JSON schemas for both the request body and the response body payloads that the `/parseFonts` endpoint should accept and conform to.
- [`helpers/crawlers.js`](src/helpers/crawlers.js) defines the web crawler.
- [`helpers/scrapers.js`](src/helpers/scrapers.js) defines the scraping functions.

## /parseFont

This endpoint takes a URL as an input and returns a list of all font families used on that page. It also optionally supports breadth-first and depth-first crawling.

## /parsePopularFonts

This endpoint returns a list of unique fonts used on the 100 most popular websites built using WebFlow.


## Project Setup Instructions

First, clone the repository to your computer and `cd` into the repository folder, then follow the below instructions to run the server directly with Node or via Docker. If you run the server directly with Node, you have the benefit of server auto-reload working out of the box.

### Running directly on Node.js

1. Make sure you have Node and yarn installed. Node 12+ is recommended, but there shouldn't be any issues running Node 8+.
1. Run `yarn install` to install dependencies.

To run the server:

```bash
yarn start
```

You can verify that the server is running correctly by making the following request with `curl` in another tab:

```bash
curl -d '{"url": "http://news.ycombinator.com"}' -H "Content-Type: application/json" -X POST http://localhost:3007/parseFonts
```

### Running via Docker

1. Ensure you have `make` and Docker installed.

To run the server:

```
make docker-start
```

You can verify that the server is running correctly by making the following request with `curl` in another tab:

```bash
curl -d '{"url": "http://news.ycombinator.com"}' -H "Content-Type: application/json" -X POST http://localhost:3007/parseFonts
```
