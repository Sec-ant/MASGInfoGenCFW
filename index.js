const DoubanWorker = require("./libs/douban-worker.js");
const IMDbWorker = require("./libs/imdb-worker.js");
const MtimeWorker = require("./libs/mtime-worker.js");
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

  // 声明缓存
  const cache = caches.default;
  // 检查缓存
  // let response = await cache.match(request);

  if (/\/douban\/?$/.test(pathName)) {
    const id = searchParams.get("id");
    const reqHeaders = {
      cookie: searchParams.get("cookie") || incomeHeaders.get("cookie"),
    };
    if (/^\d+$/.test(id)) {
      const doubanEntry = new DoubanWorker(id, reqHeaders, cache);
      await doubanEntry.init();
      let [mtimeEntry, imdbEntry] = await Promise.all([
        (async () => {
          let mtimeID = await doubanEntry.mtimeID;
          if (mtimeID) {
            let mtimeEntry = new MtimeWorker(mtimeID, cache);
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
            let imdbEntry = new IMDbWorker(imdbID, cache);
            return imdbEntry.init();
          } else {
            return {
              imdbID: null,
              imdbRating: null,
            };
          }
        })(),
      ]);
      if (doubanEntry.data.year !== mtimeEntry.data.year) {
        mtimeEntry.data = {
          mtimeID: null,
          behindTheScene: null,
        };
      }
      respBody = JSON.stringify({
        douban: {
          data: doubanEntry.data,
          error: doubanEntry.error,
        },
        imdb: {
          data: imdbEntry.data,
          error: imdbEntry.error,
        },
        mtime: {
          data: mtimeEntry.data,
          error: mtimeEntry.error,
        },
      });
    } else {
    }
  } else if ("/favicon.ico" === pathName) {
  }
  return new Response(respBody, {
    headers: respHeaders,
  });
}
