const he = require("he");
const XWorker = require("./x-worker.js");
// 类定义
class MtimeWorker extends XWorker {
  // 私有实例字段：中间变量
  #data = {};

  // 构造函数：创建实例
  constructor(id, cache) {
    super(cache);
    this.data.mtimeID = id;
  }

  // 静态公有方法 生成幕后页面解析模板：调用时需动态绑定 this
  static behindTheScenePageParserGen() {
    const windupBehindTheSceneTitle = () => {
      this.data.behindTheScene[
        this.#data.behindTheSceneNumber
      ].title = this.#data.behindTheSceneTitle.trim();
      this.#data.behindTheSceneTitle = "";
    };
    const windupBehindTheSceneContent = () => {
      if (typeof this.#data.behindTheSceneList === "undefined") {
        this.data.behindTheScene[
          this.#data.behindTheSceneNumber
        ].content = null;
      } else {
        this.data.behindTheScene[
          this.#data.behindTheSceneNumber
        ].content = this.#data.behindTheSceneList.join("\n");
        this.#data.behindTheSceneList = undefined;
      }
    };
    const contentItemSelectors = [
      ".revealed_modle dl>dt",
      ".revealed_modle dl>dd",
      ".revealed_modle dl>dt>p",
      ".revealed_modle dl>dd>p",
      '.revealed_modle>div[class^="revealed_"]>p',
    ];
    const contentItemBreakSelectors = contentItemSelectors.map(
      (s) => s + " br"
    );
    const windupBehindTheSceneItem = () => {
      const item = he
        .decode(this.#data.behindTheSceneItem)
        //.replace(/　/g, " ")
        .trim();
      if (item) {
        this.#data.behindTheSceneList.push(item);
      }
      this.#data.behindTheSceneItem = "";
    };
    return {
      element: [
        {
          selector: ".db_year>a",
          target: "element",
          handler: (el) => {
            this.data.year = Number(el.getAttribute("href").match(/\d+$/)[0]);
          },
        },
        {
          selector: ".revealed_modle",
          target: "element",
          handler: (el) => {
            if (typeof this.data.behindTheScene === "undefined") {
              this.data.behindTheScene = [];
              this.#data.behindTheSceneType = "";
              this.#data.behindTheSceneNumber = 0;
            } else if (this.#data.behindTheSceneType === "") {
              windupBehindTheSceneItem();
              windupBehindTheSceneTitle();
              windupBehindTheSceneContent();
              ++this.#data.behindTheSceneNumber;
            }
          },
        },
        {
          selector: ".revealed_modle h4",
          target: "text",
          handler: (text) => {
            this.#data.behindTheSceneType += text.text;
            if (text.lastInTextNode) {
              this.data.behindTheScene.push({
                type: this.#data.behindTheSceneType.trim().toLowerCase(),
              });
              this.#data.behindTheSceneType = "";
            }
          },
        },
        {
          selector: ".revealed_modle h3",
          target: "text",
          handler: (text) => {
            if (typeof this.#data.behindTheSceneTitle === "undefined") {
              this.#data.behindTheSceneTitle = "";
            }
            this.#data.behindTheSceneTitle += text.text;
          },
        },
        {
          selector: '.revealed_modle>[class^="revealed_"]',
          target: "element",
          handler: (el) => {
            if (
              typeof this.data.behindTheScene[
                this.#data.behindTheSceneNumber
              ] === "undefined"
            ) {
              let type;
              switch (el.getAttribute("class")) {
                case "revealed_list":
                  type = "list";
                  break;
                case "revealed_lines":
                  type = "lines";
                  break;
                case "revealed_other":
                  type = "other";
                  break;
                case "revealed_album":
                  type = "album";
                  break;
                case "revealed_news":
                  type = "news";
                  break;
                default:
                  type = "unknown";
                  break;
              }
              this.data.behindTheScene.push({
                type: type,
              });
              this.#data.behindTheSceneType = "";
            }
          },
        },
        {
          selector: contentItemSelectors.join(","),
          target: "element",
          handler: (el) => {
            if (this.#data.behindTheSceneList instanceof Array) {
              windupBehindTheSceneItem();
            }
          },
        },
        {
          selector: contentItemBreakSelectors.join(","),
          target: "element",
          handler: (el) => {
            if (typeof this.#data.behindTheSceneItem === "string") {
              windupBehindTheSceneItem();
            }
          },
        },
        {
          selector: contentItemSelectors.join(","),
          target: "text",
          handler: (text) => {
            if (typeof this.#data.behindTheSceneList === "undefined") {
              this.#data.behindTheSceneList = [];
              this.#data.behindTheSceneItem = "";
            }
            this.#data.behindTheSceneItem += text.text;
          },
        },
      ],
      document: {
        end: (end) => {
          if (typeof this.data.year === "undefined") {
            this.data.year = null;
          }
          if (typeof this.data.behindTheScene === "undefined") {
            this.data.behindTheScene = [];
          } else {
            windupBehindTheSceneItem();
            windupBehindTheSceneTitle();
            windupBehindTheSceneContent();
          }
        },
      },
    };
  }

  // 公有实例方法 获取 URL
  #getRequestURL(type = "entry") {
    let pageURL = `http://movie.mtime.com/${this.data.mtimeID}/`;
    let typeString;
    switch (type) {
      case "behindTheScene":
        typeString = `behind_the_scene.html`;
        break;
      default:
        typeString = type + ".html";
        break;
    }
    return pageURL + typeString;
  }

  // 公有实例方法 请求并解析页面：请求、解析并向实例字段赋值
  async requestAndParsePage(type = "behindTheScene") {
    const requestURL = this.#getRequestURL(type);
    let resp = await this._cachedFetch(requestURL);
    if (resp.ok) {
      await MtimeWorker._parsePage(
        resp,
        MtimeWorker[`${type}PageParserGen`].apply(this)
      );
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
    return this.requestAndParsePage();
  }
}
module.exports = MtimeWorker;
