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
      let doubanEntry, mtimeEntry, imdbEntry;
      doubanEntry = await new DoubanWorker(id, reqHeaders, cache).init();
      if (!doubanEntry.error.exists) {
        [mtimeEntry, imdbEntry] = await Promise.all([
          (async () => {
            let mtimeID = await doubanEntry.mtimeID;
            let mtimeEntry = new MtimeWorker(mtimeID, cache);
            if (mtimeID) {
              return await mtimeEntry.init();
            } else {
              mtimeEntry.error.exists = true;
              mtimeEntry.error.errors.push({
                url: null,
                status: 0,
                statusText: "Mtime ID Not Found",
              });
              return mtimeEntry;
            }
          })(),
          (async () => {
            let imdbID = await doubanEntry.imdbID;
            let imdbEntry = new IMDbWorker(imdbID, cache);
            if (imdbID) {
              return await imdbEntry.init();
            } else {
              imdbEntry.error.exists = true;
              imdbEntry.error.errors.push({
                url: null,
                status: 0,
                statusText: "IMDb ID Not Found",
              });
              return imdbEntry;
            }
          })(),
        ]);
      }
      respBody = JSON.stringify({
        data: {
          douban: doubanEntry,
          imdb: imdbEntry,
          mtime: mtimeEntry,
        },
        error: {
          exists: false,
          errors: [],
        },
      });
    } else {
      respBody = JSON.stringify({
        data: {},
        error: {
          exists: true,
          errors: [
            {
              url: null,
              status: 0,
              statusText: "Invalid Request ID",
            },
          ],
        },
      });
    }
  } else if ("/favicon.ico" === pathName) {
  }
  return new Response(respBody, {
    headers: respHeaders,
  });
}
