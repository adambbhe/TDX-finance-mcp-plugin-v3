#!/usr/bin/env node
// 单股行情字段/单位复核脚本
// 用法: node test/probe-quote.mjs <code> <setcode>
//   例: node test/probe-quote.mjs 300750 0     (宁德时代, 深市)
//       node test/probe-quote.mjs 600519 1     (贵州茅台, 沪市)
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const code = process.argv[2] || "000001";
const setcode = process.argv[3] || "0";
const TOKEN = process.env.TDX_API_KEY || process.env.TDX_API_TOKEN || "";
if (!TOKEN) { console.error("请先设置 TDX_API_KEY"); process.exit(1); }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(pathToFileURL(join(ROOT, "index.js")).href);
const tools = {};
mod.default.register({
  logger: { info(){}, debug(){}, error(){}, warn(){} },
  pluginConfig: { tdxApiToken: TOKEN },
  registerTool(t) { tools[t.name] = t; },
});

const r = await tools.tdx_quotes.execute("probe", { code, setcode }, undefined, () => {});
const d = r.details || {};
const hq = d.HQInfo || {};
const ext = d.ExtInfo || {};
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const Volume = num(hq.Volume);
const HSL = num(hq.HSL);
const Now = num(hq.Now);
const LTGB = num(ext.LTGB);   // 流通股本(万股)
const ZGB = num(ext.ZGB);     // 总股本(万股)
const ZSZ = num(ext.ZSZ);     // 总市值(元)

console.log(`\n===== ${d.BaseInfo?.Name || code} (${code}) 原始字段 =====`);
console.log("HQInfo.Volume =", Volume, " (成交量原始值)");
console.log("HQInfo.HSL    =", HSL, " (换手率原始值)");
console.log("HQInfo.Now    =", Now);
console.log("ExtInfo.LTGB  =", LTGB, " (流通股本, 万股)");
console.log("ExtInfo.ZGB   =", ZGB, " (总股本, 万股)");
console.log("ExtInfo.ZSZ   =", ZSZ, " (总市值, 元)");

console.log(`\n===== 单位恒等式检验 =====`);
if (Volume != null && HSL != null && LTGB != null && LTGB !== 0) {
  // 假设 Volume 单位=手(=百股), LTGB 单位=万股 → 流通股数 = LTGB*1e4
  const floatShares = LTGB * 1e4;
  const tradedShares = Volume * 100;                 // 手 -> 股
  const turnoverPct = tradedShares / floatShares * 100;
  const ratio = turnoverPct / HSL;
  console.log(`假设[Volume=手, LTGB=万股]: 换手率 = Volume*100 / (LTGB*1e4) *100`);
  console.log(`  = ${Volume}*100 / (${LTGB}*1e4) *100 = ${turnoverPct.toFixed(4)}%`);
  console.log(`  返回 HSL = ${HSL}%   → 比值 ${ratio.toFixed(3)}  ${Math.abs(ratio-1)<0.05 ? "✅ 吻合 (Volume 确为手, HSL 已是百分数)" : "⚠️ 不吻合，需重看单位"}`);
} else {
  console.log("缺少 Volume/HSL/LTGB，无法做恒等式检验（可能该股无 ProInfo/ExtInfo 权限或停牌）");
}

console.log(`\n===== 格式化输出 =====`);
console.log(r.content[0].text.split("\n\n详细信息")[0]);
