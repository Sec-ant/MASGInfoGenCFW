// 类定义
class IMDbParser {
  // 私有实例字段：隐私信息
  #cache;
  // 私有实例字段：其他数据库 ID
  #doubanID;

  // 构造函数：创建实例
  constructor(id, cache) {
    this.imdbID = id;
    this.#cache = cache;
    this.error = {
      exists: false,
      errors: [],
    };
  }

  // 公有实例方法 获取 URL
  #getRequestRatingURL() {
    return `https://p.media-imdb.com/static-content/documents/v1/title/tt${this.imdbID}/ratings%3Fjsonp=imdb.rating.run:imdb.api.title.ratings/data.json`;
  }

  // 私有实例方法 带缓存地请求
  async #cachedFetch(
    requestURL,
    init,
    maxAge = 43200,
    cacheCondition = (resp) => resp.ok
  ) {
    let resp = await this.#cache.match(requestURL);
    if (resp) {
      return resp;
    } else {
      resp = await fetch(requestURL, init);
      if (cacheCondition(resp)) {
        let cloneResp = resp.clone();
        let newResp = new Response(resp.body, resp);
        newResp.headers.delete("Set-Cookie");
        newResp.headers.delete("Vary");
        newResp.headers.set(
          "Cache-Control",
          ["public", `max-age=${maxAge}`, "stale", "must-revalidate"].join(",")
        );
        await this.#cache.put(requestURL, newResp);
        return cloneResp;
      }
      return resp;
    }
  }

  // 私有实例方法 解析评分：解析 IMDb 评分对象并向实例字段赋值
  async #parseRating(resp) {
    try {
      const ratingJSON = JSON.parse((await resp.text()).slice(16, -1));
      this.imdbRating = ratingJSON.resource;
    } catch (err) {
      this.error.exists = true;
      this.error.errors.push({
        url: resp.url,
        status: 0,
        statusText: err.name + ": " + err.message,
      });
      this.imdbRating = null;
    }
  }

  // 公有实例方法 请求并解析评分：请求、解析并向实例字段赋值
  async requestAndParseRating() {
    const requestRatingURL = this.#getRequestRatingURL();
    let resp = await this.#cachedFetch(requestRatingURL);
    if (resp.ok) {
      await this.#parseRating(resp);
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
    return this.requestAndParseRating();
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
    return await this.#cachedFetch(
      `https://movie.douban.com/j/subject_suggest?q=tt${this.imdbID}`
    );
  }
}
module.exports = IMDbParser;
