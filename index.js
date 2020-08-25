const he = require("he");
/**
 * Cloudflare Worker entrypoint
 */
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

// 常量定义
const AUTHOR = "TYT";
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

// 类定义
class DoubanParser {
  // 私有实例字段：隐私信息
  #headers;
  // 私有实例字段：中间变量
  #chineseTitle;
  #originalTitle;
  #transTitle;
  #akaTitles;
  #COTitlesSame;
  #genre;
  #firstSeasonDoubanID;
  #doubanAverageRating;
  #doubanRatingVotes;
  #doubanRatingHistogram;
  #_doubanRatingHistogram;
  #description;
  #label;
  #episodeDurationOver;
  #episodeCountOver;

  // 静态私有方法 生成解析模板：调用时需动态绑定 this
  static #infoPageParserGen() {
    return {
      element: [
        {
          // setChineseTitle
          selector: "title",
          target: "text",
          handler: (text) => {
            if (typeof this.#chineseTitle === "undefined") {
              this.#chineseTitle = "";
            }
            this.#chineseTitle += text.text;
            if (text.lastInTextNode) {
              this.#chineseTitle = this.#chineseTitle
                .trim()
                .replace(/\(豆瓣\)$/, "")
                .trim();
            }
          },
        },
        {
          // setOriginalTitle
          selector: "#content h1>span[property]",
          target: "text",
          handler: (text) => {
            if (typeof this.#originalTitle === "undefined") {
              this.#originalTitle = "";
            }
            this.#originalTitle += text.text;
            if (text.lastInTextNode) {
              this.#originalTitle = this.#originalTitle
                .replace(this.#chineseTitle, "")
                .trim();
              if (this.#originalTitle === "") {
                this.#COTitlesSame = true;
                this.#originalTitle = this.#chineseTitle;
              } else {
                this.#COTitlesSame = false;
              }
              // 为何只有这里需要 unescape ? 待解决
              this.#originalTitle = he.decode(this.#originalTitle);
            }
          },
        },
        {
          // setPoster
          selector: "#mainpic img",
          target: "element",
          handler: (el) => {
            try {
              this.poster = el
                .getAttribute("src")
                .replace(
                  /^.+(p\d+).+$/,
                  (_, p1) =>
                    `https://img1.doubanio.com/view/photo/l_ratio_poster/public/${p1}.jpg`
                );
            } catch (err) {
              this.poster = null;
            }
          },
        },
        {
          // setYear
          selector: "#content > h1 > span.year",
          target: "text",
          handler: (text) => {
            if (typeof this.year === "undefined") {
              this.year = "";
            }
            this.year += text.text;
            if (text.lastInTextNode) {
              this.year = this.year.slice(1, -1);
            }
          },
        },
        {
          // setGenres
          selector: '#info span[property="v:genre"]',
          target: "text",
          handler: (text) => {
            if (typeof this.genres === "undefined") {
              this.genres = [];
              this.#genre = "";
            }
            this.#genre += text.text;
            if (text.lastInTextNode) {
              this.genres.push(this.#genre.trim());
              this.#genre = "";
            }
          },
        },
        {
          // setReleaseDates
          selector: '#info span[property="v:initialReleaseDate"]',
          target: "element",
          handler: (el) => {
            if (typeof this.releaseDates === "undefined") {
              this.releaseDates = [];
            }
            this.releaseDates.push(el.getAttribute("content"));
          },
        },
        {
          // initDurations
          selector: '#info span[property="v:runtime"]',
          target: "text",
          handler: (text) => {
            if (typeof this.durations === "undefined") {
              this.durations = "";
            }
          },
        },
        {
          // setFirstSeasonDoubanID
          selector: "#season > option:first-child",
          target: "element",
          handler: (el) => {
            if (el.getAttribute("selected") === null) {
              this.#firstSeasonDoubanID = el.getAttribute("value");
            }
          },
        },
        {
          // setIMDbID
          selector: '#info a[href^="https://www.imdb.com/title/tt"]',
          target: "element",
          handler: (el) => {
            this.imdbID = el.getAttribute("href").match(/tt(\d+)/)[1];
          },
        },
        {
          // setTags
          selector: "div.tags-body>a",
          target: "element",
          handler: (el) => {
            if (typeof this.tags === "undefined") {
              this.tags = [];
            }
            this.tags.push(el.getAttribute("href").slice(5));
          },
        },
        {
          // setDoubanAverageRating
          selector: '#interest_sectl [property="v:average"]',
          target: "text",
          handler: (text) => {
            if (typeof this.#doubanAverageRating === "undefined") {
              this.#doubanAverageRating = "";
            }
            this.#doubanAverageRating += text.text;
            if (text.lastInTextNode) {
              this.#doubanAverageRating = parseFloat(this.#doubanAverageRating);
            }
          },
        },
        {
          // setDoubanRatingVotes
          selector: '#interest_sectl [property="v:votes"]',
          target: "text",
          handler: (text) => {
            if (typeof this.#doubanRatingVotes === "undefined") {
              this.#doubanRatingVotes = "";
            }
            this.#doubanRatingVotes += text.text;
            if (text.lastInTextNode) {
              this.#doubanRatingVotes = parseInt(this.#doubanRatingVotes);
            }
          },
        },
        {
          // setDoubanRatingHistogram
          selector: "#interest_sectl .ratings-on-weight .rating_per",
          target: "text",
          handler: (text) => {
            if (typeof this.#doubanRatingHistogram === "undefined") {
              this.#doubanRatingHistogram = [];
              this.#_doubanRatingHistogram = "";
            }
            this.#_doubanRatingHistogram += text.text;
            if (text.lastInTextNode) {
              this.#doubanRatingHistogram.push(
                Number(
                  (
                    parseFloat(this.#_doubanRatingHistogram.slice(0, -1)) / 100
                  ).toFixed(5)
                )
              );
              this.#_doubanRatingHistogram = "";
            }
          },
        },
        {
          // initDescription
          selector:
            '#link-report>[property="v:summary"],#link-report>span.all.hidden',
          target: "element",
          handler: (el) => {
            this.description = undefined;
          },
        },
        {
          // setDescription
          selector:
            '#link-report>[property="v:summary"],#link-report>span.all.hidden',
          target: "text",
          handler: (text) => {
            if (typeof this.description === "undefined") {
              this.description = [];
              this.#description = "";
            }
            this.#description += text.text;
            if (text.lastInTextNode) {
              if (this.#description.trim()) {
                this.description.push(this.#description.trim());
              }
              this.#description = "";
            }
          },
        },
        {
          // startInfo
          selector: "#info > span.pl",
          target: "text",
          handler: (text) => {
            if (typeof this.#label === "undefined") {
              this.#label = text.text;
            } else {
              this.#label += text.text;
            }
            if (text.lastInTextNode) {
              if ("制片国家/地区:" === this.#label) {
                this.regions = "";
              } else if ("语言:" === this.#label) {
                this.languages = "";
              } else if ("单集片长:" === this.#label) {
                this.episodeDuration = "";
                this.#episodeDurationOver = false;
              } else if ("集数:" === this.#label) {
                this.episodeCount = "";
                this.#episodeCountOver = false;
              } else if ("又名:" === this.#label) {
                this.#akaTitles = "";
              }
              this.#label = "";
            }
          },
        },
        {
          // setInfo
          selector: "#info",
          target: "text",
          handler: (text) => {
            if (typeof this.regions === "string") {
              this.regions += text.text;
            }
            if (typeof this.languages === "string") {
              this.languages += text.text;
            }
            if (typeof this.durations === "string") {
              this.durations += text.text;
            }
            if (
              typeof this.episodeDuration === "string" &&
              !this.#episodeDurationOver
            ) {
              this.episodeDuration += text.text;
            }
            if (
              typeof this.episodeCount === "string" &&
              !this.#episodeCountOver
            ) {
              this.episodeCount += text.text;
            }
            if (typeof this.#akaTitles === "string") {
              this.#akaTitles += text.text;
            }
          },
        },
        {
          // stopInfo
          selector: "#info > br",
          target: "element",
          handler: (el) => {
            if (typeof this.regions === "string") {
              this.regions = this.regions.trim().split(" / ");
            }
            if (typeof this.languages === "string") {
              this.languages = this.languages.trim().split(" / ");
            }
            if (typeof this.durations === "string") {
              this.durations = this.durations.trim().split(" / ");
            }
            if (
              typeof this.episodeDuration === "string" &&
              !this.#episodeDurationOver
            ) {
              this.episodeDuration = this.episodeDuration.trim();
              this.#episodeDurationOver = true;
            }
            if (
              typeof this.episodeCount === "string" &&
              !this.#episodeCountOver
            ) {
              this.episodeCount = this.episodeCount.trim();
              this.#episodeCountOver = true;
            }
            if (typeof this.#akaTitles === "string") {
              this.#akaTitles = this.#akaTitles.trim().split(" / ");
            }
          },
        },
      ],
      document: {
        // postProcess
        end: (end) => {
          if (this.#COTitlesSame && /中国/.test(this.regions[0])) {
            this.#transTitle = this.#akaTitles.find((title) =>
              /[a-z]/i.test(title)
            );
          } else {
            this.#transTitle = this.#chineseTitle;
          }

          if (typeof this.#akaTitles === "undefined") {
            this.#akaTitles = [];
          } else {
            const getTitlePriority = (title) =>
              title === this.#transTitle
                ? 0
                : /\(港.?台\)$/.test(title)
                ? 1
                : /\([港台]\)$/.test(title)
                ? 2
                : 3;
            this.#akaTitles = this.#akaTitles
              .sort((ta, tb) => getTitlePriority(ta) - getTitlePriority(tb))
              .filter((t) => t !== this.#transTitle);
          }

          this.title = {
            chinese: this.#chineseTitle,
            original: this.#originalTitle,
            translated: this.#transTitle,
            alsoKnownAs: this.#akaTitles,
          };

          if (typeof this.poster === "undefined") {
            this.poster = null;
          }
          if (typeof this.year === "undefined") {
            this.year = null;
          }
          if (typeof this.genres === "undefined") {
            this.genres = [];
          }
          if (typeof this.releaseDates === "undefined") {
            this.releaseDates = [];
          }
          if (typeof this.regions === "undefined") {
            this.regions = [];
          }
          if (typeof this.languages === "undefined") {
            this.languages = [];
          }
          if (typeof this.durations === "undefined") {
            this.durations = [];
          }
          if (typeof this.episodeDuration === "undefined") {
            this.episodeDuration = null;
            this.#episodeDurationOver = true;
          }
          if (typeof this.episodeCount === "undefined") {
            this.episodeCount = null;
            this.#episodeCountOver = true;
          }
          if (typeof this.#firstSeasonDoubanID === "undefined") {
            this.#firstSeasonDoubanID = null;
          }
          if (typeof this.imdbID === "undefined") {
            this.imdbID = null;
          }
          if (typeof this.tags === "undefined") {
            this.tags = [];
          }
          if (typeof this.releaseDates === "undefined") {
            this.releaseDates = [];
          } else {
            try {
              this.releaseDates.sort((a, b) => new Date(a) - new Date(b));
            } catch (err) {}
          }
          if (typeof this.description === "undefined") {
            this.description = null;
          } else {
            this.description = this.description.join("\n");
          }
          try {
            this.#doubanRatingHistogram = Object.fromEntries(
              this.#doubanRatingHistogram.map((e, i) => [5 - i, e])
            );
            this.doubanRating = {
              rating: this.#doubanAverageRating,
              ratingCount: this.#doubanRatingVotes,
              ratingHistograms: {
                "Douban Users": {
                  aggregateRating: this.#doubanAverageRating,
                  demographic: "Douban Users",
                  histogram: this.#doubanRatingHistogram,
                  totalRatings: this.#doubanRatingVotes,
                },
              },
            };
          } catch (err) {
            this.doubanRating = {
              rating: null,
              ratingCount: null,
              ratingHistograms: {
                "Douban Users": {
                  aggregateRating: null,
                  demographic: null,
                  histogram: null,
                  totalRatings: null,
                },
              },
            };
          }
        },
      },
    };
  }

  // 静态私有方法 解析页面：根据解析模板解析页面
  static async #parsePage(resp, parser) {
    let rewriter = new HTMLRewriter();
    parser.element.forEach(({ selector, target, handler }) => {
      rewriter = rewriter.on(selector, {
        [target]: handler,
      });
    });
    rewriter = rewriter.onDocument(parser.document);
    return await rewriter.transform(resp).text();
  }

  // 构造函数：创建实例
  constructor(id, headers) {
    this.doubanID = id;
    this.#headers = headers;
  }

  // 公有实例方法 初始化函数：解析页面并向实例字段赋值（待拆分）
  async init() {
    let infoPagePromise = this.#requestPage();
    // let celebritiesPagePromise = getPage('celebrities');
    // let awardsPagePromise = getPage('awards');

    let resp = await infoPagePromise;

    if (resp.ok) {
      await DoubanParser.#parsePage(
        resp,
        DoubanParser.#infoPageParserGen.apply(this)
      );
      if (this.#firstSeasonDoubanID !== null) {
        const doubanItem = new DoubanParser(
          this.#firstSeasonDoubanID,
          this.#headers
        );
        await doubanItem.init();
        this.imdbID = doubanItem.imdbID;
      }
    }
  }

  // 私有实例方法 请求页面：请求相关页面
  async #requestPage(type = "") {
    let pageURL = `https://movie.douban.com/subject/${this.doubanID}/`;
    return await fetch((pageURL += type), {
      headers: this.#headers,
      /*
      cf: {
        minify: {
          javascript: true,
          css: true,
          html: false,
        },
        cacheKey: type + (this.headers.cookie || "").trim() + this.doubanID,
        cacheTtl: 43200,
      },
      */
    });
  }
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
      const doubanItem = new DoubanParser(id, reqHeaders);
      await doubanItem.init();
      respBody = JSON.stringify({
        poster: doubanItem.poster,
        title: doubanItem.title,
        year: doubanItem.year,
        regions: doubanItem.regions,
        genres: doubanItem.genres,
        languages: doubanItem.languages,
        releaseDates: doubanItem.releaseDates,
        imdbID: doubanItem.imdbID,
        doubanRating: doubanItem.doubanRating,
        doubanID: doubanItem.doubanID,
        durations: doubanItem.durations,
        episodeDuration: doubanItem.episodeDuration,
        episodeCount: doubanItem.episodeCount,
        tags: doubanItem.tags,
        description: doubanItem.description,
      });
    } else {
      respBody = JSON.stringify({
        status: false,
        error: "Douban ID format error, pure digits are expected",
      });
    }
  } else if ("/favicon.ico" === pathName) {
  }
  return new Response(respBody, {
    headers: respHeaders,
  });
}
