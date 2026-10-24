# 测试与实际运行记录 · v1.1

## 环境与复现

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
npm.cmd run verify:motion
npm.cmd run verify:audio
npm.cmd run audio:analyze
npm.cmd run metrics:report
npm.cmd audit
```

`verify:motion`、`verify:audio`、`audio:analyze` 使用独立运行的开发服务器（默认4199，可用 `GAME_URL` 指向另一端口）。性能实测不要与批量对战同时运行；Node 计时不等于浏览器计时。

## 当前执行状态

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

最终完整E2E再次通过：绘图中位0.6ms/P95 4.1ms，持续150人约108.6 headless FPS；正常生命150人困难峰值43.7ms、普通64.3ms、大师1.5ms，小军收尾79.8ms。`browser-performance.json` 记录当前源指纹；所有100ms门槛保持不变。本机headless帧数不是显示器刷新率，也不保证所有低配设备60FPS或任何阵容的最坏上界。

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

## 公网部署实测：离线媒体阻塞记录

提交 `48562e9` 的流水40052109535已完成build/deploy；真实公网在线JS字节与本地构建一致，新图鉴、B/U、主曲连续12秒与SW21文件/Range206均通过。但首次**公网断网重载后五首音乐全部net::ERR_FAILED**，战斗仍正常；本地生产离线通过不覆盖这个失败。原报告保留于 `v11-live-pages-first-offline-failure.json`。debugger已证实：Cache.addAll保存的请求键无Accept-Encoding，而真实浏览器音频请求带identity；Pages即使不压缩音乐仍返回Vary: Accept-Encoding，导致媒体请求miss。手动fetch的Range请求没有这个浏览器专用头，因此旧测试误通过。精简真实SW证据见 `v11-offline-cache-reproduction.json`；合成new Request不能复制禁止修改的浏览器请求头，未作为根因证明。

修复只对**精确构建清单URL、完整200、仅含Accept-Encoding的Vary**回退匹配，绝不绕过Origin/Cookie/Authorization等Vary；保留Range206/416并将handler纳入缓存revision。本地生产服务器增加Pages式Vary/gzip/Range，检查五首真实离线媒体206和完整SHA。主侧独立259单测/tsc、12/12 E2E、模拟Pages生产离线回归与指标源锁检查全部通过；五首媒体206/完整SHA、82模拟秒至第8波、音乐25.4秒，无页面或失败请求。正在重新部署并做真正公网复测。`npm.cmd run verify:live` 可复现公开页面流程（要求本地dist与线上产物一致）。

## 发布与未完成边界

v1.1已获用户明确授权提交并发布；Actions首轮已部署；公网离线媒体修复已完成，正在重新验证与部署。GitHub Pages的`live-pages.json`仍是已上线v1.0的历史记录，不作为v1.1证据；新版本实测将独立记录。

仍未完成：人耳音频听审、人类完整战役通关/难度体验、实体低配PC、Firefox/Safari以及所有权限/DPI组合。核心回归、完整E2E和生产离线验收均已完成；不将外部/主观评估写成已验收承诺。
