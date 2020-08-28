// 类定义
class IMDbParser {
  // 私有实例字段：其他数据库 ID
  #doubanID;

  // 构造函数：创建实例
  constructor(id) {
    this.imdbID = id;
  }

  // 私有实例方法 请求评分：从接口获取 IMDb 评分
  async #requestRating() {
    let ratingURL = `https://p.media-imdb.com/static-content/documents/v1/title/tt${this.imdbID}/ratings%3Fjsonp=imdb.rating.run:imdb.api.title.ratings/data.json`;
    return await fetch(ratingURL, {
      cf: {
        cacheKey: `i:${this.imdbID}`,
        cacheTtlByStatus: {
          "200-299": 43200,
          404: 1,
          "500-509": 1,
        },
      },
    });
  }

  // 私有实例方法 解析评分：解析 IMDb 评分对象并向实例字段赋值
  async #parseRating(resp) {
    try {
      const ratingJSON = JSON.parse((await resp.text()).slice(16, -1));
      this.imdbRating = ratingJSON.resource;
    } catch (err) {
      this.imdbRating = null;
    }
  }

  // 公有实例方法 请求并解析评分：请求、解析并向实例字段赋值
  async requestAndParseRating() {
    let resp = await this.#requestRating();
    if (resp.ok) {
      await this.#parseRating(resp);
    }
  }

  // 公有实例方法 初始化
  async init() {
    await this.requestAndParseRating();
    return this;
  }

  // 获取豆瓣 ID Promise
  get doubanID() {
    return (async () => {
      if (typeof this.#doubanID === "undefined") {
        let resp = await this.#doubanSearch();
        if (resp.ok) {
          let results = await resp.json();
          this.#doubanID = (results[0] || { id: null }).id;
        } else {
          this.#doubanID = null;
        }
      }
      return this.#doubanID;
    })();
  }

  // 搜索豆瓣
  async #doubanSearch() {
    return await fetch(
      `https://movie.douban.com/j/subject_suggest?q=tt${this.imdbID}`,
      {
        cf: {
          cacheKey: `i:${this.imdbID}`,
          cacheTtlByStatus: {
            "200-299": 1296000,
            404: 1,
            "500-509": 1,
          },
        },
      }
    );
  }
}
module.exports = IMDbParser;
