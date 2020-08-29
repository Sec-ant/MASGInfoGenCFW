const he = require("he");
const XWorker = require("./x-worker.js");
// 类定义
class DoubanWorker extends XWorker {
  // 私有实例字段：隐私信息
  #headers;
  // 私有实例字段：条目页面解析中间变量
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
  // 私有实例字段：获奖页面解析中间变量
  #awardsTitle;
  #awardsYear;
  #awardsNumber;
  #categories;
  #categoriesTitle;
  #winners;
  #categoriesNumber;
  // 私有实例字段：影人页面解析中间变量
  #positionName;
  #celebritiesNumber;
  #celebrityList;
  #celebrityName;
  #celebrityListNumber;
  // 私有实例字段：其他数据库 ID
  #imdbID;
  #mtimeID;

  // 构造函数：创建实例
  constructor(id, headers, cache) {
    super(cache);
    this.doubanID = id;
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
          // 原始标题
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
              this.#originalTitle = he.decode(this.#originalTitle);
            }
          },
        },
        {
          // 海报
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
          // 年份
          selector: "#content>h1>span.year",
          target: "text",
          handler: (text) => {
            if (typeof this.year === "undefined") {
              this.year = "";
            }
            this.year += text.text;
            if (text.lastInTextNode) {
              this.year = Number(this.year.slice(1, -1));
            }
          },
        },
        {
          // 类别
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
          // 上映日期
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
          // 初始化时长
          selector: '#info span[property="v:runtime"]',
          target: "text",
          handler: (text) => {
            if (typeof this.durations === "undefined") {
              this.durations = "";
            }
          },
        },
        {
          // 第一季豆瓣 ID
          selector: "#season>option:first-child",
          target: "element",
          handler: (el) => {
            if (el.getAttribute("selected") === null) {
              this.#firstSeasonDoubanID = el.getAttribute("value");
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
            if (typeof this.tags === "undefined") {
              this.tags = [];
            }
            this.tags.push(el.getAttribute("href").slice(5));
          },
        },
        {
          // 豆瓣综合评分
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
          // 豆瓣评分人数
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
          // 豆瓣星级分布
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
          // 初始化简介
          selector:
            '#link-report>[property="v:summary"],#link-report>span.all.hidden',
          target: "element",
          handler: (el) => {
            this.description = undefined;
          },
        },
        {
          // 简介
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
          // 初始化详细信息
          selector: "#info>span.pl",
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
          // 详细信息：制片国家/地区，语言，单集片长，集数，又名
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
          // 收尾详细信息
          selector: "#info>br",
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
        // 后处理收尾
        end: (end) => {
          if (
            this.#akaTitles &&
            this.#COTitlesSame &&
            /中国/.test(this.regions[0])
          ) {
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
          if (typeof this.#imdbID === "undefined") {
            this.#imdbID = null;
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

  // 静态公有方法 生成获奖页面解析模板：调用时需动态绑定 this
  static awardsPageParserGen() {
    // 获奖项人员收尾辅助函数
    const windupWinners = () => {
      this.#categories[this.#categoriesNumber].winners = this.#winners
        ? he
            .decode(this.#winners)
            .split("/")
            .map((p) => p.trim())
        : [];
      this.#winners = "";
    };
    // 获奖项收尾辅助函数
    const windupCategories = () => {
      this.awards[this.#awardsNumber].categories = this.#categories;
      this.#categories = undefined;
    };
    return {
      element: [
        {
          // 获奖名称
          selector: "div.awards>.hd>h2>a",
          target: "text",
          handler: (text) => {
            if (typeof this.awards === "undefined") {
              this.awards = [];
              this.#awardsTitle = "";
              this.#awardsNumber = 0;
            } else if (this.#awardsTitle === "") {
              windupWinners();
              windupCategories();
              ++this.#awardsNumber;
            }
            this.#awardsTitle += text.text;
            if (text.lastInTextNode) {
              this.awards.push({
                title: he.decode(this.#awardsTitle).trim(),
              });
              this.#awardsTitle = "";
            }
          },
        },
        {
          // 获奖年份
          selector: "div.awards>.hd>h2>span.year",
          target: "text",
          handler: (text) => {
            if (typeof this.#awardsYear === "undefined") {
              this.#awardsYear = "";
            }
            this.#awardsYear += text.text;
            if (text.lastInTextNode) {
              this.awards[this.#awardsNumber].year = parseInt(
                this.#awardsYear.match(/\d+/)[0]
              );
              this.#awardsYear = "";
            }
          },
        },
        {
          // 获奖项名称
          selector: "div.awards>.award>li:first-of-type",
          target: "text",
          handler: (text) => {
            if (typeof this.#categories === "undefined") {
              this.#categories = [];
              this.#categoriesTitle = "";
              this.#categoriesNumber = 0;
            } else if (this.#categoriesTitle === "") {
              windupWinners();
              ++this.#categoriesNumber;
            }
            this.#categoriesTitle += text.text;
            if (text.lastInTextNode) {
              this.#categories.push({
                title: he.decode(this.#categoriesTitle).trim(),
              });
              this.#categoriesTitle = "";
            }
          },
        },
        {
          // 获奖项人员
          selector: "div.awards>.award>li:nth-of-type(2)",
          target: "text",
          handler: (text) => {
            if (typeof this.#winners === "undefined") {
              this.#winners = "";
            }
            this.#winners += text.text;
          },
        },
      ],
      document: {
        // 后处理收尾
        end: (end) => {
          if (typeof this.awards === "undefined") {
            this.awards = [];
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
      this.celebrities[
        this.#celebritiesNumber
      ].celebrityList = this.#celebrityList;
      this.#celebrityList = undefined;
    };
    return {
      element: [
        {
          // 影人大类名称
          selector: "#celebrities>div.list-wrapper>h2",
          target: "text",
          handler: (text) => {
            if (typeof this.celebrities === "undefined") {
              this.celebrities = [];
              this.#positionName = "";
              this.#celebritiesNumber = 0;
            } else if (this.#positionName === "") {
              windupCelebrityList();
              ++this.#celebritiesNumber;
            }
            this.#positionName += text.text;
            if (text.lastInTextNode) {
              const [
                positionChinese,
                positionForeign,
              ] = this.#positionName.match(/([^ ]*)(?:$| )(.*)/).slice(1, 3);
              this.celebrities.push({
                position: {
                  chinese: positionChinese || null,
                  foreign: positionForeign || null,
                },
              });
              this.#positionName = "";
            }
          },
        },
        {
          // 影人名称
          selector: "#celebrities>div.list-wrapper li.celebrity>.info>.name",
          target: "text",
          handler: (text) => {
            if (typeof this.#celebrityList === "undefined") {
              this.#celebrityList = [];
              this.#celebrityName = "";
              this.#celebrityListNumber = 0;
            }
            this.#celebrityName += text.text;
            if (text.lastInTextNode) {
              let [nameChinese, nameForeign] = this.#celebrityName
                .match(/([^ ]*)(?:$| )(.*)/)
                .slice(1, 3);
              if (!/[\u4E00-\u9FCC]/.test(nameChinese)) {
                nameForeign = nameChinese + " " + nameForeign;
                nameChinese = null;
              }
              this.#celebrityList.push({
                name: {
                  chinese: nameChinese || null,
                  foreign: nameForeign || null,
                },
              });
              this.#celebrityName = "";
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
            Object.assign(this.#celebrityList[this.#celebrityListNumber], {
              title: {
                chinese: titleChinese || null,
                foreign: titleForeign || null,
              },
              role: role.replace(/[()]/g, "") || null,
            });
            ++this.#celebrityListNumber;
          },
        },
      ],
      document: {
        // 后处理收尾
        end: (end) => {
          if (typeof this.celebrities === "undefined") {
            this.celebrities = [];
          } else {
            windupCelebrityList();
          }
        },
      },
    };
  }

  // 公有实例方法 获取 URL
  #getRequestURL(type = "entry") {
    let pageURL = `https://movie.douban.com/subject/${this.doubanID}/`;
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
      if (type === "entry" && this.#firstSeasonDoubanID !== null) {
        const doubanItem = new DoubanWorker(
          this.#firstSeasonDoubanID,
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
        this.#chineseTitle &&
        this.year
      ) {
        let resp = await this.#mtimeSearch();
        if (resp.ok) {
          let resultsJson = await resp.json();
          if (resultsJson.error) {
            this.#mtimeID = null;
          } else {
            let interestResults = resultsJson.value.filter((r) => {
              let YE = Number(r.Year) <= this.year;
              let TE = this.#chineseTitle.includes(r.TitleCn);
              if (
                this.#originalTitle &&
                this.#originalTitle !== this.#chineseTitle
              ) {
                TE = TE || this.#originalTitle.includes(r.TitleEn);
              }
              return YE && TE;
            });
            let result =
              interestResults.find((r) => Number(r.Year) === this.year) ||
              interestResults.find((r) => Number(r.Year) < this.year);
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
          `Ajax_CallBackArgument0=${encodeURIComponent(this.#chineseTitle)}`,
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