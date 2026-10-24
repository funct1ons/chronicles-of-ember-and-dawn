# 测试与实际运行记录

## 当前：16兵种视觉身份重构（本地验收通过，已获授权正在发布）

当前核心/数据指纹：`fd82d170ac87125473db58255d89a7aeb7251d50698bf991ae1c09d89df3449e`。本轮仅精灵、美术辅助、装备一致性文案与测试/报告调整；16兵所有机械字段逐项锁定，模拟、AI、经济、音频及运动算法未改。`units.ts` 的故事变动会改变原始字节指纹，故重新跑完整对战报告，而非直接沿用旧指纹。

|项目|本轮实测|
|---|---|
|单测/类型/生产构建|**22文件274项通过**；类型与图集导出通过。JS184.01kB/gzip66.13kB，CSS35.84kB/gzip8.91kB。|
|美术全帧|**640帧、0缺陷**：16兵×双阵营×5状态×4帧，48×48、非空、alpha仅0/255，扩大画布重绘检查裁切；walk/attack至少3种不同帧，双阵营几何一致。|
|轮廓问题对|预先指定9对idle/平均IoU均<0.86；三施法者idle从全同降为0.541/0.636/0.533，轻斥候/刺客0.448，轻骑/重骑0.792。IoU是同原点几何诊断，**不是玩家误认率**；完整口径见`UNIT_VISUAL_IDENTITIES.md`。|
|完整浏览器|**16/16一次通过，56.4秒**；含新2项像素/几何/缩图检查、首页/图鉴/音频/合法胜局/150人负载。无修改原100ms AI阈值。|
|150人压力|高HP混合队只作负载fixture：绘图中位0.6ms/P95 4.0ms，3模拟秒164.7ms，持续155 headless FPS；不作平衡证据。另合法75+75普通AI最大23.6ms、困难52.6ms、大师0.6ms，小军收尾32.3ms，均过100ms门槛。|
|合法自然胜局|c1无资源/属性注入：168模拟秒、14波、184击杀、69征募、基地2500/0；统计与存档相符。|
|对战等价回归|521局、3136公共局面角色覆盖及挑战见证重跑。六报告保留数组顺序与全部实际游戏/种子/RNG衍生结果，严格对比一致；仅忽略生成时间/源锁/CPU计时及已说明的未使用模板seed。**不是新增独立样本**。|
|运动|44,769 tick、1,941,038连续样本，最大2.743709 world px，无>6px。9组1024/1440/1920×DPR1/1.25/1.5通过；180Hz环境raw展示变化约6倍于30Hz模拟，不承诺每帧设备像素都移动。|
|生产子路径与离线|`/game/` 模拟Pages编码Vary服务器，21缓存、断网RAF至第8波/81模拟秒，Final播放25.2976秒；五音频全文SHA与206/128字节Range一致，无页面/非取消类资源失败。|
|实际图像审查|主侧打开最终双阵营联系图、动作图、150人双DPR、图鉴、雪地、代表视口及最新生产离线/自然交战截图，不只依靠代理回报或静态检查。|

主入口`metrics/summary.json`；新证据`unit-visual-redesign.json`、`unit-visual-gameplay-equivalence.json`，最新`browser-performance.json`、`release.json`、`v11-motion-browser.json`均有相应源码锁。旧v1.1等价报告保留为历史，汇总脚本按当前源码匹配，不用新故事指纹冒充旧验收。音频四文件未改，305秒长播证据源码锁仍有效，未无必要重跑并冒充新听审。

**边界**：本轮完整性能通过不解释过去Windows182.5/163.7ms尖峰，根因专项仍未决；旧缓存安全升级提示尚未实现。没有人类辨识率实验、人耳听审、人工完整战役或实体低配/Firefox/Safari验收。用户已授权提交部署，新版CI/公网证据将在完成后归档；下列封面与v1.1公网记录仅属于历史版本。

## 首页封面改版（已提交部署并完成公网验收，历史）

- **262项单测 / 19文件通过**，含新增3项首页结构与兼容性检查；类型与生产构建通过。JS138.74kB/gzip52.77kB、CSS35.84kB/gzip8.91kB。
- 首页专项 **2/2浏览器用例通过**：六窗口640×480、800×600、1024×768、1366×768、1440×1000、1920×1080；无横纵溢出、标题/按钮/页脚不交叠，所有模式、存档进度、设置/鸣谢与键盘跳转保留。`metrics/cover-redesign.json` 锁定模板/首页CSS/入口文件；实际打开上述多尺寸截图，归档 `screenshots/cover/`。
- 生产 `/game/` 子路径与断网重载通过：SW21缓存、第8波/82模拟秒，Final实际推进25.48秒，五音频完整SHA与Range206正确；`metrics/release.json` 锁定本地新产物。这不是新版公网发布验收。
- **本地Windows完整回归曾有性能项未过，原因仍未决**：两次14用例执行均13通过，困难AI最大182.5ms / 163.7ms，超过原100ms门槛；保留于 `cover-browser-performance-first-failure.json` 和 `cover-browser-performance-second-failure.json`。未改源码的单项三次复测分别91.4 / 74.3 / 46.4ms并通过；不能据此抹去完整套件失败或声称原因已确证。独立有界诊断已经结束，见 `metrics/cover-performance-diagnosis.json`：带引擎trace的新浏览器/有限前序负载峰值207.6/100.9ms，41次AI选择与RNG序列一致；最大尖峰主线程CPU181.8ms，记录到的GC9.44ms、直接JIT scope1.09ms不足以解释全部耗时。trace可能扰动时序，不代替原始验收。旧首页对照超时未完成，**根因仍未确证，也未排除UI的间接影响**；待独立性能专项做固定次数、等等待时间的旧/新首页配对与函数级CPU分析。
- 用户随后明确授权“提交和部署”。提交 `7cab52f` 后，原完整流水线 [40057479233](https://github.com/funct1ons/chronicles-of-ember-and-dawn/actions/runs/40057479233) 一次通过：**262单测、14/14浏览器（51.4秒）、生产离线验证**，build2m15、deploy10s。Ubuntu/Node22/Chrome156压力绘图中位0.6ms/P95 13.4ms、持续52.7FPS，普通AI峰值7.4ms、困难52.6ms、大师0.9ms、小军20.3ms；原100ms门槛未改。`metrics/cover-ci-run.json` 保存API步骤状态和日志原行。**这是独立CI环境通过，不是Windows尖峰已修复或可随意忽略的证明**；本地两次失败、三次隔离通过及诊断全部保留，Windows性能专项仍未决。
- 真实公网 `https://funct1ons.github.io/chronicles-of-ember-and-dawn/` 新封面验收通过（`metrics/cover-live-pages.json`）：标题为「烬辉战纪」，JS `index-BExlH8Ov.js`、SW与本地构建逐字节相同，无开发API。已实际打开1440封面与断网交战截图；图鉴/搜索/故事、U/B快捷键/暂停保留，Final从1.0096推进13.0149秒。SW缓存 `ember-dawn-605d01d47a707c` 共21文件；断网重载8秒后9人口、Final播放2.47秒，五首音频完整SHA与本地一致、Range206/128字节，无页面错误或非取消类资源失败。主动导航取消媒体请求单列为ERR_ABORTED，非隐藏真实错误。
- 本次未改战斗/AI/经济/音频/运动代码；源码未变不等于浏览器性能不受影响。旧521局、305秒音频长播与运动审计仍为对应源码的既有证据，不冒充本轮重跑。下列为 **v1.1发布时的历史验收**；其性能报告另存 `metrics/v11-published-browser-performance.json`，当前 `browser-performance.json` 如实保留最新执行结果。

### 旧缓存回访：此前验收的覆盖缺口

用户报告 Pages 仍显示旧封面后，主侧再次核对 `e166642` 对应部署成功，真实公网根入口、JS/SW 字节与 dist 相同；全新 Chromium 截图为新版（`metrics/cover-live-recheck.json`）。这不能替代已有缓存的升级验证。

独立 debugger 在有界真实 SW/CacheStorage fixture 中复现：旧缓存返回首次回访页面；新 worker 已激活/接管且 fetch 返回新 HTML 时，同一已加载 DOM/JS/CSS 仍旧，没有更新提示；激活后第二次 reload 得到新版。延迟一首缓存资源可使 worker 停留 installing；带 `?v=cover-7cab52f` 的在线导航可在旧 worker 控制时加载新版。使用原样生成器、精确提取的旧注册分支；HTML/App/音频为微型替代，不测真实音乐下载时长或游戏中升级。一次初始化等待不充分的无效尝试保留，不作产品证据；一次有效合并场景通过。详见 `metrics/cover-cache-upgrade-diagnosis.json`、`scripts/diagnose-cache-upgrade.mjs`。主侧审查报告/脚本，`node --check`、`git diff --check` 通过，未新增浏览器重复尝试。

用户浏览器的具体 SW/HTTP 状态未实证；本地 no-store 只排除该 fixture 的 HTTP 缓存，不能替用户排除 CDN/HTTP 缓存。当前绕过入口需联网，不清存档；任意查询 URL 不保证离线加载。升级提示/安全确认刷新尚未实现，不能把本次诊断写成自动更新功能验收。本轮未改运行时代码，未重新部署。

## v1.1 环境与复现

Windows x64、Intel i5-13400F（16逻辑核）、16GiB内存、Node 24.14.1、Chromium 153 headless。见 `metrics/environment.json`。核心/数据 SHA256：`30dddd5144bb093fb29cfa5a5f31a4504005866bcfde598bd8c1762b350477af`。音频与展示另有逐文件源码锁；不能只拿核心 SHA 验证 UI/BGM 报告。

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run assets
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run screenshots
npm.cmd run verify:release
# 线上必须已部署为与本地dist相同的构建，才执行：
npm.cmd run verify:live
npm.cmd run balance -- --holdout
npm.cmd run strategy:suite
npm.cmd run missions:verify
npm.cmd run validate:fresh
npm.cmd run ai:coverage
npm.cmd run challenges:witness
npm.cmd run motion:audit
npm.cmd run verify:unit-visuals
npm.cmd run verify:motion
npm.cmd run verify:audio
npm.cmd run audio:analyze
npm.cmd run metrics:report
npm.cmd audit
```

`verify:unit-visuals`、`verify:motion`、`verify:audio`、`audio:analyze` 使用独立运行的开发服务器（默认4199，可用 `GAME_URL` 指向另一端口）。性能实测不要与批量对战同时运行；Node 计时不等于浏览器计时。

## v1.1 发布时执行状态（历史基线）

|项目|结果与证据|
|---|---|
|单元测试|主侧完整执行：**18文件、259项通过**；包括独立冻结参考实现的 AI 精确等价检查、33项静态缓存/Vary/Range与worker生成检查。|
|类型、图集导出、构建|全部通过；JS139.45kB/gzip53.09kB、CSS32.74kB/gzip8.19kB；音乐另计。|
|完整浏览器E2E|**12/12通过，56.9秒**；包含新图鉴、音频、合法自然胜局与150人压力。首轮性能失败仍保留。|
|生产子路径/离线|当前构建 `/game/` 子路径SW缓存21文件；断网重载后真实RAF推进至第8波，音乐时钟25.4秒、五首真实媒体均由SW返回206、完整文件SHA一致，Range206/128字节，无页面错误/资源失败。源码和生产文件SHA均锁定于 `metrics/release.json`。|
|自动对战|当前指纹**521局全部重跑**；3136个局面角色覆盖及挑战见证完成。保序扫描优化前后六份报告的实际对战数据全部精确一致。|
|运动全tick审计|当前指纹44,769 tick／1,941,038个连续单位样本，最大2.744 world px，无 >6px；`v11-motion-audit.json`。|
|真实RAF/视口|9组1024/1440/1920宽 × DPR1/1.25/1.5；相邻帧同id测量，均无溢出/页面错误，源码锁已更新。|
|音乐连续性|305真实秒，3,812次采样；2次循环交叉淡化、5次强度标签变化，均不重置主曲；无静音/未播放采样，见下。|
|依赖审计|`npm audit --json` exit0、0漏洞；`metrics/npm-audit.json`。|

## 单元与界面覆盖

- 经济/战斗：结算顺序、金币结转、人口释放、零增长、收入cap、轻重甲/盾/魔法/反骑/治疗/攻城、局部索敌、前后排队列、死亡和最后一波完整交战窗口。
- 出生：同lane最近合法空位，不额外消费 RNG；存量部队不因换波重叠受到大幅回投。审计逐tick、包括出生/死亡tick，不把缺失数秒后的两点当单帧位移。
- AI：合法资源、不读取敌方未公开下一波选择、不修改真实状态/RNG、限制兵种、辅助/攻城可达性。优化对167快照、13,496个预测字段、1,990次AI选择/RNG/完整状态精确比较。
- 音频：同主曲切battle/climax不重置；流式循环重叠；静音/释放清理；高潮提示量化/去重、声部预算与峰值；旧存档保留自定义音量，新存档音乐默认80%。
- 图鉴：16条60–110字背景、全数值、实际减伤提示、收益效率、搜索/分组/费用排序、空结果与焦点保持；B打开完整战场条目，U仍选择火法。
- UI/存档：模式/阵营/自定义、本地双人独立按键、全屏/暂停/变速、设置持久化、教程跳过、战役锁定和解锁、胜负/重开/撤离、进度导入规范化与防注入。

### 战局证据分级

1. **UI夹具**：直接构造胜负，仅验证弹窗/解锁/存档，不作通关证据。
2. **合法自然胜局**：`combat.spec.ts` 的c1、seed407仅选兵与固定步快进，不注入生命/伤害/金币。最终执行为168模拟秒、14波，击杀184、征募69，与 `browser-natural-match.json` 一致。是合法脚本集成，不是人类游玩或真实时钟时长。
3. **生产真实时钟**：`verify:release` 在临时同源 `/game/` 启动真正生产产物，SW控制后断网重载，实际RAF内选兵/加速，检查音乐时钟、Range206/128字节、无开发接口/页面错误/资源失败。它不声称完成整场胜利。

## 150单位与AI预算

高生命混合150人持续3秒是**纯绘图/模拟负载夹具**，不能当作合法平衡战局。AI另外使用正常生命75+75民兵、每方80人口的快照，实际调用正式决策。

### 保留失败与复核

- v1.1首轮完整E2E：困难最大144.8ms，超过100ms门槛。原记录在 `v11-browser-performance-first-failure.json`，没有放宽门槛。
- 原样三次复测困难最大81.7 / 93.1 / 46.8ms；不能抹去首次失败或据此确定尖峰原因。
- 仅将预测内敌我扫描改为保序阵营索引，保持节点、相同tick更新、平局选择次序；评分、候选数、预测步数、规则、RNG均不变。
- Node交替计时两轮困难中位减少7.73% / 7.96%；这是局部余量，不是浏览器或最坏时延保证。`v11-tactics-equivalence.json` 包含完整方法与精确比较。
- 主侧优化后三次独立浏览器压力均通过：困难峰值50.3 / 44.6 / 60.2ms，普通13.4 / 41.4 / 24.2ms，小军收尾33.1 / 36.6 / 40.9ms。见 `v11-ai-post-optimization-probe.json`，其中明确标注为终端原输出的人工汇总。

最终完整E2E再次通过：绘图中位0.6ms/P95 4.1ms，持续150人约108.6 headless FPS；正常生命150人困难峰值43.7ms、普通64.3ms、大师1.5ms，小军收尾79.8ms。`v11-published-browser-performance.json` 保留该次发布验收报告；所有100ms门槛保持不变。本机headless帧数不是显示器刷新率，也不保证所有低配设备60FPS或任何阵容的最坏上界。

### 回归报告元数据修正

首次六报告对比仅 `challenge-witness.config.seed` 不同：旧脚本把Date.now生成的模板seed写进报告，但 `harness.runMatch` 每场都会用显式seed覆盖，实际每场结果和seed均完全相同。保留首次失败于 `v11-regression-equivalence-first-metadata-mismatch.json`；固定报告模板seed为101并重跑见证。比较工具只将这个未使用的模板seed规范到首个搜索seed，保留原值与原因，**不忽略任何实际比赛seed、数组顺序或游戏结果**。最终六报告均一致（`v11-regression-equivalence.json`），不是额外独立样本。

## 运动与视觉

`v11-motion-browser.json` 测量真正RAF中的连续draw：记录同id相邻frame，拒绝跨缺帧相减。30Hz模拟使用previous/current插值；本机约180Hz RAF环境下，原始展示坐标变化约是模拟更新的6倍，但**不意味着每帧都跨越一个实际设备像素**。报告同时记录真实设备像素变化、最大相邻位移和绘图P95。

DPR≤2 backing；角色原图整数倍率绘制、落脚点对齐设备像素。4Hz指数衰减震屏≤2物理像素，reducedMotion禁用。没有把插值写回模拟或用模糊滤镜掩盖移动。

已实际打开多DPR的1024/1440/1920截图检查：角色比例、武器与旗帜完整，HUD可读、无横向溢出。设备仿真的DPR不是实体Windows缩放/浏览器zoom兼容保证。1024×768允许纵向滚动，移动触屏不在承诺范围。

## 音频连续性与边界

`v11-audio-continuity.json`：305真实秒、3,812次数字波形采样，主曲经历2次流式循环交叉淡化及5次battle/climax切换；切换前后媒体时钟不重置。采样内最长静音/未播放时段均0秒，最低音乐RMS约0.00154，主曲+叠层最大峰值约0.343，未出现页面/媒体错误。该窗口含2倍速度部分，配乐按真实时间推进。

主曲使用同一Final Battle，1.6秒双deck重叠循环；高潮仅添加按本地节拍提示量化、带冷却的打击点缀，不叠第二首主旋律，也不冒称逐小节完美配器。App采用真实时间滞回与至少45秒间隔，避免模拟加速造成频繁切层。

`audio:analyze` 完整解码本地五文件，Channel0、RMS阈值0.00003、20ms窗；边界裁到真实duration，因此head/tail不出现负数。这是数字阈值分析，不能把另一阈值的尾音长度当作“听感静音”并盲目删曲。原文件SHA与许可不变。

**未完成人耳主观试听。** 自动采样不是采样级连续性的数学证明，也不能证明编曲、音色、循环接缝与战争感染力达到人耳审美标准。`audio-runtime.json` 则由最终E2E检查七状态、静音、播放、并发声部与总线峰值。

## CI 跨 Node 版本可移植性

首次发布流水40051642563在单测中失败：测试把Windows/Node24的预测浮点序列摘要当成跨运行时固定值。逐字段 `Object.is`、实际AI选择及完整状态/RNG比较均已通过；失败只发生在随后固定摘要断言。主侧在**同一台Windows**另用Node22.23.4复现与Linux CI完全相同的预测摘要，确认Node版本差异已足以触发问题（`v11-ci-portability.json`）。

修复仅涉及测试/校验脚本：保持冻结原实现、全部字段精确比较，另外独立累积参考/优化摘要后在同一运行时比较；没有容差、四舍五入或生产代码变化。Node22和24均通过原/新精确比较，226单测与生产构建再次通过。首次失败记录与运行编号保留，不靠重试跳过。

## 公网部署实测：离线媒体失败、修复与最终通过

提交 `48562e9` 的流水40052109535已完成build/deploy；真实公网在线JS字节与本地构建一致，新图鉴、B/U、主曲连续12秒与SW21文件/Range206均通过。但首次**公网断网重载后五首音乐全部net::ERR_FAILED**，战斗仍正常；本地生产离线通过不覆盖这个失败。原报告保留于 `v11-live-pages-first-offline-failure.json`。debugger已证实：Cache.addAll保存的请求键无Accept-Encoding，而真实浏览器音频请求带identity；Pages即使不压缩音乐仍返回Vary: Accept-Encoding，导致媒体请求miss。手动fetch的Range请求没有这个浏览器专用头，因此旧测试误通过。精简真实SW证据见 `v11-offline-cache-reproduction.json`；合成new Request不能复制禁止修改的浏览器请求头，未作为根因证明。

修复只对**精确构建清单URL、完整200、仅含Accept-Encoding的Vary**回退匹配，绝不绕过Origin/Cookie/Authorization等Vary；保留Range206/416并将handler纳入缓存revision。本地生产服务器增加Pages式Vary/gzip/Range，检查五首真实离线媒体206和完整SHA。主侧独立259单测/tsc、12/12 E2E、模拟Pages生产离线回归与指标源锁检查全部通过；五首媒体206/完整SHA、82模拟秒至第8波、音乐25.4秒，无页面或失败请求。修复提交`f1a096c`对应Actions40053690078的build/deploy全部成功。随后**真正公网复测通过**（不是用本地或CI代替）：HTTP200，生产JS与SW逐字节匹配dist；16条图鉴、搜索焦点、故事展开、B完整详情/暂停与U火法通过。在线Final由1.01秒推进至13.02秒；SW控制21缓存，Range206/128字节。断网重载后8秒征募9人口、Final实际播放2.48秒，五首完整音频SHA与public/audio全部相同，无pageerror、异常HTTP或失败请求；导航/媒体主动取消的ERR_ABORTED独立记录。证据`v11-live-pages.json`、`v11-ci-runs.json`和`../screenshots/v11/live-pages-offline.png`，截图已实际打开检查。`npm.cmd run verify:live`可复现公开页面流程（要求本地dist与线上产物一致）。

## 发布与未完成边界

v1.1已获用户明确授权并完成提交、推送、CI、部署与真正公网在线/断网验收。`live-pages.json`是v1.0历史记录，不作为v1.1证据；本次最终通过见`v11-live-pages.json`，首次失败单独保留为`v11-live-pages-first-offline-failure.json`。最终证据提交可以晚于实测所记localHead；只含文档/截图/报告，不改变已逐字节核对的运行产物。

仍未完成：人耳音频听审、人类完整战役通关/难度体验、实体低配PC、Firefox/Safari以及所有权限/DPI组合。核心回归、完整E2E和生产离线验收均已完成；不将外部/主观评估写成已验收承诺。
