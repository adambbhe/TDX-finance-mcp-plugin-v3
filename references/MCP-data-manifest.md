# TDX Finance MCP · 数据服务总表单

> 完整梳理插件对外的数据连接：服务器 → 工具（接口）→ 分类 → Entry → 判别参数（fixedTag 等）→ 数据内容。配套：`references/MCP-data-topology.svg`（拓扑图）、`MCP-data-manifest.xlsx`（多 sheet 表格）、`references/F10-catalog.md`（F10 明细）。

- 插件版本：3.3.1　|　工具数：6　|　服务器：2　|　F10 数据路由：73（29 个上游 entry）
- 鉴权：HTTP header `token`（配置 `tdxApiToken`，回退环境变量 `TDX_API_KEY`）

## 一、服务器（数据连接）

| # | 服务器 | 端点 URL | 协议 | 承载工具 | 说明 |
|---|---|---|---|---|---|
| S1 | TDX 主数据服务 | `http://tdxhub.icfqs.com:7615/TQLEX` | HTTP POST，`Entry` 走 URL Query | tdx_quotes / tdx_kline / tdx_screener / tdx_indicator_select / tdx_api_data | 行情、K线、选股、F10 基本面统一网关 |
| S2 | TDX RAG 检索服务 | `https://ai.icfqs.com:8965/v1/rag-entity-retrieve` | HTTPS POST | tdx_lookup_stock | 股票/指数/基金 代码↔名称语义检索 |

## 二、工具总览（6 个接口）

| 工具 | 服务器 | Entry | 分类 | 请求体 | 数据内容 |
|---|---|---|---|---|---|
| `tdx_quotes` | S1 | `TdxShare.PBHQInfo` | 行情 market-data | `{Head, StkInfo…}` | 实时行情快照：现价/涨跌幅、OHLC、成交量额、量比、换手率、内外盘、委比、五档、涨跌停价、总/流通市值、市盈率、股息率 |
| `tdx_kline` | S1 | `TdxShare.PBFXT` | 行情 market-data | `{Head, StkInfo…}` | K线历史（日/周/月/分钟），用于走势与回测（T+1/T+2/T+3 结果回补） |
| `tdx_screener` | S1 | `JNLPSE:wendaQuery` | 选股 screening | `{Params/自然语言}` | 自然语言智能选股（如「今日涨停且早盘封板」），返回命中股列表 |
| `tdx_indicator_select` | S1 | `NLPSE:InfoSelectV2` | 选股 indicator | `{Params 指标条件}` | 结构化金融指标条件筛选/查询 |
| `tdx_api_data` | S1 | 29 个 F10 entry（见第三节） | 基本面 core | `{Params:[…]}` | F10 全量基本面：公司/股本股东/财务/估值/分红/交易资金/题材行业板块，共 72 条数据路由 |
| `tdx_lookup_stock` | S2 | RAG retrieve | 工具 utility | `{query, …}` | 代码检索：把「宁德时代」解析成 300750 + 市场号 |

## 三、tdx_api_data · F10 数据路由（分类 / Entry / fixedTag / 数据内容）

共 72 条，按 7 大分类。判别参数：`fixedTag`（多数）/`queryKey`/`branch`/`queryType`。覆盖 `full`=命中即强校验，`partial`=仅覆盖列出值。

| 分类 | 上游 Entry | 判别参数 | 数据内容 | 覆盖 |
|---|---|---|---|---|
| 公司资料 | `TdxSharePCCW.tdxf10_gg_zxts` | fixedTag=gsgy | 公司概要 | full |
| 公司资料 | `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=0 | 公司基本信息 | full |
| 公司资料 | `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=8 | 发行与交易 | full |
| 公司资料 | `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=20 | 董监高信息 | full |
| 公司资料 | `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=3 | 参股控股公司 | full |
| 公司资料 | `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=4 | 员工构成 | full |
| 公司资料 | `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=5 | 员工效益 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gbjg` | fixedTag=gbjg | 股本结构 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gbjg` | fixedTag=gbbd | 股本变动 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gbjg` | fixedTag=xslt | 限售解禁 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gbjg` | fixedTag=gphg | 股票回购 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=cgbd | 股东增减持 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=jgcg | 机构持股汇总 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=jgcgqk | 机构持股整体分布 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=kggd | 控股股东与实控人 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=gdrs | 股东人数 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=thygdrs | 股东人数排名 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=ltgd | 十大流通股东 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=sdgdbgq | 十大股东 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyj_jgcgmx` | (无判别) | 机构持股明细 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyjcgmx` | fixedTag=gdjc | 股东进出详情 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_gdyjcgmx` | fixedTag=gdjcmxrq | 股东进出详情-类别 | full |
| 股本股东 | `TdxSharePCCW.tdxf10_gg_comreq` | fixedTag=jgcg(报告期) | 机构持股可用报告期 | partial |
| 股本股东 | `TdxShareCW.ph_agf10_gbgd_jgcc` | queryKey=00101 | 机构持仓与股价对比 | partial |
| 交易资金 | `TdxSharePCCW.tdxf10_gg_comreq` | fixedTag=jglhb(日期) | 龙虎榜可用日期 | partial |
| 交易资金 | `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=jglhb | 龙虎榜明细 | partial |
| 交易资金 | `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=dzjy | 大宗交易明细 | partial |
| 交易资金 | `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=rzrq | 融资融券 | partial |
| 交易资金 | `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=zrq | 转融券 | partial |
| 交易资金 | `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=zjlx | 资金流向 | partial |
| 交易资金 | `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=ztfx | 涨停分析 | partial |
| 交易资金 | `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=dtfx | 跌停分析 | partial |
| 交易资金 | `TdxSharePCCW.tdxf10_gg_iyds` | fixedTag=yxsbxx | 大宗交易意向申报 | partial |
| 交易资金 | `TdxSharePCCW.tdxf10_gg_zlcc` | fixedTag=bszj | 北向资金 | partial |
| 财务报表 | `TdxShareCW.ph_agf10_cw_lyb` | fixedTag=00101 | 利润表-报告期 | partial |
| 财务报表 | `TdxShareCW.ph_agf10_cw_lyb` | fixedTag=00102 | 利润表-单季度 | partial |
| 财务报表 | `TdxShareCW.ph_agf10_cw_xjllb` | fixedTag=00101 | 现金流量表-报告期 | partial |
| 财务报表 | `TdxShareCW.ph_agf10_cw_xjllb` | fixedTag=00102 | 现金流量表-单季度 | partial |
| 财务报表 | `TdxShareCW.ph_agf10_cw_zcfzb` | (无判别) | 资产负债表 | full |
| 财务报表 | `TdxShareCW.ph_agf10_cw_zxzbxq` | (无判别) | 金融行业专项指标 | full |
| 财务报表 | `TdxShareCW.ph_agf10_jyfx` | fixedTag=00202 | 主营构成 | full |
| 财务报表 | `TdxSharePCCW.tdxf9_ag_cwsj_yjyj` | (无判别) | 业绩预警/预告 | full |
| 估值研报 | `TdxSharePCCW.tdxf10_gg_ybpj` | fixedTag=yzyq | 研报评级一致预期 | full |
| 估值研报 | `TdxShareCW.ph_agf10_hypm` | queryKey=00102 | 行业财务排名 | partial |
| 估值研报 | `TdxShareCW.ph_agf10_hypm` | queryKey=00105 | 行业估值排名 | partial |
| 估值研报 | `TdxShareCW.ph_agf10_gzfx` | (无判别) | 估值历史 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=pxmz | 分红与募资概览 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fh | 分红图 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=pf | 配股已实施方案与预案 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=zfpg | 增发获配明细 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=zf | 增发方案与实施 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fhlszs_glzfl | 分红历史走势-股利支付率 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fhlszs_gxl | 分红历史走势-股息率 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fhpm_glzfl | 分红排名-股利支付率 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fhpm_gxl | 分红排名-股息率 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fhpm_pxrzb | 分红排名-派现融资比 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_fhrz_fh` | fixedTag=fh | 分红表 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_sj` | fixedTag=qhgp | 分红视界-股票筛选 | full |
| 分红融资 | `TdxSharePCCW.tdxf10_gg_sj` | fixedTag=fh_sj | 分红视界-对比数据 | full |
| 题材行业板块 | `TdxSharePCCW.tdxf10_gg_rdtc` | fixedTag=zttzbkz | 热点题材-板块族谱 | full |
| 题材行业板块 | `TdxSharePCCW.tdxf10_gg_rdtc` | fixedTag=zttzztk | 热点题材-主题库 | full |
| 题材行业板块 | `TdxSharePCCW.tdxf10_gg_rdtc` | fixedTag=sjcd | 热点题材-事件驱动 | full |
| 题材行业板块 | `TdxSharePCCW.tdxf10_gg_rdtc` | fixedTag=xxmmg | 热点题材-信息面概览 | full |
| 题材行业板块 | `TdxSharePCCW.cfg_tk_gethy` | (无判别) | 行业产业链 | full |
| 题材行业板块 | `TdxSharePCCW.skef10_hy_zxdt_hyzysj` | (无判别) | 行业重要事件 | full |
| 题材行业板块 | `TdxShareCW.skef10_hy_zxdt_hyzysj` | (无判别·别名) | 行业重要事件(别名) | full |
| 题材行业板块 | `TdxSharePCCW.skef10_bk_cpbd_jczl` | branch=001 | 板块基础资料 | full |
| 题材行业板块 | `TdxSharePCCW.skef10_bk_cpbd_jczl` | branch=002 | 板块详解 | full |
| 题材行业板块 | `TdxSharePCCW.skef10_bk_cpbd_jczl` | branch=003 | 板块阶段涨幅 | full |
| 题材行业板块 | `TdxSharePCCW.skef10_bk_cpbd_jczl` | branch=004 | 板块市场统计 | full |
| 题材行业板块 | `TdxSharePCCW.skef10_hy_hydw_gzsppm` | queryType=01 | 个股在板块中的估值对比 | full |
| 题材行业板块 | `TdxSharePCCW.skef10_hy_hydw_gzsppm` | queryType=02 | 板块或指数历史估值 | full |

### F10 分类小计

| 分类 | 路由数 |
|---|---|
| 公司资料 | 7 |
| 股本股东 | 17 |
| 交易资金 | 10 |
| 财务报表 | 8 |
| 估值研报 | 4 |
| 分红融资 | 13 |
| 题材行业板块 | 13 |
| **合计** | **72** |

## 四、备注

- Entry 一律作为 URL Query 传递（`?Entry=…`），不放在 JSON body；body 为 `{Head,…}`（行情/K线）或 `{Params:[…]}`（api_data）。
- `TdxShareCW.skef10_hy_zxdt_hyzysj` 与 `TdxSharePCCW.skef10_hy_zxdt_hyzysj` 为「行业重要事件」的两种前缀写法；另有无前缀别名 `tdxf10_gg_sj`（=`TdxSharePCCW.tdxf10_gg_sj`），本表不重复计。
- 逐条连通性核验：`node test/probe-f10.mjs`（需 `TDX_API_KEY`），生成 `test/f10-catalog-report.md`。
