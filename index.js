const DoubanParser = require("./libs/douban-parser.js");
const IMDbParser = require("./libs/imdb-parser.js");
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

// 生成响应（目前仅供测试解析是否正常，并非实际的 API 响应格式）
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
      await doubanEntry.init();
      let imdbEntry;
      if (doubanEntry.imdbID) {
        imdbEntry = new IMDbParser(doubanEntry.imdbID);
        await imdbEntry.init();
      }
      respBody = JSON.stringify({
        poster: doubanEntry.poster,
        title: doubanEntry.title,
        year: doubanEntry.year,
        regions: doubanEntry.regions,
        genres: doubanEntry.genres,
        languages: doubanEntry.languages,
        releaseDates: doubanEntry.releaseDates,
        imdbRating: (imdbEntry ? imdbEntry.imdbRating : undefined) || undefined,
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
