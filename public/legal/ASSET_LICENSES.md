# 素材与授权总表

## 原创素材
|内容|源文件/交付资源|授权|
|---|---|---|
|世界观、中文/英文标题、兵种与关卡文本|src/data、src/ui|项目MIT，见根目录LICENSE|
|16兵种、蓝/红色板、待机/行走/攻击像素帧|src/render/sprites.ts、src/render/units/*.ts；public/art/unit-atlas-*.png|项目MIT|
|四战场、旗帜、要塞与粒子美术|src/render/scenery.ts、BattleRenderer.ts；public/art/battlefield-*.png|项目MIT|
|UI SVG线稿图标、纹章与favicon|src/ui/icons.ts、public/favicon.svg|项目MIT|
|本地合成的战斗/环境/UI音效|src/audio/AudioManager.ts|项目MIT|

所有PNG均由本项目源文件导出，没有下载或复制原游戏美术。图集单元48×48，960×768像素，行列顺序见 `public/art/README.txt`。运行时直接从相同源代码缓存图帧，PNG作为可编辑资源交付。

## 第三方交响音乐
5首、共23.37MB，均为OpenGameArt页面标注CC0 1.0的作品。**作者、来源、授权直链、SHA256、格式与时长逐项记录在 [ASSET_LICENSES_AUDIO.md](ASSET_LICENSES_AUDIO.md)**。保留原始文件，不将其谎称原创，不以项目MIT重新授权。

## 字体与依赖
- 字体只引用玩家操作系统已安装的 Microsoft YaHei、SimSun / Songti 等字体。**不打包、不分发微软字体文件**，无Google Fonts或远程字体CDN请求。
- TypeScript / Vite / Vitest / tsx / Playwright 等为npm开发依赖，安装后保留其各自LICENSE。Vite构建会注入少量modulepreload兼容代码，其完整许可及附带声明自动复制到 `public/legal/VITE_LICENSE.md` 并随发布分发。游戏运行时无第三方游戏引擎、无在线SDK、无遥测或LLM API。
- 经典Miragine War相关网页只作机制研究引用；未分发原SWF、截图、贴图、Logo或音乐。

## 署名
CC0通常不强制署名，但保留作者与来源是本项目的选择。游戏内“制作与素材鸣谢”列出音乐作者，完整法律记录随源码与发布资源一同提供。
