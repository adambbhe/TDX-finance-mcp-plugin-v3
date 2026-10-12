# TDX Finance MCP · 接口与数据字典

> 面向 A 股行情分析与投资研究，完整梳理插件对外的**数据接口（工具/函数）**、**入参签名**与**可获取的数据内容**。
> 版本 3.3.1 ｜ 工具 6 个 ｜ 服务器 2 个 ｜ F10 数据路由 73 条（29 个上游 entry）。
> 配套：`MCP-data-manifest.md`（服务总表）、`F10-catalog.md`（F10 明细）、`MCP-data-topology.svg`（拓扑图）。

---

## 一、总体架构

| 项 | 内容 |
|---|---|
| 数据来源 | 通达信（TDX）金融数据服务 |
| 服务器数 | 2（S1 主数据网关；S2 RAG 代码检索） |
| 工具（函数）数 | 6：`tdx_quotes`、`tdx_kline`、`tdx_lookup_stock`、`tdx_screener`、`tdx_indicator_select`、`tdx_api_data` |
| 覆盖数据面 | 实时行情 · K线 · 代码检索 · 智能选股 · 指标查询 · F10 全量基本面（公司/股本股东/财务/估值/分红/交易资金/题材行业板块） |
| 鉴权 | HTTP header `token:<tdxApiToken>`，未配置时回退环境变量 `TDX_API_KEY` |

### 服务器

| # | 服务器 | 端点 | 协议 | 承载工具 |
|---|---|---|---|---|
| S1 | TDX 主数据网关 | `http://tdxhub.icfqs.com:7615/TQLEX` | HTTP POST（`Entry` 走 URL Query，body 为 JSON） | quotes / kline / screener / indicator_select / api_data |
| S2 | TDX RAG 检索 | `https://ai.icfqs.com:8965/v1/rag-entity-retrieve` | HTTPS POST | lookup_stock |

### 市场代码（setcode）约定

`1`=沪市 · `0`=深市 · `2`=北交所。**`code` 与 `setcode` 必须匹配**，否则易返回错误结果。不确定代码/市场号时先用 `tdx_lookup_stock` 解析。

---

## 二、6 个工具函数详解

### 1. `tdx_lookup_stock` — 代码检索（入口函数）
- **用途**：把中文名称/别名解析为「证券代码 + 市场号」。分析任何个股前的第一步。
- **服务器**：S2 RAG。
- **入参**：

  | 参数 | 必填 | 说明 |
  |---|---|---|
  | `query` | 是 | 实体名称或别名，如 `平安银行`、`茅台`、`腾讯`、`上证指数` |
  | `range` | 否 | 市场类型：`AG`=A股(默认) / `HK-GP`=港股股票 / `HK-JJ`=港股基金 / `JJ`=基金 / `MG-GP`=美股 / `ZS`=指数 |

- **返回数据**：`entity_code`（代码）、`entity_name`（名称）、`entity_type`（类型）、`entity_setcode`（市场号）、`aliases`（别名列表）。
- **示例**：`tdx_lookup_stock query="宁德时代"` → 300750 + setcode。

---

### 2. `tdx_quotes` — 实时行情快照
- **用途**：查询股票/指数/板块的实时行情，可按需返回基础行情、扩展信息、盘口、专业信息、财务、统计。
- **服务器/Entry**：S1 · `TdxShare.PBHQInfo`。
- **入参**：

  | 参数 | 必填 | 默认 | 说明 |
  |---|---|---|---|
  | `code` | 是 | — | 证券代码，如 `600519`/`000001`/`399001`/`880564` |
  | `setcode` | 是 | — | `1`沪 / `0`深 / `2`北 |
  | `hasHQInfo` | 否 | `1` | 基础行情 |
  | `hasExtInfo` | 否 | `1` | 扩展信息 |
  | `bspNum` | 否 | `5` | 盘口档位数（五档） |
  | `hasProInfo` | 否 | `0` | 专业信息 |
  | `hasCalcInfo` | 否 | `0` | 计算指标（置 1 时 hasHQInfo/hasExtInfo/hasProInfo 须同为 1） |
  | `hasCwInfo` | 否 | `0` | 财务信息 |
  | `hasStatInfo` | 否 | `0` | 统计信息（配合 statParam：3/5/10 天） |

- **可获取数据内容**：现价 / 涨跌幅、开高低收（OHLC）、成交量额、量比、换手率、内外盘、委比委差、五档买卖盘、涨跌停价、总市值 / 流通市值、市盈率、股息率。
- **示例**：`tdx_quotes code="600519" setcode="1"`。

---

### 3. `tdx_kline` — K 线历史
- **用途**：分钟 / 日 / 周 / 月 K 线，支持前复权 / 后复权，用于走势、技术分析与回测。
- **服务器/Entry**：S1 · `TdxShare.PBFXT`。
- **入参**：

  | 参数 | 必填 | 默认 | 说明 |
  |---|---|---|---|
  | `code` | 是 | — | 证券代码 |
  | `setcode` | 是 | — | `1`沪 / `0`深 / `2`北 |
  | `period` | 否 | `0` | 周期：`0`=5分钟 · `4`=日线 · `5`=周线 · `6`=月线 |
  | `wantNum` | 否 | `100` | 返回条数 |
  | `startxh` | 否 | `0` | 起始偏移 |
  | `tqFlag` | 否 | `11` | 复权：`0`不复权 / `11`前复权 / `12`后复权 |
  | `hasAttachInfo` | 否 | `1` | 附加信息 |
  | `hasLtgb` | 否 | `0` | 流通股本信息 |
  | `hasIpoPrice` | 否 | `0` | 发行价信息 |

- **可获取数据内容**：每根 K 线的时间、OHLC、成交量额；可附流通股本、发行价。
- **示例**：`tdx_kline code="000001" setcode="0" period="4" wantNum="120"`（平安银行近 120 日日线）。

---

### 4. `tdx_screener` — 自然语言智能选股
- **用途**：用一句话选股（技术面/资金面/形态等），返回命中股列表。
- **服务器/Entry**：S1 · `JNLPSE:wendaQuery`。
- **入参**：

  | 参数 | 必填 | 默认 | 说明 |
  |---|---|---|---|
  | `message` | 是 | — | 自然语言指令，如 `涨停`、`放量`、`主力流入`、`破位`、`金叉`、`今日涨停且早盘封板` |
  | `rang` | 否 | `AG` | 范围：`AG`A股 / `JJ`基金 / `ZS`指数 / `ZG-JJJL`基金经理 / `GG-GP`港股 |
  | `pageNo` | 否 | `1` | 页码 |
  | `pageSize` | 否 | `10` | 每页条数（建议 5–20） |

- **可获取数据内容**：符合条件的证券列表（代码、名称及相关命中字段）。

---

### 5. `tdx_indicator_select` — 金融指标查询
- **用途**：结构化查询某（些）实体的某（些）指标 / 属性 / 资料项。
- **服务器/Entry**：S1 · `NLPSE:InfoSelectV2`。
- **入参**：

  | 参数 | 必填 | 默认 | 说明 |
  |---|---|---|---|
  | `message` | 是 | — | 须同时含「查询实体」+「查询目标」。如 `贵州茅台 市盈率`、`宁德时代 主营构成`、`贵州茅台和宁德时代的市盈率、市净率`、`上证指数 估值水平`。**不支持**只写主题/概念/产业链词 |
  | `rang` | 否 | `AG` | `AG`A股个股 / `ZS`指数 / `JJ`基金 |

- **可获取数据内容**：所查实体对应指标/属性的结构化数值。
- **与 screener 区别**：screener 是"按条件找一批股票"；indicator_select 是"查指定股票的具体指标值"。

---

### 6. `tdx_api_data` — F10 全量基本面（统一路由）
- **用途**：一个函数覆盖 F10 全部基本面数据，传 `entry` + 判别参数即自动推导。共 **72 条数据路由**，分 7 大类（详见第三节）。
- **服务器**：S1（29 个上游 entry）。
- **入参**：

  | 参数 | 必填 | 说明 |
  |---|---|---|
  | `entry` | 是 | 上游 Entry 名（如 `TdxSharePCCW.tdxf10_gg_gsgk`） |
  | 判别参数 | 视路由 | `fixedTag` / `queryKey` / `branch` / `queryType`（见第三节） |
  | `code` / 报告期 / 日期 | 视路由 | 按上游接口要求 |
  | `mode` + `params` | partial 路由需要 | 覆盖=partial 且判别值未列出时，需显式传 mode 与 Params 数组 |

- **覆盖标记**：`full`=命中判别值即强校验、自动推导；`partial`=仅列出的判别值自动推导，其它需显式 mode。

---

## 三、`tdx_api_data` · F10 数据路由全表（72 条 / 7 类）

### 公司资料（7）
| 数据项 | entry | 判别参数 |
|---|---|---|
| 公司概要 | `tdxf10_gg_zxts` | fixedTag=gsgy |
| 公司基本信息 | `tdxf10_gg_gsgk` | fixedTag=0 |
| 发行与交易 | `tdxf10_gg_gsgk` | fixedTag=8 |
| 董监高信息 | `tdxf10_gg_gsgk` | fixedTag=20 |
| 参股控股公司 | `tdxf10_gg_gsgk` | fixedTag=3 |
| 员工构成 | `tdxf10_gg_gsgk` | fixedTag=4 |
| 员工效益 | `tdxf10_gg_gsgk` | fixedTag=5 |

### 股本股东（17）
| 数据项 | entry | 判别参数 |
|---|---|---|
| 股本结构 | `tdxf10_gg_gbjg` | fixedTag=gbjg |
| 股本变动 | `tdxf10_gg_gbjg` | fixedTag=gbbd |
| 限售解禁 | `tdxf10_gg_gbjg` | fixedTag=xslt |
| 股票回购 | `tdxf10_gg_gbjg` | fixedTag=gphg |
| 股东增减持 | `tdxf10_gg_gdyj` | fixedTag=cgbd |
| 机构持股汇总 | `tdxf10_gg_gdyj` | fixedTag=jgcg |
| 机构持股整体分布 | `tdxf10_gg_gdyj` | fixedTag=jgcgqk |
| 控股股东与实控人 | `tdxf10_gg_gdyj` | fixedTag=kggd |
| 股东人数 | `tdxf10_gg_gdyj` | fixedTag=gdrs |
| 股东人数排名 | `tdxf10_gg_gdyj` | fixedTag=thygdrs |
| 十大流通股东 | `tdxf10_gg_gdyj` | fixedTag=ltgd |
| 十大股东 | `tdxf10_gg_gdyj` | fixedTag=sdgdbgq |
| 机构持股明细 | `tdxf10_gg_gdyj_jgcgmx` | （无判别） |
| 股东进出详情 | `tdxf10_gg_gdyjcgmx` | fixedTag=gdjc |
| 股东进出详情-类别 | `tdxf10_gg_gdyjcgmx` | fixedTag=gdjcmxrq |
| 机构持股可用报告期 | `tdxf10_gg_comreq` | fixedTag=jgcg（partial） |
| 机构持仓与股价对比 | `ph_agf10_gbgd_jgcc` | queryKey=00101（partial） |

### 交易资金（10）
| 数据项 | entry | 判别参数 |
|---|---|---|
| 龙虎榜可用日期 | `tdxf10_gg_comreq` | fixedTag=jglhb（partial） |
| 龙虎榜明细 | `tdxf10_gg_jyds` | fixedTag=jglhb（partial） |
| 大宗交易明细 | `tdxf10_gg_jyds` | fixedTag=dzjy（partial） |
| 融资融券 | `tdxf10_gg_jyds` | fixedTag=rzrq（partial） |
| 转融券 | `tdxf10_gg_jyds` | fixedTag=zrq（partial） |
| 资金流向 | `tdxf10_gg_jyds` | fixedTag=zjlx（partial） |
| 涨停分析 | `tdxf10_gg_jyds` | fixedTag=ztfx（partial） |
| 跌停分析 | `tdxf10_gg_jyds` | fixedTag=dtfx（partial） |
| 大宗交易意向申报 | `tdxf10_gg_iyds` | fixedTag=yxsbxx（partial） |
| 北向资金 | `tdxf10_gg_zlcc` | fixedTag=bszj（partial） |

### 财务报表（8）
| 数据项 | entry | 判别参数 |
|---|---|---|
| 利润表-报告期 | `ph_agf10_cw_lyb` | fixedTag=00101（partial） |
| 利润表-单季度 | `ph_agf10_cw_lyb` | fixedTag=00102（partial） |
| 现金流量表-报告期 | `ph_agf10_cw_xjllb` | fixedTag=00101（partial） |
| 现金流量表-单季度 | `ph_agf10_cw_xjllb` | fixedTag=00102（partial） |
| 资产负债表 | `ph_agf10_cw_zcfzb` | （无判别） |
| 金融行业专项指标 | `ph_agf10_cw_zxzbxq` | （无判别） |
| 主营构成 | `ph_agf10_jyfx` | fixedTag=00202 |
| 业绩预警/预告 | `tdxf9_ag_cwsj_yjyj` | （无判别） |

### 估值研报（4）
| 数据项 | entry | 判别参数 |
|---|---|---|
| 研报评级一致预期 | `tdxf10_gg_ybpj` | fixedTag=yzyq |
| 业绩预告（原始透传） | `tdxf10_gg_ybpj` | fixedTag=yjyg |
| 行业财务排名 | `ph_agf10_hypm` | queryKey=00102（partial） |
| 行业估值排名 | `ph_agf10_hypm` | queryKey=00105（partial） |
| 估值历史 | `ph_agf10_gzfx` | （无判别） |

### 分红融资（13）
| 数据项 | entry | 判别参数 |
|---|---|---|
| 分红与募资概览 | `tdxf10_gg_fhrz` | fixedTag=pxmz |
| 分红图 | `tdxf10_gg_fhrz` | fixedTag=fh |
| 配股已实施方案与预案 | `tdxf10_gg_fhrz` | fixedTag=pf |
| 增发获配明细 | `tdxf10_gg_fhrz` | fixedTag=zfpg |
| 增发方案与实施 | `tdxf10_gg_fhrz` | fixedTag=zf |
| 分红历史走势-股利支付率 | `tdxf10_gg_fhrz` | fixedTag=fhlszs_glzfl |
| 分红历史走势-股息率 | `tdxf10_gg_fhrz` | fixedTag=fhlszs_gxl |
| 分红排名-股利支付率 | `tdxf10_gg_fhrz` | fixedTag=fhpm_glzfl |
| 分红排名-股息率 | `tdxf10_gg_fhrz` | fixedTag=fhpm_gxl |
| 分红排名-派现融资比 | `tdxf10_gg_fhrz` | fixedTag=fhpm_pxrzb |
| 分红表 | `tdxf10_gg_fhrz_fh` | fixedTag=fh |
| 分红视界-股票筛选 | `tdxf10_gg_sj` | fixedTag=qhgp |
| 分红视界-对比数据 | `tdxf10_gg_sj` | fixedTag=fh_sj |

### 题材行业板块（13）
| 数据项 | entry | 判别参数 |
|---|---|---|
| 热点题材-板块族谱 | `tdxf10_gg_rdtc` | fixedTag=zttzbkz |
| 热点题材-主题库 | `tdxf10_gg_rdtc` | fixedTag=zttzztk |
| 热点题材-事件驱动 | `tdxf10_gg_rdtc` | fixedTag=sjcd |
| 热点题材-信息面概览 | `tdxf10_gg_rdtc` | fixedTag=xxmmg |
| 行业产业链 | `cfg_tk_gethy` | （无判别） |
| 行业重要事件 | `skef10_hy_zxdt_hyzysj` | （无判别；PCCW/CW 两种前缀等价） |
| 板块基础资料 | `skef10_bk_cpbd_jczl` | branch=001 |
| 板块详解 | `skef10_bk_cpbd_jczl` | branch=002 |
| 板块阶段涨幅 | `skef10_bk_cpbd_jczl` | branch=003 |
| 板块市场统计 | `skef10_bk_cpbd_jczl` | branch=004 |
| 个股在板块中的估值对比 | `skef10_hy_hydw_gzsppm` | queryType=01 |
| 板块或指数历史估值 | `skef10_hy_hydw_gzsppm` | queryType=02 |

> 表中 entry 省略前缀 `TdxSharePCCW.` / `TdxShareCW.`，完整名见 `F10-catalog.md`。

---

## 四、按投研场景的组合用法

| 研究目标 | 建议调用链 |
|---|---|
| 单只个股全面画像 | `lookup_stock` → `quotes` + `kline` → api_data（公司概要/十大股东/利润表/估值历史/分红概览/主营构成） |
| 打板 / 短线情绪 | `screener`（涨停且早盘封板）→ api_data（涨停分析 ztfx / 龙虎榜 jglhb / 资金流向 zjlx） |
| 主力与筹码 | api_data（机构持股汇总 jgcg / 十大流通股东 ltgd / 股东人数 gdrs / 北向资金 bszj / 融资融券 rzrq） |
| 基本面价值 | api_data（利润表 / 现金流量表 / 资产负债表 / 估值历史 / 行业估值排名 / 研报一致预期） |
| 红利策略 | api_data（分红历史走势-股息率 fhlszs_gxl / 分红排名-股息率 fhpm_gxl / 派现融资比 fhpm_pxrzb） |
| 题材与产业链 | `indicator_select`（估值水平）+ api_data（板块族谱 / 主题库 / 事件驱动 / 行业产业链 / 板块阶段涨幅） |

---

## 五、注意事项
1. **鉴权**：需在插件配置 `tdxApiToken` 或环境变量 `TDX_API_KEY`。
2. **代码/市场号匹配**：`code` 与 `setcode` 必须对应；先用 `lookup_stock` 消歧。
3. **partial 路由**：判别值未在表中列出时，需显式传 `mode` + `params`。
4. **连通性自检**：`node test/probe-f10.mjs`（需 `TDX_API_KEY`）逐条核验 72 路由，生成 `test/f10-catalog-report.md`。
5. **网络**：数据服务器为 `tdxhub.icfqs.com:7615`，插件须运行在能访问该端点的本机环境。
