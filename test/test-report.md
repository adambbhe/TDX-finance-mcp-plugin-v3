# TDX Finance MCP Plugin v3 — 测试报告

- 生成时间: 2026-10-12T03:24:39.738Z
- 测试标的: 000001  | Token: TDX-971f51…
- 工具: 6/6 可用 | F10: 26/32 可用 | 技能: ✅42 🟡2 ❌0

## 1. 核心工具

| 工具 | 状态 | 错误码/说明 | 耗时 |
|---|---|---|---|
| tdx_quotes | ✅ |  | 219ms |
| tdx_kline | ✅ |  | 92ms |
| tdx_lookup_stock | ✅ |  | 211ms |
| tdx_screener | ✅ |  | 225ms |
| tdx_indicator_select | ✅ |  | 1259ms |
| tdx_api_data | ✅ |  | 124ms |

## 2. F10 探测矩阵（规范配对）

| entry\|fixedTag | 状态 | 说明 | 耗时 |
|---|---|---|---|
| tdxf10_gg_comreq|jglhb | ✅ | 接口可达但空数据(0行) | 117ms |
| tdxf10_gg_fhrz_fh|fh | ❌ ERR | 未注册(E|-7202) | 106ms |
| tdxf10_gg_fhrz|fhlszs_gxl | ✅ |  | 204ms |
| tdxf10_gg_fhrz|fhpm_pxrzb | ✅ |  | 118ms |
| tdxf10_gg_fhrz|pxmz | ✅ |  | 88ms |
| tdxf10_gg_gbjg|gbjg | ✅ |  | 110ms |
| tdxf10_gg_gbjg|xslt | ✅ |  | 101ms |
| tdxf10_gg_gdyjcgmx|gdjc | ❌ ERR | 业务错误(ErrorCode=-1005) | 108ms |
| tdxf10_gg_gdyjcgmx|gdjcmxrq | ❌ ERR | 业务错误(ErrorCode=-1005) | 93ms |
| tdxf10_gg_gdyj|cgbd | ✅ |  | 104ms |
| tdxf10_gg_gdyj|gdrs | ✅ |  | 88ms |
| tdxf10_gg_gdyj|jgcg | ✅ |  | 128ms |
| tdxf10_gg_gdyj|jgcgqk | ✅ |  | 124ms |
| tdxf10_gg_gdyj|ltgd | ✅ |  | 131ms |
| tdxf10_gg_gsgk|0 | ✅ |  | 90ms |
| tdxf10_gg_gsgk|20 | ✅ |  | 107ms |
| tdxf10_gg_gsgk|4 | ✅ |  | 86ms |
| tdxf10_gg_gsgk|5 | ✅ |  | 111ms |
| tdxf10_gg_iyds|yxsbxx | ❌ ERR | 未注册(E|-7202) | 87ms |
| tdxf10_gg_jyds|dzjy | ✅ |  | 111ms |
| tdxf10_gg_jyds|rzrq | ✅ |  | 105ms |
| tdxf10_gg_jyds|zjlx | ✅ |  | 84ms |
| tdxf10_gg_jyds|ztfx | ✅ | 接口可达但空数据(0行) | 81ms |
| tdxf10_gg_rdtc|sjcd | ✅ |  | 112ms |
| tdxf10_gg_rdtc|zttzbkz | ✅ |  | 88ms |
| tdxf10_gg_rdtc|zttzztk | ✅ |  | 101ms |
| tdxf10_gg_sj|fh_sj | ❌ ERR | 业务错误(ErrorCode=-1005) | 91ms |
| tdxf10_gg_sj|qhgp | ❌ ERR | 业务错误(ErrorCode=-1005) | 146ms |
| tdxf10_gg_ybpj|yjyg | ✅ |  | 106ms |
| tdxf10_gg_ybpj|yzyq | ✅ |  | 91ms |
| tdxf10_gg_zlcc|bszj | ✅ |  | 113ms |
| tdxf10_gg_zxts|gsgy | ✅ |  | 91ms |

## 3. 技能可用性

| 技能 | 结论 | 依赖工具 | 依赖F10 entry |
|---|---|---|---|
| tdx-agzxsb | ✅可用 | tdx_quotes, tdx_screener |  |
| tdx-bkbj | ✅可用 | tdx_api_data, tdx_kline | tdxf10_gg_rdtc, tdxf10_gg_ybpj |
| tdx-board-cpbd | ✅可用 | tdx_api_data |  |
| tdx-board-valuation | ✅可用 | tdx_api_data |  |
| tdx-bxzjxw | ✅可用 | tdx_api_data | tdxf10_gg_zlcc |
| tdx-chltz | ✅可用 | tdx_api_data | tdxf10_gg_jyfx |
| tdx-company-info | ✅可用 | tdx_api_data | tdxf10_gg_zxts, tdxf10_gg_gsgk |
| tdx-czzdxfxjs | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline, tdx_indicator_select | tdxf10_gg_rdtc |
| tdx-dividend-financing | 🟡部分 | tdx_api_data | tdxf10_gg_fhrz, tdxf10_gg_fhrz_fh, tdxf10_gg_sj, tdxf10_gg_gdyjcgmx |
| tdx-dragon-tiger | ✅可用 | tdx_api_data | tdxf10_gg_comreq, tdxf10_gg_jyds |
| tdx-earnings-warning | ✅可用 | tdx_api_data |  |
| tdx-event-driven-short-term-catalyst | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline, tdx_screener | tdxf10_gg_rdtc |
| tdx-fhgdhb | ✅可用 | tdx_api_data |  |
| tdx-financials | ✅可用 | tdx_api_data | tdxf10_gg_gsgk |
| tdx-fsxypmsb | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline | tdxf10_gg_rdtc, tdxf10_gg_ybpj |
| tdx-ggtzljyj | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline | tdxf10_gg_ybpj |
| tdx-ggwdzk | ✅可用 | tdx_api_data, tdx_quotes, tdx_screener | tdxf10_gg_zxts, tdxf10_gg_jyds |
| tdx-ggycbfx | ✅可用 | tdx_api_data | tdxf10_gg_ybpj |
| tdx-gszddf | ✅可用 | tdx_api_data |  |
| tdx-hot-topic | ✅可用 | tdx_api_data | tdxf10_gg_rdtc |
| tdx-industry-chain | ✅可用 | tdx_api_data |  |
| tdx-industry-chain-mapping | ✅可用 | tdx_api_data, tdx_quotes, tdx_indicator_select |  |
| tdx-jgccgdfx | ✅可用 | tdx_api_data, tdx_quotes, tdx_indicator_select | tdxf10_gg_rdtc, tdxf10_gg_ybpj, tdxf10_gg_comreq, tdxf10_gg_gdyj |
| tdx-jjzcyjd | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline | tdxf10_gg_ybpj, tdxf10_gg_rdtc |
| tdx-lhbxwfg | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline, tdx_lookup_stock, tdx_screener, tdx_indicator_select | tdxf10_gg_rdtc, tdxf10_gg_ybpj, tdxf10_gg_comreq, tdxf10_gg_jyds |
| tdx-main-position | ✅可用 | tdx_api_data | tdxf10_gg_comreq, tdxf10_gg_gdyj, tdxf10_gg_gdyj_jgcgmx, tdxf10_gg_zlcc |
| tdx-mrtyjb | ✅可用 | tdx_api_data, tdx_quotes | tdxf10_gg_ybpj, tdxf10_gg_rdtc |
| tdx-position-decision | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline, tdx_screener |  |
| tdx-quant | 未知(无可测依赖) |  |  |
| tdx-report-rating | ✅可用 | tdx_api_data | tdxf10_gg_ybpj |
| tdx-share-capital | ✅可用 | tdx_api_data | tdxf10_gg_gbjg |
| tdx-shareholder-research | ✅可用 | tdx_api_data | tdxf10_gg_gdyj |
| tdx-stock-events | ✅可用 | tdx_api_data | tdxf10_gg_gdyj, tdxf10_gg_jyds, tdxf10_gg_gdyj_jgcgmx |
| tdx-tczqcxx | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline, tdx_lookup_stock, tdx_screener | tdxf10_gg_rdtc, tdxf10_gg_ybpj, tdxf10_gg_jyds |
| tdx-trade-plan | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline, tdx_indicator_select | tdxf10_gg_rdtc, tdxf10_gg_ybpj |
| tdx-trading-info | 🟡部分 | tdx_api_data | tdxf10_gg_iyds, tdxf10_gg_jyds |
| tdx-valuation-pricing-framework | ✅可用 | tdx_api_data, tdx_quotes, tdx_indicator_select | tdxf10_gg_ybpj |
| tdx-wxd-a | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline, tdx_screener | tdxf10_gg_rdtc, tdxf10_gg_ybpj |
| tdx-wxd-bk | ✅可用 | tdx_api_data, tdx_quotes, tdx_screener | tdxf10_gg_rdtc, tdxf10_gg_ybpj |
| tdx-wxd-etf | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline, tdx_screener | tdxf10_gg_rdtc |
| tdx-wxd-jj | ✅可用 | tdx_api_data, tdx_quotes, tdx_screener | tdxf10_gg_rdtc, tdxf10_gg_ybpj |
| tdx-yjygby | ✅可用 | tdx_api_data | tdxf10_gg_ybpj |
| tdx-zjftjytl | ✅可用 | tdx_api_data | tdxf10_gg_rdtc, tdxf10_gg_ybpj |
| tdx-ztltby | ✅可用 | tdx_api_data, tdx_quotes, tdx_kline, tdx_lookup_stock, tdx_screener | tdxf10_gg_rdtc, tdxf10_gg_ybpj, tdxf10_gg_jyds, tdxf10_gg_comreq |
| tdx-zzjdysyfx | ✅可用 | tdx_api_data, tdx_quotes, tdx_lookup_stock | tdxf10_gg_rdtc, tdxf10_gg_ybpj |
