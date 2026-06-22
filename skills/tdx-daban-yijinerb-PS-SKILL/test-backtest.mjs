// 离线逻辑测试（无需联网）：验证 backtest.mjs 的分档(B) 与统计(aggregate)
// 运行：node test-backtest.mjs
process.env.TDX_API_KEY = process.env.TDX_API_KEY || "TEST";
const { B, aggregate } = await import("./backtest.mjs");

let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log("  ✓",m);} else {fail++;console.log("  ✗ FAIL",m);} };

console.log("== 分档 B ==");
ok(B.fengLiu(0.035)==="≥3%"&&B.fengLiu(0.02)==="1.5-3%"&&B.fengLiu(0.01)==="0.8-1.5%"&&B.fengLiu(0.005)==="<0.8%","封流比4档");
ok(B.fcb(91.6)==="≥60"&&B.fcb(46)==="30-60"&&B.fcb(20)==="<30","封成比3档");
ok(B.firstTime("09:25:00")==="早盘(<09:40)"&&B.firstTime("13:30:00")==="午后","首封时间档");
ok(B.openCnt(0)==="0次"&&B.openCnt(1)==="1次"&&B.openCnt(3)==="≥2次","开板次数档");
ok(B.board("一字板(涨停)")==="一字板"&&B.board("换手板")==="换手板"&&B.board("")==="盘中板","板型档");
ok(B.quality(95)==="≥85"&&B.quality(65)==="60-69"&&B.quality(50)==="<60","质量分档");

console.log("\n== 统计 aggregate ==");
const recs=[{fengLiu:0.035,sealed:true,touched:true,chg:10},{fengLiu:0.035,sealed:false,touched:true,chg:3},{fengLiu:0.005,sealed:false,touched:false,chg:-2}];
const a=aggregate(recs,"fengLiu",B.fengLiu); console.log("  ",JSON.stringify(a));
const hi=a.find(x=>x.bucket==="≥3%"),lo=a.find(x=>x.bucket==="<0.8%");
ok(hi.n===2&&Math.abs(hi.sealRate-0.5)<1e-9&&Math.abs(hi.avgChg-6.5)<1e-9,"≥3%档: n=2 封板率50% 均涨6.5%");
ok(lo.n===1&&lo.sealRate===0&&lo.avgChg===-2,"<0.8%档: n=1 封板率0% 均涨-2%");
ok(a[0].bucket==="≥3%","按封板率降序：高封流比在前");

console.log(`\n==== 回测器 结果：${pass} 通过 / ${fail} 失败 ====`);
process.exit(fail?1:0);
