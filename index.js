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
class doubanParser {
  constructor(id, headers) {
    this.doubanID = id;
    this.headers = headers;
  }

  async init() {
    let infoPagePromise = this.getPage();
    // let celebritiesPagePromise = getPage('celebrities');
    // let awardsPagePromise = getPage('awards');

    let resp = await infoPagePromise;

    if (resp.ok) {
      await this.parsePage(resp, this.doubanInfoPageParser);
      if (this._firstSeasonDoubanID !== null) {
        const doubanItem = new doubanParser(
          this._firstSeasonDoubanID,
          this.headers
        );
        await doubanItem.init();
        this.imdbID = doubanItem.imdbID;
      }
    }
  }

  getPage(type = "") {
    let pageURL = `https://movie.douban.com/subject/${this.doubanID}/`;
    return fetch((pageURL += type), {
      headers: this.headers,
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

  parsePage(resp, parser) {
    let rewriter = new HTMLRewriter();
    for (const el of parser.element) {
      rewriter = rewriter.on(el.selector, {
        [el.target]: el.handler.bind(this),
      });
    }
    const pDocument = parser.document;
    Object.keys(pDocument).forEach(
      (key) => (pDocument[key] = pDocument[key].bind(this))
    );
    rewriter = rewriter.onDocument(pDocument);
    return rewriter.transform(resp).text();
  }

  get doubanInfoPageParser() {
    return {
      element: [
        {
          selector: "title",
          target: "text",
          handler: this.setChineseTitle,
        },
        {
          selector: "#content h1>span[property]",
          target: "text",
          handler: this.setOriginalTitle,
        },
        {
          selector: "#mainpic img",
          target: "element",
          handler: this.setPoster,
        },
        {
          selector: "#content > h1 > span.year",
          target: "text",
          handler: this.setYear,
        },
        {
          selector: '#info span[property="v:genre"]',
          target: "text",
          handler: this.setGenres,
        },
        {
          selector: '#info span[property="v:initialReleaseDate"]',
          target: "element",
          handler: this.setReleaseDates,
        },
        {
          selector: '#info span[property="v:runtime"]',
          target: "text",
          handler: this.initDurations,
        },
        {
          selector: "#season > option:first-child",
          target: "element",
          handler: this.setFirstSeasonDoubanID,
        },
        {
          selector: '#info a[href^="https://www.imdb.com/title/tt"]',
          target: "element",
          handler: this.setIMDbID,
        },
        {
          selector: "div.tags-body>a",
          target: "element",
          handler: this.setTags,
        },
        {
          selector: '#interest_sectl [property="v:average"]',
          target: "text",
          handler: this.setDoubanAverageRating,
        },
        {
          selector: '#interest_sectl [property="v:votes"]',
          target: "text",
          handler: this.setDoubanRatingVotes,
        },
        {
          selector: "#interest_sectl .ratings-on-weight .rating_per",
          target: "text",
          handler: this.setDoubanRatingHistogram,
        },
        {
          selector:
            '#link-report>[property="v:summary"],#link-report>span.all.hidden',
          target: "element",
          handler: this.initDescription,
        },
        {
          selector:
            '#link-report>[property="v:summary"],#link-report>span.all.hidden',
          target: "text",
          handler: this.setDescription,
        },
        {
          selector: "#info > span.pl",
          target: "text",
          handler: this.startInfo,
        },
        {
          selector: "#info",
          target: "text",
          handler: this.setInfo,
        },
        {
          selector: "#info > br",
          target: "element",
          handler: this.stopInfo,
        },
      ],
      document: {
        end: this.postProcess,
      },
    };
  }

  setChineseTitle(text) {
    if (typeof this._chineseTitle === "undefined") {
      this._chineseTitle = "";
    }
    this._chineseTitle += text.text;
    if (text.lastInTextNode) {
      this._chineseTitle = this._chineseTitle
        .trim()
        .replace(/\(豆瓣\)$/, "")
        .trim();
    }
  }

  setOriginalTitle(text) {
    if (typeof this._originalTitle === "undefined") {
      this._originalTitle = "";
    }
    this._originalTitle += text.text;
    if (text.lastInTextNode) {
      this._originalTitle = this._originalTitle
        .replace(this._chineseTitle, "")
        .trim();
      if (this._originalTitle === "") {
        this._COTitlesSame = true;
        this._originalTitle = this._chineseTitle;
      } else {
        this._COTitlesSame = false;
      }
    }
  }

  setPoster(el) {
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
  }

  setYear(text) {
    if (typeof this.year === "undefined") {
      this.year = "";
    }
    this.year += text.text;
    if (text.lastInTextNode) {
      this.year = this.year.slice(1, -1);
    }
  }

  setGenres(text) {
    if (typeof this.genres === "undefined") {
      this.genres = [];
      this._genre = "";
    }
    this._genre += text.text;
    if (text.lastInTextNode) {
      this.genres.push(this._genre.trim());
      this._genre = "";
    }
  }

  setReleaseDates(el) {
    if (typeof this.releaseDates === "undefined") {
      this.releaseDates = [];
    }
    this.releaseDates.push(el.getAttribute("content"));
  }

  initDurations(text) {
    if (typeof this.durations === "undefined") {
      this.durations = "";
    }
  }

  setFirstSeasonDoubanID(el) {
    if (el.getAttribute("selected") === null) {
      this._firstSeasonDoubanID = el.getAttribute("value");
    }
  }

  setIMDbID(el) {
    this.imdbID = el.getAttribute("href").match(/tt(\d+)/)[1];
  }

  setTags(el) {
    if (typeof this.tags === "undefined") {
      this.tags = [];
    }
    this.tags.push(el.getAttribute("href").slice(5));
  }

  setDoubanAverageRating(text) {
    if (typeof this._doubanAverageRating === "undefined") {
      this._doubanAverageRating = "";
    }
    this._doubanAverageRating += text.text;
    if (text.lastInTextNode) {
      this._doubanAverageRating = parseFloat(this._doubanAverageRating);
    }
  }

  setDoubanRatingVotes(text) {
    if (typeof this._doubanRatingVotes === "undefined") {
      this._doubanRatingVotes = "";
    }
    this._doubanRatingVotes += text.text;
    if (text.lastInTextNode) {
      this._doubanRatingVotes = parseInt(this._doubanRatingVotes);
    }
  }

  setDoubanRatingHistogram(text) {
    if (typeof this._doubanRatingHistogram === "undefined") {
      this._doubanRatingHistogram = [];
      this.__doubanRatingHistogram = "";
    }
    this.__doubanRatingHistogram += text.text;
    if (text.lastInTextNode) {
      this._doubanRatingHistogram.push(
        Number(
          (parseFloat(this.__doubanRatingHistogram.slice(0, -1)) / 100).toFixed(
            5
          )
        )
      );
      this.__doubanRatingHistogram = "";
    }
  }

  initDescription(el) {
    this.description = undefined;
  }

  setDescription(text) {
    if (typeof this.description === "undefined") {
      this.description = [];
      this._description = "";
    }
    this._description += text.text;
    if (text.lastInTextNode) {
      if (this._description.trim()) {
        this.description.push(this._description.trim());
      }
      this._description = "";
    }
  }

  startInfo(text) {
    if (typeof this._label === "undefined") {
      this._label = text.text;
    } else {
      this._label += text.text;
    }
    if (text.lastInTextNode) {
      if ("制片国家/地区:" === this._label) {
        this.regions = "";
      } else if ("语言:" === this._label) {
        this.languages = "";
      } else if ("单集片长:" === this._label) {
        this.episodeDuration = "";
        this._episodeDurationOver = false;
      } else if ("集数:" === this._label) {
        this.episodeCount = "";
        this._episodeCountOver = false;
      } else if ("又名:" === this._label) {
        this._akaTitles = "";
      }
      this._label = "";
    }
  }

  setInfo(text) {
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
      !this._episodeDurationOver
    ) {
      this.episodeDuration += text.text;
    }
    if (typeof this.episodeCount === "string" && !this._episodeCountOver) {
      this.episodeCount += text.text;
    }
    if (typeof this._akaTitles === "string") {
      this._akaTitles += text.text;
    }
  }

  stopInfo(el) {
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
      !this._episodeDurationOver
    ) {
      this.episodeDuration = this.episodeDuration.trim();
      this._episodeDurationOver = true;
    }
    if (typeof this.episodeCount === "string" && !this._episodeCountOver) {
      this.episodeCount = this.episodeCount.trim();
      this._episodeCountOver = true;
    }
    if (typeof this._akaTitles === "string") {
      this._akaTitles = this._akaTitles.trim().split(" / ");
    }
  }

  postProcess(end) {
    if (this._COTitlesSame && /中国/.test(this.regions[0])) {
      this._transTitle = this._akaTitles.find((title) => /[a-z]/i.test(title));
    } else {
      this._transTitle = this._chineseTitle;
    }

    if (typeof this._akaTitles === "undefined") {
      this._akaTitles = [];
    } else {
      const getTitlePriority = (title) =>
        title === this._transTitle
          ? 0
          : /\(港.?台\)$/.test(title)
          ? 1
          : /\([港台]\)$/.test(title)
          ? 2
          : 3;
      this._akaTitles = this._akaTitles
        .sort((ta, tb) => getTitlePriority(ta) - getTitlePriority(tb))
        .filter((t) => t !== this._transTitle);
    }

    this.title = {
      chinese: this._chineseTitle,
      original: this._originalTitle,
      translated: this._transTitle,
      alsoKnownAs: this._akaTitles,
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
      this._episodeDurationOver = true;
    }
    if (typeof this.episodeCount === "undefined") {
      this.episodeCount = null;
      this._episodeCountOver = true;
    }
    if (typeof this._firstSeasonDoubanID === "undefined") {
      this._firstSeasonDoubanID = null;
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
      this._doubanRatingHistogram = Object.fromEntries(
        this._doubanRatingHistogram.map((e, i) => [5 - i, e])
      );
      this.doubanRating = {
        rating: this._doubanAverageRating,
        ratingCount: this._doubanRatingVotes,
        ratingHistograms: {
          "Douban Users": {
            aggregateRating: this._doubanAverageRating,
            demographic: "Douban Users",
            histogram: this._doubanRatingHistogram,
            totalRatings: this._doubanRatingVotes,
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
      const doubanItem = new doubanParser(id, reqHeaders);
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
  }
  return new Response(respBody, {
    headers: respHeaders,
  });
}
