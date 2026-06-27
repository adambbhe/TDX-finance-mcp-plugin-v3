// 离线逻辑测试（无需联网）：用真实 6/18 返回数据形状验证 v3 的解析与评分
// 运行：node test-modeA.mjs
const num = v => { if(v==null) return null; const n=Number(String(v).replace(/[, ]/g,"")); return isNaN(n)?null:n; };
const pct = v => v==null?"N/A":(v*100).toFixed(2)+"%";

function detectCols(headers, row){
  const H = headers.map(String);
  const findH = (...subs)=> H.findIndex(h=> subs.some(s=> h.includes(s)));
  const c = { market:H.indexOf("market"), code:H.indexOf("sec_code"), name:H.indexOf("sec_name"), now:H.indexOf("now_price"), chg:H.indexOf("chg") };
  c.date=findH("日期");
  c.fdje=(()=>{ let i=findH("封单金额"); if(i<0) i=H.findIndex(h=>h.includes("封单")&&!h.includes("最大")); return i; })();
  c.firstTime=findH("首次涨停时间","首次封","首次");
  c.openCnt=findH("打开次数","开板");
  c.theme=(()=>{ let i=H.findIndex(h=>h==="涨停原因"); if(i<0) i=findH("涨停原因"); if(i<0) i=findH("题材","概念"); return i; })();
  c.boardType=findH("板型");
  c.fcb=findH("封成比");
  return c;
}
function getFloatCapFrom(q){ const hq=q.HQInfo||{},ext=q.ExtInfo||{},calc=q.CalcInfo||{};
  const now=num(hq.Now)||num(hq.Close); let cap=num(calc.CALTZ);
  if(!cap){const l=num(ext.LTGB); if(l&&now) cap=l*1e4*now;} return {cap,now,ztPrice:num(ext.ZTPrice)}; }
function qualityScore(s){
  let sc=40; const notes=[]; const ft=String(s.firstTime||"");
  if(/^09:2[0-9]/.test(ft)||/^09:3/.test(ft)){sc+=20;notes.push("早盘封板");}
  else if(/^09:[45]/.test(ft)||/^10:[0-2]/.test(ft)){sc+=11;notes.push("上午封板");}
  else if(/^1[01]:/.test(ft)){sc+=5;notes.push("午前封板");}
  else if(/^1[3-5]:/.test(ft)){sc-=5;notes.push("下午/尾盘(弱)");}
  if(s.fengLiu!=null){ if(s.fengLiu>=0.015){sc+=18;notes.push("封流比≥1.5%(极硬)");} else if(s.fengLiu>=0.008){sc+=12;notes.push("封流比0.8-1.5%(硬)");} else if(s.fengLiu>=0.004){sc+=6;notes.push("封流比0.4-0.8%(中)");} else {sc+=1;notes.push("封流比<0.4%(偏软)");} }
  else { const yi=s.fdje!=null?s.fdje/1e8:0; if(yi>=5)sc+=12; else if(yi>=2)sc+=8; else if(yi>=0.5)sc+=4; }
  if(s.fcb!=null){ if(s.fcb>=32){sc+=6;notes.push("封成比高");} else if(s.fcb>=16){sc+=4;notes.push("封成比中");} else if(s.fcb>=8){sc+=2;notes.push("封成比偏中");} else notes.push("封成比低"); }
  const bt=String(s.boardType||"");
  if(bt.includes("一字")){sc+=4;notes.push("一字板");} else if(bt.includes("换手")){sc+=8;notes.push("换手板");}
  if(s.openCnt!=null&&s.openCnt>0){sc-=Math.min(18,s.openCnt*6);notes.push(`开板${s.openCnt}次`);} else if(s.openCnt===0){sc+=3;notes.push("零开板");}
  if(s.theme)sc+=4;
  return {score:Math.round(Math.max(0,Math.min(100,sc))),notes};
}

// ===== 真实 6/18 数据（取自实跑 out.txt：002167 东方锆业）=====
const headers=["POS","market","sec_code","sec_name","now_price","chg","发生日期","封单金额","首次涨停时间","最近涨停时间","涨停打开次数","涨停原因","连续涨停天数","几天","几板","原因揭秘","板型","涨停成交额","涨停最大封单额","封成比","封单额"];
const row=["1","0","002167","东方锆业","16.13","10.03","2026.06.18","417904100.00","09:25:00","09:25:00","0","新材料.锂电池概念.医疗器械概念.燃料电池.稀有金属","1","1","1","揭秘略","一字板(涨停)","45613.54","144418.81","91.6184","25908500.00"];
const quotes002167={HQInfo:{Now:16.13,Close:14.66,Volume:"282787",Amount:456136192,LB:0.3045,HSL:3.727},ExtInfo:{ZTPrice:16.13,LTGB:75871.3,ZSZ:12495479800},CalcInfo:{CALTZ:12238040100,CAZAF:10.027}};

let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log("  ✓",m);} else {fail++;console.log("  ✗ FAIL",m);} };

console.log("== 测试1：detectCols 列映射 ==");
const c=detectCols(headers,row); console.log("   映射:",JSON.stringify(c));
ok(c.fdje===7,"封单金额列=7"); ok(c.firstTime===8,"首次涨停时间列=8"); ok(c.openCnt===10,"开板次数列=10");
ok(c.theme===11,"题材列=11"); ok(c.boardType===16,"板型列=16"); ok(c.fcb===19,"封成比列=19");

console.log("\n== 测试2：行解析 ==");
const g=(i)=>i>=0?row[i]:undefined;
const s={code:g(c.code),name:g(c.name),now:num(g(c.now)),chg:num(g(c.chg)),date:g(c.date),fdje:num(g(c.fdje)),firstTime:g(c.firstTime),openCnt:num(g(c.openCnt)),theme:g(c.theme),boardType:g(c.boardType),fcb:num(g(c.fcb))};
ok(s.code==="002167"&&s.name==="东方锆业","代码/名称"); ok(s.fdje===417904100,"封单金额=4.18亿"); ok(s.firstTime==="09:25:00","首封09:25"); ok(s.openCnt===0,"开板0次"); ok(s.fcb===91.6184,"封成比91.62");

console.log("\n== 测试3：封流比计算 ==");
const fc=getFloatCapFrom(quotes002167); s.fengLiu=(fc.cap&&s.fdje!=null)?s.fdje/fc.cap:null;
console.log(`   流通市值=${(fc.cap/1e8).toFixed(2)}亿  封流比=${pct(s.fengLiu)}`);
ok(Math.abs(s.fengLiu-0.03415)<0.0005,"封流比≈3.41%");

console.log("\n== 测试4：封板质量评分 ==");
const q=qualityScore(s); console.log(`   得分=${q.score}  明细=[${q.notes.join("、")}]`);
ok(q.score===95,"002167 v3.2重标后=95(40+早盘20+封流比≥1.5%18+封成比高6+一字4+零开板3+题材4)");
ok(q.notes.includes("封流比≥1.5%(极硬)")&&q.notes.includes("零开板")&&q.notes.includes("封成比高"),"明细含三项新指标(v3.2档位)");

console.log(`\n==== 结果：${pass} 通过 / ${fail} 失败 ====`);
process.exit(fail?1:0);
