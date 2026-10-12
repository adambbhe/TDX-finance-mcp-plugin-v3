# F10 数据清单（tdx_api_data 自动路由表）

> 本表 1:1 对应 `index.js` 的 `STRUCTURED_ROUTE_REGISTRY`。`tdx_api_data` 传入 `entry` + 对应判别参数（`fixedTag` / `queryKey` / `branch` / `queryType`）即自动推导 mode 与响应转换 preset，无需手写 mode。

- 上游 entry 数：**29**
- 数据路由数：**72**（`full` 已纳入自动推导校验 54 条；`partial` 18 条，未命中判别值时需显式传 mode）
- 服务器：tdxhub.icfqs.com:7615/TQLEX
- 逐条核验：`node test/probe-f10.mjs`（需环境变量 TDX_API_KEY）

## 模块概览

| 模块 | 路由数 |
|---|---|
| 公司资料 | 7 |
| 股本股东 | 17 |
| 交易资金 | 10 |
| 财务报表 | 8 |
| 估值研报 | 4 |
| 分红融资 | 13 |
| 题材行业板块 | 13 |
| **合计** | **72** |

## 公司资料（7）

| entry | 判别参数 | 数据项 | 覆盖 |
|---|---|---|---|
| `TdxSharePCCW.tdxf10_gg_zxts` | fixedTag=gsgy | 公司概要 | full |
| `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=0 | 公司基本信息 | full |
| `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=8 | 发行与交易 | full |
| `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=20 | 董监高信息 | full |
| `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=3 | 参股控股公司 | full |
| `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=4 | 员工构成 | full |
| `TdxSharePCCW.tdxf10_gg_gsgk` | fixedTag=5 | 员工效益 | full |

## 股本股东（17）

| entry | 判别参数 | 数据项 | 覆盖 |
|---|---|---|---|
| `TdxSharePCCW.tdxf10_gg_gbjg` | fixedTag=gbjg | 股本结构 | full |
| `TdxSharePCCW.tdxf10_gg_gbjg` | fixedTag=gbbd | 股本变动 | full |
| `TdxSharePCCW.tdxf10_gg_gbjg` | fixedTag=xslt | 限售解禁 | full |
| `TdxSharePCCW.tdxf10_gg_gbjg` | fixedTag=gphg | 股票回购 | full |
| `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=cgbd | 股东增减持 | full |
| `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=jgcg | 机构持股汇总 | full |
| `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=jgcgqk | 机构持股整体分布 | full |
| `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=kggd | 控股股东与实控人 | full |
| `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=gdrs | 股东人数 | full |
| `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=thygdrs | 股东人数排名 | full |
| `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=ltgd | 十大流通股东 | full |
| `TdxSharePCCW.tdxf10_gg_gdyj` | fixedTag=sdgdbgq | 十大股东 | full |
| `TdxSharePCCW.tdxf10_gg_gdyj_jgcgmx` | (无判别) | 机构持股明细 | full |
| `TdxSharePCCW.tdxf10_gg_gdyjcgmx` | fixedTag=gdjc | 股东进出详情 | full |
| `TdxSharePCCW.tdxf10_gg_gdyjcgmx` | fixedTag=gdjcmxrq | 股东进出详情-类别 | full |
| `TdxSharePCCW.tdxf10_gg_comreq` | fixedTag=jgcg(报告期) | 机构持股可用报告期 | partial |
| `TdxShareCW.ph_agf10_gbgd_jgcc` | queryKey=00101 | 机构持仓与股价对比 | partial |

## 交易资金（10）

| entry | 判别参数 | 数据项 | 覆盖 |
|---|---|---|---|
| `TdxSharePCCW.tdxf10_gg_comreq` | fixedTag=jglhb(日期) | 龙虎榜可用日期 | partial |
| `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=jglhb | 龙虎榜明细 | partial |
| `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=dzjy | 大宗交易明细 | partial |
| `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=rzrq | 融资融券 | partial |
| `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=zrq | 转融券 | partial |
| `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=zjlx | 资金流向 | partial |
| `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=ztfx | 涨停分析 | partial |
| `TdxSharePCCW.tdxf10_gg_jyds` | fixedTag=dtfx | 跌停分析 | partial |
| `TdxSharePCCW.tdxf10_gg_iyds` | fixedTag=yxsbxx | 大宗交易意向申报 | partial |
| `TdxSharePCCW.tdxf10_gg_zlcc` | fixedTag=bszj | 北向资金 | partial |

## 财务报表（8）

| entry | 判别参数 | 数据项 | 覆盖 |
|---|---|---|---|
| `TdxShareCW.ph_agf10_cw_lyb` | fixedTag=00101 | 利润表-报告期 | partial |
| `TdxShareCW.ph_agf10_cw_lyb` | fixedTag=00102 | 利润表-单季度 | partial |
| `TdxShareCW.ph_agf10_cw_xjllb` | fixedTag=00101 | 现金流量表-报告期 | partial |
| `TdxShareCW.ph_agf10_cw_xjllb` | fixedTag=00102 | 现金流量表-单季度 | partial |
| `TdxShareCW.ph_agf10_cw_zcfzb` | (无判别) | 资产负债表 | full |
| `TdxShareCW.ph_agf10_cw_zxzbxq` | (无判别) | 金融行业专项指标 | full |
| `TdxShareCW.ph_agf10_jyfx` | fixedTag=00202 | 主营构成 | full |
| `TdxSharePCCW.tdxf9_ag_cwsj_yjyj` | (无判别) | 业绩预警/预告 | full |

## 估值研报（4）

| entry | 判别参数 | 数据项 | 覆盖 |
|---|---|---|---|
| `TdxSharePCCW.tdxf10_gg_ybpj` | fixedTag=yzyq | 研报评级一致预期 | full |
| `TdxShareCW.ph_agf10_hypm` | queryKey=00102 | 行业财务排名 | partial |
| `TdxShareCW.ph_agf10_hypm` | queryKey=00105 | 行业估值排名 | partial |
| `TdxShareCW.ph_agf10_gzfx` | (无判别) | 估值历史 | full |

## 分红融资（13）

| entry | 判别参数 | 数据项 | 覆盖 |
|---|---|---|---|
| `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=pxmz | 分红与募资概览 | full |
| `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fh | 分红图 | full |
| `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=pf | 配股已实施方案与预案 | full |
| `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=zfpg | 增发获配明细 | full |
| `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=zf | 增发方案与实施 | full |
| `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fhlszs_glzfl | 分红历史走势-股利支付率 | full |
| `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fhlszs_gxl | 分红历史走势-股息率 | full |
| `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fhpm_glzfl | 分红排名-股利支付率 | full |
| `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fhpm_gxl | 分红排名-股息率 | full |
| `TdxSharePCCW.tdxf10_gg_fhrz` | fixedTag=fhpm_pxrzb | 分红排名-派现融资比 | full |
| `TdxSharePCCW.tdxf10_gg_fhrz_fh` | fixedTag=fh | 分红表 | full |
| `TdxSharePCCW.tdxf10_gg_sj` | fixedTag=qhgp | 分红视界-股票筛选 | full |
| `TdxSharePCCW.tdxf10_gg_sj` | fixedTag=fh_sj | 分红视界-对比数据 | full |

## 题材行业板块（13）

| entry | 判别参数 | 数据项 | 覆盖 |
|---|---|---|---|
| `TdxSharePCCW.tdxf10_gg_rdtc` | fixedTag=zttzbkz | 热点题材-板块族谱 | full |
| `TdxSharePCCW.tdxf10_gg_rdtc` | fixedTag=zttzztk | 热点题材-主题库 | full |
| `TdxSharePCCW.tdxf10_gg_rdtc` | fixedTag=sjcd | 热点题材-事件驱动 | full |
| `TdxSharePCCW.tdxf10_gg_rdtc` | fixedTag=xxmmg | 热点题材-信息面概览 | full |
| `TdxSharePCCW.cfg_tk_gethy` | (无判别) | 行业产业链 | full |
| `TdxSharePCCW.skef10_hy_zxdt_hyzysj` | (无判别) | 行业重要事件 | full |
| `TdxShareCW.skef10_hy_zxdt_hyzysj` | (无判别·别名) | 行业重要事件(别名) | full |
| `TdxSharePCCW.skef10_bk_cpbd_jczl` | branch=001 | 板块基础资料 | full |
| `TdxSharePCCW.skef10_bk_cpbd_jczl` | branch=002 | 板块详解 | full |
| `TdxSharePCCW.skef10_bk_cpbd_jczl` | branch=003 | 板块阶段涨幅 | full |
| `TdxSharePCCW.skef10_bk_cpbd_jczl` | branch=004 | 板块市场统计 | full |
| `TdxSharePCCW.skef10_hy_hydw_gzsppm` | queryType=01 | 个股在板块中的估值对比 | full |
| `TdxSharePCCW.skef10_hy_hydw_gzsppm` | queryType=02 | 板块或指数历史估值 | full |

## 说明

- **覆盖 full**：`resolveStructuredRoute` 会对该 entry 的判别值强校验，未命中即报错并提示可用判别值。
- **覆盖 partial**：仅覆盖已列出的判别值，传入其它值时不自动推导，需显式 `mode` + `params`。
- `TdxShareCW.skef10_hy_zxdt_hyzysj` 与 `TdxSharePCCW.skef10_hy_zxdt_hyzysj` 为同一「行业重要事件」的两种 entry 前缀写法，均可用。
- 注册表另含无前缀别名 `tdxf10_gg_sj`（=`TdxSharePCCW.tdxf10_gg_sj`，仅 `fh_sj`），与带前缀版等价，本清单不重复列出。
