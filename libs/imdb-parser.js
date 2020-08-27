// 类定义
class IMDbParser {
  #doubanID;
  // 构造函数
  constructor(id) {
    this.imdbID = id;
  }

  // 公有实例方法 初始化
  async init() {
    return await this.requestAndParseRating();
  }

  // 公有实例方法 获取并解析评分
  async requestAndParseRating() {
    let resp = await this.#requestRating();
    if (resp.ok) {
      await this.#parseRating(resp);
    }
  }

  // 获取豆瓣 ID
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
      `https://movie.douban.com/j/subject_suggest?q=tt${this.imdbID}`
    );
  }

  // 私有实例方法 解析评分
  async #parseRating(resp) {
    try {
      const ratingJSON = JSON.parse((await resp.text()).slice(16, -1));
      this.imdbRating = ratingJSON.resource;
    } catch (err) {
      this.imdbRating = null;
    }
  }
  // 私有实例方法 获取评分
  async #requestRating() {
    let ratingURL = `https://p.media-imdb.com/static-content/documents/v1/title/tt${this.imdbID}/ratings%3Fjsonp=imdb.rating.run:imdb.api.title.ratings/data.json`;
    return await fetch(ratingURL);
  }
}
module.exports = IMDbParser;
