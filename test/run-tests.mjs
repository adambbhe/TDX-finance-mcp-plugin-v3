#!/usr/bin/env node
/**
 * TDX Finance MCP Plugin v3 — 接口与技能测试harness (v2 配对逻辑)
 *
 * 它做什么：
 *  1) 直接加载 ../index.js（真实插件代码），用 mock api 注册，拿到 6 个工具的 execute。
 *  2) Phase A：对 6 个核心工具发真实请求，记录 HTTP/TDX 错误码、耗时、数据摘要。
 *  3) Phase B：扫描 ../skills/<skill>/SKILL.md，提取工具名、F10 entry 与 fixedTag。
 *               每个 fixedTag 按【全局最高频共现的 entry】配对，消除就近配对的 -1005 噪声。
 *  4) Phase C：对去重后的 (entry,fixedTag) 组合逐一探测（通过 tdx_api_data）。
 *  5) Phase D：把 45 个技能映射到“可用/部分可用/不可用”，输出 JSON + Markdown 报告。
 *
 * 用法：
 *   set  TDX_API_KEY=你的token   (Windows:  $env:TDX_API_KEY="...")
 *   node test/run-tests.mjs            # 默认测试标的 000001(平安银行,深市)
 *   node test/run-tests.mjs --code 600519 --setcode 1
 *   node test/run-tests.mjs --skip-f10 # 只测 6 个工具，不跑 F10 矩阵
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const SKILLS_DIR = join(ROOT, "skills");

// ---- args ----
const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const TEST_CODE = getArg("--code", "000001");
const TEST_SETCODE = getArg("--setcode", "0");
const SKIP_F10 = argv.includes("--skip-f10");

const TOKEN = process.env.TDX_API_KEY || process.env.TDX_API_TOKEN || "";
if (!TOKEN) { console.error("❌ 请先设置环境变量 TDX_API_KEY=<你的TDX token>"); process.exit(1); }

// ---- classify a tool result / error ----
const ERR_MARKERS = [
  { re: /E\|-7201/, tag: "未注册(E|-7201)" },
  { re: /E\|-7202/, tag: "未注册(E|-7202)" },
  { re: /-1005/, tag: "参数错误(-1005)" },
  { re: /need login|401/i, tag: "需登录(401)" },
  { re: /S1404\d/, tag: "服务错误(S1404x)" },
  { re: /\b503\b/, tag: "服务不可用(503)" },
  { re: /"ErrorId"\s*:\s*"?(?!0)/, tag: "ErrorId!=0" },
];
function classify(text) {
  if (!text) return { status: "EMPTY", note: "空响应" };
  for (const m of ERR_MARKERS) if (m.re.test(text)) return { status: "ERR", note: m.tag };
  return { status: "OK", note: "" };
}
function extractText(res) {
  try {
    if (res == null) return "";
    if (typeof res === "string") return res;
    if (Array.isArray(res.content)) return res.content.map(c => c?.text ?? "").join("\n");
    return JSON.stringify(res);
  } catch { return String(res); }
}

// ---- load plugin & register ----
async function loadTools() {
  const mod = await import(pathToFileURL(join(ROOT, "index.js")).href);
  const plugin = mod.default ?? mod.plugin ?? mod;
  const tools = {};
  const api = {
    logger: { info() {}, debug() {}, error() {}, warn() {} },
    pluginConfig: { tdxApiToken: TOKEN },
    registerTool(t) { tools[t.name] = t; },
  };
  if (typeof plugin.register !== "function") throw new Error("插件没有 register() 导出");
  plugin.register(api);
  return tools;
}

async function callTool(tool, params) {
  const t0 = Date.now();
  try {
    // OpenClaw 工具签名: execute(toolCallId, params, signal, onUpdate) —— params 是第 2 个参数
    const res = await tool.execute("test-call", params, undefined, () => {});
    const text = extractText(res);
    const c = classify(text);
    return { ok: c.status === "OK", ...c, ms: Date.now() - t0, sample: text.replace(/\s+/g, " ").slice(0, 160) };
  } catch (e) {
    return { ok: false, status: "THROW", note: String(e?.message || e).slice(0, 120), ms: Date.now() - t0, sample: "" };
  }
}

// ---- Phase B: scan skills (collect tools/entries/fixedTags + proximity pairs) ----
const TOOL_NAMES = ["tdx_api_data", "tdx_quotes", "tdx_kline", "tdx_lookup_stock", "tdx_screener", "tdx_indicator_select"];
function scanSkills() {
  const out = {};
  if (!existsSync(SKILLS_DIR)) return out;
  for (const name of readdirSync(SKILLS_DIR)) {
    const f = join(SKILLS_DIR, name, "SKILL.md");
    if (!existsSync(f)) continue;
    const txt = readFileSync(f, "utf8");
    const tools = TOOL_NAMES.filter(t => txt.includes(t));
    const lines = txt.split(/\r?\n/);
    const entries = new Set(), fixedTags = new Set(), proxPairs = [];
    let lastEntry = null, lastEntryLine = -99;
    lines.forEach((ln, i) => {
      const em = ln.match(/tdxf10_[a-z_]+/g);
      if (em) for (const e of em) { entries.add(e); lastEntry = e; lastEntryLine = i; }
      const fm = ln.match(/fixedTag["'\s:=]+([a-zA-Z0-9_]+)/);
      if (fm) {
        const ft = fm[1]; fixedTags.add(ft);
        if (lastEntry && i - lastEntryLine <= 8) proxPairs.push([lastEntry, ft]);
      }
    });
    out[name] = { tools, entries: [...entries], fixedTags: [...fixedTags], proxPairs };
  }
  return out;
}

// 全局：每个 fixedTag 选择共现次数最高的 entry 作为规范配对
function buildCanonical(scan) {
  const count = new Map(); // "entry|ft" -> n
  for (const s of Object.values(scan))
    for (const [e, ft] of s.proxPairs) count.set(e + "|" + ft, (count.get(e + "|" + ft) || 0) + 1);
  const best = new Map(); // ft -> {entry, n}
  for (const [key, n] of count) {
    const [e, ft] = key.split("|");
    const cur = best.get(ft);
    if (!cur || n > cur.n) best.set(ft, { entry: e, n });
  }
  const canonical = new Map(); // ft -> entry
  for (const [ft, v] of best) canonical.set(ft, v.entry);
  return canonical;
}

(async () => {
  console.log("====== TDX Finance MCP Plugin v3 — 测试 ======");
  console.log("Token:", TOKEN.slice(0, 10) + "…  | 测试标的:", TEST_CODE, "setcode", TEST_SETCODE);
  const tools = await loadTools();
  console.log("已注册工具:", Object.keys(tools).join(", "), "\n");

  const report = { generatedAt: new Date().toISOString(), token: TOKEN.slice(0, 10) + "…", testCode: TEST_CODE, tools: {}, f10: {}, skills: {} };

  // ---------- Phase A ----------
  console.log("---- Phase A: 6 个核心工具 ----");
  const toolTests = [
    ["tdx_quotes",          { code: TEST_CODE, setcode: TEST_SETCODE }],
    ["tdx_kline",           { code: TEST_CODE, setcode: TEST_SETCODE, period: "4", wantNum: "5" }],
    ["tdx_lookup_stock",    { query: "平安银行" }],
    ["tdx_screener",        { message: "涨停", pageSize: "5" }],
    ["tdx_indicator_select",{ message: "平安银行 市盈率" }],
    ["tdx_api_data",        { entry: "TdxSharePCCW.tdxf10_gg_ybpj", code: TEST_CODE, fixedTag: "yzyq" }],
  ];
  for (const [name, params] of toolTests) {
    if (!tools[name]) { console.log(`  ✖ ${name} 未注册`); report.tools[name] = { ok: false, note: "未注册" }; continue; }
    const r = await callTool(tools[name], params);
    report.tools[name] = r;
    console.log(`  ${r.ok ? "✅" : "❌"} ${name.padEnd(22)} ${String(r.status).padEnd(6)} ${r.ms}ms  ${r.note}`);
    if (r.sample) console.log(`       ↳ ${r.sample}`);
  }

  // ---------- Phase B+C ----------
  const scan = scanSkills();
  const canonical = buildCanonical(scan);
  // 每个技能的规范化依赖对：仅当该技能同时引用了 fixedTag 的规范 entry
  for (const s of Object.values(scan)) {
    const pairs = new Set();
    for (const ft of s.fixedTags) {
      const ce = canonical.get(ft);
      if (ce && s.entries.includes(ce)) pairs.add(ce + "|" + ft);
    }
    s.pairs = [...pairs];
  }
  if (!SKIP_F10) {
    console.log("\n---- Phase C: F10 (entry, fixedTag) 探测（规范配对）----");
    const probeSet = new Set();
    for (const s of Object.values(scan)) for (const p of s.pairs) probeSet.add(p);
    const probes = [...probeSet].sort();
    console.log(`  从 ${Object.keys(scan).length} 个技能规范化出 ${probes.length} 个唯一 entry|fixedTag 组合\n`);
    for (const p of probes) {
      const [e, ft] = p.split("|");
      const entry = e.startsWith("Tdx") ? e : "TdxSharePCCW." + e;
      const r = await callTool(tools.tdx_api_data, { entry, code: TEST_CODE, fixedTag: ft });
      report.f10[p] = r;
      console.log(`  ${r.ok ? "✅" : "❌"} ${p.padEnd(34)} ${String(r.status).padEnd(6)} ${r.ms}ms ${r.note}`);
    }
  }

  // ---------- Phase D ----------
  console.log("\n---- Phase D: 45 个技能可用性 ----");
  const entryOk = (entry, ft) => {
    const key = entry + "|" + ft;
    if (report.f10[key]) return report.f10[key].ok;
    const sib = Object.entries(report.f10).filter(([k]) => k.startsWith(entry + "|"));
    if (sib.length) return sib.some(([, v]) => v.ok);
    return null;
  };
  let avail = 0, partial = 0, down = 0;
  for (const [name, dep] of Object.entries(scan)) {
    const checks = [];
    for (const t of dep.tools) if (report.tools[t]) checks.push(report.tools[t].ok);
    for (const p of dep.pairs) { const [e, ft] = p.split("|"); const v = entryOk(e, ft); if (v !== null) checks.push(v); }
    let verdict;
    if (checks.length === 0) verdict = "未知(无可测依赖)";
    else if (checks.every(Boolean)) { verdict = "✅可用"; avail++; }
    else if (checks.some(Boolean)) { verdict = "🟡部分"; partial++; }
    else { verdict = "❌不可用"; down++; }
    report.skills[name] = { verdict, tools: dep.tools, entries: dep.entries };
    console.log(`  ${verdict.padEnd(8)} ${name}`);
  }
  console.log(`\n  小结: ✅${avail} 可用 | 🟡${partial} 部分 | ❌${down} 不可用 | 共 ${Object.keys(scan).length}`);

  const okTools = Object.values(report.tools).filter(t => t.ok).length;
  report.summary = { toolsOk: okTools, toolsTotal: Object.keys(report.tools).length,
    f10Ok: Object.values(report.f10).filter(t => t.ok).length, f10Total: Object.keys(report.f10).length,
    skillsAvail: avail, skillsPartial: partial, skillsDown: down };
  writeFileSync(join(__dir, "test-report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(__dir, "test-report.md"), toMarkdown(report));
  console.log("\n📄 报告已写入 test/test-report.json 与 test/test-report.md");
})();

function toMarkdown(r) {
  const L = [];
  L.push("# TDX Finance MCP Plugin v3 — 测试报告\n");
  L.push(`- 生成时间: ${r.generatedAt}`);
  L.push(`- 测试标的: ${r.testCode}  | Token: ${r.token}`);
  L.push(`- 工具: ${r.summary.toolsOk}/${r.summary.toolsTotal} 可用 | F10: ${r.summary.f10Ok}/${r.summary.f10Total} 可用 | 技能: ✅${r.summary.skillsAvail} 🟡${r.summary.skillsPartial} ❌${r.summary.skillsDown}\n`);
  L.push("## 1. 核心工具\n");
  L.push("| 工具 | 状态 | 错误码/说明 | 耗时 |\n|---|---|---|---|");
  for (const [k, v] of Object.entries(r.tools)) L.push(`| ${k} | ${v.ok ? "✅" : "❌ " + v.status} | ${v.note || ""} | ${v.ms ?? ""}ms |`);
  L.push("\n## 2. F10 探测矩阵（规范配对）\n");
  L.push("| entry\\|fixedTag | 状态 | 说明 | 耗时 |\n|---|---|---|---|");
  for (const [k, v] of Object.entries(r.f10)) L.push(`| ${k} | ${v.ok ? "✅" : "❌ " + v.status} | ${v.note || ""} | ${v.ms ?? ""}ms |`);
  L.push("\n## 3. 技能可用性\n");
  L.push("| 技能 | 结论 | 依赖工具 | 依赖F10 entry |\n|---|---|---|---|");
  for (const [k, v] of Object.entries(r.skills)) L.push(`| ${k} | ${v.verdict} | ${v.tools.join(", ")} | ${v.entries.join(", ")} |`);
  return L.join("\n") + "\n";
}
