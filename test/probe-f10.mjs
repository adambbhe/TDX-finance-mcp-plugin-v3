#!/usr/bin/env node
/**
 * F10 数据清单逐条核验 —— 驱动真实插件的 tdx_api_data.execute 打接口
 *
 * 做什么：
 *   1) 加载 ../index.js（真实插件），mock api 注册，取到 tdx_api_data.execute。
 *   2) 遍历 test/f10-routes.mjs（71 条权威路由 = STRUCTURED_ROUTE_REGISTRY），逐条发请求。
 *   3) 按 OK / 空 / 错误(带错误码) 分类，输出汇总 + 明细。
 *   4) 落盘 test/f10-catalog-report.md 与 .json。
 *
 * 用法：
 *   $env:TDX_API_KEY="TDX-xxxx"        # Windows PowerShell
 *   export TDX_API_KEY=TDX-xxxx        # bash
 *   node test/probe-f10.mjs                 # 全量
 *   node test/probe-f10.mjs --cat 财务报表  # 只测某模块
 *   node test/probe-f10.mjs --full-only     # 只测 coverage=full 的路由
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { F10_ROUTES } from "./f10-routes.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const argv = process.argv.slice(2);
const getArg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const CAT = getArg("--cat");
const FULL_ONLY = argv.includes("--full-only");

const TOKEN = process.env.TDX_API_KEY || process.env.TDX_API_TOKEN || "";
if (!TOKEN) { console.error("❌ 请先设置环境变量 TDX_API_KEY=<你的TDX token>"); process.exit(1); }

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
  if (!text || !text.trim()) return { status: "EMPTY", note: "空响应" };
  for (const m of ERR_MARKERS) if (m.re.test(text)) return { status: "ERR", note: m.tag };
  // 请求失败标记
  if (/请求失败/.test(text) && !/请求成功/.test(text)) return { status: "ERR", note: "请求失败" };
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
async function loadTool() {
  const mod = await import(pathToFileURL(join(ROOT, "index.js")).href);
  const plugin = mod.default ?? mod.plugin ?? mod;
  const tools = {};
  const api = { logger: { info(){}, debug(){}, error(){}, warn(){} }, pluginConfig: { tdxApiToken: TOKEN }, registerTool(t){ tools[t.name] = t; } };
  if (typeof plugin.register !== "function") throw new Error("插件没有 register() 导出");
  plugin.register(api);
  if (!tools.tdx_api_data) throw new Error("未注册 tdx_api_data");
  return tools.tdx_api_data;
}
async function call(tool, params) {
  const t0 = Date.now();
  try {
    const res = await tool.execute("f10-probe", params, undefined, () => {});
    const text = extractText(res);
    const c = classify(text);
    return { ...c, ms: Date.now() - t0, sample: text.replace(/\s+/g, " ").slice(0, 200) };
  } catch (e) {
    return { status: "THROW", note: String(e?.message || e).slice(0, 140), ms: Date.now() - t0, sample: "" };
  }
}

(async () => {
  let routes = F10_ROUTES;
  if (CAT) routes = routes.filter(r => r.cat === CAT);
  if (FULL_ONLY) routes = routes.filter(r => r.cov === "full");

  console.log("====== F10 数据清单核验 ======");
  console.log("Token:", TOKEN.slice(0, 10) + "…  | 路由数:", routes.length, CAT ? `| 模块:${CAT}` : "", FULL_ONLY ? "| 仅full" : "");
  const tool = await loadTool();

  const rows = [];
  for (const r of routes) {
    const res = await call(tool, r.params);
    const icon = res.status === "OK" ? "✓" : res.status === "EMPTY" ? "∅" : "✗";
    console.log(`  ${icon} [${r.cat}] ${r.entry} ${r.sel}  → ${r.desc}  | ${res.status}${res.note ? " " + res.note : ""} (${res.ms}ms)`);
    rows.push({ ...r, params: undefined, ...res });
  }

  const n = rows.length;
  const ok = rows.filter(r => r.status === "OK").length;
  const empty = rows.filter(r => r.status === "EMPTY").length;
  const err = n - ok - empty;
  console.log(`\n==== 汇总：OK ${ok} / 空 ${empty} / 错误 ${err} / 共 ${n} ====`);

  // Markdown 报告
  const byCat = {};
  for (const r of rows) (byCat[r.cat] ||= []).push(r);
  let md = `# F10 数据清单核验报告\n\n`;
  md += `- 生成时间：${new Date().toISOString()}\n- Token：${TOKEN.slice(0,10)}…\n- 路由数：${n}（OK ${ok} / 空 ${empty} / 错误 ${err}）\n\n`;
  for (const [cat, list] of Object.entries(byCat)) {
    md += `## ${cat}\n\n| entry | 判别 | 数据项 | 覆盖 | 结果 | 备注 |\n|---|---|---|---|---|---|\n`;
    for (const r of list) {
      const icon = r.status === "OK" ? "✅ OK" : r.status === "EMPTY" ? "⚪ 空" : "❌ " + r.status;
      md += `| \`${r.entry}\` | ${r.sel} | ${r.desc} | ${r.cov} | ${icon} | ${r.note || ""} |\n`;
    }
    md += `\n`;
  }
  writeFileSync(join(__dir, "f10-catalog-report.md"), md, "utf8");
  writeFileSync(join(__dir, "f10-catalog-report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), summary: { n, ok, empty, err }, rows }, null, 2), "utf8");
  console.log("已写入 test/f10-catalog-report.md 与 .json");
  process.exit(0);
})();
