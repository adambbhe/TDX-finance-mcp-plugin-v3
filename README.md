# TDX Finance MCP Plugin v3

<p align="center">
  <strong>通达信金融数据服务 MCP 插件（精简版）</strong><br>
  <em>TDX (TongDaXin) Finance Data Service · Model Context Protocol Plugin</em>
</p>

<p align="center">
  <a href="#简介">简介</a> ·
  <a href="#架构总览">架构总览</a> ·
  <a href="#工具列表">工具列表</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#工具文档">工具文档</a> ·
  <a href="#故障排查">故障排查</a>
</p>

---

## 简介

**TDX Finance MCP Plugin v3** 是一个为 OpenClaw 平台设计的金融数据服务插件，提供通达信（TDX）A 股金融数据接口的统一访问能力。

本插件封装了 **6 个经过验证的核心工具**，并内置 **45 个专业投资分析技能**，覆盖 A 股实时行情、K线、F10 基本面、智能选股、指标筛选与代码检索等需求。

### v3 与旧版的区别

v3 是在 v2 基础上的**清理与精简版本**，主要变更（详见 [CHANGELOG.md](./CHANGELOG.md)）：

- 移除了 4 个依赖问达（Wenda）平台、长期返回 `401 need login` 的失效工具（`wenda_news_query` / `wenda_report_query` / `wenda_notice_query` / `wenda_macro_query`）。这些功能已在技能层迁移至 F10 模块，旧工具不再需要。
- 清除了此前散落在多个脚本与文档中的**硬编码 API Token 与认证密钥**。
- 删除了仓库内的调试 / 抓取 Cookie / 重复扫描脚本，只保留可发布的插件资产。
- 统一了版本号、仓库地址与技能数量等元数据。

### 近期变更（v3.3.x）

- **v3.3.1**：移除一进二打板技能（`tdx-daban-yijinerb-PS-SKILL`），技能总数 46 → 45。
- **v3.3.0**：`tdx_api_data` 注册表接入 `ybpj|yjyg`（业绩预告，服务端当前返回空表、原始透传）；修复 `tdx_quotes` 摘要涨跌幅 NaN；修正测试分类器对数据数字的 401 误判（详见 [CHANGELOG.md](./CHANGELOG.md)）。

> 现在工具层、清单（`openclaw.plugin.json`）与文档三者完全一致：**6 个工具，全部可用**。

### 一包包含：工具 + 技能

```
tdx-finance-mcp-plugin-v3/
├── index.js                 # 6 个数据工具（核心实现，单文件 ESM）
├── openclaw.plugin.json     # 插件清单（工具 + 技能声明）
├── skills/                  # 45 个专业投资技能（提示词 + agents 配置）
├── install.sh               # Linux/Mac 安装脚本
├── install.ps1              # Windows 安装脚本
├── config.example.json      # 配置示例
├── SKILLS.md                # 技能清单与触发词
├── CHANGELOG.md             # 版本变更记录
└── README.md                # 本文件
```

---

## 架构总览

本插件的 6 个工具调用 **2 个不同的 API 服务器**。理解这一架构是正确使用和调试的关键。

| # | 服务器地址 | 用途 | 涉及工具 |
|---|-----------|------|---------|
| **1** | `http://tdxhub.icfqs.com:7615/TQLEX` | F10 基本面、实时行情、K线、选股、指标 | `tdx_api_data`, `tdx_quotes`, `tdx_kline`, `tdx_screener`, `tdx_indicator_select` |
| **2** | `https://ai.icfqs.com:8965/v1/rag-entity-retrieve` | RAG 实体代码/名称检索 | `tdx_lookup_stock` |

> ⚠️ **重要**：不同工具使用不同的 Entry 名称和请求体格式（见 [工具文档](#工具文档)）。**不要根据工具名猜测 Entry 名称。**

---

## 工具列表

> 🟢 = 完全可用。F10 个别子模块服务端未注册（`E|-7202`），与 Token 权限无关（详见下方实测结果）。

| # | 工具名称 | 功能描述 | 服务器 | Entry | 状态 |
|---|---------|---------|--------|-------|------|
| 1 | **tdx_api_data** | 统一 F10 内部 API 调用（含盈利预测、热点题材、事件驱动等子模块） | 服务器1 | `TdxSharePCCW.*` | 🟢 |
| 2 | **tdx_quotes** | 实时行情查询（报价、五档盘口、涨跌幅等） | 服务器1 | `TdxShare.PBHQInfo` | 🟢 |
| 3 | **tdx_kline** | K线历史数据查询（多周期、含复权） | 服务器1 | `TdxShare.PBFXT` | 🟢 |
| 4 | **tdx_lookup_stock** | 股票/指数/基金代码 RAG 检索 | 服务器2 | AI RAG | 🟢 |
| 5 | **tdx_screener** | 自然语言智能选股 | 服务器1 | `JNLPSE:wendaQuery` | 🟢 |
| 6 | **tdx_indicator_select** | 金融指标选择与查询 | 服务器1 | `NLPSE:InfoSelectV2` | 🟢 |

### 实测结果（2026-10-12，标的 000001；另有 11 只跨市场样本交叉验证）

> 通过 `test/run-tests.mjs` 驱动真实插件代码实测。完整报告见 [test/test-report.md](./test/test-report.md)。

- **6 个核心工具：全部可用 ✅**（行情 ~190ms、K线 ~87ms、代码检索 ~189ms、选股 ~216ms、指标 ~1.2s、F10 ~120ms）。
- **F10 子模块：除 2 个服务端未注册模块外全部可用。** 已验证可用：公司概况 `gsgk`、公司概要 `zxts/gsgy`、盈利预测 `ybpj/yzyq`、业绩预告 `ybpj/yjyg`（服务端当前返回空表，原始透传）、事件与题材 `rdtc/sjcd·zttzbkz·zttzztk`、龙虎榜涨停/大宗/融资融券/资金流 `jyds/ztfx·dzjy·rzrq·zjlx`、股东研究 `gdyj/gdrs·cgbd·jgcg·jgcgqk·ltgd`、股本结构 `gbjg/xslt`、主力持仓 `zlcc`、分红 `fhrz/fhpm_pxrzb·pxmz`、综合 `comreq/jglhb`。
- **不可用子模块（服务端未注册，与 Token 权限无关）：** `fhrz_fh/fh`、异动 `iyds/yxsbxx`（`E|-7202` / HTTP 503）。另有 4 个非标准 fixedTag 组合返回 `-1005 数据库执行失败`（探测噪声，不代表 entry 不可达）。
- **「无数据」的表现形式是 0 行空结果集**（如北交所贝特瑞 835185 的资金流向），而非错误。
- **⚠️ 历史勘误（v3.2.7 及更早报告）**：此前记载的 `401 需登录` 子模块（股东人数/分红历史/融资融券/资金流向等）为测试分类器把数据数字（如 `4.814011`、`4018`）误判为 401 的伪影，v3.3.0 已修复分类器——上述子模块实际全部可用，无需升级 Token 权限。
- **技能层：45 个技能 42 ✅ 可用 / 2 🟡 部分 / 0 ❌ 不可用**。测试框架（`test/run-tests.mjs`）动态枚举 `skills/` 目录，按各技能声明的数据依赖逐项验证；「部分可用」指个别依赖子模块未注册时自动降级。

---

## 快速开始

### 前置要求

- **Node.js** ≥ 22.16.0（使用内置 fetch，运行时零额外依赖）
- **OpenClaw**：已安装并运行
- **TDX API Token**：从通达信官方获取的数据服务授权令牌

### 三步启动

#### 1. 安装插件

```bash
git clone https://github.com/adambbhe/TDX-finance-mcp-plugin-v3.git
cd TDX-finance-mcp-plugin-v3

# 一键安装（自动配置 Token + 安装 45 个技能）
# Linux/Mac:
chmod +x install.sh && ./install.sh

# Windows:
.\install.ps1 -Token "你的TDX_API_TOKEN"
```

#### 2. 配置 API Token

复制 `config.example.json` 为 `config.json` 并填入你的 Token（`config.json` 已被 `.gitignore` 忽略，不会误提交）：

```json
{
  "plugins": {
    "tdx-finance-mcp": {
      "enabled": true,
      "config": { "tdxApiToken": "你的通达信API_TOKEN" }
    }
  }
}
```

或使用环境变量：

```bash
# Linux/Mac
export TDX_API_KEY="你的API_KEY"
# Windows PowerShell
$env:TDX_API_KEY = "你的API_KEY"
```

#### 3. 启动 OpenClaw

```bash
openclaw start
```

插件会自动加载 **6 个工具 + 45 个技能**。

---

## 配置说明

### `tdxApiToken`（必填）

通达信 API 授权令牌。插件将其作为 HTTP header `token: <tdx-api-token>` 发送。

**Token 注入优先级**：

1. 插件配置中的 `tdxApiToken` 字段
2. 环境变量 `TDX_API_KEY`（回退方案）

### `apiEndpoint`（可选）

仅对**服务器1**的工具生效。默认 `http://tdxhub.icfqs.com:7615/TQLEX`。

**优先级**：参数 `apiEndpoint` → 配置 `apiEndpoint` → `TDX_API_DATA_ENDPOINT` → `TDX_API_ENDPOINT` → 硬编码默认值。

### 环境变量汇总

| 环境变量名 | 说明 | 影响范围 |
|-----------|------|---------|
| `TDX_API_KEY` | API Token（回退方案） | 全部工具 |
| `TDX_API_DATA_ENDPOINT` | 自定义服务器1端点 | 服务器1工具 |

---

## 工具文档

> ⚠️ 每个工具的 Entry 名称、请求体格式和目标服务器都不同。以下信息均从源码 `index.js` 提取验证。

### 1. `tdx_api_data` — F10 基本面数据统一接口

- **服务器**：`http://tdxhub.icfqs.com:7615/TQLEX`
- **Entry 格式**：动态，以 `TdxSharePCCW.` 等为前缀
- **请求体**：`{ Params: [...] }`

```json
// 盈利预测
{ "entry": "TdxSharePCCW.tdxf10_gg_ybpj", "code": "000001", "fixedTag": "yzyq" }
// 业绩预告（服务端当前返回空表，原始透传）
{ "entry": "TdxSharePCCW.tdxf10_gg_ybpj", "code": "000001", "fixedTag": "yjyg" }
// 热点题材板块族谱
{ "entry": "TdxSharePCCW.tdxf10_gg_rdtc", "code": "000001", "fixedTag": "zttzbkz" }
// 事件驱动催化
{ "entry": "TdxSharePCCW.tdxf10_gg_rdtc", "code": "000001", "fixedTag": "sjcd" }
```

工具支持多种参数模板（`raw` / `code-only` / `code-fixed-tag` / `fixed-tag-code-extra` / `code-date-range-page` 等），可按 `entry + fixedTag` 自动推导。详见源码与各技能的 `SKILL.md`。

### 2. `tdx_quotes` — 实时行情查询

- **Entry**：`TdxShare.PBHQInfo` ·  **请求体**：结构化对象

```bash
tdx_quotes code="000001" setcode="0"            # 平安银行（深市）
tdx_quotes code="600519" setcode="1" hasProInfo="1"  # 贵州茅台（沪市）
```

`setcode`：`0`=深市，`1`=沪市，`2`=北交所。

### 3. `tdx_kline` — K线历史数据

- **Entry**：`TdxShare.PBFXT` · **请求体**：结构化对象

```bash
tdx_kline code="000001" setcode="0" period="4" wantNum="30"   # 日K 最近30根
tdx_kline code="600519" setcode="1" period="6" wantNum="12"   # 月K
```

`period`：`4`=日K，`5`=周K，`6`=月K，`3`=60分钟，`9`=1分钟（完整对照见源码）。

### 4. `tdx_lookup_stock` — 代码/名称检索

- **服务器**：`https://ai.icfqs.com:8965/v1/rag-entity-retrieve`（独立于主 API）
- **请求体**：`{ query, range }`

```bash
tdx_lookup_stock query="平安银行"
tdx_lookup_stock query="腾讯" range="HK-GP"
```

`range`：`AG`=A股（默认），`HK-GP`=港股，`JJ`=基金，`MG-GP`=美股，`ZS`=指数 等。

### 5. `tdx_screener` — 自然语言智能选股

- **Entry**：`JNLPSE:wendaQuery` · **请求体**：`[{ message, rang, pageNo, pageSize }]`

```bash
tdx_screener message="涨停"
tdx_screener message="主板 小盘 低价 涨停"
```

### 6. `tdx_indicator_select` — 指标选择与查询

- **Entry**：`NLPSE:InfoSelectV2` · **请求体**：`{ message, rang }`

```bash
tdx_indicator_select message="000001 技术指标"
tdx_indicator_select message="银行业估值对比"
```

---

## 认证机制

所有请求统一在 Header 中携带 Token：

```
Content-Type: application/json
token: {your_tdx_api_token}
```

Token 来源优先级：插件配置 `tdxApiToken` → 环境变量 `TDX_API_KEY`。

> 🔒 **安全提示**：不要把真实 Token 写入源码或提交到仓库。请使用 `config.json`（已忽略）或环境变量。

---

## 故障排查

**Q：OpenClaw 安装时报 validation 警告 / 工具未注册 / 初始化被阻断？**
已在 **v3.1.2** 修复。根因是 **plugin id 不匹配**：`index.js` 导出的 `id: "tdx-finance"` 与 manifest `openclaw.plugin.json` 的 `id: "tdx-finance-mcp"` 不一致，OpenClaw 对不上 manifest 就会验证失败、工具不注册（**与你填的配置值无关，所以改配置也过不了**）。修复方法是把 `index.js` 的 `id`/`name` 对齐成 `tdx-finance-mcp` / `TDX Finance MCP`。

升级到 ≥3.1.2 后，`config.json` 只需填 token：

```json
{ "plugins": { "tdx-finance-mcp": { "enabled": true, "config": { "tdxApiToken": "TDX-你的token" } } } }
```

然后重新加载插件即可。自定义端点改用环境变量 `TDX_API_DATA_ENDPOINT`（v3.1.2 起 config 已不含 apiEndpoint 字段）。

> 附：v3.1.2 也顺手简化了 `configSchema`（移除 `format:"uri"`、空默认+pattern、`additionalProperties:false`）作为次要 hardening，但那**不是**本次安装失败的根因。

**Q：如何获取 TDX API Token？**
联系通达信官方申请数据服务权限。Token 通常为 `TDX-xxxx...` 格式。

**Q：接口返回 503 / S14042 错误？**
通常是 Token 权限不足、服务端维护或网络问题。确认能访问 `tdxhub.icfqs.com:7615` 与 `ai.icfqs.com:8965`。

**Q：`tdx_api_data` 能用但 `tdx_quotes`/`tdx_kline` 报错？**
正常现象——三者使用完全不同的 Entry（`TdxSharePCCW.*` vs `TdxShare.PBHQInfo` vs `TdxShare.PBFXT`）。请勿根据工具名猜测 Entry。

**Q：部分 F10 数据返回 `E|-7201` / `E|-7202`？**
该模块未在当前 Token 下注册，需联系通达信升级权限。

**Q：PowerShell 测试失败但 Node.js 成功？**
已知差异。请在 Node.js ≥ 22 环境运行，调试时使用原生 `fetch`。

---

## 已知注意事项

1. **Entry 名称 ≠ 工具名**：永远从源码读取，不要猜测。
2. **两种不同的请求体格式**：`tdx_api_data` 用 `{ Params: [...] }`；`tdx_quotes`/`tdx_kline` 用结构化对象；`tdx_screener` 用数组。
3. **两个不同的服务器**：不要假设所有请求都发往同一地址。

---

## 许可证

本项目基于 **MIT License** 开源，详见 [LICENSE](./LICENSE)。

---

<p align="center">Made with ❤️ by TDX Team · v3.3.1</p>
