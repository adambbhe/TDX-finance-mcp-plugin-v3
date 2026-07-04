#!/usr/bin/env node
/**
 * 一进二打板 · 模式A（盘后建监测池）本地运行器  v3
 * ---------------------------------------------------------------
 * 运行：node run-modeA.mjs --token=TDX-xxxx [--top=20] [--probe]
 *       或 export TDX_API_KEY=... 后直接 node run-modeA.mjs
 *
 * v3 变更（按需求只加 封成比/开板次数/封流比）：
 *  - 封成比、开板次数：从 screener "涨停" 直接读，进表格并计入封板质量评分。
 *  - 封流比：每只首板加一次 quotes，= 封单金额 ÷ 流通市值（CALTZ 或 LTGB×现价）。
 *    封流比比绝对封单额更能反映"封板硬不硬"，作为封板质量主指标。
 *  - 大单净比：本版不加（zjlx 实测 -1005，待权限/接口恢复）。
 *  - 列名按真实中文表头匹配（本地 API 返回正常 UTF-8），并保留 value 兜底。
 *  - 结果用 fs 写 UTF-8：modeA-result.md / modeA-raw.json（绕开 PowerShell 乱码）。
 */
import { writeFileSync, mkdirSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const TOKEN = args.token || process.env.TDX_API_KEY || process.env.TDX_API_TOKEN;
const TOP = parseInt(args.top || "20", 10);
const PROBE = !!args.probe;
const EP = process.env.TDX_API_DATA_ENDPOINT || "http://tdxhub.icfqs.com:7615/TQLEX";
if (!TOKEN) { console.error("缺少 Token：--token=TDX-xxxx 或 export TDX_API_KEY=..."); process.exit(1); }

const rawDump = {};
let HIST = null; // 归档目录 history/<日期>
function ensureHist(dateKey){ const d=`history/${dateKey}`; try{ mkdirSync(d,{recursive:true}); HIST=d; }catch(e){ console.error("建档失败:",e.message); } }
function writeBoth(name, content){ writeFileSync(name, content, "utf8"); if(HIST){ try{ writeFileSync(`${HIST}/${name}`, content, "utf8"); }catch{} } }

async function call(entry, body){
  const url = `${EP}?Entry=${encodeURIComponent(entry)}`;
  const ctrl = new AbortController(); const t = setTimeout(()=>ctrl.abort(), 20000);
  try {
    const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","token":TOKEN},body:JSON.stringify(body),signal:ctrl.signal});
    const txt = await r.text(); let json; try{json=JSON.parse(txt);}catch{json=txt;}
    return { status:r.status, json };
  } catch(e){ return { status:0, error:`${e.name}:${e.message}${e.cause?.code?` (${e.cause.code})`:""}` }; }
  finally { clearTimeout(t); }
}
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const num = v => { if(v==null) return null; const n = Number(String(v).replace(/[, ]/g,"")); return isNaN(n)?null:n; };
const fmtYi = v => { const n=num(v); return n==null?"N/A":(n>=1e8?(n/1e8).toFixed(2)+"亿":n>=1e4?(n/1e4).toFixed(0)+"万":String(n)); };
const pct = v => v==null?"N/A":(v*100).toFixed(2)+"%";
const setcodeOf = code => /^60/.test(code)?"1":/^00/.test(code)?"0":null; // 仅主板

// ---- 1) screener "涨停"：一次取全部涨停股及其封板列（按中文表头匹配）----
function detectCols(headers, row){
  const H = headers.map(String);
  const findH = (...subs)=> H.findIndex(h=> subs.some(s=> h.includes(s)));
  const c = { market:H.indexOf("market"), code:H.indexOf("sec_code"), name:H.indexOf("sec_name"),
              now:H.indexOf("now_price"), chg:H.indexOf("chg") };
  c.date      = findH("日期");
  c.fdje      = (()=>{ let i=findH("封单金额"); if(i<0) i=H.findIndex(h=>h.includes("封单")&&!h.includes("最大")); return i; })();
  c.firstTime = findH("首次涨停时间","首次封","首次");
  c.openCnt   = findH("打开次数","开板");
  c.theme     = (()=>{ let i=H.findIndex(h=>h==="涨停原因"); if(i<0) i=findH("涨停原因"); if(i<0) i=findH("题材","概念"); return i; })();
  c.boardType = findH("板型");
  c.fcb       = findH("封成比");
  // value 兜底（万一表头非中文）
  const isTime=v=>/^\d{1,2}:\d{2}:\d{2}$/.test(String(v)), isDate=v=>/^\d{4}[.\-/]\d{2}[.\-/]\d{2}$/.test(String(v));
  if(c.date<0) c.date=row.findIndex(isDate);
  if(c.firstTime<0) c.firstTime=row.findIndex(isTime);
  if(c.fdje<0 && c.date>=0) c.fdje=c.date+1;
  return c;
}
async function getLimitUps(){
  // 选股走 JNLPSE NLP 服务，偶发繁忙/宕机；自动重试 3 次（请求体固定为正确数组格式）
  let res;
  for (let attempt=1; attempt<=3; attempt++){
    res = await call("JNLPSE:wendaQuery", [{message:"涨停", rang:"AG", pageNo:"1", pageSize:"120"}]);
    if (res.status===200 && Array.isArray(res.json)) break;
    const why = res.error || `HTTP${res.status}` + (typeof res.json==="string" ? (": "+String(res.json).slice(0,80))
      : (res.json && (res.json.error||res.json.msg) ? (": "+JSON.stringify(res.json).slice(0,80)) : ""));
    console.error(`[涨停] 第 ${attempt}/3 次失败（${why}）${attempt<3?"，1.5s 后重试...":"，放弃"}`);
    if (attempt<3) await sleep(1500);
  }
  rawDump.screener_meta_headers = Array.isArray(res.json) ? res.json.slice(0,3) : res.json;
  if (res.status!==200 || !Array.isArray(res.json)) { console.error("[涨停] 选股 NLP 接口多次失败（服务可能繁忙/宕机），请稍后重跑。"); return {list:[]}; }
  const [meta, headers, , ...rows] = res.json;
  if (!rows.length) return {list:[], total:meta?.[2]};
  const cols = detectCols(headers, rows[0]);
  rawDump.screener_detectedCols = cols; rawDump.screener_firstRow = rows[0];
  const g=(r,i)=> i>=0 ? r[i] : undefined;
  const list = rows.map(r=>({
    code:String(g(r,cols.code)), name:String(g(r,cols.name)),
    now:num(g(r,cols.now)), chg:num(g(r,cols.chg)), date:g(r,cols.date),
    fdje:num(g(r,cols.fdje)), firstTime:g(r,cols.firstTime), openCnt:num(g(r,cols.openCnt)),
    theme:g(r,cols.theme), boardType:g(r,cols.boardType), fcb:num(g(r,cols.fcb)),
  })).filter(x=>x.code && x.code!=="undefined");
  return {list, total:meta?.[2]};
}

// ---- 2) 日K验证"当日首板"：当日≥9.8% 且 前两日均<9.8% ----
async function isFreshFirstBoard(code, setcode){
  const res = await call("TdxShare.PBFXT", {Head:{Target:0,CharSet:"UTF8"},Code:code,Setcode:Number(setcode),Period:4,Startxh:"0",WantNum:"6",TQFlag:"11",MPData:0,HasAttachInfo:"1",HasLtgb:"0",ForRefresh:0,HasIpoPrice:"0"});
  const items = res.json?.ListItem || res.json?.result?.ListItem;
  if (!Array.isArray(items) || items.length<4) return {ok:false};
  const cl = items.map(it=>num((it.Item||it)[5])).filter(n=>n!=null); const n=cl.length;
  const chg=(a,b)=>(cl[a]/cl[b]-1)*100;
  return { ok:true, today:chg(n-1,n-2), isFirst: chg(n-1,n-2)>=9.8 && chg(n-2,n-3)<9.8 && chg(n-3,n-4)<9.8 };
}

// ---- 3) quotes 取流通市值算封流比 ----
async function getFloatCap(code, setcode){
  const res = await call("TdxShare.PBHQInfo", {Head:{Target:"0",CharSet:"UTF8"},Code:code,Setcode:setcode,HasHQInfo:"1",HasExtInfo:"1",BspNum:"0",HasProInfo:"0",HasCalcInfo:"1",HasCwInfo:"0",HasStatInfo:"0"});
  const j=res.json||{}; const hq=j.HQInfo||{}, ext=j.ExtInfo||{}, calc=j.CalcInfo||{};
  const now = num(hq.Now) || num(hq.Close);
  let cap = num(calc.CALTZ);                                   // 流通市值(元) 优先
  if(!cap){ const ltgb=num(ext.LTGB); if(ltgb&&now) cap=ltgb*1e4*now; } // LTGB(万股)×现价
  return { cap, now, ztPrice:num(ext.ZTPrice) };
}

// ---- 4) 封板质量评分（封流比为主 + 封成比 + 开板次数 + 首封时间 + 板型）----
function qualityScore(s){
  let sc=40; const notes=[];
  const ft=String(s.firstTime||"");
  if (/^09:2[0-9]/.test(ft)||/^09:3/.test(ft)){sc+=20;notes.push("早盘封板");}
  else if (/^09:[45]/.test(ft)||/^10:[0-2]/.test(ft)){sc+=11;notes.push("上午封板");}
  else if (/^1[01]:/.test(ft)){sc+=5;notes.push("午前封板");}
  else if (/^1[3-5]:/.test(ft)){sc-=5;notes.push("下午/尾盘封板(弱)");}
  // 封流比（封板硬度主指标，阈值按 362 只首板分布重标 v3.2：中位 0.47%、P85≈1.3%；≥1.5% 才算极硬）
  if (s.fengLiu!=null){
    if (s.fengLiu>=0.015){sc+=18;notes.push("封流比≥1.5%(极硬)");}
    else if (s.fengLiu>=0.008){sc+=12;notes.push("封流比0.8-1.5%(硬)");}
    else if (s.fengLiu>=0.004){sc+=6;notes.push("封流比0.4-0.8%(中)");}
    else {sc+=1;notes.push("封流比<0.4%(偏软)");}
  } else { const yi=s.fdje!=null?s.fdje/1e8:0;          // 无封流比时退回看绝对封单
    if(yi>=5)sc+=12; else if(yi>=2)sc+=8; else if(yi>=0.5)sc+=4; }
  // 封成比（封得实不实，阈值按 362 样本分布重标 v3.2：中位 7.7、P85≈32）
  if (s.fcb!=null){ if(s.fcb>=32){sc+=6;notes.push("封成比高");} else if(s.fcb>=16){sc+=4;notes.push("封成比中");} else if(s.fcb>=8){sc+=2;notes.push("封成比偏中");} else {notes.push("封成比低");} }
  // 板型
  const bt=String(s.boardType||"");
  if (bt.includes("一字")){sc+=4;notes.push("一字板");}
  else if (bt.includes("换手")||/\bT\b/.test(bt)){sc+=8;notes.push("换手板(利接力)");}
  // 开板次数
  if (s.openCnt!=null && s.openCnt>0){sc-=Math.min(18,s.openCnt*6);notes.push(`开板${s.openCnt}次(削弱)`);}
  else if (s.openCnt===0){sc+=3;notes.push("零开板");}
  if (s.theme) sc+=4;
  return { score: Math.round(Math.max(0,Math.min(100,sc))), notes };
}
const tradable = s => String(s.boardType||"").includes("一字") ? "一字·次日多半买不进(仅监测)" : "留打板空间·可参与";

(async () => {
  const out = [];
  out.push(`# 一进二 模式A 监测池（盘后建池）`);
  out.push(`端点 ${EP}　运行 ${new Date().toLocaleString("zh-CN")}\n`);

  const {list, total} = await getLimitUps();
  if (!list.length){ out.push("未取得涨停清单（见控制台错误）。"); return finish(out); }
  const dateKey = String(list[0]?.date||"").replace(/[^0-9]/g,"") || new Date().toISOString().slice(0,10).replace(/-/g,"");
  ensureHist(dateKey);
  out.push(`涨停清单：共 ${total??list.length} 只，数据日 **${list[0]?.date||"?"}**（归档 history/${dateKey}/）。逐只验证首板并取流通市值算封流比...\n`);

  const pool=[];
  for (const s of list){
    const setcode = setcodeOf(s.code);
    if (setcode===null) continue;                 // 非主板
    if (/ST/i.test(s.name||"")) continue;          // ST
    const fb = await isFreshFirstBoard(s.code, setcode);
    if (!fb.ok || !fb.isFirst) continue;           // 仅当日首板
    const fc = await getFloatCap(s.code, setcode); // 算封流比
    s.fengLiu = (fc.cap && s.fdje!=null) ? s.fdje/fc.cap : null;
    s.floatCap = fc.cap;
    const q = qualityScore(s);
    pool.push({...s, setcode, score:q.score, notes:q.notes, tradable:tradable(s), todayChg:fb.today});
    if (PROBE && pool.length===1){ rawDump.kline_first=fb; rawDump.quotes_first=fc; }
    await sleep(40);
  }
  if (!pool.length){ out.push("无通过首板验证的标的（可能非交易日/字段需再校准）。"); return finish(out); }

  pool.sort((a,b)=> b.score-a.score);
  // 机器可读监测池，供模式B 读取（同时归档到 history/<日期>/）
  writeBoth("modeA-pool.json", JSON.stringify({date:list[0]?.date, generated:new Date().toISOString(),
    pool: pool.map(p=>({code:p.code,name:p.name,setcode:p.setcode,qualityScore:p.score,theme:p.theme,
      fdje:p.fdje,fengLiu:p.fengLiu,fcb:p.fcb,openCnt:p.openCnt,boardType:p.boardType,firstTime:p.firstTime,notes:p.notes}))},null,2));
  out.push(`## 次日竞价重点监测股（${Math.min(TOP,pool.length)}/${pool.length} 只通过首板验证）\n`);
  out.push(`| 代码 | 名称 | 涨幅% | 首封时间 | 封单金额 | 封流比 | 封成比 | 开板 | 板型 | 题材 | 质量分 | 可成交性 |`);
  out.push(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const p of pool.slice(0,TOP)){
    out.push(`| ${p.code} | ${p.name} | ${p.chg??p.todayChg?.toFixed?.(1)??""} | ${p.firstTime??"N/A"} | ${fmtYi(p.fdje)} | ${pct(p.fengLiu)} | ${p.fcb??"N/A"} | ${p.openCnt??0} | ${String(p.boardType||"盘中板").replace(/\(.*?\)/,"")} | ${p.theme??"N/A"} | ${p.score} | ${p.tradable} |`);
  }
  out.push(`\n### 首选标的（封板质量前 3）`);
  for (const p of pool.slice(0,3)){
    out.push(`- **${p.code} ${p.name}**（${p.score}分）：${p.notes.join("、")}。封流比 ${pct(p.fengLiu)}、开板 ${p.openCnt??0} 次、封成比 ${p.fcb??"N/A"}。题材：${p.theme??"N/A"}。`);
  }
  out.push(`\n> 次日 9:25-9:29 对本清单逐只取 quotes（现价/LB量比/Wtb委比/ZTPrice涨停价/BspInfo五档）做模式B 定夺；弱势退潮则停做。`);
  finish(out);
})();

function finish(lines){
  const md = lines.join("\n")+"\n";
  writeBoth("modeA-result.md", md);
  writeBoth("modeA-raw.json", JSON.stringify(rawDump,null,2));
  console.log(md);
  console.log(`\n[已写出] modeA-result.md / modeA-pool.json / modeA-raw.json（UTF-8）${HIST?`，并归档至 ${HIST}/`:""}`);
}

/* ===== QUOTES_FIELDS（实测确认，供模式B）=====
 * HQInfo.Now=现价 Close=昨收 Open=开盘 Volume=量 Amount=额 LB=量比 HSL=换手率
 * ExtInfo.ZTPrice=涨停价 DTPrice=跌停价 ZSZ=总市值 LTGB=流通股本(万股) FreeLtgb=自由流通
 * ProInfo.Wtb=委比 InOut=资金净额 YearZTDay=年内涨停天数
 * CalcInfo.CAZAF=涨幅% CALTZ=流通市值(元) CALTZZ=自由流通市值
 * BspInfo=[{BuyP,BuyV}x5]（卖档 SellP/SellV，竞价窗口内含撮合）
 * 封流比 = 封单金额(screener) / CALTZ(流通市值)
 * 高开判定: Now>=ZTPrice→已顶一字(买不进)；Now<ZTPrice 且 (Now/Close-1)∈[4.5%,7%]→可参与
 */
