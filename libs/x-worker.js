class XWorker {
  #cache;
  constructor(cache) {
    this.#cache = cache;
    this.data = {};
    this.error = {
      exists: false,
      errors: [],
    };
  }

  // 保护实例方法 带缓存地请求
  async _cachedFetch(
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

  // 静态保护方法 解析页面：根据解析模板解析页面
  static async _parsePage(resp, parser) {
    let rewriter = new HTMLRewriter();
    parser.element.forEach(({ selector, target, handler }) => {
      rewriter = rewriter.on(selector, {
        [target]: handler,
      });
    });
    rewriter = rewriter.onDocument(parser.document);
    return await rewriter.transform(resp).text();
  }
}
module.exports = XWorker;
