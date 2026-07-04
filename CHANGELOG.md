# Changelog

本文件记录 TDX Finance MCP Plugin 的版本变更。

## [3.2.1] — 2026-07-04 · tdx_quotes 行情格式化专业化

### 修复（Fixed）

- **`formatQuotesResult` 格式化专业化 + 空数据兜底**：原实现只输出「现价/涨跌幅/成交量/换手率」四项，且换手率等数值未做精度处理（如 `0.735299528%`）。现改为：
  - 数值统一保留 2 位小数（换手率 `0.74%`、价格 2 位）；
  - 新增字段（依据实测完整响应校准字段映射）：涨跌额、今开/最高/最低/昨收/均价 `Average`、成交额（`Amount`/元→亿）、量比 `LB`、**委比 `Wtb`（在 `ProInfo` 下，原 `pick` 未搜索该容器会漏引，已修复）**、内盘 `Inside`/外盘 `Outside`（主动买/卖量）、涨停 `ZTPrice`/跌停 `DTPrice`、总市值 `ZSZ`(ExtInfo/元→/1e8 亿)、流通市值（`ZSZ×LTGB/ZGB`，单位无关的比例法，回退 `LTGB×现价`）、市盈率 `SYL`、股息率 `MGGX`、五档买一/卖一（字段名容错，缺失跳过不报错）；
  - `HSL` 保持按百分数展示，`Volume` 按手（=百股）处理，**均已用两只股票的接口自返回值做恒等式验证**：000001 `1.43e6手×100÷(流通股)=0.737% ≈ HSL 0.735%`；300750 用接口自带 `LTGB=425701.22万股` 算得 `258849×100÷(LTGB×1e4)×100=0.6081% == HSL 0.60805%`（比值 1.000）。故 Volume **不×100**、HSL **不×100**；
  - **请求默认开启 `HasProInfo="1"`**（原默认 `"0"`）：否则 `ProInfo` 不返回，委比 `Wtb`/现量 `NowVol` 永远拿不到——即便解析了也是空的。现默认即可得委比；
  - 内外盘增加占比展示（如 `内盘 82万手 / 外盘 61万手 (内57%/外43%)`）；五档买一/卖一附带委托量（如 `买一 10.51×3200手`，字段名容错）；
  - 字段在 `HQInfo/ExtInfo/CalcInfo/顶层` 间按序查找，涨跌幅优先取 `CalcInfo.CAZAF`，否则由 `Now/Close` 计算；
  - **空数据兜底**：当响应无有效行情字段（停牌、code/setcode 不匹配或接口返回空对象）时，返回明确提示 + 原始响应，而非仅回传空对象。
  - 已用 mock 响应驱动真实插件代码路径验证（正常/空数据两用例通过）。

### 说明（澄清，非代码变更）

- 关于「TDX API 503 / Entry 名称错误 / Entry 应放 URL Query」：**插件代码本就正确**。所有 server1 工具（`tdx_quotes`→`TdxShare.PBHQInfo`、`tdx_kline`→`TdxShare.PBFXT`、`tdx_screener`→`JNLPSE:wendaQuery`、`tdx_indicator_select`→`NLPSE:InfoSelectV2`）与通用 `tdx_api_data` 均通过 `?Entry=...`（URL Query）传 Entry，请求体为 `{Head,...}` 或 `{Params:[...]}`，从不使用工具名作为 Entry。手工 curl 时若把 Entry 放进 body 或漏掉 `Head`，才会出现 503/空数据——那是调用方式问题，非插件缺陷。

- 版本对齐：manifest 与 package.json 统一为 `3.2.1`（此前 package.json 滞留在 3.0.1）。

---

## [3.2.0] — 2026-06-26 · 一进二打板·封流比/封成比阈值按 362 样本重标

### 变更（Changed）

- **`tdx-daban-yijinerb-PS-SKILL` 封板质量评分重标**：用 6 个交易日累积的 **362 只首板**实测分布，校准封流比/封成比档位（原阈值用单日样本定得过高，导致 70%+ 首板挤在最低档、质量分失去区分度）：
  - **封流比**：原 ≥3%/1.5-3%/0.8-1.5%/<0.8% → **≥1.5%(+18) / 0.8-1.5%(+12) / 0.4-0.8%(+6) / <0.4%(+1)**（中位 0.47%、P85≈1.3%，≥1.5% 即极硬）。
  - **封成比**：原 ≥60/30-60/<30 → **≥32(+6) / 16-32(+4) / 8-16(+2) / <8(0)**（中位 7.7、P85≈32）。
  - 效果（362 样本回算）：质量分 `<60` 档占比 70.2% → 54.7%，`70-84` 12.2% → 21.3%，均分 53.9 → 58.2；封流比四档人口从「70% 挤一档」变为 10/19/27/44%。
  - 同步更新 `references/scoring-rules.md`、`run-modeA.mjs`、`backtest.mjs`（分档函数 `B`）及离线测试 `test-modeA.mjs`/`test-backtest.mjs`（全部通过）。
- **说明**：本次仅为 bundled 打板技能的评分阈值调优，**不影响 6 个核心工具**。真实「一进二成功率」仍需本机 `node backtest.mjs --token=...`（用 `tdx_kline` 回补次日封板结果）确认。

---

## [3.1.2] — 2026-06-20 · 安装校验修复 + 一进二打板技能

### 修复（Fixed）

- **插件初始化 validation 失败 / 工具未注册（根因：plugin id 不匹配）**：`index.js` 导出的插件 `id: "tdx-finance"` 与 manifest `openclaw.plugin.json` 声明的 `id: "tdx-finance-mcp"` 不一致，OpenClaw 无法把运行时插件对上 manifest，导致验证失败、6 个工具不注册。已将 `index.js` 的 `id`/`name` 对齐为 `tdx-finance-mcp` / `TDX Finance MCP`（manifest 的 id 被 config、依赖、仓库到处引用，故以它为准）。
- **（次要 hardening，非本次根因）** 顺手简化了 `configSchema`：移除 `apiEndpoint` 的 `"format": "uri"`、`tdxApiToken` 的 `"default": ""`+`"pattern"`、顶层 `"additionalProperties": false`，仅保留 `type/properties/required`；`config.example.json` 精简为只填 `tdxApiToken`。这是降低 strict 校验器风险的清理，但**不是**本次安装失败的原因。

### 新增（Added）

- **`tdx-daban-yijinerb-PS-SKILL`（一进二量化打板）** 技能 + 完整本地闭环脚本：`run-modeA.mjs`（盘后建监测池）、`run-modeB.mjs`（次日 9:25-9:29 竞价定夺）、`backtest.mjs`（回测/阈值校准）、`history/` 按日自动归档、离线回归测试（`test-*.mjs`）。详见该技能目录的 `SKILL.md` / `README.md`。
- 接口字段实测确认：`tdx_screener "涨停"` 直接返回 封单金额/首次涨停时间/涨停打开次数/封成比/板型/题材；`tdx_quotes` 含 `LB`量比、`Wtb`委比、`ZTPrice`涨停价、`CALTZ`流通市值、`BspInfo`五档。

### 变更（Changed）

- 删除早期的“当日涨停打板”技能，聚焦一进二。技能总数 45 → 46，版本 3.0.1 → 3.1.2。

---

## [3.0.1] — 2026-06-20 · 实测与权限标注

基于有效 Token 通过 `test/run-tests.mjs` 对真实插件代码做了端到端测试，并据结果做最小标注。

### 测试结果

- **6 个核心工具全部可用** ✅（quotes/kline/lookup/screener/indicator/api_data）。
- **F10 子模块 27/37 探测通过**；少数高级子表需更高权限：`401 需登录`（股东人数 `gdyj/gdrs`、分红历史 `fhrz/fhlszs_gxl`、融资融券 `jyds/rzrq`）、`E|-7202 未注册`（`fhrz_fh/fh`、异动 `iyds/yxsbxx`）。
- **45 个技能：38 可用 / 6 部分可用 / 0 不可用**（`tdx-quant` 无可测外部依赖，单列）。

### 变更

- 新增 `test/`（测试 harness + 真实报告 `test-report.md`/`.json`，不随发布包分发）。
- README 权限说明替换为实测结果。
- 给 6 个部分可用技能（`dividend-financing`、`dragon-tiger`、`shareholder-research`、`trading-info`、`lhbxwfg`、`ztltby`）追加“数据权限说明（v3 实测）”小节，指导在受限子表上优雅降级。核心逻辑未改。

---

## [3.0.0] — 2026-06-20 · 清理与精简版

v3 在 v2 基础上做安全与一致性清理，**不改变 6 个核心工具的行为与 45 个技能的内容**，目标是产出一个干净、可发布、文档与代码一致的插件。

### 移除（Removed）

- **失效的 Wenda 工具**：从 `index.js` 与 `openclaw.plugin.json` 中删除 4 个依赖问达平台、长期返回 `401 need login` 的工具：
  - `wenda_news_query`、`wenda_report_query`、`wenda_notice_query`（清单中声明的 3 个）
  - `wenda_macro_query`（代码中定义但清单未声明的"隐藏"第 4 个）

  这些功能已在技能层迁移至 F10 模块（`tdx_api_data` + `rdtc/ybpj` 等），旧工具不再被任何技能引用。共移除约 389 行 wenda 相关代码（工具定义、`createWendaTool`、认证助手及注册循环）。
- **硬编码凭证**：删除散落在脚本与文档中的真实 API Token（`TDX-3d84119f...`，12 处）以及 wenda 认证密钥（`Tdx-Auth sk-...`，位于 wenda 模块）。核心 `index.js` 的工具认证逻辑本就走配置/环境变量，未受影响。
- **调试与抓取脚本**：删除全部开发期残留文件——抓取浏览器 Cookie 的脚本（`wenda-cookie-reader.*`、`deep-cookie-scan.cjs`、`quick-cookie-diag.cjs`、`cookies-template.txt`）、重复的 F10 扫描脚本（`scan-f10-entries/v2/v3.js`）、认证诊断（`wenda-auth-*`、`wenda-deep-analyzer.py`）、权限/限流测试（`deep-permission-test.js`、`test-rate-limit.js`、`test-wenda-integration.cjs`）、参考采集脚本与产物（`collect-api-reference.js`、`api-reference-data.json`、`api-reference.csv`、`API-Reference-Manual.html`）、迁移报告（`SKILL-MIGRATION-REPORT*.*`、`generate-skill-migration-report.cjs`、`README-V2-MIGRATION.md`、`wenda-integration-test-report.json`）、空/垃圾 HTML（`pul-analysis-node.html`、`pul-page-analysis.html`）以及 `push-to-github.bat`。
- **未使用依赖**：从 `package.json` 移除 `devDependencies`（`better-sqlite3`、`sql.js`）——它们仅被已删除的 Cookie 读取脚本使用。

### 修复 / 变更（Fixed / Changed）

- **代码与文档一致**：工具层、`openclaw.plugin.json`、README 三者现在统一为 6 个工具。
- **元数据修正**：版本统一为 `3.0.0`；`repository` / `homepage` / `bugs` 指向 v3 仓库；移除了不再适用的 wenda 超时/环境变量配置。
- **技能数量修正**：安装脚本中"44 个技能"更正为"45 个技能"，与实际打包数量一致。
- **README 重写**：去除自相矛盾的"100% 可用率"等表述，如实标注 F10 高级模块需更高 Token 权限。

### 保留（Kept）

- 6 个核心工具：`tdx_api_data`、`tdx_quotes`、`tdx_kline`、`tdx_lookup_stock`、`tdx_screener`、`tdx_indicator_select`。
- 全部 45 个技能（`skills/`，每个含 `SKILL.md` + `agents/openai.yaml`），内容未改动。
- 安装脚本、配置示例、许可证、技能清单。

### 安全提醒

如果泄露的 Token（`TDX-3d84119f… (旧泄露 Token)`）仍然有效，请**立即在通达信侧吊销并更换**，并从旧仓库的 git 历史中清除——删除当前文件不会清除历史提交中的记录。

---

## [2.0] — 2026-05-25 · F10 迁移版（历史）

- 将依赖 Wenda 平台的新闻/研报/公告功能在**技能层**迁移至 F10 模块。
- 注：该版本仅更新了技能提示词，未从代码与清单中移除失效的 wenda 工具（由 v3 完成）。

## [1.0] — 初始版本（历史）

- 9 个工具（6 核心 + 3 wenda）+ 45 个技能的初始实现。
