# history/ — 每日打板数据与策略结果归档

模式A、模式B 每次运行会自动把数据和选股结果按**数据日期**存到本目录，供以后回测、校准阈值使用。**不要手动删除**——样本越多，阈值校得越准。

## 目录结构

```
history/
  20260618/                     # 按数据日期(YYYYMMDD)分文件夹
    modeA-result.md             # 盘后监测池（人读）
    modeA-pool.json             # 监测池特征（机器读，供模式B + 回测）
    modeA-raw.json              # screener 原始表头/首行（字段校验/排错）
  20260619/
    modeB-result.md             # 次日竞价定夺结果（人读）
    modeB-data.json             # 每只竞价特征+评分+选择（机器读，回测核心）
```

## 各文件含义

- **modeA-pool.json**：当日全部通过首板验证的标的及其特征——封单金额、封流比、封成比、开板次数、首封时间、板型、题材、封板质量分。
- **modeB-data.json**：次日竞价对监测池逐只取数的结果——高开%、量比(LB)、委比(Wtb)、涨停价(ZTPrice)、竞价分、板块身位、综合分、可成交性、最终是否选中。

## 回测用法（用 backtest.mjs 自动跑）

`backtest.mjs` 会自动完成"特征 → 实际结果"的对齐与统计：

```
node backtest.mjs --token=TDX-xxxx
```

它做的事：
1. 遍历本目录每个 `YYYYMMDD/modeA-pool.json`，拿到每只首板的全部特征。
2. 用 `tdx_kline` 回补**次日实际结果**：次日收盘涨幅、是否封板（≥9.8%=一进二成功）、是否触板。
3. 按各特征档位（封流比/封成比/首封时间/开板次数/板型/质量分）统计**一进二成功率**与平均次日涨幅，输出 `backtest-report.md`、`backtest-samples.json`。
4. 看每个特征各档位成功率是否单调拉开 → 有区分度的阈值保留/强化，无效的调边界或降权，回填到 `references/scoring-rules.md` 与脚本。

> 样本越多越准：每个交易日都跑——收盘后 `run-modeA.mjs`、次日 9:25-9:29 `run-modeB.mjs`，让 history/ 持续累积，再定期跑 `backtest.mjs` 校准阈值。
