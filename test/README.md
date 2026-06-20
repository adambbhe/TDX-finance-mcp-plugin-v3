# TDX Finance MCP Plugin v3 — 测试说明

本目录是**开发期测试工具**，不随插件发布（不在 `package.json` 的 `files` 白名单中）。

## 它测什么

`run-tests.mjs` 直接加载 `../index.js`（真实插件代码），用一个 mock 的 OpenClaw `api`
注册插件、拿到 6 个工具的 `execute`，然后：

- **Phase A**：对 6 个核心工具发真实请求（行情、K线、代码检索、选股、指标、F10）。
- **Phase B**：扫描 `../skills/*/SKILL.md`，自动提取每个技能引用的工具名和 F10 `(entry, fixedTag)`。
- **Phase C**：对去重后的 F10 组合逐一探测（通过 `tdx_api_data`）。
- **Phase D**：把 45 个技能判定为 ✅可用 / 🟡部分可用 / ❌不可用，并写出报告。

状态分类会识别通达信的错误码：`E|-7201/-7202`（模块未注册）、`-1005`（参数错误）、
`401 need login`、`S1404x`、`503`、`ErrorId!=0` 等。

## 运行前提

- Node.js ≥ 22.16
- 已安装依赖：在仓库根目录执行 `npm install`（只装 `@sinclair/typebox`）
- 能访问 `tdxhub.icfqs.com:7615` 与 `ai.icfqs.com:8965`（公司网络/防火墙需放行）
- 一个有效的 TDX API Token

## 运行

```bash
# 1) 安装依赖（在仓库根目录）
npm install

# 2) 设置 Token
# Linux/Mac:
export TDX_API_KEY="你的TDX_TOKEN"
# Windows PowerShell:
$env:TDX_API_KEY="你的TDX_TOKEN"

# 3) 跑测试（默认标的 000001 平安银行，深市）
node test/run-tests.mjs

# 其它用法
node test/run-tests.mjs --code 600519 --setcode 1   # 换沪市标的（贵州茅台）
node test/run-tests.mjs --skip-f10                   # 只测 6 个工具，跳过 F10 矩阵
```

## 产出

- 控制台：逐项 ✅/❌ 结果 + 小结
- `test/test-report.json`：结构化结果（便于二次处理）
- `test/test-report.md`：可读报告（工具表 / F10 矩阵 / 技能可用性表）

## 说明

- Phase C 的 `(entry, fixedTag)` 来自对技能文档的就近配对提取，个别组合可能不是该 entry
  的标准 fixedTag；这种情况通常返回 `-1005 参数错误`，属正常的探测噪声，不影响对“entry 是否可达”的判断。
- 技能可用性按“其依赖的工具与 F10 entry 是否全部通过”来判定；entry 级别命中即视为该数据可达。
