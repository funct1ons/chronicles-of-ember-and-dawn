# 烬辉战纪 · 音频方向与实现

> 范围：`src/audio/AudioManager.ts`、`public/audio/*`。
> 目标平台：Windows PC 浏览器、离线静态部署（Vite）。
> 本文件记录**实际实现**与已核实的资源事实；主观听感尚未验收，见文末“已知局限”。

## 1. 方向与边界

- **BGM 全部使用本地成品音频形式的 CC0 管弦乐 / 战争配乐（不宣称真人乐团现场演奏）**，不使用实时合成的循环冒充交响乐，也不使用 chiptune/8-bit 作为背景音乐。
- 音效（UI、刀剑、弓弩、魔法、火、号角、鼓、坍塌、风）由 Web Audio **本地合成**，带噪声瞬态、金属非谐分音、滤波与包络，避免单音“滴滴”感。
- 运行时**不发起任何外部网络请求**：音乐由 `public/audio` 经 `import.meta.env.BASE_URL` 提供（仅同源静态文件），音效与风由 Web Audio 生成。
- 5 首原始录音覆盖 **7 个叙事状态**；`victory` 与 `defeat` 是同一批 CC0 素材的运行时复用（增益/播放速率处理），不伪造新曲目，也不修改原始文件。
- 音频是表现层：核心模拟不依赖音频，任何音频异常都被捕获，不阻断模拟与渲染。

## 2. 七状态音乐设计

| 场景 | 叙事用途 | 曲目 | 运行时处理 | 交叉淡化 |
| --- | --- | --- | --- | --- |
| `menu` | 主菜单、势力/模式选择 | Eye of the Storm | 场景增益 0.72，原速 | 2.6 s |
| `campaign` | 战役地图、关卡简报 | War Theme | 场景增益 0.68，原速 | 2.4 s |
| `prepare` | 开战准备、首波倒计时 | Hope (Orchestral Battle Music) | 场景增益 0.66，原速 | 2.0 s |
| `battle` | 常规回合交战 | The Final Battle | 场景增益 0.78，原速 | 1.8 s |
| `climax` | 密集交锋、要塞濒危 | Epic March Loop | 场景增益 0.84，原速 | 1.4 s |
| `victory` | 胜利结算 | Hope (Orchestral Battle Music) —— 复用 | 场景增益 0.70，原速；若该曲正在播放则延续 | 1.6 s |
| `defeat` | 失败结算 | Eye of the Storm —— 复用 | 场景增益 0.58，`playbackRate = 0.92` 放慢 | 2.8 s |

设计意图：

- **菜单**用较宽的战争氛围曲，不抢 UI 注意力；**战役**用有军旅/铜管/鼓点标签的曲目建立推进感；**备战**用明亮曲目承接希望与紧张；**战斗**用戏剧性强的曲目；**高潮**用 43 秒的中世纪行军循环，短、密、可重复。
- **胜利**不另找第六首：重新进入 `Hope`，形成“战前希望 → 胜利凯旋”的再现；若当前正播放该曲（例如直接从 `prepare` 切来），只平滑改变增益/播放速率，不重启。**失败**把 `Eye of the Storm` 放慢到 0.92 倍，作为同一场风暴的余波；`defeat → menu` 仍是同一曲目，不会重新起播，只恢复原速与音量。
- 以上“明亮/戏剧性/行军”依据 OpenGameArt 页面作者自述与标签，**不是试听结论**。素材实际听感需在集成后主观验收，必要时只调整 `SCENES` 中的 `music` / `playbackRate` / 淡化时长，无需改文件。
- 进入 `climax` 由 App 判断：实际接敌单位达到20，或任一要塞生命低于30%；高潮状态下接敌单位降到9以下才允许回落，切换至少间隔12秒。音频层不自动读取战局。

推荐的状态切换：

```text
menu ──> campaign ──> prepare ──> battle ──> victory ──> campaign/menu
                                     │
                                     ├──> climax ──> victory
                                     └──> defeat ──> menu/campaign
```

同一帧内多次 `setScene` 只保留最后一个；重复设置当前场景是安全的 no-op。

## 3. 混音结构

```text
BGM（两个 HTMLAudioElement 甲/乙）
  element.volume = musicVolume × trackLoudnessTrim × sceneGain × crossfadeGain × duckGain × seamEnvelope
  mute 时 = 0

音效（Web Audio 合成声部）
  voice → effectsGain → DynamicsCompressor → masterGain → destination

环境（Web Audio 噪声）
  粉噪 → 低通 480 Hz ─┐
  粉噪 → 带通 1250 Hz ─┼→ windGain ─┐
  粉噪 → 低通 85 Hz → rumbleGain ────┴→ ambienceGain → masterGain

mute：masterGain = 0，同时把所有 BGM element.volume 置 0；未静音时 masterGain = 0.8 预留余量
```

- **三条独立用户音量**：`setVolumes(music, effects, ambience)`，各自 0..1 并独立保留。
- 音频类独立默认值为音乐 `0.70`、音效 `0.80`、环境 `0.50`；实际游戏由存档设置覆盖，首次启动为 `0.45 / 0.50 / 0.25`。BGM 再乘场景增益（0.58–0.84），给音效和 UI 留动态余量。
- 环境风声在 `ambienceGain` 之外还有独立 `windGain`；`update()` 用两个不同频率的正弦叠加形成缓慢阵风，避免恒定白噪的“空调声”。战斗/高潮场景额外叠加 85 Hz 低通“远方战鼓/隆隆”层。
- 音效总线有压缩器（阈值 −16 dB、比率 4:1），大量单位混战时抑制削波；这属于保护，不是“实时合成 BGM”。

## 4. 音效目录（21 个）

所有音效名称与需求清单一致：

`select`、`click`、`coin`、`countdown`、`spawn`、`sword`、`shield`、`pike`、`axe`、`bow`、`crossbow`、`magic`、`fire`、`heal`、`horn`、`base`、`collapse`、`victory`、`defeat`、`step`、`warning`。

| 名称 | 建议触发 | 合成层次（瞬态 / 主体 / 尾部） |
| --- | --- | --- |
| `select` | 兵种/菜单选中 | 720→980 Hz 正弦短音 + 1440 Hz 三角泛音 |
| `click` | 按钮确认 | 2.6 kHz 高通噪声点击 + 1.8→1.2 kHz 短音 |
| `coin` | 金币收入/购买 | 1318.5 Hz、1760 Hz 双三角铃音 + 3520 Hz 微光 |
| `countdown` | 回合/开战倒计时 | 220→130 Hz 低鼓 + 带通噪声 + 440 Hz 木鱼感短音 |
| `spawn` | 单位入场 | 160→70 Hz 落地 + 500→1600 Hz 上升气流 + 330→660 Hz 提示音 |
| `sword` | 剑/轻步兵命中 | 3.2 kHz 高通瞬态 + 2380/3510/5070 Hz 金属分音 + 低频撞击 |
| `shield` | 盾兵/重甲格挡 | 150→65 Hz 闷响 + 780/1210/1930 Hz 较低金属分音 + 带通噪声 |
| `pike` | 长枪突刺 | 520 Hz 木质短击 + 260→140 Hz 枪杆 + 1900/2850 Hz 枪尖金属 |
| `axe` | 蛮兵/重斧劈砍 | 1.6 kHz→280 Hz 低通噪声 + 110→48 Hz 重击 + 少量金属泛音 |
| `bow` | 弓手射击 | 320→150 Hz 弦释放 + 1.1→2.6 kHz 箭矢气流 + 900→400 Hz 弦尾 |
| `crossbow` | 弩手射击 | 2.3 kHz 机械扣击 + 金属小件 + 900→380 Hz 后坐 + 箭矢气流 |
| `magic` | 法师/火法施法 | 523/659/784/1046 Hz 琶音 + 700→4200 Hz 魔法气流 + 高频泛音 |
| `fire` | 火焰法术命中 | 1.1 kHz→380 Hz 低通轰燃 + 2.6 kHz 火星 + 95→45 Hz 低频 + 随机爆裂 |
| `heal` | 祭司治疗 | 392/523/659 Hz 三角琶音 + 1046 Hz 高音 + 上升微光噪声 |
| `horn` | 开波/号令/精英登场 | 155.56 Hz→233.08 Hz 锯齿铜管+低通 + 466 Hz 泛音 + 116 Hz 低音 |
| `base` | 要塞受击/撞击 | 72→42 Hz 长鼓 + 240 Hz 低通噪声 + 58→38 Hz 锯齿低音 |
| `collapse` | 要塞摧毁 | 1.7 s 下坠低通噪声 + 90→32 Hz 塌陷 + 随机碎石 + 低频锯齿 |
| `victory` | 胜利短号角（与 BGM 叠加） | 523/659/784 Hz 锯齿三连音 + 四音持续和弦 |
| `defeat` | 失败短动机 | 392→349→294→220 Hz 下行三角音 + 110 Hz 低音持续 |
| `step` | 可选：行军脚步 | 420 Hz 低通脚步噪声 + 95 Hz 轻闷响（刻意压低） |
| `warning` | 要塞低血/危险提示 | 880 Hz 与 1174.66 Hz 双铃警示 + 1760 Hz 微光 |

### 4.1 防过载参数

| 名称 | 冷却 (s) | 同名并发上限 | 优先级 | 音高随机 |
| --- | --- | --- | --- | --- |
| `select` | 0.045 | 2 | 2 | ±2% |
| `click` | 0.05 | 2 | 1 | ±3% |
| `coin` | 0.09 | 3 | 3 | ±1.5% |
| `countdown` | 0.5 | 1 | 5 | ±1% |
| `spawn` | 0.12 | 4 | 3 | ±5% |
| `sword` | 0.07 | 6 | 5 | ±6% |
| `shield` | 0.08 | 4 | 5 | ±5% |
| `pike` | 0.09 | 3 | 5 | ±6% |
| `axe` | 0.12 | 3 | 6 | ±7% |
| `bow` | 0.08 | 5 | 5 | ±6% |
| `crossbow` | 0.1 | 4 | 5 | ±5% |
| `magic` | 0.14 | 3 | 6 | ±3.5% |
| `fire` | 0.16 | 3 | 6 | ±5% |
| `heal` | 0.5 | 2 | 5 | ±2% |
| `horn` | 1.4 | 1 | 8 | 固定 |
| `base` | 0.35 | 2 | 8 | ±3% |
| `collapse` | 1.6 | 1 | 9 | ±3% |
| `victory` | 4 | 1 | 10 | 固定 |
| `defeat` | 4 | 1 | 10 | 固定 |
| `step` | 0.09 | 4 | 1 | ±8% |
| `warning` | 1.4 | 1 | 7 | 固定 |

- 全局受管声部上限 **20**。达到上限时，新声音只有在优先级不低于当前最低优先级声部时才可“抢占”最弱声部；否则直接丢弃。被抢占声部以短包络衰减，并在60ms内停止，故极短释放尾音可与20个有效声部重叠，避免硬切爆音。
- 每次调用 `play` 都有上表所列的 ±1.5% 到 ±8% 频率扰动（号角、胜负、警示固定音高），避免连续打击完全同质。
- `intensity`（0..1）线性缩放音量（0 时仍保留 35% 基础响度，便于低强度反馈）；`pan`（−1..1）经 `StereoPannerNode` 定位，无该节点时自动退化为居中。
- 冷却按 `AudioContext.currentTime` 计算；未解锁或上下文非 running 时静默跳过。

## 5. 集成契约

```ts
import { AudioManager, type AudioScene } from './audio/AudioManager';

// 整个应用只创建一个实例，不要按页面重复创建。
const audio = new AudioManager({ debug: import.meta.env.DEV });

// 必须在真实用户手势中解锁（只会成功一次；重复调用安全）。
window.addEventListener('pointerdown', () => void audio.unlock(), { once: true });
window.addEventListener('keydown', () => void audio.unlock(), { once: true });

// 场景切换（幂等）。
audio.setScene('menu');

// 每帧调用，dt 单位为秒；内部把 dt 限制在 0..0.25 s。
function frame(dt: number) {
  audio.update(dt);
}

// 设置面板（0..100 → 0..1）。
audio.setVolumes(music / 100, effects / 100, ambience / 100);
audio.setMuted(settings.muted);

// 战斗事件示例：屏幕 x 0..1280 映射到声像，强度随伤害/规模增长。
const pan = (x: number) => (x / 1280) * 2 - 1;
audio.play('sword', 0.7, pan(event.x) * 0.7);
audio.play('collapse', 1, pan(baseX) * 0.5);

// 页面/组件销毁时。
audio.dispose();
```

关键约定：

1. **`unlock()` 必须在 click/pointerup/keydown 等真实手势中调用。** 浏览器的自动播放策略会阻止未激活的音频；`play()` 被拒绝时被捕获且不会抛到游戏循环。
2. **`update(dt)` 每帧调用**，且 `dt` 为秒。交叉淡化与阵风由它推进；若不调用，第一段音乐将停在淡入起点。
3. `setScene` 只应在状态真正变化时调用；重复调用当前场景不会重启歌曲。主循环每帧调用同一场景是安全的 no-op（已用 90 次连续调用实测：`play()` 调用数不增加，播放时间继续前进）。
4. `setMuted` 与 `setVolumes` 可在 `unlock()` 之前调用：设置会被保存，解锁时立即生效。音乐/音效/环境任一音量允许为 0；三路都为 0 时实测输出 RMS 为 0。
5. 音频层不主动读游戏状态。调用方按上表驱动场景与事件。
6. 不要直接 `new AudioManager()` 多次；多实例会重复预加载 23 MB 音乐并叠加音轨。

### 5.1 App 实际场景映射

| 界面/状态 | `setScene` |
| --- | --- |
| 主菜单、势力选择、设置 | `menu` |
| 战役地图、关卡选择 | `campaign` |
| 开战到首波出兵前 | `prepare` |
| 常规对战回合 | `battle` |
| 密集接敌或要塞 < 30%，带人数及12秒迟滞 | `climax` |
| 胜利结算面板 | `victory` |
| 失败结算面板 | `defeat` |

### 5.2 战斗事件映射建议

| 模拟事件 | 音效 |
| --- | --- |
| `spawn` | `spawn`（精英/攻城单位可加 `horn`，但依赖 1.4 s 冷却） |
| `hit`（近战） | 按兵种：`sword` / `shield` / `pike` / `axe` |
| `shot` | `bow` / `crossbow` / `magic` / `fire` |
| `heal` | `heal` |
| `base` | `base`；要塞摧毁时 `collapse` |
| `wave` / 最后3秒倒计时 / 开战 | `coin` / `countdown` / `horn` |
| 胜利 / 失败 | `victory` / `defeat`，同时切 `victory` / `defeat` 场景 |
| 金币入账 / 购买 | `coin` |
| UI 确认 | `select` / `click` |
| 低血警告 | `warning` |
| 行军脚步 | `step`，App每约0.38秒最多触发一次，不逐单位播放 |

`play` 的冷却与并发限制已能承受回合同步涌出的大量事件；调用方仍应避免把每个单位每一帧的移动都映射为 `step`。

## 6. 运行时行为

- **预加载**：构造函数为 5 首曲目建立 `HTMLAudioElement`（`preload="auto"`、`loop=true`、`volume=0`），设置 `src` 后调用 `load()`。构造函数不创建 `AudioContext`，避免浏览器手势警告；`unlock()` 时才创建/恢复。
- **双甲板交叉淡化**：`current` + `outgoing` 两个 `Audio` 对象。切场景时旧曲线性淡出、新曲淡入；淡出完成后 `pause()` 并回到 0。A→B→A 的快速切换会复用仍在淡出的甲板，不产生第三路音频。
- **同曲目切换**：`prepare → victory` 等使用同一文件时只平滑调整增益/播放速率，不重启。
- **循环**：全部 `loop=true`，首0.6秒/尾1.1秒运行时柔化包络；不修改源录音、不宣称采样级无缝。The Final Battle原曲有一处停顿，属于保留的编曲内容。
- **路径**：`import.meta.env.BASE_URL + 'audio/<file>'`，兼容子路径部署。
- **同场景不重启**：`setScene` 对当前场景直接返回；同一曲目跨场景（如 `prepare → victory`、`defeat → menu`）也不会重设 `currentTime`，只平滑调整音量/速率。
- **手势前设置**：`setMuted` / `setVolumes` 在 `unlock()` 前只记录状态；创建上下文时应用。实测预置静音后解锁，`masterGain = 0`、BGM 元素音量为 0，取消静音后恢复。
- **异常处理**：`unlock`、`play`、`ensureContext`、环境节点、每一声部与交叉淡化均 `try/catch`；失败默认静默，`debug: true` 时输出 `[audio] ...` 警告。音频失败不影响模拟。
- **音量与静音**：音乐通过 `element.volume`，音效/环境通过各自 GainNode，静音通过 `masterGain = 0` + 音乐音量 0。静音时仍保留播放进度。
- **销毁**：停止风声源、断开节点、清空并释放 5 个媒体元素、关闭 `AudioContext`；之后所有公开方法均为安全 no-op。

## 7. 已知局限与风险

1. **未做主观试听。** 素材选择依据 OpenGameArt 页面文字、标签、时长与格式；`victory`/`defeat` 的复用、场景增益、放慢处理尚未经人耳验收。本次完成的是机械解码、电平采样与集成行为验证（见第 8 节），不等同于“听过并认可”。首次集成后应由人实际听辨并微调 `SCENES`。
2. **源素材响度已机械标定**：源文件整轨LUFS为Eye −22.07、War −12.03、Hope −9.90、Final −13.79、March −10.49。运行时trim分别1.424/0.448/0.351/0.549/0.375，将场景/用户增益之前的名义响度统一到约−19 LUFS；原始文件不改动。报告见 `docs/metrics/audio-loudness.json`，输出字段仅为ffmpeg分析时的参考，游戏未采用重新编码音频。
3. **OGG Vorbis 兼容性**：三首 OGG 的Vorbis编码应受 Chromium/Firefox/现代 Edge 支持，本轮实际验证的是Chromium；Safari 对 Vorbis 支持依版本而定。项目目标为 Windows PC 浏览器，暂未转码。若需广覆盖，可用 ffmpeg 转成 MP3/AAC 并同步更新许可文档；不得用实时合成替代 BGM。
4. **文件体积**：`epic_march_loop.wav` 为 7.33 MiB PCM，5 首合计 22.29 MiB（23.37 MB），低于 30 MB 预算；离线场景可接受。若未来要求首屏更快，可转码为 OGG/MP3（CC0 允许），但那会改变“原始文件”记录。
5. **循环接缝**：保留原始文件，运行时首0.6秒、尾1.1秒柔化音量；没有重新剪辑成采样级无缝环，仍可能有短暂音乐呼吸。
6. **BGM ducking 已补齐**：优先级≥8的号角/基地/坍塌/胜负音效使音乐短暂降至62%，80ms进、约700ms恢复，减少重要信号遮蔽。
7. **自动化测试已随源码提供**：`tests/e2e/audio.spec.ts` 实测七种状态的播放时钟与非零波形、静音、20声部限制和压缩后输出余量；`scripts/verify-release.ts` 断网实测配乐持续播放与音频Range响应。真实声卡与声像主观听感仍未验收。
8. **`update` 依赖**：交叉淡化与阵风由调用方每帧驱动，漏调用会导致音乐停在淡入低音量。
9. **自动播放失败重试**：若 `play()` 被策略拒绝，会在下一次 `unlock()` 时重试；本模块不自行注册全局手势监听器。
10. **无空间音频/混响尾**：音效用干声 + 滤波 + 包络；未接入卷积混响，战场空间感有限。
11. **音量标定**：已按整轨LUFS机械标定静态trim，消除源素材约12dB差异；主观音色与编曲感受仍需人耳判断。

## 8. 本次验证记录

资源与许可：

- 5 个 OGA 页面与文件直链已实际抓取；作者、CC0 字段、文件名、字节数见 `docs/ASSET_LICENSES_AUDIO.md`。
- 文件均以 SHA-256 记录，魔数分别为 ID3 / OggS / RIFF；`ffmpeg 7.1`（imageio-ffmpeg 提供）完整解码到 null，全部退出码 0；无转码、无剪辑、无重编码。
- 时长：Eye of the Storm 1:58.02、War Theme 4:43.74、The Final Battle 2:25.82、Hope 1:09.82、Epic March Loop 0:43.58。

初次模块机械验证（Playwright缓存版本1243内的 Chromium 153 + Web Audio `AnalyserNode` / `decodeAudioData`；以下初次采样早于最终响度trim与总线余量调整）：

- 5 个文件全部成功解码为 48 kHz 双声道 PCM，时长与 ffmpeg 一致；整轨 RMS / 峰值分别约为：Eye 0.0605 / 0.373、War 0.204 / 1.005、Hope 0.229 / 0.900、Final 0.124 / 0.903、March 0.218 / 1.013。均非静音；War/March 的重采样峰值略超 1.0，属于源素材瞬态；原始文件未修改，运行时使用上述静态trim降低电平。
- 播放 `menu` 时通过 `MediaElementAudioSourceNode + AnalyserNode` 采样到非零 BGM：RMS 0.0255、峰值 0.0871。
- 音效总线采样：触发 `horn`/`sword` 后 RMS 0.0512、峰值 0.4777；环境风声/隆隆采样：RMS 0.0270、峰值 0.1018；三路用户音量全为 0 时输出 RMS = 0。
- 同场景连续 90 次 `setScene('menu')`：`HTMLMediaElement.play()` 调用数保持 1 次（无重启），`currentTime` 从 3.58 s 前进到 6.74 s。跨 6 个场景切换只新增 6 次 `play()`（总计 7 次），每次仅新曲启动一次；`defeat` 播放速率实测 0.92。
- `setMuted(true)` 后 `masterGain = 0`、BGM 元素音量 0、总线有 20 ms 平滑；解锁前预置静音同样生效，取消静音后恢复。`setVolumes(0,0,0)` 时音效/环境增益与音乐元素音量均为 0，输出 RMS 为 0。
- `dispose()` 后 `ctx = null`、`unlocked = false`，公开方法再调用为安全 no-op。
- 页面无 `pageerror`；唯一的 404 是测试页默认请求 `/favicon.ico`，与音频无关；5 个音频请求均为 200/206。

类型检查：

- `npx tsc --noEmit`：当前通过（exit 0），`src/audio/AudioManager.ts` 无类型错误；早期验证时曾有一处不属于本模块的 `src/core/ai.ts` 错误，主侧已修复。

最终集成复测：
- `npm run test:e2e` 中的音频测试已通过；七状态均在本地文件上实际播放，时钟从15秒持续前进、波形RMS非零、媒体错误为null。
- 极端1000次混合音效请求下有效声部不超过20；测试刻意清除音色冷却以施压。压缩后的主总线峰值低于0.99，默认总线再留20%余量，具体采样随随机音效变化，原始记录见 `docs/metrics/audio-runtime.json`。
- 静音后音乐元素音量为0，主总线在平滑包络后为0；用户音量、跨场景淡化和同曲目复用正常。
- 生产版 `/game/` 子路径断网后音乐仍实际推进，音频范围请求返回206和正确128字节内容，见 `docs/metrics/release.json`。

**明确声明：以上均为机械解码/电平/行为验证，没有进行人耳试听，也没有声卡主观评价。** 自动化不能证明编曲偏好、音色统一性和循环听感达到某位玩家的主观标准。
