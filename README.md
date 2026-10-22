# 季节回声 · Climate Calendar Wheel

一个零依赖、可直接打开的交互式气候年轮。将一年 365 天排列成圆环，探索不同日期及城市之间的近似气候对应关系。

## 在线使用 / 本地运行

项目为纯静态单页网站。下载或克隆仓库后，直接打开 `index.html` 即可；也可以部署到 GitHub Pages、Vercel 或任何静态文件服务器，无需构建命令、数据库或 API Key。

## 功能

- **气温年轮（主视图）**：展示全年逐日气温的冷暖分布。默认打开当天；鼠标悬停外圈实时预览，点击确认日期。手机可沿外圈触摸拨动，松手确认。
- **全年温度光谱**：紧随轮盘下方的连续色带，支持点击选取日期。
- **日期映射（默认折叠）**：同城寻找升温季与降温季气温近似的日期，或将源城市某天映射到另一城市的近似气候日期。
- **气候比较**：支持平均气温、平均最高 / 最低气温以及温度优先 / 综合气候两种匹配方式，并展示湿度与降水的参考对照。
- **响应式设计与动效**：手机端优化，轮盘和信息卡自适应；提供入场、切换和连线动态效果，兼容系统减少动态效果设置。

城市：东京、北京、合肥、成都、西安、广州、武汉。

## 数据说明

本项目用于**气候季节探索**，不是天气预报。气温由月度气候平年值经平滑插值转换为 365 个参考日期的估计值，**不是逐日实测数据**。部分中国城市使用邻近站点；湿度含模型估算，降水主要按所在月份的气候参考量展示。不同数据来源与统计期间不一定完全一致；跨城市匹配结果只表示指定指标下的近似相似，不能据此判断体感、日照或极端天气。

参考信息：
- [Japan Meteorological Agency — Climate Normals](https://www.data.jma.go.jp/stats/en/normal/normal.html)
- [JMA ClimatView](https://ds.data.jma.go.jp/tcc/tcc/products/climate/climatview/frame.php)
- [Climate Zone](https://www.climate-zone.com/)

## 部署

Vercel 项目：`climate-calendar-wheel`，关联 GitHub `main` 分支，自动部署。

生产域名：`weather.lucidcairn.com`。域名由 DNSPod 提供解析，如未指向 Vercel，请添加 `weather` 的 CNAME 记录；准确记录值以 Vercel Domains 配置面板为准。

## 开发

主要实现为单个 `index.html`（原生 HTML/CSS/JavaScript/SVG），不包含需要联网加载的前端运行时依赖。日期映射使用参考气温曲线和加权相似度搜索；同城模式限制候选日期来自相反的升温或降温趋势。

```bash
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```
