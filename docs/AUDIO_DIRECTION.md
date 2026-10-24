# 烬辉战纪 · v1.1 音频方向与实现

## 1. 资源与表现边界

- 主配乐为 **5 首随包部署的 CC0 管弦乐录音**，不是 chiptune，不使用在线 API；来源、作者、原始文件 SHA256 见 `ASSET_LICENSES_AUDIO.md`。
- 五首原文件没有剪辑、转码或重编码。21 类音效、风声与高潮打击叠层由本地 Web Audio 合成，不冒充真人录音库。
- 自动化验证解码、播放、电平与切换行为；**没有完成主观人耳听审**，不把机械采样当成音色、编曲或音乐感染力验收。

## 2. 已批准的乙方案：连续主曲 + 协调打击层

|状态|本地录音|处理|
|---|---|---|
|主菜单|Eye of the Storm|0.72 场景系数，2.6s 淡入|
|战役地图|War Theme|0.68，2.4s|
|战斗准备|Epic March Loop|0.66，2s；军鼓主题与胜利音乐分开|
|常规战斗|The Final Battle|0.78，1.8s|
|激烈交锋|**仍为 The Final Battle**|主曲平滑提升约2dB；增加非旋律的稀疏低鼓/军鼓层|
|胜利|Hope — Orchestral Battle Music|0.70，1.6s；每次从开头起奏|
|失败|Eye of the Storm|0.58，2.8s，0.92倍速；每次从开头起奏|

`battle ↔ climax` 不切文件、不换播放甲板、不重置 `currentTime`。进入新战斗才重置战斗主曲。重复 `setScene` 不重启；退出高潮只淡出叠层。

App 的强度控制使用 **真实播放时间**，不受 ×3 游戏速度放大：
- 接敌单位 ≥24 或任一要塞 <30%，持续3秒后进入高潮。
- 接敌单位 ≤12 且无危险，持续6秒后回落。
- 两次强度变化至少相隔45秒，避免临界来回跳动。

### 打击层协调方式

不把一个猜测的 BPM 强加给原曲。对实际部署的 Final 录音做20ms低频包络正向瞬态分析，选取32个间隔至少2.4秒的稀疏重音点，见 `battleAccentCues.ts` 与 `scripts/analyze-battle-accents.mjs`。它们是**素材重音提示，不宣称完整节拍/小节检测**。

调度跟随同一媒体播放头，前瞻0.3秒；循环/跳转/卡顿时重新同步，不追补积压鼓点。不叠第二旋律；音色为短低鼓和受控军鼓。测试将提示点绑定到源录音 SHA256，替换音源后必须重新分析。

## 3. 循环与切换

v1.0 的首0.6秒/尾1.1秒音量归零包络已移除。

每首录音一个主媒体元素，**临近循环才懒创建第二甲板**，约提前20秒准备并静音预热；最后1.6秒采用恒功率增益交叠，随后交换甲板。切换场景的旧曲淡出完成后停止。媒体原生 `loop` 作为兜底，不依赖它保证无缝。

这是流式双甲板交叠，不是采样级无缝剪辑；素材本身的停顿、淡尾和音乐结构仍然存在。应区分：
1. 播放头在走，不代表实际有声。
2. 增益非零，也不代表素材不是静音。
3. 只有分析总线实际 PCM，才能核查是否出现新增掉音；仍不能替代人耳听接缝。

## 4. 混音与音量

- 首次游戏默认：音乐 **0.80**、音效0.50、环境0.25。已有用户的存档音量不会被强制覆盖。
- 录音响度 trim：Eye 1.424 / War 0.448 / Hope 0.351 / Final 0.549 / March 0.375，按既有整轨 LUFS 校准到场景系数之前约 −19 LUFS；原始分析见 `metrics/audio-loudness.json`。
- 音乐元素音量 = 用户音乐 × trim × 场景系数 × 跨曲淡入淡出 × 循环交叠 × duck，单元素上限0.95。
- 高潮层走**音乐控制**，不走音效滑块；全静音立即停层并清理待播节点，恢复不补播。
- 音效：voice → effectsGain → compressor → masterGain。环境：风/低频隆隆 → ambienceGain → masterGain。
- 重要号角/要塞/坍塌/胜负提示短暂 duck BGM；20个受管音效声部、同类冷却和优先级抢占限制密集战斗负载。
- BGM 媒体元素独立输出；测试监测器只在验收时把它们接入 Analyser，不让 BGM 重复输出。

21 类声音：`select click coin countdown spawn sword shield pike axe bow crossbow magic fire heal horn base collapse victory defeat step warning`。同类打击有适度音高变化；脚步按军团节奏触发，不逐单位逐帧播放。

## 5. 生命周期与部署

```ts
const audio = new AudioManager();
button.onclick = () => audio.unlock(); // 真实用户手势
function frame(dt: number) { audio.update(dt); }
audio.setScene('battle');
audio.setVolumes(music, effects, ambience);
audio.setMuted(muted);
audio.dispose();
```

- 构造函数预加载本地媒体，但不擅自创建可播放 AudioContext；手势解锁失败可重试，不阻断游戏模拟。
- 同源资源路径使用 Vite `BASE_URL`，支持 Pages 子目录；SW 缓存全部音乐并正确返回 Range 206。
- `dispose` 清理主/备用媒体、记忆位置、叠层声源、环境节点并关闭上下文；后续调用安全。
- 不要按页面新建多个 AudioManager。每帧要调用 `update`；浏览器后台节流仍属于外部风险。

## 6. 可复现验证

```powershell
npx.cmd vitest run src/audio
npx.cmd playwright test tests/e2e/audio.spec.ts
# 已启动 npm run dev（默认长播工具指向 4199，可用 GAME_URL 指定）后：
npm.cmd run audio:analyze
npm.cmd run verify:audio
```

- `audio-runtime.json`：同曲不重启、循环换甲板、真实音乐/叠层波形、滑块归零、静音恢复、并发与销毁。
- `v11-audio-continuity.json`：5分钟实际播放、正常/高潮切换与两次自然循环；直接采样真实音乐总线 PCM，不以播放状态或非零增益冒充有声。若发现静音，须另对照源录音，而不能自动认定是播放故障。最终结果见 `TEST_REPORT.md`。
- `release.json`：生产子路径、断网、实际音乐时钟和音频 Range。

5分钟工具隔离运行真实 AudioManager，不运行 App 页面，避免并行修改界面触发 Vite HMR 重载破坏长测；战局强度滞回与 App 接线另有单测和 E2E。

## 7. 明确的未验收边界

- 未完成真人听审、声卡/扬声器混音检查，以及整场人类战役体验。
- 流式交叠不是采样级环；不能承诺所有设备/浏览器/失焦节流状态下绝无缝隙。
- OGG 在本轮 Chromium 实测；Firefox/Safari及实体低配设备尚待测。
- 五首约23.37MB，其中 March 为原始 WAV；没有为缩小体积悄悄换成合成 BGM。
