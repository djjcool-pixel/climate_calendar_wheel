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

### 动效与性能

默认城市为**成都**，跨城比较默认目标为东京。

- 指针与连线共用一个按需运行的 `requestAnimationFrame` 循环；使用可中途接续的阻尼运动，跨年按最短圆弧移动。日期、滑块和按钮始终以最终选定值为准。
- SVG 温度刻度、指针、连线及文本节点复用；目标城市内圈首次使用时才创建。指针输入每帧合并，匹配结果按配置与日期缓存，缓存最多保留 16 组。
- 温度光谱使用 CSS 渐变；折叠的比较面板延后更新。静止后停止动画循环，切换到后台、轮盘离屏或系统开启“减少动态效果”时直接归位。
- 主要控件统一 44px 高，使用 SVG 导航图标；分段按钮的选中底色平滑滑动。触屏上沿外圈拨动，中心区域可正常滚动页面。

### 浏览器回归检查

网站运行仍不需要安装依赖。下面的 Playwright 仅用于开发验证：

```bash
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium firefox webkit
node scripts/verify-motion.cjs
BROWSERS=chromium,firefox,webkit node scripts/verify-motion.cjs
```

Linux 如缺少浏览器系统库，可按 Playwright 提示安装所需开发环境依赖。检查覆盖 320–1440px 布局、跨年短弧、快速连续点击、节点复用、拖动确认与取消、键盘、跨城交换、减少动态效果与静止停帧；Chromium 另用原生触屏事件验证外圈拨动与中心滚动。内嵌浏览器仍建议在目标 App 的真机上复核。
