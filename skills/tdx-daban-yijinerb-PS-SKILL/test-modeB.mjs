// 离线逻辑测试（无需联网）：验证模式B 竞价评分 / 可成交性 / 板块梯队身位
// 运行：node test-modeB.mjs
process.env.TDX_API_KEY = process.env.TDX_API_KEY || "TEST"; // 防止 import 时 Token 检查退出
const { auctionScore, tradableB, clusterPosition } = await import("./run-modeB.mjs");

let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log("  ✓",m);} else {fail++;console.log("  ✗ FAIL",m);} };

console.log("== 测试1：竞价评分 auctionScore ==");
const a1=auctionScore({kaiPct:5.0,lb:4,wtb:60}); console.log("   黄金高开5%+量比4+委比60 =>",a1.score,a1.notes.join("、"));
ok(a1.score===100,"黄金高开+强量比+强委比=100");
const a2=auctionScore({kaiPct:5.5,lb:2,wtb:10}); ok(a2.score===80,"高开5.5%+量比2+委比10=80");
const a3=auctionScore({kaiPct:1.0,lb:0.8,wtb:-60}); console.log("   低开1%+弱量比+弱委比 =>",a3.score,a3.notes.join("、"));
ok(a3.score===0,"高开不足+量比弱+委比弱=0");

console.log("\n== 测试2：可成交性 tradableB ==");
ok(tradableB({now:11,close:10,ztPrice:11,kaiPct:10})==="竞价顶一字·买不进(仅监测)","顶一字→买不进");
ok(tradableB({now:10.5,close:10,ztPrice:11,kaiPct:5})==="可参与(黄金高开)","高开5%→可参与黄金");
ok(tradableB({now:10.1,close:10,ztPrice:11,kaiPct:1})==="高开不足·弃","高开1%→弃");

console.log("\n== 测试3：板块梯队/身位 clusterPosition ==");
const items=[
  {code:"a",theme:"无人驾驶.人形机器人.机器人概念",base:80},
  {code:"b",theme:"人形机器人.高端装备.机器人概念",base:70},
  {code:"c",theme:"机器人概念.汽车零部件",base:60},
  {code:"d",theme:"水务.国企改革",base:50},
];
clusterPosition(items);
const by=Object.fromEntries(items.map(i=>[i.code,i]));
console.log("   机器人组:",["a","b","c"].map(k=>`${k}=${by[k].position}`).join(" "),"| d:",by.d.position);
ok(by.a.hotTheme==="机器人"&&by.a.position==="龙头","a=机器人龙头(base最高)");
ok(by.b.position==="卡位","b=卡位");
ok(by.c.position==="跟风","c=跟风");
ok(by.d.position==="独票","d=独票(同题材仅1只)");
ok(by.a.posBonus===15&&by.c.posBonus===2,"身位加分 龙头15/跟风2");

console.log(`\n==== 模式B 结果：${pass} 通过 / ${fail} 失败 ====`);
process.exit(fail?1:0);
