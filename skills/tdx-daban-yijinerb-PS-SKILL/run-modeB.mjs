#!/usr/bin/env node
/**
 * 一进二打板 · 模式B（次日 9:25-9:29 竞价定夺）本地运行器
 * ---------------------------------------------------------------
 * 读取模式A 产出的 modeA-pool.json，对每只首板取实时竞价 quotes，
 * 结合 封板质量(模式A) + 竞价表现(高开/量比LB/委比Wtb) + 板块梯队身位，
 * 算综合分、判可成交性，选出当日最终一进二标的。
 *
 * 运行：node run-modeB.mjs --token=TDX-xxxx [--pool=modeA-pool.json] [--top=10]
 * ⚠️ 必须在交易日 9:25-9:29 竞价窗口运行：此时 quotes.Now=竞价撮合价、Volume=竞价量。
 *    非窗口运行 quotes 是连续竞价/昨收价，结果无意义（脚本会提示）。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
let HIST = null; // 归档目录 history/<竞价日>
function ensureHist(dateKey){ const d=`history/${dateKey}`; try{ mkdirSync(d,{recursive:true}); HIST=d; }catch(e){ console.error("建档失败:",e.message); } }
function writeBoth(name, content){ writeFileSync(name, content, "utf8"); if(HIST){ try{ writeFileSync(`${HIST}/${name}`, content, "utf8"); }catch{} } }

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m=a.match(/^--([^=]+)(?:=(.*))?$/); return m?[m[1],m[2]??true]:[a,true]; }));
const TOKEN = args.token || process.env.TDX_API_KEY || process.env.TDX_API_TOKEN;
const POOLF = args.pool || "modeA-pool.json";
const TOP = parseInt(args.top || "10", 10);
const EP = process.env.TDX_API_DATA_ENDPOINT || "http://tdxhub.icfqs.com:7615/TQLEX";
if (!TOKEN){ console.error("缺少 Token：--token=TDX-xxxx 或 export TDX_API_KEY=..."); process.exit(1); }

const num = v => { if(v==null) return null; const n=Number(String(v).replace(/[, ]/g,"")); return isNaN(n)?null:n; };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function call(entry, body){
  const url=`${EP}?Entry=${encodeURIComponent(entry)}`; const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),20000);
  try{ const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","token":TOKEN},body:JSON.stringify(body),signal:ctrl.signal});
    const txt=await r.text(); let j; try{j=JSON.parse(txt);}catch{j=txt;} return {status:r.status,json:j}; }
  catch(e){ return {status:0,error:`${e.name}:${e.message}${e.cause?.code?` (${e.cause.code})`:""}`}; }
  finally{ clearTimeout(t); }
}

// 选股 NLP 服务偶发繁忙/宕机，自动重试（请求体固定为正确数组格式）
async function callScreenerRetry(body, n=3){
  let res;
  for (let a=1;a<=n;a++){ res=await call("JNLPSE:wendaQuery", body); if (res.status===200 && Array.isArray(res.json)) return res; if (a<n) await sleep(1500); }
  return res;
}
async function getQuote(code,setcode){
  const res=await call("TdxShare.PBHQInfo",{Head:{Target:"0",CharSet:"UTF8"},Code:code,Setcode:setcode,HasHQInfo:"1",HasExtInfo:"1",BspNum:"5",HasProInfo:"1",HasCalcInfo:"1",HasCwInfo:"0",HasStatInfo:"0"});
  const j=res.json||{}; const hq=j.HQInfo||{},ext=j.ExtInfo||{},pro=j.ProInfo||{};
  const now=num(hq.Now), close=num(hq.Close);
  return { now, close, open:num(hq.Open), vol:num(hq.Volume), lb:num(hq.LB), wtb:num(pro.Wtb), hqDate:hq.HQDate,
    ztPrice:num(ext.ZTPrice), kaiPct:(now!=null&&close)?(now/close-1)*100:null, ok:res.status===200, err:res.error||(res.status!==200?res.status:null) };
}

// ---- 竞价表现评分（0-100：高开45 + 量比30 + 委比25）----
export function auctionScore(q){
  const notes=[]; let sc=0; const kp=q.kaiPct;
  if(kp==null) return {score:0,notes:["无竞价数据"]};
  if(kp>=4.5&&kp<=7){sc+=45;notes.push(`高开${kp.toFixed(1)}%(黄金)`);}
  else if(kp>=4&&kp<7.5){sc+=32;notes.push(`高开${kp.toFixed(1)}%`);}
  else if(kp>=2&&kp<4.5){sc+=18;notes.push(`高开偏低${kp.toFixed(1)}%`);}
  else if(kp>7.5){sc+=10;notes.push(`高开透支${kp.toFixed(1)}%`);}
  else {notes.push(`高开不足/低开${kp.toFixed(1)}%`);}
  if(q.lb!=null){ if(q.lb>=3){sc+=30;notes.push(`量比${q.lb.toFixed(1)}强`);} else if(q.lb>=1.5){sc+=20;notes.push(`量比${q.lb.toFixed(1)}`);} else if(q.lb>=1){sc+=10;} else {notes.push(`量比${q.lb.toFixed(1)}弱`);} }
  if(q.wtb!=null){ if(q.wtb>=50){sc+=25;notes.push(`委比+${q.wtb.toFixed(0)}强`);} else if(q.wtb>=0){sc+=15;notes.push(`委比+${q.wtb.toFixed(0)}`);} else if(q.wtb>=-50){sc+=5;} else {notes.push(`委比${q.wtb.toFixed(0)}弱`);} }
  return {score:Math.min(100,sc),notes};
}
export function tradableB(q){
  if(q.now==null||q.close==null) return "无数据";
  if(q.ztPrice!=null && q.now>=q.ztPrice) return "竞价顶一字·买不进(仅监测)";
  const kp=q.kaiPct;
  if(kp>=4.5&&kp<=7) return "可参与(黄金高开)";
  if(kp>=4&&kp<7.5) return "可参与";
  if(kp<2) return "高开不足·弃";
  if(kp>7.5) return "高开透支·谨慎";
  return "观察";
}
// ---- 板块梯队/身位：按题材聚类，组内按 base 分排龙头/卡位/跟风 ----
export function themeKeys(t){ return String(t||"").split(/[.\s,，、]+/).map(x=>x.replace(/(概念|板块|股)$/,"")).filter(x=>x.length>=2&&x.length<=8); }
export function clusterPosition(items){ // items: [{theme, base}]，原地写 hotTheme/position/posBonus
  const freq={}; items.forEach(it=> themeKeys(it.theme).forEach(k=> freq[k]=(freq[k]||0)+1));
  items.forEach(it=>{ const ks=themeKeys(it.theme); let best=ks[0]||"其它",bf=0;
    ks.forEach(k=>{ if((freq[k]||0)>bf){bf=freq[k];best=k;} }); it.hotTheme=bf>=2?best:(ks[0]||"其它"); it.themeCount=bf; });
  const groups={}; items.forEach(it=> (groups[it.hotTheme]=groups[it.hotTheme]||[]).push(it));
  for(const g of Object.values(groups)){ g.sort((a,b)=> b.base-a.base);
    g.forEach((it,i)=>{ it.position = g.length<2?"独票":(i===0?"龙头":i===1?"卡位":"跟风");
      it.posBonus = g.length<2?0:(i===0?15:i===1?8:2); }); }
  return items;
}

async function marketGate(){
  const [sh,sz,cy,zt]=await Promise.all([getQuote("000001","1"),getQuote("399001","0"),getQuote("399006","0"),
    callScreenerRetry([{message:"涨停",rang:"AG",pageNo:"1",pageSize:"1"}])]);
  const ztCount = Array.isArray(zt.json)? num(zt.json[0]?.[2]) : null;
  const regime = ztCount==null?"未知":(ztCount>80?"强势":ztCount>=40?"震荡":"弱势退潮");
  return {sh,sz,cy,ztCount,regime};
}

async function main(){
  let poolData;
  try { poolData = JSON.parse(readFileSync(POOLF,"utf8")); }
  catch { console.error(`读不到 ${POOLF}，请先跑模式A 生成。`); process.exit(1); }
  const pool = poolData.pool||[];
  const out=[]; out.push(`# 一进二 模式B 竞价定夺`); out.push(`监测池来自 ${POOLF}（首板数据日 ${poolData.date||"?"}）　运行 ${new Date().toLocaleString("zh-CN")}\n`);

  const g = await marketGate();
  const dateKey = String(g.sh.hqDate||"").replace(/[^0-9]/g,"") || new Date().toISOString().slice(0,10).replace(/-/g,"");
  ensureHist(dateKey);
  out.push(`## 市场环境闸门（竞价日 ${dateKey}，归档 history/${dateKey}/）`);
  out.push(`- 涨停家数(近似)：${g.ztCount??"N/A"}　情绪：**${g.regime}**`);
  if (g.sh.kaiPct!=null) out.push(`- 指数竞价：上证 ${g.sh.kaiPct.toFixed(2)}%、深成 ${g.sz.kaiPct?.toFixed(2)}%、创业板 ${g.cy.kaiPct?.toFixed(2)}%`);
  if (g.regime==="弱势退潮"){ out.push(`\n> ⛔ 弱势退潮，**今日停做一进二**，建议空仓或仅观察。`); return finish(out); }

  const rows=[];
  for (const s of pool){
    const q = await getQuote(s.code, s.setcode);
    const aud = auctionScore(q);
    const base = Math.round(0.45*(s.qualityScore||0) + 0.45*aud.score);
    rows.push({...s, q, auction:aud.score, auctionNotes:aud.notes, tradable:tradableB(q), base});
    await sleep(40);
  }
  clusterPosition(rows);
  rows.forEach(r=> r.final = Math.min(100, r.base + r.posBonus));

  const playable = rows.filter(r=> String(r.tradable).startsWith("可参与")).sort((a,b)=> b.final-a.final);
  const monitor  = rows.filter(r=> !String(r.tradable).startsWith("可参与")).sort((a,b)=> b.final-a.final);
  const topCode = playable[0]?.code;
  // 机器可读竞价数据+选择，归档供回测
  writeBoth("modeB-data.json", JSON.stringify({date:dateKey, poolDate:poolData.date, regime:g.regime, ztCount:g.ztCount,
    rows: rows.map(r=>({code:r.code,name:r.name,setcode:r.setcode,kaiPct:r.q.kaiPct,lb:r.q.lb,wtb:r.q.wtb,ztPrice:r.q.ztPrice,
      now:r.q.now,close:r.q.close,qualityScore:r.qualityScore,auction:r.auction,base:r.base,posBonus:r.posBonus,final:r.final,
      hotTheme:r.hotTheme,position:r.position,tradable:r.tradable,selected:r.code===topCode}))},null,2));

  out.push(`\n## 可参与候选（按综合分，${Math.min(TOP,playable.length)}/${playable.length}）\n`);
  out.push(`| 代码 | 名称 | 高开% | 量比 | 委比 | 题材身位 | 质量分 | 竞价分 | 综合 | 可成交性 |`);
  out.push(`|---|---|---|---|---|---|---|---|---|---|`);
  for (const r of playable.slice(0,TOP))
    out.push(`| ${r.code} | ${r.name} | ${r.q.kaiPct?.toFixed(1)??"N/A"} | ${r.q.lb?.toFixed(1)??"N/A"} | ${r.q.wtb?.toFixed(0)??"N/A"} | ${r.hotTheme}/${r.position} | ${r.qualityScore} | ${r.auction} | ${r.final} | ${r.tradable} |`);

  if (playable.length){
    const top=playable[0];
    out.push(`\n### 首选一进二标的：${top.code} ${top.name}（综合 ${top.final}）`);
    out.push(`- 竞价：${top.auctionNotes.join("、")}`);
    out.push(`- 板块：${top.hotTheme} 题材，身位 **${top.position}**（同题材 ${top.themeCount} 只）`);
    out.push(`- 封板质量(昨日)：${top.qualityScore} 分；封流比 ${top.fengLiu!=null?(top.fengLiu*100).toFixed(2)+"%":"N/A"}、开板 ${top.openCnt??0} 次`);
    out.push(`- 操作：竞价临近涨停扫板，单票 12%，单日仅此 1 只；跌破开盘价 -2% 无条件止损。`);
  } else out.push(`\n> 监测池中无"可参与"标的（多为顶一字买不进或高开不足）。`);

  out.push(`\n## 仅监测（买不进/弃）\n`);
  for (const r of monitor.slice(0,TOP))
    out.push(`- ${r.code} ${r.name}：${r.tradable}（高开 ${r.q.kaiPct?.toFixed(1)??"N/A"}%、${r.hotTheme}/${r.position}）`);
  finish(out);
}
// 仅在直接运行时执行 main（被 import 时不触发，便于离线测试）
if (process.argv[1] && /run-modeB\.mjs$/.test(process.argv[1].replace(/\\/g,"/"))) main();

function finish(lines){
  const md=lines.join("\n")+"\n";
  writeBoth("modeB-result.md", md);
  console.log(md);
  console.log(`\n[已写出] modeB-result.md / modeB-data.json（UTF-8）${HIST?`，并归档至 ${HIST}/`:""}`);
}
