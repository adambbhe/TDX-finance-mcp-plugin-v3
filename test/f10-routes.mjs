// F10 权威路由清单 —— 直接对应 index.js 的 STRUCTURED_ROUTE_REGISTRY
// 每条 = 一个可被 tdx_api_data 自动推导命中的 (entry, 判别值) 组合。
// coverage: "full"=已纳入自动推导校验; "partial"=部分覆盖(未命中则需显式 mode)。
// params 为该路由的官方示例入参，probe-f10.mjs 用它逐条打接口核验。
export const F10_ROUTES = [
  // ── 公司资料 ──────────────────────────────────────────────
  { cat:"公司资料", entry:"TdxSharePCCW.tdxf10_gg_zxts", sel:"fixedTag=gsgy", desc:"公司概要", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_zxts", code:"000001", fixedTag:"gsgy"} },
  { cat:"公司资料", entry:"TdxSharePCCW.tdxf10_gg_gsgk", sel:"fixedTag=0",  desc:"公司基本信息", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gsgk", fixedTag:"0",  code:"000001"} },
  { cat:"公司资料", entry:"TdxSharePCCW.tdxf10_gg_gsgk", sel:"fixedTag=8",  desc:"发行与交易", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gsgk", fixedTag:"8",  code:"000001"} },
  { cat:"公司资料", entry:"TdxSharePCCW.tdxf10_gg_gsgk", sel:"fixedTag=20", desc:"董监高信息", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gsgk", fixedTag:"20", code:"000001"} },
  { cat:"公司资料", entry:"TdxSharePCCW.tdxf10_gg_gsgk", sel:"fixedTag=3",  desc:"参股控股公司", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gsgk", fixedTag:"3",  code:"000001"} },
  { cat:"公司资料", entry:"TdxSharePCCW.tdxf10_gg_gsgk", sel:"fixedTag=4",  desc:"员工构成", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gsgk", fixedTag:"4",  code:"000001"} },
  { cat:"公司资料", entry:"TdxSharePCCW.tdxf10_gg_gsgk", sel:"fixedTag=5",  desc:"员工效益", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gsgk", fixedTag:"5",  code:"000001"} },

  // ── 股本与股东 ────────────────────────────────────────────
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gbjg", sel:"fixedTag=gbjg", desc:"股本结构", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gbjg", code:"000001", fixedTag:"gbjg"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gbjg", sel:"fixedTag=gbbd", desc:"股本变动", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gbjg", code:"000001", fixedTag:"gbbd"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gbjg", sel:"fixedTag=xslt", desc:"限售解禁", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gbjg", code:"000001", fixedTag:"xslt"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gbjg", sel:"fixedTag=gphg", desc:"股票回购", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gbjg", code:"000001", fixedTag:"gphg"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyj", sel:"fixedTag=cgbd", desc:"股东增减持", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyj", code:"000001", fixedTag:"cgbd", beginDate:"20240101", endDate:"20241231"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyj", sel:"fixedTag=jgcg", desc:"机构持股汇总", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyj", code:"000001", fixedTag:"jgcg", pageNo:"1", pageSize:"20"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyj", sel:"fixedTag=jgcgqk", desc:"机构持股整体分布", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyj", code:"000001", fixedTag:"jgcgqk", reportDate:"20241231", pageNo:"1", pageSize:"20"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyj", sel:"fixedTag=kggd", desc:"控股股东与实控人", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyj", code:"000001", fixedTag:"kggd", pageNo:"1", pageSize:"20"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyj", sel:"fixedTag=gdrs", desc:"股东人数", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyj", code:"000001", fixedTag:"gdrs", pageNo:"1", pageSize:"20"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyj", sel:"fixedTag=thygdrs", desc:"股东人数排名", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyj", code:"000001", fixedTag:"thygdrs", pageNo:"1", pageSize:"20"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyj", sel:"fixedTag=ltgd", desc:"十大流通股东", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyj", code:"000001", fixedTag:"ltgd", pageNo:"1", pageSize:"20"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyj", sel:"fixedTag=sdgdbgq", desc:"十大股东", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyj", code:"000001", fixedTag:"sdgdbgq", pageNo:"1", pageSize:"20"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyj_jgcgmx", sel:"(无判别)", desc:"机构持股明细", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyj_jgcgmx", code:"000001", sortType:"0", reportDate:"20241231", typeValue:"99"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyjcgmx", sel:"fixedTag=gdjc", desc:"股东进出详情", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyjcgmx", fixedTag:"gdjc", code:"000001", extraOne:"9900002221", extraTwo:"8000056", extraThree:"1"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_gdyjcgmx", sel:"fixedTag=gdjcmxrq", desc:"股东进出详情-类别", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_gdyjcgmx", fixedTag:"gdjcmxrq", code:"", extraOne:"9900002221", extraTwo:"8000056", extraThree:"1"} },
  { cat:"股本股东", entry:"TdxSharePCCW.tdxf10_gg_comreq", sel:"fixedTag=jgcg(报告期)", desc:"机构持股可用报告期", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_comreq", fixedTag:"jgcg", code:"000001"} },
  { cat:"交易资金", entry:"TdxSharePCCW.tdxf10_gg_comreq", sel:"fixedTag=jglhb(日期)", desc:"龙虎榜可用日期", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_comreq", fixedTag:"jglhb", code:"000001"} },
  { cat:"股本股东", entry:"TdxShareCW.ph_agf10_gbgd_jgcc", sel:"queryKey=00101", desc:"机构持仓与股价对比", cov:"partial", params:{entry:"TdxShareCW.ph_agf10_gbgd_jgcc", queryKey:"00101", code:"000001", compareFlag:"0"} },

  // ── 财务报表 ──────────────────────────────────────────────
  { cat:"财务报表", entry:"TdxShareCW.ph_agf10_cw_lyb",   sel:"fixedTag=00101", desc:"利润表-报告期", cov:"partial", params:{entry:"TdxShareCW.ph_agf10_cw_lyb", fixedTag:"00101", code:"600036"} },
  { cat:"财务报表", entry:"TdxShareCW.ph_agf10_cw_lyb",   sel:"fixedTag=00102", desc:"利润表-单季度", cov:"partial", params:{entry:"TdxShareCW.ph_agf10_cw_lyb", fixedTag:"00102", code:"600036"} },
  { cat:"财务报表", entry:"TdxShareCW.ph_agf10_cw_xjllb", sel:"fixedTag=00101", desc:"现金流量表-报告期", cov:"partial", params:{entry:"TdxShareCW.ph_agf10_cw_xjllb", fixedTag:"00101", code:"600036"} },
  { cat:"财务报表", entry:"TdxShareCW.ph_agf10_cw_xjllb", sel:"fixedTag=00102", desc:"现金流量表-单季度", cov:"partial", params:{entry:"TdxShareCW.ph_agf10_cw_xjllb", fixedTag:"00102", code:"600036"} },
  { cat:"财务报表", entry:"TdxShareCW.ph_agf10_cw_zcfzb", sel:"(无判别)", desc:"资产负债表", cov:"full", params:{entry:"TdxShareCW.ph_agf10_cw_zcfzb", code:"600036"} },
  { cat:"财务报表", entry:"TdxShareCW.ph_agf10_cw_zxzbxq", sel:"(无判别)", desc:"金融行业专项指标", cov:"full", params:{entry:"TdxShareCW.ph_agf10_cw_zxzbxq", code:"600036", extra:"20250930"} },
  { cat:"财务报表", entry:"TdxShareCW.ph_agf10_jyfx", sel:"fixedTag=00202", desc:"主营构成", cov:"full", params:{entry:"TdxShareCW.ph_agf10_jyfx", fixedTag:"00202", code:"600519", extra:"20241231"} },
  { cat:"财务报表", entry:"TdxSharePCCW.tdxf9_ag_cwsj_yjyj", sel:"(无判别)", desc:"业绩预警/预告", cov:"full", params:{entry:"TdxSharePCCW.tdxf9_ag_cwsj_yjyj", code:"000526", extra:"gssz0000526"} },

  // ── 估值与研报 ────────────────────────────────────────────
  { cat:"估值研报", entry:"TdxSharePCCW.tdxf10_gg_ybpj", sel:"fixedTag=yzyq", desc:"研报评级一致预期", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_ybpj", code:"000001", fixedTag:"yzyq"} },
  { cat:"估值研报", entry:"TdxSharePCCW.tdxf10_gg_ybpj", sel:"fixedTag=yjyg", desc:"业绩预告（服务端当前返回空表，原始透传）", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_ybpj", code:"000001", fixedTag:"yjyg"} },
  { cat:"估值研报", entry:"TdxShareCW.ph_agf10_hypm", sel:"queryKey=00102", desc:"行业财务排名", cov:"partial", params:{entry:"TdxShareCW.ph_agf10_hypm", queryKey:"00102", code:"688318", extra:"20250930"} },
  { cat:"估值研报", entry:"TdxShareCW.ph_agf10_hypm", sel:"queryKey=00105", desc:"行业估值排名", cov:"partial", params:{entry:"TdxShareCW.ph_agf10_hypm", queryKey:"00105", code:"688318", extra:"20250930"} },
  { cat:"估值研报", entry:"TdxShareCW.ph_agf10_gzfx", sel:"(无判别)", desc:"估值历史", cov:"full", params:{entry:"TdxShareCW.ph_agf10_gzfx", code:"000001", extraOne:"1Y", extraTwo:"PE"} },

  // ── 分红与融资 ────────────────────────────────────────────
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz", sel:"fixedTag=pxmz", desc:"分红与募资概览", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz", code:"000001", fixedTag:"pxmz"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz", sel:"fixedTag=fh", desc:"分红图", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz", code:"000001", fixedTag:"fh"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz", sel:"fixedTag=pf", desc:"配股已实施方案与预案", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz", code:"000001", fixedTag:"pf"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz", sel:"fixedTag=zfpg", desc:"增发获配明细", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz", code:"000001", fixedTag:"zfpg"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz", sel:"fixedTag=zf", desc:"增发方案与实施", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz", code:"000001", fixedTag:"zf"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz", sel:"fixedTag=fhlszs_glzfl", desc:"分红历史走势-股利支付率", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz", code:"601086", fixedTag:"fhlszs_glzfl"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz", sel:"fixedTag=fhlszs_gxl", desc:"分红历史走势-股息率", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz", code:"601086", fixedTag:"fhlszs_gxl"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz", sel:"fixedTag=fhpm_glzfl", desc:"分红排名-股利支付率", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz", code:"601086", fixedTag:"fhpm_glzfl"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz", sel:"fixedTag=fhpm_gxl", desc:"分红排名-股息率", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz", code:"601086", fixedTag:"fhpm_gxl"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz", sel:"fixedTag=fhpm_pxrzb", desc:"分红排名-派现融资比", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz", code:"601086", fixedTag:"fhpm_pxrzb"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_fhrz_fh", sel:"fixedTag=fh", desc:"分红表", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_fhrz_fh", code:"000001", fixedTag:"fh", extra:"1"} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_sj", sel:"fixedTag=qhgp", desc:"分红视界-股票筛选", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_sj", fixedTag:"qhgp", code:"000001", extraOne:"0", extraTwo:""} },
  { cat:"分红融资", entry:"TdxSharePCCW.tdxf10_gg_sj", sel:"fixedTag=fh_sj", desc:"分红视界-对比数据", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_sj", fixedTag:"fh_sj", code:"000001", extraOne:"0", extraTwo:"000001,600000,600016,600036,600015,601988,601398,601166"} },

  // ── 交易与资金 ────────────────────────────────────────────
  { cat:"交易资金", entry:"TdxSharePCCW.tdxf10_gg_jyds", sel:"fixedTag=jglhb", desc:"龙虎榜明细", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_jyds", code:"000001", fixedTag:"jglhb", extra:"20221129"} },
  { cat:"交易资金", entry:"TdxSharePCCW.tdxf10_gg_jyds", sel:"fixedTag=dzjy", desc:"大宗交易明细", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_jyds", code:"000001", fixedTag:"dzjy", extra:"20260107"} },
  { cat:"交易资金", entry:"TdxSharePCCW.tdxf10_gg_jyds", sel:"fixedTag=rzrq", desc:"融资融券", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_jyds", code:"000001", fixedTag:"rzrq"} },
  { cat:"交易资金", entry:"TdxSharePCCW.tdxf10_gg_jyds", sel:"fixedTag=zrq", desc:"转融券", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_jyds", code:"000001", fixedTag:"zrq"} },
  { cat:"交易资金", entry:"TdxSharePCCW.tdxf10_gg_jyds", sel:"fixedTag=zjlx", desc:"资金流向", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_jyds", code:"000001", fixedTag:"zjlx"} },
  { cat:"交易资金", entry:"TdxSharePCCW.tdxf10_gg_jyds", sel:"fixedTag=ztfx", desc:"涨停分析", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_jyds", code:"000001", fixedTag:"ztfx"} },
  { cat:"交易资金", entry:"TdxSharePCCW.tdxf10_gg_jyds", sel:"fixedTag=dtfx", desc:"跌停分析", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_jyds", code:"000001", fixedTag:"dtfx"} },
  { cat:"交易资金", entry:"TdxSharePCCW.tdxf10_gg_iyds", sel:"fixedTag=yxsbxx", desc:"大宗交易意向申报", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_iyds", code:"000001", fixedTag:"yxsbxx"} },
  { cat:"交易资金", entry:"TdxSharePCCW.tdxf10_gg_zlcc", sel:"fixedTag=bszj", desc:"北向资金", cov:"partial", params:{entry:"TdxSharePCCW.tdxf10_gg_zlcc", code:"000001", fixedTag:"bszj", date:"20241231"} },

  // ── 题材 / 行业 / 板块 ────────────────────────────────────
  { cat:"题材行业板块", entry:"TdxSharePCCW.tdxf10_gg_rdtc", sel:"fixedTag=zttzbkz", desc:"热点题材-板块族谱", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_rdtc", code:"000001", fixedTag:"zttzbkz"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.tdxf10_gg_rdtc", sel:"fixedTag=zttzztk", desc:"热点题材-主题库", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_rdtc", code:"000001", fixedTag:"zttzztk"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.tdxf10_gg_rdtc", sel:"fixedTag=sjcd", desc:"热点题材-事件驱动", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_rdtc", code:"000001", fixedTag:"sjcd"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.tdxf10_gg_rdtc", sel:"fixedTag=xxmmg", desc:"热点题材-信息面概览", cov:"full", params:{entry:"TdxSharePCCW.tdxf10_gg_rdtc", code:"000001", fixedTag:"xxmmg"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.cfg_tk_gethy", sel:"(无判别)", desc:"行业产业链", cov:"full", params:{entry:"TdxSharePCCW.cfg_tk_gethy", industryCode:"881426"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.skef10_hy_zxdt_hyzysj", sel:"(无判别)", desc:"行业重要事件", cov:"full", params:{entry:"TdxSharePCCW.skef10_hy_zxdt_hyzysj", industryCode:"881430"} },
  { cat:"题材行业板块", entry:"TdxShareCW.skef10_hy_zxdt_hyzysj", sel:"(无判别·别名)", desc:"行业重要事件(别名)", cov:"full", params:{entry:"TdxShareCW.skef10_hy_zxdt_hyzysj", industryCode:"881430"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.skef10_bk_cpbd_jczl", sel:"branch=001", desc:"板块基础资料", cov:"full", params:{entry:"TdxSharePCCW.skef10_bk_cpbd_jczl", branch:"001", code:"880976"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.skef10_bk_cpbd_jczl", sel:"branch=002", desc:"板块详解", cov:"full", params:{entry:"TdxSharePCCW.skef10_bk_cpbd_jczl", branch:"002", code:"880976"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.skef10_bk_cpbd_jczl", sel:"branch=003", desc:"板块阶段涨幅", cov:"full", params:{entry:"TdxSharePCCW.skef10_bk_cpbd_jczl", branch:"003", code:"880976", timeType:"1m"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.skef10_bk_cpbd_jczl", sel:"branch=004", desc:"板块市场统计", cov:"full", params:{entry:"TdxSharePCCW.skef10_bk_cpbd_jczl", branch:"004", code:"880976"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.skef10_hy_hydw_gzsppm", sel:"queryType=01", desc:"个股在板块中的估值对比", cov:"full", params:{entry:"TdxSharePCCW.skef10_hy_hydw_gzsppm", queryType:"01", targetCode:"881430", stockCode:"301073"} },
  { cat:"题材行业板块", entry:"TdxSharePCCW.skef10_hy_hydw_gzsppm", sel:"queryType=02", desc:"板块或指数历史估值", cov:"full", params:{entry:"TdxSharePCCW.skef10_hy_hydw_gzsppm", queryType:"02", targetCode:"881430", stockCode:""} },
];
export default F10_ROUTES;
