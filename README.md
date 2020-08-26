# MASGInfoGenCFW

部署在 Cloudflare Workers 上的 MASGInfoGen API，仍然在缓慢开发中……

**MASG**: **M**ovie/**M**usic | **Anime** | **Series** | **Game**

## 开发环境准备

1. 注册 [Cloudflare 账户](https://dash.cloudflare.com/sign-up/workers)
2. 安装 [Node.js](https://nodejs.org/en/)
3. 安装用于生成 Cloudflare Workers 后端 js 代码并部署所需的 CLI 工具 [Wrangler](https://developers.cloudflare.com/workers/cli-wrangler/install-update)
4. 克隆本仓库到本地：`git clone git@github.com:Sec-ant/MASGInfoGenCFW.git`
5. 在项目文件夹下运行 `npm install` 安装依赖，依赖包括：
   - [Babel](https://github.com/babel/babel): 用于支持 Javascript [Class 相关实验性功能](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Classes/Class_elements)
      - [Babel Loader](https://github.com/babel/babel-loader)
      - [babel-preset-minify](https://babeljs.io/docs/en/babel-preset-minify)
      - [@babel/plugin-proposal-class-properties](https://babeljs.io/docs/en/babel-plugin-proposal-class-properties)
      - [@babel/plugin-proposal-private-methods](https://babeljs.io/docs/en/babel-plugin-proposal-private-methods)
   - [he](https://github.com/mathiasbynens/he): 用于对 [HTML Entities](https://html.spec.whatwg.org/multipage/named-characters.html#named-character-references) 进行解码
6. 复制一份项目文件夹下的 `wrangler.toml.sample`，重命名为 `wrangler.toml`，将文件中的 `account_id` 改为你的 Cloudflare 账户 ID（通过[这个页面](https://dash.cloudflare.com/)登录进入 Workers 管理页面后，页面右侧会显示）
7. 按照[说明文档](https://developers.cloudflare.com/workers/cli-wrangler/authentication)对 Wrangler 进行授权，以便于构建后直接部署到 Cloudflare 上

## 开发

1. 按照需要修改根目录的 `index.js` 文件
2. 通过 Wrangler 构建、预览和部署
   ```
   wrangler build
   wrangler preview
   wrangler publish
   ```

## 特点

本项目采用 Cloudflare Workers 的原生 API [HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter) 进行页面解析，这是一种流式 HTML 解析器，优点是不需要自己写正则表达式进行解析，且避免了引入第三方包导致脚本体积和 CPU 运算耗时增加的情况，缺点是流式解析和 jQuery, cheerio 等 API 有明显的区别，目前网络上 HTMLRewriter 相关文档很少，需要自己尝试，且迁移工作量较大。

## 后面需要解决的问题

request 和 subrequest 的缓存机制。

## Demo

https://info.secant.workers.dev/douban?id=26635374

## 注意！！

项目仍然在开发中，在本句话更新之前，恕不保证 API 的一致性和稳定性。
