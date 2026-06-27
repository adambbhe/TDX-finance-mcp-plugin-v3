#!/usr/bin/env node
/**
 * 一进二打板 · 回测/阈值校准器
 * ---------------------------------------------------------------
 * 读取 history/ 里累积的 modeA-pool.json（每日首板监测池+特征），用 tdx_kline 回补
 * 每只票的「次日实际结果」（是否封板晋级二板、次日涨幅、是否触板），再按各特征档位
 * 统计一进二成功率与平均次日涨幅 → 看哪些阈值真有区分度，据此调 scoring-rules 档位。
 *
 * 运行：node backtest.mjs --token=TDX-xxxx [--probe]
 * 输出：backtest-report.md（人读统计表）、backtest-samples.json（特征→结果明细，可再分析）
 *
 * 说明：
 *  - 「一进二成功」= 次日收盘涨幅 ≥ 9.8%（封板）。「触板」= 次日最高涨幅 ≥ 9.8%。
 *  - 只统计「次日已成为过去交易日」的样本；最近一天若次日未发生，自动跳过（无结果）。
 *  - kline 每根 Item：已确认 high=Item[3]、low=Item[4]、close=Item[5]；日期列自动探测。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map(a=>{ const m=a.match(/^--([^=]+)(?:=(.*))?$/); return m?[m[1],m[2]??true]:[a,true]; }));
const TOKEN = args.token || process.env.TDX_API_KEY || process.env.TDX_API_TOKEN;
const PROBE = !!args.probe;
const EP = process.env.TDX_API_DATA_ENDPOINT || "http://tdxhub.icfqs.com:7615/TQLEX";

const num = v => { if(v==null) return null; const n=Number(String(v).replace(/[, ]/g,"")); return isNaN(n)?null:n; };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

// ===== 特征分档（与 scoring-rules 一致；改阈值时改这里再回测对比）=====
export const B = {
  fengLiu: v=> v==null?"N/A": v>=0.015?"≥1.5%": v>=0.008?"0.8-1.5%": v>=0.004?"0.4-0.8%":"<0.4%",
  fcb:     v=> v==null?"N/A": v>=32?"≥32": v>=16?"16-32": v>=8?"8-16":"<8",
  firstTime: ft=>{ const s=String(ft||""); return /^09:[0-3]/.test(s)?"早盘(<09:40)": /^09:[45]|^10:[0-2]/.test(s)?"上午(09:40-10:29)": /^1[0-1]:/.test(s)?"午前":"午后"; },
  openCnt: n=> n==null?"N/A": n===0?"0次": n===1?"1次":"≥2次",
  board:   bt=>{ const s=String(bt||""); return s.includes("一字")?"一字板": s.includes("换手")?"换手板":"盘中板"; },
  quality: s=> s==null?"N/A": s>=85?"≥85": s>=70?"70-84": s>=60?"60-69":"<60",
};

// ===== 统计：按 bucketFn(rec[key]) 分组，算样本数/封板率/触板率/平均次日涨幅 =====
export function aggregate(records, key, bucketFn){
  const g={};
  for (const r of records){ const b=bucketFn(r[key]); (g[b]=g[b]||[]).push(r); }
  return Object.entries(g).map(([bucket,rs])=>{
    const n=rs.length;
    const sealed=rs.filter(r=>r.sealed).length, touched=rs.filter(r=>r.touched).length;
    const avgChg=rs.reduce((s,r)=>s+(r.chg||0),0)/n;
    return { bucket, n, sealRate:sealed/n, touchRate:touched/n, avgChg };
  }).sort((a,b)=> b.sealRate-a.sealRate);
}

async function call(entry, body){
  const url=`${EP}?Entry=${encodeURIComponent(entry)}`; const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),20000);
  try{ const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","token":TOKEN},body:JSON.stringify(body),signal:ctrl.signal});
    const txt=await r.text(); let j; try{j=JSON.parse(txt);}catch{j=txt;} return {status:r.status,json:j}; }
  catch(e){ return {status:0,error:`${e.name}:${e.message}`}; } finally{ clearTimeout(t); }
}

// 探测 Item 里的日期列（值形如 20260618 的 8 位）
function detectDateIdx(item){ for(let i=0;i<item.length;i++){ if(/^20\d{6}$/.test(String(item[i]).replace(/[.\-]/g,""))) return i; } return 0; }

// 取某票日K，定位 poolDate 当日与次日，算结果
async function outcome(code, setcode, poolDateKey){
  const res=await call("TdxShare.PBFXT",{Head:{Target:0,CharSet:"UTF8"},Code:code,Setcode:Number(setcode),Period:4,Startxh:"0",WantNum:"40",TQFlag:"11",MPData:0,HasAttachInfo:"1",HasLtgb:"0",ForRefresh:0,HasIpoPrice:"0"});
  const items=(res.json?.ListItem||res.json?.result?.ListItem||[]).map(it=>it.Item||it);
  if(!items.length) return null;
  if(PROBE){ console.error(`[probe] ${code} 首根Item:`, JSON.stringify(items[items.length-1])); }
  const di=detectDateIdx(items[items.length-1]);
  const norm=s=>String(s).replace(/[.\-]/g,"");
  const idx=items.findIndex(it=> norm(it[di])===poolDateKey);
  if(idx<0 || idx+1>=items.length) return null;        // 找不到当日，或次日尚未发生
  const D=items[idx], D1=items[idx+1];
  const cD=num(D[5]), cD1=num(D1[5]), hD1=num(D1[3]);
  if(!cD||!cD1) return null;
  const chg=(cD1/cD-1)*100, hi=(hD1/cD-1)*100;
  return { chg, sealed: chg>=9.8, touched: hi>=9.8, nextHigh:hi };
}

async function main(){
  if(!TOKEN){ console.error("缺少 Token：--token=TDX-xxxx"); process.exit(1); }
  if(!existsSync("history")){ console.error("没有 history/ 目录，先跑几天 run-modeA.mjs 累积数据。"); process.exit(1); }
  const days=readdirSync("history").filter(d=>/^\d{8}$/.test(d)).sort();
  if(!days.length){ console.error("history/ 下没有 YYYYMMDD 数据日，先跑 run-modeA.mjs。"); process.exit(1); }

  const records=[]; let skipped=0;
  for(const day of days){
    const pf=`history/${day}/modeA-pool.json`;
    if(!existsSync(pf)) continue;
    const pool=JSON.parse(readFileSync(pf,"utf8")).pool||[];
    console.error(`回测 ${day}：${pool.length} 只首板...`);
    for(const s of pool){
      const o=await outcome(s.code, s.setcode, day);
      if(!o){ skipped++; continue; }
      records.push({ day, code:s.code, name:s.name, fengLiu:s.fengLiu, fcb:s.fcb, firstTime:s.firstTime,
        openCnt:s.openCnt, boardType:s.boardType, qualityScore:s.qualityScore, ...o });
      await sleep(40);
    }
  }
  if(!records.length){ console.error(`无可用样本（${skipped} 只次日结果未生成或未匹配）。`); process.exit(1); }

  const feats=[["封流比","fengLiu",B.fengLiu],["封成比","fcb",B.fcb],["首封时间","firstTime",B.firstTime],
    ["开板次数","openCnt",B.openCnt],["板型","boardType",B.board],["质量分","qualityScore",B.quality]];
  const out=[]; out.push(`# 一进二 阈值回测报告`);
  out.push(`样本：${records.length} 只（覆盖 ${days.length} 个数据日，跳过 ${skipped} 只无次日结果）　运行 ${new Date().toLocaleString("zh-CN")}`);
  const overall=records.filter(r=>r.sealed).length/records.length;
  out.push(`整体一进二成功率（封板率）：**${(overall*100).toFixed(1)}%**　平均次日涨幅：${(records.reduce((s,r)=>s+r.chg,0)/records.length).toFixed(2)}%\n`);
  for(const [label,key,fn] of feats){
    out.push(`## 按 ${label} 分档`);
    out.push(`| 档位 | 样本 | 一进二成功率 | 触板率 | 平均次日涨幅 |`);
    out.push(`|---|---|---|---|---|`);
    for(const r of aggregate(records,key,fn))
      out.push(`| ${r.bucket} | ${r.n} | ${(r.sealRate*100).toFixed(1)}% | ${(r.touchRate*100).toFixed(1)}% | ${r.avgChg.toFixed(2)}% |`);
    out.push("");
  }
  out.push(`> 看每个特征**各档位成功率是否单调拉开**：拉得开=该阈值有区分度，可保留/强化；几乎一样=该档位无效，需调边界或降权。`);
  const md=out.join("\n")+"\n";
  writeFileSync("backtest-report.md", md, "utf8");
  writeFileSync("backtest-samples.json", JSON.stringify(records,null,2), "utf8");
  console.log(md); console.log("[已写出] backtest-report.md、backtest-samples.json");
}
if (process.argv[1] && /(^|\/)backtest\.mjs$/.test(process.argv[1].replace(/\\/g,"/"))) main();
