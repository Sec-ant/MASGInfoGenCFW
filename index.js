const DoubanParser = require("./libs/douban-parser.js");
const IMDbParser = require("./libs/imdb-parser.js");
const MtimeParser = require("./libs/mtime-parser.js");
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
// 添加数字位逗号分隔符
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
      let [mtimeEntry, imdbEntry] = await Promise.all([
        (async () => {
          let mtimeID = await doubanEntry.mtimeID;
          if (mtimeID) {
            let mtimeEntry = new MtimeParser(mtimeID);
            return mtimeEntry.init();
          } else {
            return {
              mtimeID: null,
              behindTheScene: [],
            };
          }
        })(),
        (async () => {
          let imdbID = await doubanEntry.imdbID;
          if (imdbID) {
            let imdbEntry = new IMDbParser(imdbID);
            return imdbEntry.init();
          } else {
            return {
              imdbID: null,
              imdbRating: null,
            };
          }
        })(),
      ]);
      if (doubanEntry.year !== mtimeEntry.year) {
        mtimeEntry = {
          mtimeID: null,
          behindTheScene: null,
        };
      }
      respBody = JSON.stringify({
        poster: doubanEntry.poster,
        title: doubanEntry.title,
        year: doubanEntry.year,
        regions: doubanEntry.regions,
        genres: doubanEntry.genres,
        languages: doubanEntry.languages,
        releaseDates: doubanEntry.releaseDates,
        imdbRating: imdbEntry.imdbRating,
        imdbID: imdbEntry.imdbID,
        doubanRating: doubanEntry.doubanRating,
        doubanID: doubanEntry.doubanID,
        mtimeID: mtimeEntry.mtimeID,
        durations: doubanEntry.durations,
        episodeDuration: doubanEntry.episodeDuration,
        episodeCount: doubanEntry.episodeCount,
        celebrities: doubanEntry.celebrities,
        tags: doubanEntry.tags,
        description: doubanEntry.description,
        awards: doubanEntry.awards,
        mtimeBehindTheScene: mtimeEntry.behindTheScene,
      });
    } else {
    }
  } else if ("/favicon.ico" === pathName) {
  }
  return new Response(respBody, {
    headers: respHeaders,
  });
}
