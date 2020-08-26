const DoubanParser = require("./libs/douban-parser.js");
/**
 * Cloudflare Worker entrypoint
 */
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

// 常量定义
const AUTHOR = "Secant";
const VERSION = "0.0.1";
const TIMEOUT = 6000;

// 辅助函数
/**
 * Add commas to number
 * @param {Number} number
 */
function addComma(number) {
  let parts = number.toString().split("");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

// 生成响应
async function handleRequest(request) {
  const incomeURL = new URL(request.url);
  const pathName = incomeURL.pathname;
  const searchParams = incomeURL.searchParams;
  const incomeHeaders = new Request(request).headers;

  let respBody = "{}";
  let respHeaders = {
    "content-type": "application/json;charset=UTF-8",
  };

  if (/\/douban\/?$/.test(pathName)) {
    const id = searchParams.get("id");
    const reqHeaders = {
      cookie: searchParams.get("cookie") || incomeHeaders.get("cookie"),
    };
    if (/^\d+$/.test(id)) {
      const doubanEntry = new DoubanParser(id, reqHeaders);
      await Promise.all(
        ["entry", "celebrities", "awards"].map((p) =>
          doubanEntry.requestAndParsePage(p)
        )
      );
      respBody = JSON.stringify({
        poster: doubanEntry.poster,
        title: doubanEntry.title,
        year: doubanEntry.year,
        regions: doubanEntry.regions,
        genres: doubanEntry.genres,
        languages: doubanEntry.languages,
        releaseDates: doubanEntry.releaseDates,
        imdbID: doubanEntry.imdbID,
        doubanRating: doubanEntry.doubanRating,
        doubanID: doubanEntry.doubanID,
        durations: doubanEntry.durations,
        episodeDuration: doubanEntry.episodeDuration,
        episodeCount: doubanEntry.episodeCount,
        celebrities: doubanEntry.celebrities,
        tags: doubanEntry.tags,
        description: doubanEntry.description,
        awards: doubanEntry.awards,
      });
    } else {
    }
  } else if ("/favicon.ico" === pathName) {
  }
  return new Response(respBody, {
    headers: respHeaders,
  });
}
