# 音频资源许可与出处

本文件记录 `public/audio/` 下 5 个音乐文件的**可核实来源、作者、许可、直链、字节数与哈希**。
核实日期：**2026-10-23**（页面 HTML 与文件直链均实际抓取；未做主观试听）。

## 1. 汇总

| 本地文件 | 作品 | 作者（OGA） | 许可 | 时长 | 规格 | 字节 | SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `eye_of_the_storm.mp3` | Eye of the Storm | Indieteur | CC0 1.0 | 1:58.02 | MP3 256 kbps, 44.1 kHz, stereo | 3,777,653 | `e7dff5f9d7d205237c6e767929230434666ea52e621f80038e9ea02dc5d6a629` |
| `war_theme.ogg` | War Theme | Spring Spring | CC0 1.0 | 4:43.74 | Ogg Vorbis 192 kbps, 44.1 kHz, stereo | 6,890,306 | `1291731b7f99e58655954e5e6d1f256dc522601664bcd9c3d9d0d4618f020d3e` |
| `hope_orchestral_battle_music.ogg` | Hope (Orchestral Battle Music) | MintoDog | CC0 1.0 | 1:09.82 | Ogg Vorbis 256 kbps, 44.1 kHz, stereo | 2,192,846 | `1615903236286af59d14b4d71da3fc2518a3091ecdd8f162a50215b9b3d0f320` |
| `the_final_battle.ogg` | The Final Battle | skrjablin | CC0 1.0 | 2:25.82 | Ogg Vorbis 160 kbps, 44.1 kHz, stereo | 2,822,466 | `401fa62b9ed9bb2eea5821bdbe245e3eb991a89ecd1509c3742f7b5393b0df1c` |
| `epic_march_loop.wav` | Epic March Loop | Eldritch Grim | CC0 1.0 | 0:43.58 | WAV PCM s16le 1411 kbps, 44.1 kHz, stereo | 7,687,996 | `7dffcb82140f3aced075b2766f135c17757c60bd8f7a2717b11ab49318c824d6` |

合计：**23,371,267 字节 = 22.29 MiB = 23.37 MB**（低于 30 MB 预算）。
所有文件均为**下载后原样保存**，未转码、未剪辑、未重命名内容（仅改本地文件名）。

许可依据：OpenGameArt 页面 “License(s)” 字段均显示 **CC0**，链接到
<https://creativecommons.org/publicdomain/zero/1.0/>。
CC0 1.0 为公有领域贡献，允许复制、修改、分发与商业使用，**不要求署名**；本仓库仍保留作者与出处作为礼节性 credit。

## 2. 逐项出处

### 2.1 Eye of the Storm

- 作者：**Indieteur**（OGA `/users/indieteur`）
- 页面：<https://opengameart.org/content/eye-of-the-storm-0>
- 许可：**CC0 1.0**（页面 License(s) 字段；插图 `cc0.png`，链接到 CC0 1.0）
- 页面自述：*“An original orchestral music which you can use in warfare scenes. (Fits perfectly with games set in medieval times.)”*
- Copyright/Attribution Notice（原文）：*“Attribution will be appreciated but not required.”*
- 采用的 OGA 文件：`Eye of the Storm.mp3`（页面 File(s) 条目，3.8 Mb）
- 直链：<https://opengameart.org/sites/default/files/Eye%20of%20the%20Storm_1.mp3>
- 本地：`public/audio/eye_of_the_storm.mp3`，3,777,653 B，1:58.02，MP3 256 kbps
- 未采用的同页文件：`Eye of the Storm.wav`（31.2 Mb, 原始 WAV）
- 用途：`menu`；`defeat` 以 `playbackRate 0.92` 运行时复用（不改文件）

### 2.2 War Theme

- 作者：**Spring Spring**（OGA `/users/spring-spring`）
- 页面：<https://opengameart.org/content/war-theme>
- 许可：**CC0 1.0**（页面 License(s) 字段）
- 页面自述：*“an orchestral war theme”*；标签含 orchestral / military / war / brass / drums / timpani / strings 等。
- 页面未提供额外的 Copyright/Attribution Notice 字段。
- 采用的 OGA 文件：`war theme ver 2.ogg`（页面 File(s) 条目，6.9 Mb）
- 直链：<https://opengameart.org/sites/default/files/war%20theme%20ver%202_0.ogg>
- 本地：`public/audio/war_theme.ogg`，6,890,306 B，4:43.74，Ogg Vorbis 192 kbps
- 未采用的同页文件：`war theme.ogg`（旧版，5 Mb）
- 用途：`campaign`

### 2.3 The Final Battle

- 作者：**skrjablin**（OGA `/users/skrjablin`）
- 页面：<https://opengameart.org/content/the-final-battle>
- 许可：**CC0 1.0**（页面 License(s) 字段）
- 页面自述（节选）：*“Generic orchestral drama-filled epic battle music … Loopable (with an audible pause, but restart is still quite coherent in key and mood). Released as public domain. But if you want to, I still appreciate if you credit me ("skrjablin").”*
- 采用的 OGA 文件：`the_final_battle.ogg`（页面 File(s) 条目，2.8 Mb）
- 直链：<https://opengameart.org/sites/default/files/the_final_battle.ogg>
- 本地：`public/audio/the_final_battle.ogg`，2,822,466 B，2:25.82，Ogg Vorbis 160 kbps
- 用途：`battle`
- 注意：作者自述“可循环但有一处可听停顿”；本项目直接 `loop=true`，未做无缝重剪。

### 2.4 Hope (Orchestral Battle Music)

- 作者：**MintoDog**（OGA `/users/mintodog`）
- 页面：<https://opengameart.org/content/hopeorchestral-battle-music>
- 许可：**CC0 1.0**（页面 License(s) 字段）
- 页面自述：*“Orchestral battle music with bright tunes. This music is loopable. File formats are ogg and flac.”*
- 页面未提供额外的 Copyright/Attribution Notice 字段。
- 采用的 OGA 文件：`hope_orchestral_battle_music_bpm165.ogg`（页面 File(s) 条目，2.2 Mb）
- 直链：<https://opengameart.org/sites/default/files/hope_orchestral_battle_music_bpm165_0.ogg>
- 本地：`public/audio/hope_orchestral_battle_music.ogg`，2,192,846 B，1:09.82，Ogg Vorbis 256 kbps
- 未采用的同页文件：同名 `.flac`（7.6 Mb）
- 用途：`prepare`；`victory` 运行时复用（不改文件）

### 2.5 Epic March Loop

- 作者：**Eldritch Grim**（OGA `/users/eldritch-grim`）
- 页面：<https://opengameart.org/content/epic-war-loop>（页面标题为 *Epic March Loop*）
- 许可：**CC0 1.0**（页面 License(s) 字段）
- 页面自述（节选）：*“Medieval war loop for marching scenes and such.”*，并指向完整曲目 *The March of Devil's Dome*（<https://opengameart.org/content/the-march-of-devils-dome>）。
- Copyright/Attribution Notice（原文）：*“Attribution is appreciated but not required. If considered, please credit Eldritch Grim.”*
- 采用的 OGA 文件：`the_march_of_devils_dome_loop.wav`（页面 File(s) 条目，7.7 Mb）
- 直链：<https://opengameart.org/sites/default/files/the_march_of_devils_dome_loop.wav>
- 本地：`public/audio/epic_march_loop.wav`，7,687,996 B，0:43.58，WAV PCM 16-bit stereo 44.1 kHz
- 用途：`climax`

## 3. 合规说明

- 五个页面在核实时的 License(s) 均**只有 CC0**，未发现 CC-BY-NC、ND、GPL 或“仅限非商业”等附加限制。
- CC0 允许随游戏源码与构建产物一起分发；本文件与 `docs/AUDIO_DIRECTION.md` 中保留作者/链接，属于自愿署名，不构成额外许可义务。
- 未使用 OpenGameArt 预览生成的低码率音频；除 `Eye of the Storm` 为页面提供的原始 MP3 外，其余均取页面 File(s) 列出的主文件。
- 资源随仓库/构建离线分发，不依赖运行时外链；游戏不访问 OpenGameArt 或其他网络服务。
- 若未来替换任何曲目，应同步更新本文件的作者、页面、直链、字节数、SHA-256 与用途，并重新核实许可。

## 4. 核验方法与证据

1. 使用 HTTP 抓取 5 个 OGA 内容页，读取页面中的 `Author:`、`License(s):`、`File(s):`、`Copyright/Attribution Notice` 字段与直链。
2. 通过直链下载到 `public/audio/`；记录 `Content-Length` 与实际字节数，二者一致。
3. 检查文件魔数：`ID3`（MP3）、`OggS`（Ogg Vorbis）、`RIFF/WAVE`（WAV）。
4. 计算 SHA-256（见上表）。
5. 用 ffmpeg 7.1（由 `imageio-ffmpeg` 提供的本地二进制）读取时长/编码，并完整解码到 null；5 个文件退出码均为 0。
6. **未进行主观试听**；已用 headless Chromium 完成无听感的解码、`AnalyserNode` 电平与集成行为验证（结果见 `docs/AUDIO_DIRECTION.md` 第 8 节），不代表听过或认可音质。

## 5. 礼节性署名文本（可直接放入游戏 Credit）

```text
Music (CC0 1.0, via OpenGameArt.org):
- "Eye of the Storm" by Indieteur
  https://opengameart.org/content/eye-of-the-storm-0
- "War Theme" by Spring Spring
  https://opengameart.org/content/war-theme
- "The Final Battle" by skrjablin
  https://opengameart.org/content/the-final-battle
- "Hope (Orchestral Battle Music)" by MintoDog
  https://opengameart.org/content/hopeorchestral-battle-music
- "Epic March Loop" by Eldritch Grim
  https://opengameart.org/content/epic-war-loop
Battle and interface sound effects are synthesized at runtime with Web Audio.
```
