const he = require("he");
// 类定义
class MtimeParser {
  // 私有实例字段：隐私信息
  #cache;
  // 私有实例字段：幕后页面解析中间变量
  #behindTheSceneType;
  #behindTheSceneNumber;
  #behindTheSceneTitle;
  #behindTheSceneList;
  #behindTheSceneItem;

  // 构造函数：创建实例
  constructor(id, cache) {
    this.mtimeID = id;
    this.#cache = cache;
  }

  // 静态公有方法 生成幕后页面解析模板：调用时需动态绑定 this
  static behindTheScenePageParserGen() {
    const windupBehindTheSceneTitle = () => {
      this.behindTheScene[
        this.#behindTheSceneNumber
      ].title = this.#behindTheSceneTitle.trim();
      this.#behindTheSceneTitle = "";
    };
    const windupBehindTheSceneContent = () => {
      if (typeof this.#behindTheSceneList === "undefined") {
        this.behindTheScene[this.#behindTheSceneNumber].content = null;
      } else {
        this.behindTheScene[
          this.#behindTheSceneNumber
        ].content = this.#behindTheSceneList.join("\n");
        this.#behindTheSceneList = undefined;
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
        .decode(this.#behindTheSceneItem)
        //.replace(/　/g, " ")
        .trim();
      if (item) {
        this.#behindTheSceneList.push(item);
      }
      this.#behindTheSceneItem = "";
    };
    return {
      element: [
        {
          selector: ".db_year>a",
          target: "element",
          handler: (el) => {
            this.year = Number(el.getAttribute("href").match(/\d+$/)[0]);
          },
        },
        {
          selector: ".revealed_modle",
          target: "element",
          handler: (el) => {
            if (typeof this.behindTheScene === "undefined") {
              this.behindTheScene = [];
              this.#behindTheSceneType = "";
              this.#behindTheSceneNumber = 0;
            } else if (this.#behindTheSceneType === "") {
              windupBehindTheSceneItem();
              windupBehindTheSceneTitle();
              windupBehindTheSceneContent();
              ++this.#behindTheSceneNumber;
            }
          },
        },
        {
          selector: ".revealed_modle h4",
          target: "text",
          handler: (text) => {
            this.#behindTheSceneType += text.text;
            if (text.lastInTextNode) {
              this.behindTheScene.push({
                type: this.#behindTheSceneType.trim().toLowerCase(),
              });
              this.#behindTheSceneType = "";
            }
          },
        },
        {
          selector: ".revealed_modle h3",
          target: "text",
          handler: (text) => {
            if (typeof this.#behindTheSceneTitle === "undefined") {
              this.#behindTheSceneTitle = "";
            }
            this.#behindTheSceneTitle += text.text;
          },
        },
        {
          selector: '.revealed_modle>[class^="revealed_"]',
          target: "element",
          handler: (el) => {
            if (
              typeof this.behindTheScene[this.#behindTheSceneNumber] ===
              "undefined"
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
              this.behindTheScene.push({
                type: type,
              });
              this.#behindTheSceneType = "";
            }
          },
        },
        {
          selector: contentItemSelectors.join(","),
          target: "element",
          handler: (el) => {
            if (this.#behindTheSceneList instanceof Array) {
              windupBehindTheSceneItem();
            }
          },
        },
        {
          selector: contentItemBreakSelectors.join(","),
          target: "element",
          handler: (el) => {
            if (typeof this.#behindTheSceneItem === "string") {
              windupBehindTheSceneItem();
            }
          },
        },
        {
          selector: contentItemSelectors.join(","),
          target: "text",
          handler: (text) => {
            if (typeof this.#behindTheSceneList === "undefined") {
              this.#behindTheSceneList = [];
              this.#behindTheSceneItem = "";
            }
            this.#behindTheSceneItem += text.text;
          },
        },
      ],
      document: {
        end: (end) => {
          if (typeof this.year === "undefined") {
            this.year = null;
          }
          if (typeof this.behindTheScene === "undefined") {
            this.behindTheScene = [];
          } else {
            windupBehindTheSceneItem();
            windupBehindTheSceneTitle();
            windupBehindTheSceneContent();
          }
        },
      },
    };
  }

  #getRequestURL(type = "entry") {
    let pageURL = `http://movie.mtime.com/${this.mtimeID}/`;
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

  // 私有实例方法 请求页面：请求相关页面
  async #requestPage(requestURL) {
    let resp = await this.#cache.match(requestURL);
    if (resp) {
      return [resp, true];
    } else {
      return [await fetch(requestURL), false];
    }
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

  // 公有实例方法 请求并解析页面：请求、解析并向实例字段赋值
  async requestAndParsePage(type = "behindTheScene") {
    const requestURL = this.#getRequestURL(type);
    let [resp, isCached] = await this.#requestPage(requestURL);
    if (resp.ok) {
      let putCache;
      let respClone = resp.clone();
      if (!isCached) {
        let newResp = new Response(resp.body, resp);
        newResp.headers.delete("Set-Cookie");
        newResp.headers.delete("Vary");
        newResp.headers.set(
          "Cache-Control",
          ["public", "max-age=43200", "stale", "must-revalidate"].join(",")
        );
        putCache = this.#cache.put(requestURL, newResp);
      }
      await MtimeParser.#parsePage(
        respClone,
        MtimeParser[`${type}PageParserGen`].apply(this)
      );
      await putCache;
    }
  }

  // 公有实例方法 初始化
  async init() {
    await this.requestAndParsePage();
    return this;
  }
}
module.exports = MtimeParser;
