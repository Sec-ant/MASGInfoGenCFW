const he = require("he");
const XWorker = require("./x-worker.js");
// 类定义
class DoubanWorker extends XWorker {
  // 私有实例字段：隐私信息
  #headers;
  // 私有实例字段：中间变量
  #data = {};
  // 私有实例字段：其他数据库 ID
  #imdbID;
  #mtimeID;

  // 构造函数：创建实例
  constructor(id, headers, cache) {
    super(cache);
    this.data.doubanID = id;
    this.#headers = headers;
  }

  // 静态公有方法 生成条目页面解析模板：调用时需动态绑定 this
  static entryPageParserGen() {
    return {
      element: [
        {
          // 中文标题
          selector: "title",
          target: "text",
          handler: (text) => {
            if (typeof this.#data.chineseTitle === "undefined") {
              this.#data.chineseTitle = "";
            }
            this.#data.chineseTitle += text.text;
            if (text.lastInTextNode) {
              this.#data.chineseTitle = this.#data.chineseTitle
                .trim()
                .replace(/\(豆瓣\)$/, "")
                .trim();
            }
          },
        },
        {
          // 原始标题
          selector: "#content h1>span[property]",
          target: "text",
          handler: (text) => {
            if (typeof this.#data.originalTitle === "undefined") {
              this.#data.originalTitle = "";
            }
            this.#data.originalTitle += text.text;
            if (text.lastInTextNode) {
              this.#data.originalTitle = this.#data.originalTitle
                .replace(this.#data.chineseTitle, "")
                .trim();
              if (this.#data.originalTitle === "") {
                this.#data.COTitlesSame = true;
                this.#data.originalTitle = this.#data.chineseTitle;
              } else {
                this.#data.COTitlesSame = false;
              }
              this.#data.originalTitle = he.decode(this.#data.originalTitle);
            }
          },
        },
        {
          // 海报
          selector: "#mainpic img",
          target: "element",
          handler: (el) => {
            try {
              this.data.poster = el
                .getAttribute("src")
                .replace(
                  /^.+(p\d+).+$/,
                  (_, p1) =>
                    `https://img1.doubanio.com/view/photo/l_ratio_poster/public/${p1}.jpg`
                );
            } catch (err) {
              this.data.poster = null;
            }
          },
        },
        {
          // 年份
          selector: "#content>h1>span.year",
          target: "text",
          handler: (text) => {
            if (typeof this.data.year === "undefined") {
              this.data.year = "";
            }
            this.data.year += text.text;
            if (text.lastInTextNode) {
              this.data.year = Number(this.data.year.slice(1, -1));
            }
          },
        },
        {
          // 类别
          selector: '#info span[property="v:genre"]',
          target: "text",
          handler: (text) => {
            if (typeof this.data.genres === "undefined") {
              this.data.genres = [];
              this.#data.genre = "";
            }
            this.#data.genre += text.text;
            if (text.lastInTextNode) {
              this.data.genres.push(this.#data.genre.trim());
              this.#data.genre = "";
            }
          },
        },
        {
          // 上映日期
          selector: '#info span[property="v:initialReleaseDate"]',
          target: "element",
          handler: (el) => {
            if (typeof this.data.releaseDates === "undefined") {
              this.data.releaseDates = [];
            }
            this.data.releaseDates.push(el.getAttribute("content"));
          },
        },
        {
          // 初始化时长
          selector: '#info span[property="v:runtime"]',
          target: "text",
          handler: (text) => {
            if (typeof this.data.durations === "undefined") {
              this.data.durations = "";
            }
          },
        },
        {
          // 第一季豆瓣 ID
          selector: "#season>option:first-child",
          target: "element",
          handler: (el) => {
            if (el.getAttribute("selected") === null) {
              this.#data.firstSeasonDoubanID = el.getAttribute("value");
            }
          },
        },
        {
          // IMDb ID
          selector: '#info a[href^="https://www.imdb.com/title/tt"]',
          target: "element",
          handler: (el) => {
            this.#imdbID = el.getAttribute("href").match(/tt(\d+)/)[1];
          },
        },
        {
          // 标签
          selector: "div.tags-body>a",
          target: "element",
          handler: (el) => {
            if (typeof this.data.tags === "undefined") {
              this.data.tags = [];
            }
            this.data.tags.push(el.getAttribute("href").slice(5));
          },
        },
        {
          // 豆瓣综合评分
          selector: '#interest_sectl [property="v:average"]',
          target: "text",
          handler: (text) => {
            if (typeof this.#data.doubanAverageRating === "undefined") {
              this.#data.doubanAverageRating = "";
            }
            this.#data.doubanAverageRating += text.text;
            if (text.lastInTextNode) {
              this.#data.doubanAverageRating = parseFloat(
                this.#data.doubanAverageRating
              );
            }
          },
        },
        {
          // 豆瓣评分人数
          selector: '#interest_sectl [property="v:votes"]',
          target: "text",
          handler: (text) => {
            if (typeof this.#data.doubanRatingVotes === "undefined") {
              this.#data.doubanRatingVotes = "";
            }
            this.#data.doubanRatingVotes += text.text;
            if (text.lastInTextNode) {
              this.#data.doubanRatingVotes = parseInt(
                this.#data.doubanRatingVotes
              );
            }
          },
        },
        {
          // 豆瓣星级分布
          selector: "#interest_sectl .ratings-on-weight .rating_per",
          target: "text",
          handler: (text) => {
            if (typeof this.#data.doubanRatingHistogram === "undefined") {
              this.#data.doubanRatingHistogram = [];
              this.#data._doubanRatingHistogram = "";
            }
            this.#data._doubanRatingHistogram += text.text;
            if (text.lastInTextNode) {
              this.#data.doubanRatingHistogram.push(
                Number(
                  (
                    parseFloat(this.#data._doubanRatingHistogram.slice(0, -1)) /
                    100
                  ).toFixed(5)
                )
              );
              this.#data._doubanRatingHistogram = "";
            }
          },
        },
        {
          // 初始化简介
          selector:
            '#link-report>[property="v:summary"],#link-report>span.all.hidden',
          target: "element",
          handler: (el) => {
            this.data.description = undefined;
          },
        },
        {
          // 简介
          selector:
            '#link-report>[property="v:summary"],#link-report>span.all.hidden',
          target: "text",
          handler: (text) => {
            if (typeof this.data.description === "undefined") {
              this.data.description = [];
              this.#data.description = "";
            }
            this.#data.description += text.text;
            if (text.lastInTextNode) {
              if (this.#data.description.trim()) {
                this.data.description.push(this.#data.description.trim());
              }
              this.#data.description = "";
            }
          },
        },
        {
          // 初始化详细信息
          selector: "#info>span.pl",
          target: "text",
          handler: (text) => {
            if (typeof this.#data.label === "undefined") {
              this.#data.label = text.text;
            } else {
              this.#data.label += text.text;
            }
            if (text.lastInTextNode) {
              if ("制片国家/地区:" === this.#data.label) {
                this.data.regions = "";
              } else if ("语言:" === this.#data.label) {
                this.data.languages = "";
              } else if ("单集片长:" === this.#data.label) {
                this.data.episodeDuration = "";
                this.#data.episodeDurationOver = false;
              } else if ("集数:" === this.#data.label) {
                this.data.episodeCount = "";
                this.#data.episodeCountOver = false;
              } else if ("又名:" === this.#data.label) {
                this.#data.akaTitles = "";
              }
              this.#data.label = "";
            }
          },
        },
        {
          // 详细信息：制片国家/地区，语言，单集片长，集数，又名
          selector: "#info",
          target: "text",
          handler: (text) => {
            if (typeof this.data.regions === "string") {
              this.data.regions += text.text;
            }
            if (typeof this.data.languages === "string") {
              this.data.languages += text.text;
            }
            if (typeof this.data.durations === "string") {
              this.data.durations += text.text;
            }
            if (
              typeof this.data.episodeDuration === "string" &&
              !this.#data.episodeDurationOver
            ) {
              this.data.episodeDuration += text.text;
            }
            if (
              typeof this.data.episodeCount === "string" &&
              !this.#data.episodeCountOver
            ) {
              this.data.episodeCount += text.text;
            }
            if (typeof this.#data.akaTitles === "string") {
              this.#data.akaTitles += text.text;
            }
          },
        },
        {
          // 收尾详细信息
          selector: "#info>br",
          target: "element",
          handler: (el) => {
            if (typeof this.data.regions === "string") {
              this.data.regions = this.data.regions.trim().split(" / ");
            }
            if (typeof this.data.languages === "string") {
              this.data.languages = this.data.languages.trim().split(" / ");
            }
            if (typeof this.data.durations === "string") {
              this.data.durations = this.data.durations.trim().split(" / ");
            }
            if (
              typeof this.data.episodeDuration === "string" &&
              !this.#data.episodeDurationOver
            ) {
              this.data.episodeDuration = this.data.episodeDuration.trim();
              this.#data.episodeDurationOver = true;
            }
            if (
              typeof this.data.episodeCount === "string" &&
              !this.#data.episodeCountOver
            ) {
              this.data.episodeCount = this.data.episodeCount.trim();
              this.#data.episodeCountOver = true;
            }
            if (typeof this.#data.akaTitles === "string") {
              this.#data.akaTitles = this.#data.akaTitles.trim().split(" / ");
            }
          },
        },
      ],
      document: {
        // 后处理收尾
        end: (end) => {
          if (
            this.#data.akaTitles &&
            this.#data.COTitlesSame &&
            /中国/.test(this.data.regions[0])
          ) {
            this.#data.transTitle = this.#data.akaTitles.find((title) =>
              /[a-z]/i.test(title)
            );
          } else {
            this.#data.transTitle = this.#data.chineseTitle;
          }

          if (typeof this.#data.akaTitles === "undefined") {
            this.#data.akaTitles = [];
          } else {
            const getTitlePriority = (title) =>
              title === this.#data.transTitle
                ? 0
                : /\(港.?台\)$/.test(title)
                ? 1
                : /\([港台]\)$/.test(title)
                ? 2
                : 3;
            this.#data.akaTitles = this.#data.akaTitles
              .sort((ta, tb) => getTitlePriority(ta) - getTitlePriority(tb))
              .filter((t) => t !== this.#data.transTitle);
          }

          this.data.title = {
            chinese: this.#data.chineseTitle,
            original: this.#data.originalTitle,
            translated: this.#data.transTitle,
            alsoKnownAs: this.#data.akaTitles,
          };

          if (typeof this.data.poster === "undefined") {
            this.data.poster = null;
          }
          if (typeof this.data.year === "undefined") {
            this.data.year = null;
          }
          if (typeof this.data.genres === "undefined") {
            this.data.genres = [];
          }
          if (typeof this.data.releaseDates === "undefined") {
            this.data.releaseDates = [];
          }
          if (typeof this.data.regions === "undefined") {
            this.data.regions = [];
          }
          if (typeof this.data.languages === "undefined") {
            this.data.languages = [];
          }
          if (typeof this.data.durations === "undefined") {
            this.data.durations = [];
          }
          if (typeof this.data.episodeDuration === "undefined") {
            this.data.episodeDuration = null;
            this.#data.episodeDurationOver = true;
          }
          if (typeof this.data.episodeCount === "undefined") {
            this.data.episodeCount = null;
            this.#data.episodeCountOver = true;
          }
          if (typeof this.#data.firstSeasonDoubanID === "undefined") {
            this.#data.firstSeasonDoubanID = null;
          }
          if (typeof this.#imdbID === "undefined") {
            this.#imdbID = null;
          }
          if (typeof this.data.tags === "undefined") {
            this.data.tags = [];
          }
          if (typeof this.data.releaseDates === "undefined") {
            this.data.releaseDates = [];
          } else {
            try {
              this.data.releaseDates.sort((a, b) => new Date(a) - new Date(b));
            } catch (err) {}
          }
          if (typeof this.data.description === "undefined") {
            this.data.description = null;
          } else {
            this.data.description = this.data.description.join("\n");
          }
          try {
            this.#data.doubanRatingHistogram = Object.fromEntries(
              this.#data.doubanRatingHistogram.map((e, i) => [5 - i, e])
            );
          } catch (err) {
            this.#data.doubanRatingHistogram = null;
          }
          this.data.doubanRating = {
            rating: this.#data.doubanAverageRating || null,
            ratingCount: this.#data.doubanRatingVotes || null,
            ratingHistograms: {
              "Douban Users": {
                aggregateRating: this.#data.doubanAverageRating || null,
                demographic: "Douban Users",
                histogram: this.#data.doubanRatingHistogram || null,
                totalRatings: this.#data.doubanRatingVotes || null,
              },
            },
          };
        },
      },
    };
  }

  // 静态公有方法 生成获奖页面解析模板：调用时需动态绑定 this
  static awardsPageParserGen() {
    // 获奖项人员收尾辅助函数
    const windupWinners = () => {
      this.#data.categories[this.#data.categoriesNumber].winners = this.#data
        .winners
        ? he
            .decode(this.#data.winners)
            .split("/")
            .map((p) => p.trim())
        : [];
      this.#data.winners = "";
    };
    // 获奖项收尾辅助函数
    const windupCategories = () => {
      this.data.awards[
        this.#data.awardsNumber
      ].categories = this.#data.categories;
      this.#data.categories = undefined;
    };
    return {
      element: [
        {
          // 获奖名称
          selector: "div.awards>.hd>h2>a",
          target: "text",
          handler: (text) => {
            if (typeof this.data.awards === "undefined") {
              this.data.awards = [];
              this.#data.awardsTitle = "";
              this.#data.awardsNumber = 0;
            } else if (this.#data.awardsTitle === "") {
              windupWinners();
              windupCategories();
              ++this.#data.awardsNumber;
            }
            this.#data.awardsTitle += text.text;
            if (text.lastInTextNode) {
              this.data.awards.push({
                title: he.decode(this.#data.awardsTitle).trim(),
              });
              this.#data.awardsTitle = "";
            }
          },
        },
        {
          // 获奖年份
          selector: "div.awards>.hd>h2>span.year",
          target: "text",
          handler: (text) => {
            if (typeof this.#data.awardsYear === "undefined") {
              this.#data.awardsYear = "";
            }
            this.#data.awardsYear += text.text;
            if (text.lastInTextNode) {
              this.data.awards[this.#data.awardsNumber].year = parseInt(
                this.#data.awardsYear.match(/\d+/)[0]
              );
              this.#data.awardsYear = "";
            }
          },
        },
        {
          // 获奖项名称
          selector: "div.awards>.award>li:first-of-type",
          target: "text",
          handler: (text) => {
            if (typeof this.#data.categories === "undefined") {
              this.#data.categories = [];
              this.#data.categoriesTitle = "";
              this.#data.categoriesNumber = 0;
            } else if (this.#data.categoriesTitle === "") {
              windupWinners();
              ++this.#data.categoriesNumber;
            }
            this.#data.categoriesTitle += text.text;
            if (text.lastInTextNode) {
              this.#data.categories.push({
                title: he.decode(this.#data.categoriesTitle).trim(),
              });
              this.#data.categoriesTitle = "";
            }
          },
        },
        {
          // 获奖项人员
          selector: "div.awards>.award>li:nth-of-type(2)",
          target: "text",
          handler: (text) => {
            if (typeof this.#data.winners === "undefined") {
              this.#data.winners = "";
            }
            this.#data.winners += text.text;
          },
        },
      ],
      document: {
        // 后处理收尾
        end: (end) => {
          if (typeof this.data.awards === "undefined") {
            this.data.awards = [];
          } else {
            windupWinners();
            windupCategories();
          }
        },
      },
    };
  }

  // 静态公有方法 生成影人页面解析模板：调用时需动态绑定 this
  static celebritiesPageParserGen() {
    // 影人列表收尾辅助函数
    const windupCelebrityList = () => {
      this.data.celebrities[
        this.#data.celebritiesNumber
      ].celebrityList = this.#data.celebrityList;
      this.#data.celebrityList = undefined;
    };
    return {
      element: [
        {
          // 影人大类名称
          selector: "#celebrities>div.list-wrapper>h2",
          target: "text",
          handler: (text) => {
            if (typeof this.data.celebrities === "undefined") {
              this.data.celebrities = [];
              this.#data.positionName = "";
              this.#data.celebritiesNumber = 0;
            } else if (this.#data.positionName === "") {
              windupCelebrityList();
              ++this.#data.celebritiesNumber;
            }
            this.#data.positionName += text.text;
            if (text.lastInTextNode) {
              const [
                positionChinese,
                positionForeign,
              ] = this.#data.positionName
                .match(/([^ ]*)(?:$| )(.*)/)
                .slice(1, 3);
              this.data.celebrities.push({
                position: {
                  chinese: positionChinese || null,
                  foreign: positionForeign || null,
                },
              });
              this.#data.positionName = "";
            }
          },
        },
        {
          // 影人名称
          selector: "#celebrities>div.list-wrapper li.celebrity>.info>.name",
          target: "text",
          handler: (text) => {
            if (typeof this.#data.celebrityList === "undefined") {
              this.#data.celebrityList = [];
              this.#data.celebrityName = "";
              this.#data.celebrityListNumber = 0;
            }
            this.#data.celebrityName += text.text;
            if (text.lastInTextNode) {
              let [nameChinese, nameForeign] = this.#data.celebrityName
                .match(/([^ ]*)(?:$| )(.*)/)
                .slice(1, 3);
              if (!/[\u4E00-\u9FCC]/.test(nameChinese)) {
                nameForeign = nameChinese + " " + nameForeign;
                nameChinese = null;
              }
              this.#data.celebrityList.push({
                name: {
                  chinese: nameChinese || null,
                  foreign: nameForeign || null,
                },
              });
              this.#data.celebrityName = "";
            }
          },
        },
        {
          // 影人职位名称、角色名称
          selector: "#celebrities>div.list-wrapper li.celebrity>.info>.role",
          target: "element",
          handler: (el) => {
            const [titleChinese, titleForeign, role] = el
              .getAttribute("title")
              .match(/([^ ]*)(?:$| )([^(]*)(?:$| )(.*)/)
              .slice(1, 4);
            Object.assign(
              this.#data.celebrityList[this.#data.celebrityListNumber],
              {
                title: {
                  chinese: titleChinese || null,
                  foreign: titleForeign || null,
                },
                role: role.replace(/[()]/g, "") || null,
              }
            );
            ++this.#data.celebrityListNumber;
          },
        },
      ],
      document: {
        // 后处理收尾
        end: (end) => {
          if (typeof this.data.celebrities === "undefined") {
            this.data.celebrities = [];
          } else {
            windupCelebrityList();
          }
        },
      },
    };
  }

  // 公有实例方法 获取 URL
  #getRequestURL(type = "entry") {
    let pageURL = `https://movie.douban.com/subject/${this.data.doubanID}/`;
    let typeString;
    switch (type) {
      case "entry":
        typeString = "";
        break;
      case "celebrities":
        typeString = type;
        break;
      case "awards":
        typeString = type + "/";
        break;
      default:
        typeString = type;
        break;
    }
    return pageURL + typeString;
  }

  // 公有实例方法 请求并解析页面：请求、解析并向实例字段赋值
  async requestAndParsePage(type = "entry") {
    const requestURL = this.#getRequestURL(type);
    let resp = await this._cachedFetch(requestURL, {
      headers: this.#headers,
    });
    if (resp.ok) {
      await DoubanWorker._parsePage(
        resp,
        DoubanWorker[`${type}PageParserGen`].apply(this)
      );
      if (type === "entry" && this.#data.firstSeasonDoubanID !== null) {
        const doubanItem = new DoubanWorker(
          this.#data.firstSeasonDoubanID,
          this.#headers
        );
        await doubanItem.requestAndParsePage(type);
        this.#imdbID = await doubanItem.imdbID;
      }
    } else {
      this.error.exists = true;
      this.error.errors.push({
        url: requestURL,
        status: resp.status,
        statusText: resp.statusText,
      });
    }
    return this;
  }

  // 公有实例方法 初始化
  async init() {
    await Promise.all(
      ["entry", "celebrities", "awards"].map((p) => this.requestAndParsePage(p))
    );
    return this;
  }

  // 获取 IMDb ID Promise
  get imdbID() {
    return (async () => {
      if (typeof this.#imdbID === "undefined") {
        await this.requestAndParsePage();
      }
      return this.#imdbID;
    })();
  }

  // 获取时光网 ID Promise
  get mtimeID() {
    return (async () => {
      if (
        typeof this.#mtimeID === "undefined" &&
        this.#data.chineseTitle &&
        this.data.year
      ) {
        let resp = await this.#mtimeSearch();
        if (resp.ok) {
          let resultsJson = await resp.json();
          if (resultsJson.error) {
            this.#mtimeID = null;
          } else {
            let interestResults = resultsJson.value.filter((r) => {
              let YE = Number(r.Year) <= this.data.year;
              let TE = this.#data.chineseTitle.includes(r.TitleCn);
              if (
                this.#data.originalTitle &&
                this.#data.originalTitle !== this.#data.chineseTitle
              ) {
                TE = TE || this.#data.originalTitle.includes(r.TitleEn);
              }
              return YE && TE;
            });
            let result =
              interestResults.find((r) => Number(r.Year) === this.data.year) ||
              interestResults.find((r) => Number(r.Year) < this.data.year);
            if (result) {
              this.#mtimeID = "" + result.MovieId;
            } else {
              this.#mtimeID = null;
            }
          }
        } else {
          this.#mtimeID = null;
        }
      }
      return this.#mtimeID;
    })();
  }

  // 搜索时光网
  async #mtimeSearch(count = 5) {
    return await this._cachedFetch(
      "http://my.mtime.com/Service/Movie.mc?" +
        [
          "Ajax_CallBack=true",
          "Ajax_CallBackType=Mtime.MemberCenter.Pages.MovieService",
          "Ajax_CallBackMethod=GetSearchMoviesByTitle",
          `Ajax_CallBackArgument0=${encodeURIComponent(
            this.#data.chineseTitle
          )}`,
          `Ajax_CallBackArgument1=${count}`,
        ].join("&"),
      {
        method: "get",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "user-agent": "/",
          host: "my.mtime.com",
        },
      },
      1296000
    );
  }
}
module.exports = DoubanWorker;
