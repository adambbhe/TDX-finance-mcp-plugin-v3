# Changelog

本文件记录 TDX Finance MCP Plugin 的版本变更。

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
