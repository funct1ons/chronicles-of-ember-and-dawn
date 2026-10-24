# 烬辉战纪 · Chronicles of Ember and Dawn

离线优先的原创像素战争策略游戏。选择下一波兵种、投资战时经济、自动交锋，摧毁敌方要塞。灵感来自经典 Flash《Miragine War》，**不包含原游戏资源，也不声称原数值一比一复刻**。

![新版首页封面](docs/screenshots/cover/cover-1440x1000.png)

## 首页封面改版（已上线）

以「烬辉战纪」四字标题为视觉中心，只保留一行英文副题与一句标语。战役/经典对战为主入口，其余模式收为文字导航；删除右侧故事、重复品牌文字与宣传说明。所有模式、工具设置和战役进度保留，未改战斗、经济、AI或音频。

[在线游玩](https://funct1ons.github.io/chronicles-of-ember-and-dawn/) · 完整 CI 通过（262 单测、14 浏览器用例、生产离线验证）。真实公网新封面、交互、BGM 与断网重载已验收。此前 Windows 性能尖峰仍为未决项，未因 CI 通过而删除，见 `docs/TEST_REPORT.md`。

## v1.1 更新

- 16兵种各有原创小故事，支持定位筛选、搜索、价格排序、真实伤害适性与经济效率；战场按 `B` 查看完整条目。
- 战斗主曲连续播放，高潮只增加协调打击层与平滑增益；双甲板循环交叠，首次默认音乐音量提高至80%（不覆盖已有设置）。
- 固定步渲染插值、设备像素对齐、整数倍率精灵与低幅震屏；修复换波出生重叠推开已有单位的问题。
- 已完成305秒真实音频波形长测、9组视口/DPR检查和新版本521局回归；详情与验收边界见测试报告。

## Windows PowerShell 启动

需要 **Node.js 22.12+（推荐22 LTS或24 LTS）**，现代 Edge / Chrome / Firefox。无需后端、账户、API Key、Python或额外游戏编辑器。

```powershell
Set-Location C:\files\code\MiragineWar
npm.cmd ci
npm.cmd run dev
```

浏览器打开终端显示的地址（通常 `http://localhost:5173`）。第一次依赖安装需要网络，之后游戏资源完全在本地。若端口被占用，Vite会显示新地址。

构建与本地发布版：

```powershell
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1
```

打开显示地址。**不要直接双击 `dist/index.html`**：ES模块、音频和离线缓存需要HTTP服务。浏览器须经一次点击后才允许音乐播放；点击菜单按钮即可启动交响配乐。

## 已实现内容

- 16种原创、数据驱动兵种：轻重甲、远程穿甲、反骑、冲锋、范围魔法、治疗、潜袭与攻城，各有成本/收益/人口/生命/防御/轻重甲伤害/间隔/射程/速度。
- 四种原创像素环境，两阵营统一图集，行走/攻击/待机/受击/死亡反馈、箭矢/魔法/烟尘与旗帜。
- 经典对战、10关渐进战役、3种特殊试炼、自定义规则、本地双人。
- 五档规则/评分与有界前瞻AI；所有经典难度遵守同等金币与人口，战役额外补给在简报明示。
- 教程、完整兵种图鉴、暂停、1/1.5/2/3倍速、全屏、静音、三路音量、战史与版本化本地进度、JSON导入导出。
- 五首本地CC0管弦配乐、七个音乐状态、连续战斗主曲/高潮协调叠层、流式循环交叠、21类本地合成音效、风/战场环境与20声部上限。
- GitHub Pages子路径兼容、所有音频随发布、生产版离线缓存与音频Range支持。

## 三十秒上手

1. 点“新手教学”看五页可跳过指南，或“经典对战”直接开始。
2. 点击兵种，决定下一波招募内容；无需手动控制士兵。
3. 首波6秒，此后每12秒：**领取当前收入 → 按金币与剩余人口自动征募（最多18人）→ 招募提高后续收入**。
4. 低阶兵经济效率更高；需要在发育与眼前反制之间取舍。收入上限600，金币最多6000并结转。
5. 单位存活占用人口，死亡释放。盾兵抗箭、弩/斧破甲、枪兵反骑；先前排后远程形成混编。
6. 摧毁对方要塞获胜；第80波征募后仍有完整12秒交战窗口，之后按要塞剩余生命判胜，完全相同为平局。

|操作|快捷键|
|---|---|
|选择上排/下排8兵种|`1–8` / `Q W E R T Y U I`|
|本地双人左方|同上|
|本地双人右方|方向键浏览，`Enter`确认|
|暂停/继续|`Space`，或暂停面板|
|返回/关闭面板|`Esc`|
|加速/减速|`+` / `-`|
|当前检视兵种完整图鉴|`B`（`U`仍选火法）|
|一键静音|`M`|
|全屏|`F`（浏览器也可F11）|

## 存档与离线

- 战役进度和最近50场战史保存在当前浏览器 `localStorage`，键 `ember-dawn-save-v1`。**不同浏览器、隐私窗口、不同域名或端口不共享存档**。
- 设置中可导出/导入JSON进度；战斗中途状态不保存。退出当前战场会明确确认。
- 生产版首次完整载入后提示资源已备妥，Service Worker缓存全部静态资源和约23.37MB音乐；之后相同地址可断网游玩。
- 浏览器禁用存储/清除缓存会失去对应数据。离线缓存要求HTTPS或localhost；局域网普通HTTP不提供Service Worker。
- 开发服务器仍需本机运行，开发模式不注册Service Worker。生产缓存更新由内容指纹自动管理，不缓存外部网站。

## 测试、平衡与资源导出

```powershell
npm.cmd test                 # 核心/AI/内容/存档单元测试
npm.cmd run build           # TypeScript + 生产构建 + 全资源离线清单
npx.cmd playwright install chromium
npm.cmd run test:e2e        # 浏览器UI、音频、合法自然胜局、150单位绘图/AI延迟
npm.cmd run balance         # 220局确定性自动对战（运行时间依CPU而异）
npm.cmd run balance -- --holdout # 换独立种子与双方位置，输出balance-holdout.json
npm.cmd run strategy:suite  # 多种混编/经济策略与13关卡的AI烟测
npm.cmd run missions:verify # 固定合法配方对战役/试炼的可玩性抽样
npm.cmd run ai:coverage     # 检查全部16种兵种在公共局面中的决策可达性
npm.cmd run validate:fresh  # 冻结后首次启用的74局种子集；重跑不增加独立样本
npm.cmd run metrics:report  # 汇总报告并拒绝与当前源码指纹不符的旧结果
npm.cmd run challenges:witness # 无盾试炼的合法通关构造验证
npm.cmd run screenshots     # 收集本轮E2E截图到docs/screenshots
npm.cmd run verify:release  # /game/子目录、断网、实际时钟战斗、音乐与Range验收
npm.cmd run assets          # 导出两阵营精灵图集和四战场PNG
npm.cmd run motion:audit    # 全tick出生/位移异常审计
# 以下需要运行本地dev服务器，默认 http://127.0.0.1:4199/
# npm.cmd run dev -- --port 4199 --strictPort
npm.cmd run verify:motion   # 9组视口/DPR与真实RAF插值检查
npm.cmd run verify:audio    # 305秒真实波形长播（不加速、不seek）
npm.cmd run audio:analyze   # 重现Final素材的稀疏低频重音分析
```

浏览器下载受阻时，可使用已有Chrome/Edge：

```powershell
$env:CHROMIUM_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm.cmd run test:e2e
```

Windows自动化配置也会查找已有Playwright Chromium缓存。CI使用标准 `playwright install --with-deps chromium`，不依赖本机特定路径。性能数据是当前Windows/Chromium环境实测，不是所有设备的帧率保证。自动对战JSON附核心与数据文件SHA256指纹；固定配方/AI对战不是人类通关或全策略平衡证明。

## GitHub Pages

**线上地址：<https://funct1ons.github.io/chronicles-of-ember-and-dawn/>**（已实际部署并访问验证）

1. **v1.1 已提交、部署并通过真实公网验收**：16兵种完整图鉴、连续战斗配乐、运动优化均已上线；GitHub Pages 断网重载后可出兵并实际播放音乐，五首离线音频SHA校验全部一致。发布与实测证据见 [执行记录](docs/PROGRESS.md)。
2. GitHub仓库 **Settings → Pages → Source → GitHub Actions**。
3. `.github/workflows/pages.yml` 在 `main` 推送或手动触发时执行依赖安装、单测、构建与浏览器验收，然后上传 `dist/` 并部署。
4. 如果默认分支不是main，修改工作流分支过滤。

Vite `base: './'`、同源相对音频和SW清单支持 `https://<user>.github.io/<repo>/`，不需要硬编码仓库名。离线入口使用标准发布地址（末尾 `/`）；缓存仅包含精确构建清单，不对任意查询URL或其它页面作离线兜底。部署后可运行 `npm.cmd run verify:live` 做真实公网在线/断网验收，要求本地 `dist/` 与线上构建一致。

## 工程结构

```text
src/core/       纯数据固定步模拟、伤害、碰撞/队列、经济、AI（无DOM）
src/data/       16兵种、4环境、10战役、3试炼配置
src/render/     原创像素图帧缓存、场景、按脚点深度排序、特效
src/audio/      音乐导演、分总线音效/环境、限流与优先级
src/ui/         DOM模板、交互、存档校验与设置
public/art/     可审阅/编辑的原创PNG精灵表与场景
public/audio/   五首本地CC0原始配乐
scripts/        平衡、PNG导出、生产离线验证、SW生成
```

模拟不依赖渲染、音频或在线服务；固定30Hz，渲染使用requestAnimationFrame与位置插值（暂停冻结展示，不修改模拟位置）。当前约150单位预算下采用有界O(n²)邻近搜索与软八队列，无不必要后端/框架。

## 设计与验收文档

- [机制研究与证据边界](docs/MECHANICS_RESEARCH.md)
- [游戏设计](docs/GAME_DESIGN.md)
- [美术方向](docs/ART_DIRECTION.md)
- [音频方向与听感验收边界](docs/AUDIO_DIRECTION.md)
- [平衡报告](docs/BALANCE_REPORT.md)
- [测试报告](docs/TEST_REPORT.md)
- [素材授权](docs/ASSET_LICENSES.md) / [音乐逐项来源与哈希](docs/ASSET_LICENSES_AUDIO.md)
- [开发与问题记录](docs/PROGRESS.md)
- [v1.1 已批准方案与实施追踪](docs/PLAN_V1_1_CODEX_AUDIO_MOTION.md)
- [线上 Pages 实测记录](docs/metrics/live-pages.json)

## 授权与已知边界

原创代码、文字与像素资源采用MIT；第三方音乐单独遵循CC0 1.0，保留作者来源。未打包系统字体，未使用原Miragine贴图/Logo/音乐。

首版面向Windows桌面浏览器（建议至少1024px宽），不含服务器联网、抽卡、英雄养成或商业化。Safari/移动触屏不是本轮验证目标。音效是本地分层合成，不冒称真人录制音效库；角色动画是原创程序化像素图帧，不冒称商业级手绘动画。音乐经过实际播放与电平/响度验证，但**机器检测不等于人耳主观试听**，主观音色/编曲与循环听感仍需人工评估。
