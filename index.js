import { Type } from "@sinclair/typebox";
//#region extensions/tdx-finance/src/plugin-config.ts
const TDX_FINANCE_PLUGIN_CONFIG_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: { tdxApiToken: {
		type: "string",
		title: "TDX API Token",
		description: "TDX API token. When configured, the plugin sends it in the HTTP header `token: <tdx-api-token>` for all tool requests. If unset, the plugin falls back to the `TDX_API_KEY` environment variable when available."
	} }
};
function readEnvVar(name) {
	try {
		const value = typeof process !== "undefined" ? process.env?.[name] : void 0;
		return typeof value === "string" && value.trim() ? value.trim() : void 0;
	} catch {
		return;
	}
}
function resolveTdxApiToken(config) {
	const value = config?.tdxApiToken;
	if (typeof value === "string" && value.trim()) return value.trim();
	return readEnvVar("TDX_API_KEY");
}
function appendTdxTokenHeader(headers, tdxApiToken) {
	if (!tdxApiToken) return headers;
	return {
		...headers,
		token: tdxApiToken
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/core/utils.ts
function getEnvVar$3(key) {
	try {
		return typeof process !== "undefined" ? process.env?.[key] : void 0;
	} catch {
		return;
	}
}
function logDebug$3(logger, message) {
	logger?.debug?.(message);
}
function json$4(payload) {
	return {
		content: [{
			type: "text",
			text: JSON.stringify(payload, null, 2)
		}],
		details: payload
	};
}
function isPlainObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function isResultSet(value) {
	return isPlainObject(value);
}
function isResultSetResponse(value) {
	return isPlainObject(value);
}
function asOptionalString$1(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
function isStringRecord(value) {
	return isPlainObject(value) && Object.values(value).every((entry) => typeof entry === "string");
}
function asNonNegativeIntegerString(value, fallback) {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.trunc(value).toString();
	if (typeof value === "string" && value.trim() !== "") {
		const trimmed = value.trim();
		if (/^\d+$/.test(trimmed)) return trimmed;
	}
	return fallback;
}
function normalizeDate$1(value) {
	const text = asOptionalString$1(value);
	if (!text) return;
	const compact = text.replace(/[^\d]/g, "");
	if (/^\d{8}$/.test(compact)) return compact;
	return text;
}
function normalizeEntry(value) {
	return asOptionalString$1(value);
}
//#endregion
//#region extensions/tdx-finance/src/api-data/core/auth.ts
function resolveAuthValue(directValue, envName) {
	const direct = asOptionalString$1(directValue);
	if (direct) return {
		value: direct,
		source: "direct"
	};
	const envKey = asOptionalString$1(envName);
	if (envKey) {
		const envValue = asOptionalString$1(getEnvVar$3(envKey));
		if (envValue) return {
			value: envValue,
			source: "env",
			env: envKey
		};
		return {
			source: "env",
			env: envKey
		};
	}
	return { source: "none" };
}
function resolveAuthHeaders(auth, tdxApiToken) {
	if (!auth || auth.mode === "none") return {
		headers: {},
		summary: {
			mode: "none",
			source: "none"
		}
	};
	if (auth.mode === "tdx") return {
		headers: appendTdxTokenHeader({}, tdxApiToken),
		summary: {
			mode: auth.mode,
			headerName: "token",
			source: "direct"
		}
	};
	const resolved = resolveAuthValue(auth.value, auth.env);
	const value = resolved.value;
	if (!value) throw new Error(auth.env ? `Cannot read auth header ${auth.headerName} from env ${auth.env}.` : `Missing auth header ${auth.headerName}. Provide auth.value or auth.env.`);
	return {
		headers: { [auth.headerName]: value },
		summary: {
			mode: auth.mode,
			headerName: auth.headerName,
			source: resolved.source,
			env: resolved.env
		}
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/core/errors.ts
function createValidationError(mode, message) {
	return {
		ok: false,
		toolName: "tdx_api_data",
		mode,
		error: {
			kind: "validation",
			message
		}
	};
}
function ensureRequiredString(name, value) {
	const normalized = asOptionalString$1(value);
	if (!normalized) throw new Error(`缺少必填参数：${name}`);
	return normalized;
}
function resolveEndpoint(context, params) {
	return normalizeEntry(params.apiEndpoint) || normalizeEntry(context.apiEndpoint) || normalizeEntry(getEnvVar$3("TDX_API_DATA_ENDPOINT")) || normalizeEntry(getEnvVar$3("TDX_API_DATE_ENDPOINT")) || normalizeEntry(getEnvVar$3("TDX_API_ENDPOINT")) || "http://tdxhub.icfqs.com:7615/TQLEX";
}
//#endregion
//#region extensions/tdx-finance/src/api-data/core/http.ts
const DEFAULT_TIMEOUT_MS$1 = 45e3;
function parseResponseBody(rawText, contentType) {
	const trimmed = rawText.trim();
	if (!trimmed) return {
		bodyType: "empty",
		data: null
	};
	if ((contentType || "").toLowerCase().includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) try {
		return {
			bodyType: "json",
			data: JSON.parse(trimmed)
		};
	} catch {
		return {
			bodyType: "text",
			data: trimmed,
			rawText: trimmed
		};
	}
	return {
		bodyType: "text",
		data: trimmed,
		rawText: trimmed
	};
}
async function postInternalApi(args) {
	const url = new URL(args.endpoint);
	url.searchParams.set("Entry", args.request.entry);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
	const abortHandler = () => controller.abort();
	if (args.signal) args.signal.addEventListener("abort", abortHandler);
	try {
		logDebug$3(args.logger, `tdx-finance: tdx_api_data request - mode=${args.request.mode}, entry=${args.request.entry}, url=${url.toString()}`);
		logDebug$3(args.logger, `tdx-finance: tdx_api_data request body - ${JSON.stringify(args.request.requestBody)}`);
		const startedAt = Date.now();
		const response = await fetch(url.toString(), {
			method: "POST",
			headers: appendTdxTokenHeader({
				"Content-Type": "application/json",
				...args.auth.headers
			}, args.tdxApiToken),
			body: JSON.stringify(args.request.requestBody),
			signal: controller.signal
		});
		const rawText = await response.text();
		const elapsedMs = Date.now() - startedAt;
		const contentType = response.headers.get("content-type");
		const responseContentType = contentType ?? void 0;
		return {
			url: url.toString(),
			elapsedMs,
			response: {
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				contentType: responseContentType,
				parsedBody: parseResponseBody(rawText, contentType)
			}
		};
	} finally {
		clearTimeout(timeout);
		if (args.signal) args.signal.removeEventListener("abort", abortHandler);
	}
}
//#endregion
//#region extensions/tdx-finance/src/api-data/presets/result-set-preset.ts
function defineResultSetPreset(getSpecs, summary) {
	return {
		get specs() {
			return getSpecs();
		},
		summary
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/board/specs.ts
const BOARD_CPBD_BASIC_INFO_FIELDS = {
	N001: "总市值",
	N002: "总股本",
	N003: "净资产收益率",
	N004: "资产负债率",
	N005: "每股收益",
	N006: "每股净资产",
	N007: "市盈率",
	N008: "市净率",
	N009: "领涨股",
	N010: "成份股数量",
	N011: "指数计算方法",
	N012: "报告总股本"
};
const BOARD_CPBD_DETAIL_FIELDS = {
	N012: "创建日期",
	N013: "板块分类",
	N014: "板块解读",
	N002: "证券代码",
	N003: "证券名称",
	N004: "关联评分",
	N005: "关联说明"
};
const BOARD_CPBD_DETAIL_ASSET_FIELDS = {
	N001: "板块代码",
	N002: "板块图标"
};
const BOARD_CPBD_STAGE_RETURN_FIELDS = {
	N001: "日期",
	N002: "板块涨幅",
	N003: "上证涨幅",
	N004: "板块排名",
	N005: "板块数量",
	N006: "板块类型",
	N007: "更新时间"
};
const BOARD_CPBD_MARKET_STATS_FIELDS = {
	N001: "交易日期",
	N002: "收盘价",
	N003: "成交额",
	N004: "上涨家数",
	N005: "下跌家数",
	N006: "5日涨幅",
	N007: "10日涨幅",
	N008: "20日涨幅",
	N009: "30日涨幅",
	N010: "1年涨幅"
};
const BOARD_CPBD_BASIC_INFO_RESULT_SET_SPECS = [{
	name: "basic_info",
	index: 0,
	fieldMap: BOARD_CPBD_BASIC_INFO_FIELDS,
	layout: "record"
}];
const BOARD_CPBD_DETAIL_RESULT_SET_SPECS = [{
	name: "board_detail",
	index: 0,
	fieldMap: BOARD_CPBD_DETAIL_FIELDS,
	headers: [
		"创建日期",
		"板块分类",
		"板块解读",
		"证券代码",
		"证券名称",
		"关联评分",
		"关联说明"
	],
	layout: "table",
	maxRows: 20
}, {
	name: "board_asset",
	index: 1,
	fieldMap: BOARD_CPBD_DETAIL_ASSET_FIELDS,
	layout: "record"
}];
const BOARD_CPBD_STAGE_RETURN_RESULT_SET_SPECS = [{
	name: "stage_return",
	index: 0,
	fieldMap: BOARD_CPBD_STAGE_RETURN_FIELDS,
	headers: [
		"日期",
		"板块涨幅",
		"上证涨幅",
		"板块排名",
		"板块数量",
		"板块类型",
		"更新时间"
	],
	layout: "table",
	maxRows: 20
}];
const BOARD_CPBD_MARKET_STATS_RESULT_SET_SPECS = [{
	name: "market_stats",
	index: 0,
	fieldMap: BOARD_CPBD_MARKET_STATS_FIELDS,
	headers: [
		"交易日期",
		"收盘价",
		"成交额",
		"上涨家数",
		"下跌家数",
		"5日涨幅",
		"10日涨幅",
		"20日涨幅",
		"30日涨幅",
		"1年涨幅"
	],
	layout: "table",
	maxRows: 20
}];
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/shared.ts
const DISPLAY_FIELD_LABELS = {
	accountingFirm: "会计师事务所",
	actualRaisedGross: "实际募资总额",
	actualRaisedNet: "实际净募资额",
	adjustingConst: "调整常数",
	adjustingFactor: "调整因子",
	affiliateName: "关联方名称",
	age: "年龄",
	alias: "别名",
	allocationCommitment: "配售承诺",
	allotmentSuccessRate: "中签率",
	amount_10k_cny: "金额(万元)",
	annualCompensation: "年度薪酬",
	asOfDate: "截至日期",
	aud100ToCny: "100澳元兑人民币",
	baseReportDate: "基准报告期",
	boardCategory: "板块分类",
	boardCode: "板块代码",
	boardCount: "板块数量",
	boardInterpretation: "板块解读",
	boardLogo: "板块图标",
	boardRank: "板块排名",
	boardReturn: "板块涨幅",
	boardSecretary: "董事会秘书",
	boardSecretaryEmail: "董秘邮箱",
	boardType: "板块类型",
	board_created_at: "板块创建日期",
	board_id: "板块编号",
	board_name: "板块名称",
	bookValuePerShare: "每股净资产",
	businessCategory: "业务分类",
	businessScope: "经营范围",
	buy_amount: "买入金额",
	buy_ratio: "买入占比",
	buyer_department: "买方营业部",
	cad100ToCny: "100加元兑人民币",
	canvasHeight: "画布高度",
	canvasWidth: "画布宽度",
	capitalUnit: "资本单位",
	category: "分类",
	chairman: "董事长",
	chairmanProfileJump: "董事长资料链接",
	chartType: "图表类型",
	chf100ToCny: "100瑞郎兑人民币",
	close: "收盘价",
	closePrice: "收盘价",
	cny100ToAed: "100人民币兑阿联酋迪拉姆",
	cny100ToDkk: "100人民币兑丹麦克朗",
	cny100ToMxn: "100人民币兑墨西哥比索",
	cny100ToMyr: "100人民币兑马来西亚林吉特",
	cny100ToNok: "100人民币兑挪威克朗",
	cny100ToPln: "100人民币兑波兰兹罗提",
	cny100ToRub: "100人民币兑俄罗斯卢布",
	cny100ToSar: "100人民币兑沙特里亚尔",
	cny100ToSek: "100人民币兑瑞典克朗",
	cny100ToTry: "100人民币兑土耳其里拉",
	cny100ToZar: "100人民币兑南非兰特",
	cny1ToHuf: "1人民币兑匈牙利福林",
	cny1ToKrw: "1人民币兑韩元",
	column_name: "栏目名称",
	companyName: "公司名称",
	companyProfile: "公司简介",
	componentCount: "成份股数量",
	config_category: "配置分类",
	consolidationLabel: "并表口径",
	contactPhone: "联系电话",
	content: "内容",
	controllingShareholder: "控股股东",
	conversionRatio: "换算比例",
	count: "数量",
	createdAt: "创建时间",
	createdDate: "创建日期",
	created_at: "创建时间",
	csrcIndustry: "证监会行业",
	currencyCode: "币种代码",
	currencyName: "币种名称",
	date: "日期",
	debtRatio: "资产负债率",
	description: "描述",
	downCount: "下跌家数",
	education: "学历",
	elementId: "元素编号",
	employeeCount: "员工人数",
	endDate: "结束日期",
	englishName: "英文名称",
	eps: "每股收益",
	esgReportTitle: "环境社会治理报告标题",
	eur100ToCny: "100欧元兑人民币",
	event_code: "事件代码",
	event_name: "事件名称",
	event_type: "事件类型",
	extendedAbbr: "扩展简称",
	firstDayClosePrice: "首日收盘价",
	firstDayCloseReturn: "首日收盘涨幅",
	firstDayOpenPrice: "首日开盘价",
	forecastEndDate: "预测截止期",
	formerNames: "曾用名",
	fxTimestamp: "汇率时间",
	gbp100ToCny: "100英镑兑人民币",
	gender: "性别",
	generalManager: "总经理",
	groupId: "分组编号",
	hasStock: "是否含个股",
	height: "高度",
	hkd100ToCny: "100港元兑人民币",
	holder_name: "股东名称",
	holder_type: "股东类型",
	holdingRatio: "持股比例",
	holding_market_value: "持股市值",
	holding_ratio: "持股比例",
	holding_shares: "持股数量",
	includedInConsolidation: "纳入合并范围",
	included_at: "收录时间",
	indexCalculationMethod: "指数计算方法",
	industryCode: "行业代码",
	investmentAmount: "投资金额",
	issuePeRatio: "发行市盈率",
	issuePrice: "发行价",
	issuePricingMethod: "发行定价方式",
	jpy100ToCny: "100日元兑人民币",
	lawFirm: "律师事务所",
	leadUnderwriter: "主承销商",
	leadingStock: "领涨股",
	legalRepresentative: "法定代表人",
	listingBoard: "上市板块",
	listingDate: "上市日期",
	listingSponsor: "上市保荐机构",
	listingStandard: "上市标准",
	logoUrl: "图标链接",
	mainBusiness: "主营业务",
	market: "市场",
	marketMakerCount: "做市商数量",
	marketMakers: "做市商",
	metricT005: "指标005",
	metricT006: "指标006",
	metricT007: "指标007",
	metricT024: "指标024",
	metricT025: "指标025",
	metricT031: "指标031",
	metricT032: "指标032",
	metricT033: "指标033",
	modifiedAt: "修改时间",
	modifiedBy: "修改人",
	mop100ToCny: "100澳门元兑人民币",
	name: "名称",
	netProfit: "净利润",
	net_amount: "净额",
	nzd100ToCny: "100新西兰元兑人民币",
	offeringMethod: "发行方式",
	offeringSystem: "发行制度",
	offeringTargets: "发行对象",
	officeAddress: "办公地址",
	page_no: "页码",
	parValuePerShare: "每股面值",
	pb: "市净率",
	pbMrq: "最新市净率",
	pcfTtm: "滚动市现率",
	pe: "市盈率",
	peLyr: "静态市盈率",
	peTtm: "滚动市盈率",
	personId: "人员编号",
	plannedRaisedAmount: "拟募资金额",
	positionCategory: "持仓分类",
	positionCode: "持仓代码",
	postIssueBookValuePerShare: "发行后每股净资产",
	preIssueBookValuePerShare: "发行前每股净资产",
	premium_discount_rate: "溢折价率",
	price: "价格",
	productLineId: "产品线编号",
	productNames: "产品名称",
	profitRatio: "利润占比",
	profitStatus: "盈利状态",
	prospectusUrl: "招股书链接",
	psTtm: "滚动市销率",
	publicIssuedShares: "公开发行股数",
	rank: "排名",
	ranking_info: "排名信息",
	reason: "原因",
	recordId: "记录编号",
	record_id: "记录编号",
	region: "地区",
	registeredAddress: "注册地址",
	registeredCapital: "注册资本",
	relatedIndices: "相关指数",
	relatedInfo: "关联信息",
	relatedListedCompanies: "关联上市公司",
	related_code: "关联代码",
	related_names: "关联名称",
	related_setcode: "关联集合代码",
	relation_score: "关联度",
	relationship: "关系",
	relevanceDescription: "关联说明",
	relevanceScore: "关联评分",
	reportUrl: "报告链接",
	report_date: "报告期",
	researchIndustry: "研究行业",
	return10d: "10日涨幅",
	return1y: "1年涨幅",
	return20d: "20日涨幅",
	return30d: "30日涨幅",
	return5d: "5日涨幅",
	revenueComponent: "收入构成",
	revenueRatio: "收入占比",
	roe: "净资产收益率",
	seat_name: "席位名称",
	securityCode: "证券代码",
	securityName: "证券名称",
	sell_amount: "卖出金额",
	sell_ratio: "卖出占比",
	seller_department: "卖方营业部",
	seriesFlag: "序列标识",
	sgd100ToCny: "100新加坡元兑人民币",
	shanghaiReturn: "上证涨幅",
	shareClass: "股份类别",
	share_change: "股份变动",
	sharesAtPeriodEnd: "期末股数",
	sharesAtPeriodStart: "期初股数",
	short_name: "简称",
	side: "方向",
	sinceListingReturn: "上市以来涨幅",
	sourceId: "来源编号",
	statusFlag: "状态标记",
	stockId: "股票编号",
	tag: "标签",
	targetId: "目标编号",
	text: "文本",
	title: "标题",
	topic_date: "题材日期",
	topic_name: "题材名称",
	totalIssueFees: "发行总费用",
	totalIssuedShares: "发行总股数",
	totalMarketValue: "总市值",
	totalShares: "总股本",
	totalSharesReported: "报告总股本",
	total_count: "总数",
	total_shares: "总股数",
	tradeDate: "交易日期",
	trade_date: "交易日期",
	tradingDay: "交易日",
	turnover: "换手率",
	turnoverAmount: "成交额",
	twd100ToCny: "100新台币兑人民币",
	type: "类型",
	unifiedSocialCreditCode: "统一社会信用代码",
	upCount: "上涨家数",
	updatedAt: "更新时间",
	usd100ToCny: "100美元兑人民币",
	value: "值",
	vertexCount: "顶点数量",
	volume_10k_shares: "成交量(万股)",
	votingRatio: "表决权比例",
	votingRights: "表决权",
	website: "网站",
	width: "宽度",
	x: "横坐标",
	y: "纵坐标"
};
const DISPLAY_FIELD_ALIASES = Object.entries(DISPLAY_FIELD_LABELS).reduce((acc, [englishKey, chineseKey]) => {
	acc[chineseKey] ??= [];
	acc[chineseKey].push(englishKey);
	return acc;
}, {});
function isDateLikeLabel(label) {
	return /(date|day|at)$/i.test(label) || /(日期|时间|报告期|截止期|公告日|交易日|更新日|创建日|上市日|解禁日|变动日)/.test(label);
}
function isCodeLikeLabel(label) {
	return /(id|flag)$/i.test(label) || /(代码|编号|标识|记录号)$/.test(label);
}
function formatCompactDate(value) {
	const raw = typeof value === "number" ? String(value) : String(value ?? "").trim();
	if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
	return typeof value === "number" ? value : raw;
}
function toDisplayValue(value, label = "") {
	if (typeof value === "number") return value;
	if (typeof value !== "string") return String(value);
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (/^0\d+$/.test(trimmed) || isCodeLikeLabel(label) || isDateLikeLabel(label)) return trimmed;
	const numeric = Number(trimmed);
	if (Number.isFinite(numeric) && (trimmed.includes(".") || trimmed.includes("e") || trimmed.includes("E") || Math.abs(numeric) <= Number.MAX_SAFE_INTEGER)) return numeric;
	return trimmed;
}
function mapResultRow(row, fieldMap) {
	const mapped = {};
	if (fieldMap) for (const [sourceKey, targetKey] of Object.entries(fieldMap)) {
		const value = row[sourceKey];
		if (value === void 0 || value === null || value === "") continue;
		mapped[targetKey] = isDateLikeLabel(targetKey) ? formatCompactDate(value) : toDisplayValue(value, targetKey);
	}
	for (const [key, value] of Object.entries(row)) {
		if (fieldMap && key in fieldMap || value === void 0 || value === null || value === "") continue;
		mapped[key] = isDateLikeLabel(key) ? formatCompactDate(value) : toDisplayValue(value, key);
	}
	return normalizeParsedRow(mapped);
}
function resultSetToRows(resultSet) {
	if (!resultSet || !Array.isArray(resultSet.ColName) || !Array.isArray(resultSet.Content)) return [];
	return resultSet.Content.filter((row) => Array.isArray(row)).map((row) => {
		const mapped = {};
		resultSet.ColName?.forEach((columnName, index) => {
			mapped[columnName] = row[index];
		});
		return mapped;
	});
}
function objectRowToDisplayRow(row) {
	const mapped = {};
	for (const [key, value] of Object.entries(row)) if (value !== void 0 && value !== null && value !== "") mapped[key] = toDisplayValue(value, key);
	return normalizeParsedRow(mapped);
}
function transformArrayPayload(rawData, specs) {
	if (!Array.isArray(rawData) || rawData.length === 0 || specs.length === 0) return [];
	const spec = specs[0];
	const objectRows = rawData.filter((row) => isPlainObject(row));
	if (objectRows.length === rawData.length) return [{
		name: spec.name,
		rows: objectRows.map((row) => mapResultRow(row, spec.fieldMap)),
		headers: spec.headers,
		layout: spec.layout,
		maxRows: spec.maxRows,
		index: spec.index ?? 0
	}];
	const scalarRows = rawData.filter((row) => !Array.isArray(row) && !isPlainObject(row));
	if (scalarRows.length === rawData.length) return [{
		name: spec.name,
		rows: scalarRows.map((value) => ({ value: toDisplayValue(value, "value") })),
		headers: ["值"],
		layout: "table",
		maxRows: spec.maxRows,
		index: spec.index ?? 0
	}];
	const arrayRows = rawData.filter((row) => Array.isArray(row));
	if (arrayRows.length >= 2) {
		const headerRow = arrayRows[0];
		if (headerRow.every((cell) => typeof cell === "string")) {
			const rows = arrayRows.slice(1).map((row) => {
				const mapped = {};
				headerRow.forEach((header, index) => {
					mapped[String(header)] = row[index];
				});
				return mapResultRow(mapped, spec.fieldMap);
			});
			return [{
				name: spec.name,
				rows,
				headers: spec.headers,
				layout: spec.layout,
				maxRows: spec.maxRows,
				index: spec.index ?? 0
			}];
		}
	}
	return [];
}
function getFirstRowValue(table, key) {
	const firstRow = table?.rows[0];
	if (!firstRow) return;
	if (key in firstRow) return firstRow[key];
	const displayKey = DISPLAY_FIELD_LABELS[key] ?? key;
	if (displayKey in firstRow) return firstRow[displayKey];
	for (const alias of DISPLAY_FIELD_ALIASES[key] ?? []) if (alias in firstRow) return firstRow[alias];
}
function nonEmptyParts(parts) {
	return parts.map((part) => String(part ?? "").trim()).filter(Boolean);
}
function readRawCacheInfo(rawData) {
	return {
		hitCache: isResultSetResponse(rawData) ? typeof rawData.hitCache === "boolean" ? rawData.hitCache : typeof rawData.HitCache === "string" ? rawData.HitCache : void 0 : void 0,
		errorCode: isResultSetResponse(rawData) && typeof rawData.ErrorCode === "number" ? rawData.ErrorCode : void 0
	};
}
function mapSelectedRow(row, fieldMap) {
	const mapped = {};
	for (const [sourceKey, targetKey] of Object.entries(fieldMap)) {
		const value = row[sourceKey];
		if (value === void 0 || value === null || value === "") continue;
		mapped[targetKey] = isDateLikeLabel(targetKey) ? formatCompactDate(value) : toDisplayValue(value, targetKey);
	}
	return normalizeParsedRow(mapped);
}
function mapSelectedRowPreserveUnknown(row, fieldMap) {
	const mapped = mapSelectedRow(row, fieldMap);
	for (const [key, value] of Object.entries(row)) {
		if (key in fieldMap || value === void 0 || value === null || value === "") continue;
		mapped[key] = isDateLikeLabel(key) ? formatCompactDate(value) : toDisplayValue(value, key);
	}
	return normalizeParsedRow(mapped);
}
function collectObjectRows(input) {
	if (!Array.isArray(input)) return [];
	return input.filter((row) => !!row && typeof row === "object" && !Array.isArray(row));
}
function findResultSetByKey(resultSets, key, fallbackIndex) {
	const matched = resultSets.find((resultSet) => resultSet.ResultSetKey === key);
	if (matched) return matched;
	if (fallbackIndex === void 0) return;
	const candidate = resultSets[fallbackIndex];
	return isResultSet(candidate) ? candidate : void 0;
}
function mapFirstResultRow(resultSets, key, fieldMap, fallbackIndex) {
	const rows = resultSetToRows(findResultSetByKey(resultSets, key, fallbackIndex));
	if (rows.length === 0) return {};
	return mapSelectedRowPreserveUnknown(rows[0], fieldMap);
}
function collectMappedRows(resultSets, key, fieldMap, fallbackIndex) {
	return resultSetToRows(findResultSetByKey(resultSets, key, fallbackIndex)).map((row) => mapSelectedRowPreserveUnknown(row, fieldMap));
}
function parseSequentialResultTables(rawData, resultSets) {
	if (!isResultSetResponse(rawData) || !Array.isArray(rawData.ResultSets)) return null;
	const { hitCache, errorCode } = readRawCacheInfo(rawData);
	return {
		tables: rawData.ResultSets.map((resultSet, index) => {
			const spec = resultSets[index] ?? {
				name: resultSet.ResultSetKey || `table${index}`,
				layout: "table"
			};
			return {
				name: spec.name,
				rows: isResultSet(resultSet) ? resultSetToRows(resultSet).map((row) => spec.fieldMap ? mapSelectedRowPreserveUnknown(row, spec.fieldMap) : mapResultRow(row)) : [],
				headers: spec.headers,
				layout: spec.layout,
				maxRows: spec.maxRows
			};
		}),
		hitCache,
		errorCode
	};
}
function countDistinctValues(rows, key) {
	return new Set(rows.map((row) => String(row[key] ?? "").trim()).filter(Boolean)).size;
}
function formatPercentValue(value) {
	if (value === void 0 || value === null || value === "") return;
	return typeof value === "number" ? `${value}%` : String(value);
}
function normalizeCompactOrDashedDate(value) {
	if (!value?.trim()) return;
	const trimmed = value.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
	if (/^\d{8}$/.test(trimmed)) return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
	return trimmed;
}
function normalizeParsedRow(row) {
	const normalized = {};
	for (const [key, value] of Object.entries(row)) {
		if (value === void 0 || value === null || value === "") continue;
		const displayKey = DISPLAY_FIELD_LABELS[key] ?? key;
		const finalKey = displayKey in normalized && displayKey !== key ? `${displayKey}(${key})` : displayKey;
		const finalValue = typeof value === "number" || typeof value === "string" ? value : toDisplayValue(value, key);
		normalized[finalKey] = finalValue;
		const aliases = new Set(DISPLAY_FIELD_ALIASES[finalKey] ?? []);
		if (finalKey !== key) aliases.add(key);
		for (const alias of aliases) {
			if (alias === finalKey) continue;
			Object.defineProperty(normalized, alias, {
				value: finalValue,
				enumerable: false,
				configurable: true,
				writable: true
			});
		}
	}
	return normalized;
}
function normalizeParsedTable(table) {
	return {
		name: table.name,
		rows: Array.isArray(table.rows) ? table.rows.map((row) => normalizeParsedRow(row)) : [],
		headers: table.headers?.map((header) => DISPLAY_FIELD_LABELS[header] ?? header),
		layout: table.layout,
		maxRows: table.maxRows,
		resultSetKey: table.resultSetKey,
		index: table.index
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/board/summary.ts
function buildBoardCpbdBasicInfoSummary(tables) {
	const leadingStock = String(getFirstRowValue(tables[0], "leadingStock") ?? "").trim();
	const componentCount = String(getFirstRowValue(tables[0], "componentCount") ?? "").trim();
	const pe = String(getFirstRowValue(tables[0], "pe") ?? "").trim();
	const pb = String(getFirstRowValue(tables[0], "pb") ?? "").trim();
	const parts = nonEmptyParts([
		leadingStock ? `领涨股 ${leadingStock}` : void 0,
		componentCount ? `成份股 ${componentCount} 只` : void 0,
		pe ? `PE ${pe}` : void 0,
		pb ? `PB ${pb}` : void 0
	]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildBoardCpbdDetailSummary(tables) {
	const boardCategory = String(getFirstRowValue(tables[0], "boardCategory") ?? "").trim();
	const createdDate = String(getFirstRowValue(tables[0], "createdDate") ?? "").trim();
	const relatedRows = tables[0]?.rows.length ?? 0;
	const parts = nonEmptyParts([
		boardCategory || void 0,
		createdDate ? `创建于 ${String(formatCompactDate(createdDate))}` : void 0,
		relatedRows > 0 ? `关联证券 ${relatedRows} 条` : void 0
	]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildBoardCpbdStageReturnSummary(tables) {
	const rowCount = tables[0]?.rows.length ?? 0;
	const latestUpdatedAt = String(getFirstRowValue(tables[0], "updatedAt") ?? getFirstRowValue(tables[0], "date") ?? "").trim();
	const parts = nonEmptyParts([latestUpdatedAt ? `最新 ${String(formatCompactDate(latestUpdatedAt))}` : void 0, rowCount > 0 ? `阶段记录 ${rowCount} 条` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildBoardCpbdMarketStatsSummary(tables) {
	const rowCount = tables[0]?.rows.length ?? 0;
	const latestTradeDate = String(getFirstRowValue(tables[0], "tradeDate") ?? "").trim();
	const parts = nonEmptyParts([latestTradeDate ? `最新交易日 ${String(formatCompactDate(latestTradeDate))}` : void 0, rowCount > 0 ? `统计记录 ${rowCount} 条` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/company/summary.ts
function buildCompanyBasicInfoSummary(tables, code) {
	const basicRow = tables[0]?.rows[0] ?? {};
	const companyName = String(basicRow.companyName ?? code);
	const businessCount = tables[1]?.rows.length ?? 0;
	const esgCount = tables[2]?.rows.length ?? 0;
	const parts = [businessCount > 0 ? `${businessCount} business lines` : "", esgCount > 0 ? `${esgCount} ESG reports` : ""].filter(Boolean);
	return `${companyName} (${code}) basic info${parts.length > 0 ? ` - ${parts.join(", ")}` : ""}`;
}
function buildCompanyIssuanceTradingSummary(tables, code) {
	const row = tables[0]?.rows[0] ?? {};
	const listingDate = String(row.listingDate ?? "").trim();
	const parts = [
		String(row.shareClass ?? "").trim(),
		listingDate,
		String(row.listingBoard ?? "").trim()
	].filter(Boolean);
	return `${code} issuance and trading${parts.length > 0 ? ` - ${parts.join(" | ")}` : ""}`;
}
function buildCompanyExecutivesSummary(tables, code) {
	return `${code} executives - ${tables[0]?.rows.length ?? 0} people, ${tables[1]?.rows.length ?? 0} category summaries`;
}
function buildCompanyAffiliatesSummary(tables, code) {
	const affiliateCount = tables[0]?.rows.length ?? 0;
	const fxDate = String((tables[1]?.rows[0] ?? {}).asOfDate ?? "").trim();
	return `${code} affiliates - ${affiliateCount} companies${fxDate ? `, fx as of ${fxDate}` : ""}`;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/company/specs.ts
const COMPANY_GSGK_BASIC_INFO_FIELDS = {
	imgsrc: "图标链接",
	T003: "公司名称",
	T038: "地区",
	T006: "英文名称",
	url: "网站",
	yjhy: "研究行业",
	shxydm: "统一社会信用代码",
	T040: "证监会行业",
	glss: "关联上市公司",
	glxx: "关联信息",
	kwjc: "扩展简称",
	T005: "曾用名",
	bkzs: "相关指数",
	T017: "主营业务",
	cpmc: "产品名称",
	T036: "控股股东",
	T008: "法定代表人",
	T030: "总经理",
	T023: "董事会秘书",
	dsz: "董事长",
	dszjj: "董事长资料链接",
	T010: "注册资本",
	dw: "资本单位",
	ygzs: "员工人数",
	T024: "联系电话",
	T026: "董秘邮箱",
	T028: "会计师事务所",
	T029: "律师事务所",
	T009: "注册地址",
	T012: "办公地址",
	T019: "公司简介",
	T018: "经营范围"
};
const COMPANY_GSGK_BASIC_INFO_BUSINESS_FIELDS = {
	T003: "业务分类",
	N002: "收入构成",
	N004: "收入占比",
	N008: "利润占比"
};
const COMPANY_GSGK_ESG_REPORT_FIELDS = {
	N035: "环境社会治理报告标题",
	Url: "报告链接"
};
const COMPANY_GSGK_ISSUANCE_TRADING_FIELDS = {
	T035: "股份类别",
	T031: "上市日期",
	T051: "发行方式",
	tpq: "表决权",
	ylzt: "盈利状态",
	zhbl: "换算比例",
	ssbk: "上市板块",
	ssbz: "上市标准",
	fxzd: "发行制度",
	mgmz: "每股面值",
	T046: "发行前每股净资产",
	T048: "发行定价方式",
	T042: "发行价",
	T047: "发行后每股净资产",
	T043: "发行市盈率",
	T044: "发行总股数",
	T056: "实际募资总额",
	T058: "中签率",
	T045: "公开发行股数",
	yjmjzj: "拟募资金额",
	T057: "实际净募资额",
	T050: "发行总费用",
	T059: "首日开盘价",
	T060: "首日收盘价",
	syl: "首日收盘涨幅",
	zgsms: "招股书链接",
	zcxs: "主承销商",
	bjr: "上市保荐机构",
	T049: "发行对象",
	T054: "配售承诺",
	zss: "做市商",
	zsszs: "做市商数量",
	ssylzf: "上市以来涨幅"
};
const COMPANY_GSGK_EXECUTIVE_FIELDS = {
	T002: "名称",
	T015: "标题",
	T005: "日期",
	T006: "性别",
	T008: "学历",
	nncj: "年龄",
	T010: "年度薪酬",
	T011: "期初股数",
	T012: "期末股数",
	T014: "人员编号",
	rec_id: "记录编号",
	T003: "持仓分类",
	T004: "持仓代码"
};
const COMPANY_GSGK_EXECUTIVE_SUMMARY_FIELDS = {
	T003: "持仓分类",
	zs: "数量"
};
const COMPANY_GSGK_AFFILIATE_FIELDS = {
	glgs: "关联方名称",
	ckgx: "关系",
	T009: "币种代码",
	sT009: "币种名称",
	cgbl: "持股比例",
	T007: "表决权比例",
	tzje: "投资金额",
	jly: "净利润",
	rec_id: "记录编号",
	T012: "主营业务",
	T011: "纳入合并范围",
	hbbb: "并表口径"
};
const COMPANY_GSGK_EXCHANGE_RATE_FIELDS = {
	mx: "截至日期",
	T001: "汇率时间",
	T002: "100美元兑人民币",
	T003: "100欧元兑人民币",
	T004: "100日元兑人民币",
	T005: "100港元兑人民币",
	T006: "100英镑兑人民币",
	T007: "100人民币兑马来西亚林吉特",
	T008: "100人民币兑俄罗斯卢布",
	T009: "100澳元兑人民币",
	T010: "100加元兑人民币",
	T011: "100新西兰元兑人民币",
	T012: "100新加坡元兑人民币",
	T013: "100瑞郎兑人民币",
	T014: "100人民币兑南非兰特",
	T015: "1人民币兑韩元",
	T016: "100人民币兑阿联酋迪拉姆",
	T017: "100人民币兑沙特里亚尔",
	T018: "1人民币兑匈牙利福林",
	T019: "100人民币兑波兰兹罗提",
	T020: "100人民币兑丹麦克朗",
	T021: "100人民币兑瑞典克朗",
	T022: "100人民币兑挪威克朗",
	T023: "100人民币兑土耳其里拉",
	T024: "100人民币兑墨西哥比索",
	T025: "100新台币兑人民币",
	T026: "100澳门元兑人民币"
};
const COMPANY_BASIC_INFO_SPEC = {
	toolName: "company_basic_info",
	fixedTag: "0",
	resultSets: [
		{
			name: "basic_info",
			fieldMap: COMPANY_GSGK_BASIC_INFO_FIELDS,
			layout: "record"
		},
		{
			name: "business_breakdown",
			fieldMap: COMPANY_GSGK_BASIC_INFO_BUSINESS_FIELDS,
			headers: [
				"业务分类",
				"收入构成",
				"收入占比",
				"利润占比"
			],
			layout: "table",
			maxRows: 10
		},
		{
			name: "esg_reports",
			fieldMap: COMPANY_GSGK_ESG_REPORT_FIELDS,
			headers: ["环境社会治理报告标题", "报告链接"],
			layout: "table",
			maxRows: 10
		}
	],
	buildSummary: buildCompanyBasicInfoSummary
};
const COMPANY_ISSUANCE_TRADING_SPEC = {
	toolName: "company_issuance_trading",
	fixedTag: "8",
	resultSets: [{
		name: "issuance_and_trading",
		fieldMap: COMPANY_GSGK_ISSUANCE_TRADING_FIELDS,
		headers: [
			"股份类别",
			"上市日期",
			"发行方式",
			"表决权",
			"盈利状态",
			"换算比例",
			"上市板块",
			"上市标准",
			"发行制度",
			"每股面值",
			"发行前每股净资产",
			"发行定价方式",
			"发行价",
			"发行后每股净资产",
			"发行市盈率",
			"发行总股数",
			"实际募资总额",
			"中签率",
			"公开发行股数",
			"拟募资金额",
			"实际净募资额",
			"发行总费用",
			"首日开盘价",
			"首日收盘价",
			"首日收盘涨幅",
			"招股书链接",
			"主承销商",
			"上市保荐机构",
			"发行对象",
			"配售承诺",
			"做市商",
			"做市商数量",
			"上市以来涨幅"
		],
		layout: "table",
		maxRows: 10
	}],
	buildSummary: buildCompanyIssuanceTradingSummary
};
const COMPANY_EXECUTIVES_SPEC = {
	toolName: "company_executives",
	fixedTag: "20",
	resultSets: [{
		name: "executives",
		fieldMap: COMPANY_GSGK_EXECUTIVE_FIELDS,
		headers: [
			"名称",
			"标题",
			"日期",
			"性别",
			"学历",
			"年龄",
			"年度薪酬",
			"期初股数",
			"期末股数",
			"人员编号"
		],
		layout: "table",
		maxRows: 20
	}, {
		name: "position_summary",
		fieldMap: COMPANY_GSGK_EXECUTIVE_SUMMARY_FIELDS,
		headers: ["持仓分类", "数量"],
		layout: "table",
		maxRows: 10
	}],
	buildSummary: buildCompanyExecutivesSummary
};
const COMPANY_AFFILIATES_SPEC = {
	toolName: "company_affiliates",
	fixedTag: "3",
	resultSets: [{
		name: "affiliates",
		fieldMap: COMPANY_GSGK_AFFILIATE_FIELDS,
		headers: [
			"关联方名称",
			"关系",
			"币种代码",
			"币种名称",
			"持股比例",
			"表决权比例",
			"投资金额",
			"净利润",
			"主营业务",
			"并表口径"
		],
		layout: "table",
		maxRows: 20
	}, {
		name: "exchange_rates",
		fieldMap: COMPANY_GSGK_EXCHANGE_RATE_FIELDS,
		layout: "record"
	}],
	buildSummary: buildCompanyAffiliatesSummary
};
//#endregion
//#region extensions/tdx-finance/src/api-data/presets/helpers.ts
function buildTransformedFromParsed(parser, parsed) {
	if (!parsed || !Array.isArray(parsed.tables) || parsed.tables.length === 0) return;
	return {
		parser,
		summary: parsed.summary,
		tables: parsed.tables.map((table) => normalizeParsedTable(table)),
		hitCache: parsed.hitCache,
		errorCode: parsed.errorCode
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/company/parser.ts
function parseCompanyGsgkResult(rawData, toolSpec, params) {
	const parsed = parseSequentialResultTables(rawData, toolSpec.resultSets);
	if (!parsed) return null;
	return {
		toolName: toolSpec.toolName,
		code: params.code.trim(),
		fixedTag: toolSpec.fixedTag,
		summary: toolSpec.buildSummary(parsed.tables, params.code.trim()),
		tables: parsed.tables,
		hitCache: parsed.hitCache,
		errorCode: parsed.errorCode
	};
}
function createCompanyGsgkPresetTransform(preset, getSpec) {
	return (rawData, request) => {
		const code = asOptionalString$1(String(request.code ?? "")) ?? "";
		return buildTransformedFromParsed(preset, parseCompanyGsgkResult(rawData, getSpec(), { code }));
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/company-overview/specs.ts
const COMPANY_OVERVIEW_BASIC_FIELDS = {
	kfjlr: "扣非净利润(元)",
	jqjzcsyl: "加权净资产收益率(%)",
	jjrq: "解禁日期",
	gsdw: "公司地位"
};
const COMPANY_OVERVIEW_BUSINESS_FIELDS = {
	T017: "主营业务",
	hy1: "一级行业",
	hy2: "二级行业"
};
const COMPANY_OVERVIEW_RELATED_THEME_FIELDS = {
	rec_id: "记录号",
	T002: "关联主题",
	T001: "主题编号"
};
const COMPANY_OVERVIEW_TAG_FIELDS = {
	T060: "标签一",
	T061: "标签二",
	T062: "标签三",
	T063: "标签四",
	T064: "标签五",
	T065: "标签六"
};
const COMPANY_OVERVIEW_FINANCIAL_HIGHLIGHT_FIELDS = {
	mgsy: "每股收益(元)",
	mgjzc: "每股净资产(元)",
	yysr: "营业收入(元)",
	gmjlr: "归母净利润(元)",
	mll: "毛利率(%)",
	zcfzl: "资产负债率(%)",
	kfjlrtbzzl: "扣非净利润同比增长率(%)",
	yysrtbzzl: "营业收入同比增长率(%)",
	gmjlrtbzzl: "归母净利润同比增长率(%)",
	mgzbgj: "每股资本公积(元)",
	mgwfplr: "每股未分配利润(元)",
	mgjjxjl: "每股经营现金流(元)",
	bgq: "报告期"
};
const COMPANY_OVERVIEW_PLEDGE_FIELDS = {
	zyrq: "质押更新日期",
	zygf: "质押股份比例(%)",
	zzygf: "总质押股份量(股)"
};
const COMPANY_OVERVIEW_VALUATION_FIELDS = {
	sylttm: "滚动市盈率",
	syllyr: "静态市盈率",
	sjl: "市净率",
	zsz: "总市值(元)",
	zgb: "总股本(股)",
	ltag: "流通境内上市普通股(股)"
};
const COMPANY_OVERVIEW_EXTRA_INFO_FIELDS = { iscdr: "是否为中国存托凭证" };
const COMPANY_OVERVIEW_METADATA_FIELDS = {
	name: "证券名称",
	zzhy: "证监会行业",
	pjgdsyll: "最近一个月平均滚动市盈率",
	gxrq: "日期"
};
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/company-overview/summary.ts
function buildCompanyOverviewSummary(input) {
	const name = String(input.metadata["证券名称"] ?? input.code.trim());
	const reportDate = String(input.financialHighlights["报告期"] ?? input.metadata["日期"] ?? "").trim();
	const industry = [input.businessOverview["一级行业"], input.businessOverview["二级行业"]].filter((value) => value !== void 0 && value !== null && String(value).trim() !== "").map((value) => String(value)).join(" / ");
	const summaryParts = [
		industry ? `行业 ${industry}` : "",
		input.relatedThemes.length > 0 ? `关联主题 ${input.relatedThemes.length} 条` : "",
		input.tags.length > 0 ? `标签 ${input.tags.length} 个` : ""
	].filter(Boolean);
	return `${name} (${input.code.trim()}) 公司概要${reportDate ? ` - ${reportDate}` : ""}${summaryParts.length > 0 ? ` - ${summaryParts.join("，")}` : ""}`;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/company-overview/parser.ts
function parseCompanyOverviewResult(rawData, params) {
	if (!isResultSetResponse(rawData) || !Array.isArray(rawData.ResultSets) || rawData.ResultSets.length === 0) return null;
	const resultSets = rawData.ResultSets;
	const basicOverview = mapFirstResultRow(resultSets, "table0", COMPANY_OVERVIEW_BASIC_FIELDS, 0);
	const businessOverview = mapFirstResultRow(resultSets, "table1", COMPANY_OVERVIEW_BUSINESS_FIELDS, 1);
	const relatedThemes = collectMappedRows(resultSets, "table2", COMPANY_OVERVIEW_RELATED_THEME_FIELDS, 2);
	const tagDetails = mapFirstResultRow(resultSets, "table3", COMPANY_OVERVIEW_TAG_FIELDS, 3);
	const tags = Object.values(tagDetails).map((value) => String(value).trim()).filter(Boolean);
	const financialHighlights = mapFirstResultRow(resultSets, "table4", COMPANY_OVERVIEW_FINANCIAL_HIGHLIGHT_FIELDS, 4);
	const pledgeOverview = mapFirstResultRow(resultSets, "table5", COMPANY_OVERVIEW_PLEDGE_FIELDS, 5);
	const valuationMetrics = mapFirstResultRow(resultSets, "table6", COMPANY_OVERVIEW_VALUATION_FIELDS, 6);
	const extraInfo = mapFirstResultRow(resultSets, "table7", COMPANY_OVERVIEW_EXTRA_INFO_FIELDS, 7);
	const metadata = mapFirstResultRow(resultSets, "table8", COMPANY_OVERVIEW_METADATA_FIELDS, 8);
	const summary = buildCompanyOverviewSummary({
		code: params.code,
		metadata,
		businessOverview,
		relatedThemes,
		tags,
		financialHighlights
	});
	return {
		code: params.code.trim(),
		fixedTag: params.fixedTag?.trim() || "gsgy",
		parser: "company_overview",
		summary,
		data: relatedThemes,
		basicOverview,
		businessOverview,
		relatedThemes,
		tagDetails,
		tags,
		financialHighlights,
		pledgeOverview,
		valuationMetrics,
		extraInfo,
		metadata,
		errorCode: typeof rawData.ErrorCode === "number" ? rawData.ErrorCode : void 0,
		hitCache: typeof rawData.hitCache === "boolean" ? rawData.hitCache : void 0,
		cacheTrace: typeof rawData.HitCache === "string" ? rawData.HitCache : void 0
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/company-overview/presets.ts
function transformCompanyOverviewPreset(rawData, request) {
	const parsed = parseCompanyOverviewResult(rawData, {
		code: asOptionalString$1(String(request.code ?? "")) ?? "",
		fixedTag: asOptionalString$1(String(request.fixedTag ?? ""))
	});
	if (!parsed) return;
	const tables = [];
	const maybePushRecord = (name, record) => {
		if (record && Object.keys(record).length > 0) tables.push({
			name,
			rows: [normalizeParsedRow(record)],
			layout: "record"
		});
	};
	const maybePushTable = (name, rows) => {
		if (Array.isArray(rows) && rows.length > 0) tables.push({
			name,
			rows: rows.map((row) => normalizeParsedRow(row)),
			layout: "table"
		});
	};
	maybePushRecord("metadata", parsed.metadata);
	maybePushRecord("basic_overview", parsed.basicOverview);
	maybePushRecord("business_overview", parsed.businessOverview);
	maybePushTable("related_themes", parsed.relatedThemes);
	maybePushRecord("tag_details", parsed.tagDetails);
	if (Array.isArray(parsed.tags) && parsed.tags.length > 0) tables.push({
		name: "tags",
		rows: parsed.tags.map((tag) => ({ tag })),
		headers: ["标签"],
		layout: "table"
	});
	maybePushRecord("financial_highlights", parsed.financialHighlights);
	maybePushRecord("pledge_overview", parsed.pledgeOverview);
	maybePushRecord("valuation_metrics", parsed.valuationMetrics);
	maybePushRecord("extra_info", parsed.extraInfo);
	return {
		parser: "company_overview",
		summary: parsed.summary,
		tables,
		hitCache: parsed.hitCache ?? parsed.cacheTrace,
		errorCode: parsed.errorCode
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/dragon-tiger/specs.ts
function normalizeDragonTigerQueryType(value) {
	return value?.trim().toLowerCase() ?? "";
}
function getDragonTigerResultSetSpec(queryType, resultSetKey, fallbackIndex) {
	if (queryType === "dates") return {
		name: "available_dates",
		fieldMap: { T001: "date" },
		headers: ["日期"],
		layout: "table"
	};
	const key = resultSetKey || `table${fallbackIndex}`;
	if (key === "table0") return {
		name: "summary",
		fieldMap: {
			T004: "信息类型编码",
			T013: "买入金额(元)",
			T014: "买入占总成交比",
			T015: "卖出金额(元)",
			T016: "卖出占总成交比",
			je: "净额(元)",
			cje: "总成交额"
		},
		headers: [
			"信息类型编码",
			"买入金额(元)",
			"买入占总成交比",
			"卖出金额(元)",
			"卖出占总成交比",
			"净额(元)",
			"总成交额"
		],
		layout: "table"
	};
	if (key === "table1") return {
		name: "details",
		fieldMap: {
			T004: "信息类型",
			cid: "信息类型编码",
			dzjy: "大宗交易",
			T006: "交易类型",
			T007: "排名",
			T008: "营业部(席位)名称",
			T009: "买入金额(元)",
			T010: "卖出金额(元)",
			mrbl: "买入占比",
			mcbl: "卖出占比",
			je: "净额"
		},
		headers: [
			"信息类型",
			"信息类型编码",
			"大宗交易",
			"交易类型",
			"排名",
			"营业部(席位)名称",
			"买入金额(元)",
			"卖出金额(元)",
			"买入占比",
			"卖出占比",
			"净额"
		],
		layout: "table"
	};
	if (key === "table2") return {
		name: "seat_profiles",
		fieldMap: {
			T008: "营业部(席位)名称",
			T006: "营业部标签代码",
			T003: "营业部标签名称"
		},
		headers: [
			"营业部(席位)名称",
			"营业部标签代码",
			"营业部标签名称"
		],
		layout: "table"
	};
	if (key === "table3") return {
		name: "extra",
		fieldMap: {
			T001: "日期",
			T002: "证券代码",
			T004: "信息类型编码",
			T008: "营业部(席位)名称",
			T006: "交易类型",
			T007: "排名",
			mmbq: "买卖标签"
		},
		headers: [
			"日期",
			"证券代码",
			"信息类型编码",
			"营业部(席位)名称",
			"交易类型",
			"排名",
			"买卖标签"
		],
		layout: "table"
	};
	return {
		name: key,
		layout: "table"
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/dragon-tiger/parser.ts
function parseDragonTigerArrayPayload(rawData, queryType) {
	if (!Array.isArray(rawData) || rawData.length === 0) return [];
	const objectRows = rawData.filter((row) => isPlainObject(row));
	if (objectRows.length === rawData.length) return [{
		name: "data",
		rows: objectRows.map((row) => objectRowToDisplayRow(row)),
		layout: "table"
	}];
	const scalarRows = rawData.filter((row) => !Array.isArray(row) && !isPlainObject(row));
	if (scalarRows.length === rawData.length) {
		const key = queryType === "dates" ? "date" : "value";
		return [{
			name: "data",
			rows: scalarRows.map((value) => ({ [key]: toDisplayValue(value, key) })),
			layout: "table"
		}];
	}
	const arrayRows = rawData.filter((row) => Array.isArray(row));
	if (arrayRows.length >= 2) {
		const headerRow = arrayRows[0];
		if (headerRow.every((cell) => typeof cell === "string")) return [{
			name: "data",
			rows: arrayRows.slice(1).map((row) => {
				const mapped = {};
				headerRow.forEach((header, index) => {
					const value = row[index];
					if (value !== void 0 && value !== null && value !== "") mapped[header] = toDisplayValue(value, header);
				});
				return mapped;
			}),
			layout: "table"
		}];
	}
	return [];
}
function parseDragonTigerResult(rawData, params) {
	const queryType = normalizeDragonTigerQueryType(params.queryType);
	const code = params.code.trim();
	const fixedTag = params.fixedTag?.trim() || "jglhb";
	const date = normalizeCompactOrDashedDate(params.date);
	const { hitCache, errorCode } = readRawCacheInfo(rawData);
	const tables = [];
	if (isResultSetResponse(rawData) && Array.isArray(rawData.ResultSets)) rawData.ResultSets.forEach((resultSet, index) => {
		if (!isResultSet(resultSet)) return;
		const spec = getDragonTigerResultSetSpec(queryType, resultSet.ResultSetKey || "", index);
		tables.push({
			name: spec.name,
			rows: resultSetToRows(resultSet).map((row) => spec.fieldMap ? mapSelectedRowPreserveUnknown(row, spec.fieldMap) : objectRowToDisplayRow(row)),
			headers: spec.headers,
			layout: "table"
		});
	});
	if (tables.length === 0) tables.push(...parseDragonTigerArrayPayload(rawData, queryType));
	if (tables.length === 0) return null;
	const totalRows = tables.reduce((sum, table) => sum + table.rows.length, 0);
	return {
		queryType,
		code,
		fixedTag,
		date,
		summary: `${queryType === "dates" ? `${code} dragon-tiger available dates` : `${code} dragon-tiger detail rows${date ? ` (${date})` : ""}`} - ${totalRows} rows, ${tables.length} result sets`,
		tables,
		hitCache,
		errorCode
	};
}
function createDragonTigerPresetTransform(preset, queryType) {
	return (rawData, request) => buildTransformedFromParsed(preset, parseDragonTigerResult(rawData, {
		queryType,
		code: asOptionalString$1(String(request.code ?? "")) ?? "",
		fixedTag: asOptionalString$1(String(request.fixedTag ?? "")) ?? "jglhb",
		date: asOptionalString$1(String(request.date ?? ""))
	}));
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/dividend-financing/specs.ts
const DIVIDEND_FINANCING_OVERVIEW_RESULT_SET_SPECS = [
	{
		name: "dividend_stats",
		index: 0,
		fieldMap: {
			total: "dividend_count",
			sum: "dividend_amount"
		},
		headers: ["分红次数", "派息金额"],
		layout: "record"
	},
	{
		name: "ipo_stats",
		index: 1,
		fieldMap: {
			total: "ipo_count",
			sum: "ipo_funding"
		},
		headers: ["首发次数", "募资金额"],
		layout: "record"
	},
	{
		name: "seo_stats",
		index: 2,
		fieldMap: {
			total: "seo_count",
			sum: "seo_funding",
			zfcnt: "seo_plan_count"
		},
		headers: [
			"增发次数",
			"募资金额",
			"增发预案次数"
		],
		layout: "record"
	},
	{
		name: "rights_issue_stats",
		index: 3,
		fieldMap: {
			total: "rights_issue_count",
			sum: "rights_issue_funding",
			pgcnt: "rights_issue_plan_count"
		},
		headers: [
			"配股次数",
			"募资金额",
			"配股预案次数"
		],
		layout: "record"
	},
	{
		name: "listing_info",
		index: 4,
		fieldMap: { ssy: "listing_year" },
		headers: ["上市年份"],
		layout: "record"
	},
	{
		name: "convertible_bond_stats",
		index: 5,
		fieldMap: {
			total: "convertible_bond_count",
			sum: "convertible_bond_funding"
		},
		headers: ["转债次数", "募资金额"],
		layout: "record"
	},
	{
		name: "dividend_ratio_stats",
		index: 6,
		fieldMap: {
			gxl: "latest_dividend_yield",
			glzfl: "latest_payout_ratio",
			ljxjfh: "total_cash_dividend",
			njgmjlrfrom: "avg_net_profit",
			xjfhnl: "cash_dividend_to_profit"
		},
		headers: [
			"最新股息率",
			"最新年度股利支付率",
			"累计现金分红（派现+回购注销）",
			"年均归母净利润",
			"累计现金分红（派现+回购注销）/年均归母净利润"
		],
		layout: "record"
	},
	{
		name: "equity_incentive_stats",
		index: 7,
		fieldMap: {
			total: "equity_incentive_count",
			sum: "equity_incentive_funding"
		},
		headers: ["已实施股权激励和授予", "募资额"],
		layout: "record"
	}
];
const DIVIDEND_CHART_RESULT_SET_SPECS = [{
	name: "dividend_chart",
	index: 0,
	fieldMap: {
		rq: "dividend_year",
		N002: "report_period",
		N012: "dividend_amount"
	},
	headers: [
		"分红年度",
		"报告期",
		"分红金额"
	],
	layout: "table",
	maxRows: 50
}];
const DIVIDEND_TABLE_RESULT_SET_SPECS = [{
	name: "dividend_table",
	index: 0,
	fieldMap: {
		rq: "dividend_year",
		T003: "board_announcement_date",
		T004: "plan_description",
		T006: "basic_eps",
		T026: "roe",
		T021: "record_date",
		T023: "ex_right_date",
		T036: "plan_status",
		aT036: "plan_status_code",
		glzfl: "payout_ratio",
		jdcode: "distribution_target"
	},
	headers: [
		"分红年度",
		"董事会预案公告日期",
		"实施方案分红说明",
		"基本每股收益",
		"净资产收益率",
		"股权登记日",
		"除权日",
		"方案进度",
		"方案进度编码",
		"股利支付率",
		"派发对象"
	],
	layout: "table",
	maxRows: 50
}, {
	name: "page_info",
	index: 1,
	fieldMap: { zs: "total" },
	headers: ["总数"],
	layout: "record"
}];
const DIVIDEND_VIEWER_FILTER_RESULT_SET_SPECS = [{
	name: "summary",
	index: 0,
	fieldMap: { zs: "total" },
	headers: ["总数"],
	layout: "record"
}, {
	name: "stocks",
	index: 1,
	fieldMap: {
		id: "input_code",
		N001: "stock_code",
		N002: "stock_name"
	},
	headers: [
		"判断入参代码",
		"证券代码",
		"证券简称"
	],
	layout: "table",
	maxRows: 50
}];
const DIVIDEND_VIEWER_COMPARE_RESULT_SET_SPECS = [{
	name: "comparison",
	index: 0,
	fieldMap: {
		N001: "year",
		N002: "stock_code",
		N003: "stock_name",
		N004: "total_dividend",
		N005: "ipo_funding",
		N006: "seo_funding",
		N007: "rights_issue_funding",
		N008: "total_funding",
		N009: "net_dividend",
		N010: "cash_to_funding_ratio",
		N011: "listing_date"
	},
	headers: [
		"年份",
		"证券代码",
		"证券简称",
		"累计分红总额(元)",
		"首发融资金额(元)",
		"增发融资累计金额(元)",
		"配股融资累计金额(元)",
		"累计融资(元)",
		"累计净分红(元)",
		"派现融资比%",
		"上市日期"
	],
	layout: "table",
	maxRows: 200
}];
const RIGHTS_ISSUE_PLAN_RESULT_SET_SPECS = [{
	name: "rights_issue_execution",
	index: 0,
	fieldMap: {
		rq: "announcement_date",
		T005: "rights_ratio",
		T006: "rights_price",
		T011: "record_date",
		T012: "ex_right_base_date",
		T015: "actual_shares_10k",
		T017: "actual_funding_10k"
	},
	headers: [
		"公告日期",
		"配股比例(每10股配N股)",
		"配股价格(元)",
		"股权登记日",
		"除权基准日",
		"实际配股数量(万股)",
		"实际募资总额(万元)"
	],
	layout: "table",
	maxRows: 50
}, {
	name: "rights_issue_plan",
	index: 1,
	fieldMap: {
		rq: "announcement_date",
		T023: "plan_status",
		T006: "planned_ratio",
		T011: "planned_price_upper",
		T012: "planned_price_lower",
		T014: "planned_shares_10k",
		T015: "planned_funding_10k"
	},
	headers: [
		"公告日期",
		"方案进度",
		"配股比例(董)(每10股配N股)",
		"预计配股价格上限(元)",
		"预计配股价格下限(元)",
		"预计配股数量(万股)",
		"预计募集资金(万元)"
	],
	layout: "table",
	maxRows: 50
}];
const PLACEMENT_DETAIL_RESULT_SET_SPECS = [{
	name: "placement_details",
	index: 0,
	fieldMap: {
		T004: "allocated_org_or_code",
		T005: "allocated_org",
		T009: "lock_period_months",
		T007: "allocated_shares",
		T008: "valid_subscription_shares",
		T006: "institution_type",
		T012: "allocated_amount",
		jjrq: "deadline",
		hpjg: "issue_price",
		T002: "shareholder_id",
		T003: "tdx_shareholder_id",
		id: "shareholder_category"
	},
	headers: [
		"公布获配机构/代码",
		"获配机构",
		"锁定期(月)",
		"获配数量(股)",
		"有效申购数量(股)",
		"机构类型",
		"获配金额",
		"截止日期",
		"发行价",
		"股东id",
		"通达信股东id",
		"股东类别"
	],
	layout: "table",
	maxRows: 100
}, {
	name: "announcements",
	index: 1,
	fieldMap: { mx: "announcement_date" },
	headers: ["公告日期"],
	layout: "record"
}];
const HOLDER_CHANGE_DETAIL_RESULT_SET_SPECS = [{
	name: "holder_change_details",
	index: 0,
	fieldMap: {
		T001: "institution_id",
		zqdm: "stock_code",
		sc: "market",
		rq: "report_date",
		T006: "holding_shares",
		T007: "free_float_ratio",
		T012: "share_type",
		T009: "category",
		cnt: "count",
		T008: "share_change",
		zqjc: "stock_name",
		stype: "type"
	},
	headers: [
		"机构id",
		"证券代码",
		"证券市场",
		"报告日期",
		"持股数量",
		"占流通股股本比例",
		"股份性质",
		"种类",
		"个数",
		"增减股数",
		"证券简称",
		"类别"
	],
	layout: "table",
	maxRows: 100
}];
const HOLDER_CHANGE_TYPE_RESULT_SET_SPECS = [{
	name: "holder_change_types",
	index: 0,
	fieldMap: {
		T001: "institution_id",
		stype: "type"
	},
	headers: ["机构id", "类别"],
	layout: "table",
	maxRows: 100
}];
const REFINANCING_PLAN_RESULT_SET_SPECS = [{
	name: "refinancing_execution",
	index: 0,
	fieldMap: {
		T003: "announcement_date",
		T005: "total_issue_10k",
		T006: "public_issue_10k",
		T011: "par_value",
		T012: "issue_price",
		T017: "pricing_method",
		T025: "planned_funding_10k",
		T026: "actual_funding_10k",
		T111: "underwriting_method",
		T110: "issue_method",
		T037: "record_date",
		T038: "ex_right_date",
		T039: "pre_issue_total_shares_10k",
		T040: "post_issue_total_shares_10k",
		T080: "listing_date"
	},
	headers: [
		"公告日期",
		"总发行数量(万股)",
		"公开发行数量(万股)",
		"每股面值(元)",
		"发行价格(人民币)(元)",
		"发行定价方式",
		"预计募资金额(万元)",
		"实际募资总额(万元)",
		"承销方式",
		"发行方式",
		"股权登记日",
		"除权日",
		"发行前总股本(万股)",
		"发行后总股本(万股)",
		"增发股上市日"
	],
	layout: "table",
	maxRows: 50
}, {
	name: "refinancing_plan",
	index: 1,
	fieldMap: {
		T005: "issue_scale_10k",
		T008: "planned_funding_10k",
		T002: "announcement_date",
		T007: "pricing_method",
		T016: "plan_status",
		T006: "issue_target",
		T009: "planned_investment"
	},
	headers: [
		"发行规模(万股)",
		"预计募资金额(万元)",
		"公告日期",
		"发行定价方式",
		"方案进度",
		"发行对象",
		"预计募资投向"
	],
	layout: "table",
	maxRows: 50
}];
const DIVIDEND_HISTORY_PAYOUT_RESULT_SET_SPECS = [{
	name: "payout_history",
	index: 0,
	fieldMap: {
		N001: "dividend_year",
		N002: "dividend_amount",
		N003: "net_profit",
		N004: "payout_ratio"
	},
	headers: [
		"分红年度",
		"分红金额",
		"归母净利润",
		"股利支付率"
	],
	layout: "table",
	maxRows: 100
}];
const DIVIDEND_HISTORY_YIELD_RESULT_SET_SPECS = [{
	name: "yield_history",
	index: 0,
	fieldMap: {
		N001: "date",
		N002: "dividend_yield",
		N003: "yeb_seven_day_yield",
		N004: "ex_dividend_date"
	},
	headers: [
		"日期",
		"股息率",
		"余额宝七日年化收益",
		"除权除息日"
	],
	layout: "table",
	maxRows: 200
}];
const DIVIDEND_RANK_PAYOUT_RESULT_SET_SPECS = [{
	name: "industry_rank",
	index: 0,
	fieldMap: {
		N001: "rank",
		N002: "stock_name",
		N003: "payout_ratio"
	},
	headers: [
		"排名",
		"股票简称",
		"股利支付率%"
	],
	layout: "table",
	maxRows: 20
}, {
	name: "market_rank",
	index: 1,
	fieldMap: {
		N001: "rank",
		N002: "stock_name",
		N003: "payout_ratio"
	},
	headers: [
		"排名",
		"股票简称",
		"股利支付率%"
	],
	layout: "table",
	maxRows: 20
}];
const DIVIDEND_RANK_YIELD_RESULT_SET_SPECS = [{
	name: "industry_rank",
	index: 0,
	fieldMap: {
		N001: "rank",
		N002: "stock_name",
		N003: "dividend_yield"
	},
	headers: [
		"排名",
		"股票简称",
		"股息率%"
	],
	layout: "table",
	maxRows: 20
}, {
	name: "market_rank",
	index: 1,
	fieldMap: {
		N001: "rank",
		N002: "stock_name",
		N003: "dividend_yield"
	},
	headers: [
		"排名",
		"股票简称",
		"股息率%"
	],
	layout: "table",
	maxRows: 20
}];
const DIVIDEND_RANK_CASHFIN_RATIO_RESULT_SET_SPECS = [{
	name: "industry_rank",
	index: 0,
	fieldMap: {
		N001: "rank",
		N002: "stock_name",
		N003: "cash_to_funding_ratio"
	},
	headers: [
		"排名",
		"股票简称",
		"派现融资比%"
	],
	layout: "table",
	maxRows: 20
}, {
	name: "market_rank",
	index: 1,
	fieldMap: {
		N001: "rank",
		N002: "stock_name",
		N003: "cash_to_funding_ratio"
	},
	headers: [
		"排名",
		"股票简称",
		"派现融资比%"
	],
	layout: "table",
	maxRows: 20
}];
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/dividend-financing/summary.ts
function buildRowCountSummary(tables, label) {
	const rowCount = tables[0]?.rows.length ?? 0;
	return rowCount > 0 ? `${label} ${rowCount} 条` : void 0;
}
function buildLatestDateSummary(tables, field, label) {
	const latestDate = String(getFirstRowValue(tables[0], field) ?? "").trim();
	if (!latestDate) return;
	return `${label} ${String(formatCompactDate(latestDate))}`;
}
function buildDividendFinancingOverviewSummary(tables) {
	const listingYear = String(getFirstRowValue(tables[4], "listingYear") ?? "").trim();
	return listingYear ? `上市年份 ${listingYear}` : void 0;
}
function buildDividendChartSummary(tables) {
	const parts = nonEmptyParts([buildLatestDateSummary(tables, "dividendYear", "最新年度"), buildRowCountSummary(tables, "分红记录")]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildDividendTableSummary(tables) {
	const parts = nonEmptyParts([buildLatestDateSummary(tables, "dividendYear", "最新年度"), buildRowCountSummary(tables, "分红方案")]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildDividendViewerFilterSummary(tables) {
	const total = String(getFirstRowValue(tables[0], "total") ?? "").trim();
	const rowCount = tables[1]?.rows.length ?? 0;
	const parts = nonEmptyParts([total ? `总数 ${total}` : void 0, rowCount > 0 ? `证券 ${rowCount} 条` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildDividendViewerCompareSummary(tables) {
	return buildRowCountSummary(tables, "对比记录");
}
function buildRightsIssuePlanSummary(tables) {
	const executionCount = tables[0]?.rows.length ?? 0;
	const planCount = tables[1]?.rows.length ?? 0;
	const parts = nonEmptyParts([executionCount > 0 ? `已实施 ${executionCount} 条` : void 0, planCount > 0 ? `预案 ${planCount} 条` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildPlacementDetailSummary(tables) {
	const parts = nonEmptyParts([buildLatestDateSummary(tables, "announcementDate", "公告"), buildRowCountSummary(tables, "获配明细")]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildHolderChangeDetailSummary(tables) {
	const parts = nonEmptyParts([buildLatestDateSummary(tables, "reportDate", "最新报告"), buildRowCountSummary(tables, "持股变动")]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildHolderChangeTypeSummary(tables) {
	return buildRowCountSummary(tables, "类别记录");
}
function buildRefinancingPlanSummary(tables) {
	const executionCount = tables[0]?.rows.length ?? 0;
	const planCount = tables[1]?.rows.length ?? 0;
	const parts = nonEmptyParts([executionCount > 0 ? `已实施 ${executionCount} 条` : void 0, planCount > 0 ? `预案 ${planCount} 条` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildDividendHistoryPayoutSummary(tables) {
	const parts = nonEmptyParts([buildLatestDateSummary(tables, "dividendYear", "最新年度"), buildRowCountSummary(tables, "历史记录")]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildDividendHistoryYieldSummary(tables) {
	const parts = nonEmptyParts([buildLatestDateSummary(tables, "date", "最新日期"), buildRowCountSummary(tables, "历史记录")]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildDividendRankPayoutSummary(tables) {
	return buildRowCountSummary(tables, "排名记录");
}
function buildDividendRankYieldSummary(tables) {
	return buildRowCountSummary(tables, "排名记录");
}
function buildDividendRankCashfinRatioSummary(tables) {
	return buildRowCountSummary(tables, "排名记录");
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/financials/result-sets.ts
function collectFinancialRowGroups(rawData) {
	if (isResultSetResponse(rawData) && Array.isArray(rawData.ResultSets)) return rawData.ResultSets.map((resultSet) => resultSetToRows(resultSet));
	if (!Array.isArray(rawData)) return [];
	const directRows = collectObjectRows(rawData);
	if (directRows.length > 0) return [directRows];
	return rawData.map((item) => collectObjectRows(item));
}
function collectFinancialRows(rawData, groupIndex = 0) {
	return collectFinancialRowGroups(rawData)[groupIndex] ?? [];
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/financials/business.ts
function parseBusinessResult(rawData, params) {
	const rowGroups = collectFinancialRowGroups(rawData);
	if (rowGroups.length < 3) return null;
	const categoryRows = (rowGroups[0] ?? []).map((row) => mapSelectedRowPreserveUnknown(row, {
		N001: "分类方式",
		N002: "项目个数",
		N003: "总收入",
		N010: "分类方式ID"
	}));
	const itemRows = (rowGroups[1] ?? []).map((row) => mapSelectedRowPreserveUnknown(row, {
		N004: "主营构成",
		N006: "收入比例",
		N010: "分类方式ID"
	}));
	const detailRows = (rowGroups[2] ?? []).map((row) => mapSelectedRowPreserveUnknown(row, {
		N004: "主营构成",
		N005: "主营收入",
		N006: "收入比例",
		N007: "毛利率",
		N010: "分类方式ID"
	}));
	const itemsByCategory = {};
	const detailsByCategory = {};
	for (const row of itemRows) {
		const categoryId = String(row["分类方式ID"] ?? "unknown");
		itemsByCategory[categoryId] ??= [];
		itemsByCategory[categoryId].push(row);
	}
	for (const row of detailRows) {
		const categoryId = String(row["分类方式ID"] ?? "unknown");
		detailsByCategory[categoryId] ??= [];
		detailsByCategory[categoryId].push(row);
	}
	return {
		reportType: params.reportType,
		code: params.code,
		parser: "business",
		data: categoryRows,
		categories: categoryRows,
		itemsByCategory,
		detailsByCategory,
		summary: `${params.code} 主营构成 - 共 ${categoryRows.length} 种分类方式`
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/financials/employee.ts
function parseEmployeeStructureResult(rawData, params) {
	const rows = collectFinancialRows(rawData);
	if (rows.length === 0) return null;
	const data = rows.map((row) => ({
		报告期: toDisplayValue(row.T002, "报告期"),
		类别编码: toDisplayValue(row.T003, "类别编码"),
		类别名称: toDisplayValue(row.sT003, "类别名称"),
		项目名称: toDisplayValue(row.T004, "项目名称"),
		员工数量: toDisplayValue(row.T005, "员工数量"),
		员工占比: toDisplayValue(row.T006, "员工占比")
	}));
	return {
		reportType: params.reportType,
		code: params.code,
		parser: "employee_structure",
		data,
		summary: `${params.code} 员工构成 - 共 ${data.length} 条记录`
	};
}
function parseEmployeeEfficiencyResult(rawData, params) {
	const rows = collectFinancialRows(rawData);
	if (rows.length === 0) return null;
	const data = rows.map((row) => ({
		年度: toDisplayValue(row.N001, "年度"),
		人均扣非净利润: toDisplayValue(row.N002, "人均扣非净利润"),
		人均营业总收入: toDisplayValue(row.N003, "人均营业总收入"),
		人均薪酬: toDisplayValue(row.N004, "人均薪酬")
	}));
	return {
		reportType: params.reportType,
		code: params.code,
		parser: "employee_efficiency",
		data,
		summary: `${params.code} 员工效益 - 共 ${data.length} 个年度`
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/financials/statements.ts
const REPORT_NAMES = {
	income: "利润表",
	cashflow: "现金流量表",
	balance: "资产负债表",
	industry_rank: "行业排名-财务状况",
	valuation_rank: "行业排名-估值水平",
	special: "专项指标",
	business: "主营构成",
	valuation_history: "估值历史",
	employee_structure: "员工构成",
	employee_efficiency: "员工效益"
};
const INCOME_FIELDS_NON_FINANCE = {
	N001: "截止日期",
	N002: "营业总收入",
	N003: "营业收入",
	N004: "营业总成本",
	N005: "营业成本",
	N006: "营业税金及附加",
	N007: "销售费用",
	N008: "管理费用",
	N009: "研发费用",
	N010: "财务费用",
	N011: "堪探费用",
	N012: "资产减值损失",
	N013: "信用减值损失",
	N014: "公允价值变动净收益",
	N015: "投资收益",
	N016: "联营合营投资收益",
	N017: "资产处置收益",
	N018: "其他收益",
	N019: "营业利润",
	N020: "营业外收入",
	N021: "营业外支出",
	N022: "利润总额",
	N023: "所得税费用",
	N024: "净利润",
	N025: "归属母公司净利润",
	N026: "归属少数股东损益",
	N027: "持续经营净利润",
	N028: "终止经营净利润",
	N029: "基本每股收益",
	N030: "稀释每股收益",
	N031: "其他综合收益",
	N032: "综合收益总额",
	N033: "归属母公司综合收益",
	N034: "归属少数股东综合收益",
	N035: "扣非净利润",
	N036: "资产减值损失(新)",
	N037: "信用减值损失(新)",
	Tdate: "日期"
};
const INCOME_FIELDS_FINANCE = {
	N001: "截止日期",
	N002: "营业收入",
	N003: "利息净收入",
	N004: "利息收入",
	N005: "利息支出",
	N006: "手续费佣金净收入",
	N007: "手续费佣金收入",
	N008: "手续费佣金支出",
	N009: "代理买卖证券净收",
	N010: "证券承销业务净收",
	N011: "委托客户管理资产净收",
	N012: "已赚保费",
	N013: "保险业务收入",
	N014: "分保费收入",
	N015: "分出保费",
	N016: "提取未到期责任准备金",
	N017: "投资收益",
	N018: "联营合营投资收益",
	N019: "公允价值变动收益",
	N020: "汇兑收益",
	N021: "其他业务收入",
	N022: "营业支出",
	N023: "退保金",
	N024: "赔付支出",
	N025: "摊回赔付支出",
	N026: "提取保险责任准备金",
	N027: "摊回保险责任准备金",
	N028: "保单红利支出",
	N029: "分保费用",
	N030: "营业税金及附加",
	N031: "手续费佣金支出2",
	N032: "业务及管理费",
	N033: "摊回分保费用",
	N034: "资产减值损失",
	N035: "信用减值损失",
	N036: "其他业务成本",
	N037: "营业利润",
	N038: "营业外收入",
	N039: "贴补收入",
	N040: "影响利润总额其他科目",
	N041: "营业外支出",
	N042: "利润总额",
	N043: "所得税",
	N044: "影响净利润其他科目",
	N045: "净利润",
	N046: "归属母公司净利润",
	N047: "归属少数股东损益",
	N048: "持续经营净利润",
	N049: "终止经营净利润",
	N050: "基本每股收益",
	N051: "稀释每股收益",
	N052: "其他综合收益",
	N053: "综合收益总额",
	N054: "归属母公司综合收益",
	N055: "归属少数股东综合收益",
	N056: "扣非净利润",
	Tdate: "日期"
};
const CASHFLOW_FIELDS_NON_FINANCE = {
	N001: "截止日期",
	N002: "销售商品收到现金",
	N003: "收到税费返还",
	N004: "收到其他经营活动现金",
	N005: "经营活动现金流入小计",
	N006: "购买商品支付现金",
	N007: "支付职工现金",
	N008: "支付各项税费",
	N009: "支付其他经营活动现金",
	N010: "经营活动现金流出小计",
	N011: "经营活动现金流量净额",
	N012: "收回投资收到现金",
	N013: "投资收益收到现金",
	N014: "处置资产收回现金",
	N015: "处置子公司收到现金",
	N016: "收到其他投资活动现金",
	N017: "投资活动现金流入小计",
	N018: "购建资产支付现金",
	N019: "投资支付现金",
	N020: "取得子公司支付现金",
	N021: "支付其他投资活动现金",
	N022: "投资活动现金流出小计",
	N023: "投资活动现金流量净额",
	N024: "吸收投资收到现金",
	N025: "取得借款收到现金",
	N026: "发行债券收到现金",
	N027: "收到其他筹资活动现金",
	N028: "筹资活动现金流入小计",
	N029: "偿还债务支付现金",
	N030: "分配股利支付现金",
	N031: "支付其他筹资活动现金",
	N032: "筹资活动现金流出小计",
	N033: "筹资活动现金流量净额",
	N034: "汇率变动对现金影响",
	N035: "现金及等价物净增加额",
	N036: "期初现金及等价物余额",
	N037: "期末现金及等价物余额",
	N038: "净利润",
	N039: "资产减值准备",
	N040: "固定资产折旧",
	N041: "无形资产摊销",
	N042: "长期待摊费用摊销",
	N043: "处置资产损失",
	N044: "固定资产报废损失",
	N045: "公允价值变动损失",
	N046: "财务费用",
	N047: "投资损失",
	N048: "递延所得税资产减少",
	N049: "递延所得税负债增加",
	N050: "存货减少",
	N051: "经营性应收项目减少",
	N052: "经营性应付项目增加",
	N053: "其他",
	N054: "经营活动现金流量净额2",
	N055: "债务转为资本",
	N056: "年内到期可转换债券",
	N057: "融资租入固定资产",
	N058: "现金期末余额",
	N059: "现金期初余额",
	N060: "现金等价物期末余额",
	N061: "现金等价物期初余额",
	N062: "其他原因对现金影响",
	N063: "现金等价物净增加额",
	Tdate: "日期"
};
const CASHFLOW_FIELDS_FINANCE = {
	N001: "截止日期",
	N002: "客户存款和同业存放款项净增加额",
	N003: "向中央银行借款净增加额",
	N004: "向其他金融机构拆入资金净增加额",
	N005: "收取利息、手续费及佣金的现金",
	N006: "收到原保险合同保费取得的现金",
	N007: "收到再保业务现金净额",
	N008: "保户储金及投资款净增加额",
	N009: "处置交易性金融资产净增加额",
	N010: "收取买入返售金融资产净增加额",
	N011: "收到的税费返还",
	N012: "收到其他与经营活动有关的现金",
	N013: "经营活动现金流入小计",
	N014: "客户贷款及垫款净增加额",
	N015: "存放中央银行和同业款项净增加额",
	N016: "支付利息、手续费及佣金的现金",
	N017: "支付原保险合同赔付款项的现金",
	N018: "支付再保业务现金净额",
	N019: "支付保单红利的现金",
	N020: "支付给职工以及为职工支付的现金",
	N021: "支付的各项税费",
	N022: "支付其他与经营活动有关的现金",
	N023: "经营活动现金流出小计",
	N024: "经营活动现金流量净额",
	N025: "收回投资收到的现金",
	N026: "取得投资收益收到的现金",
	N027: "处置固定资产、无形资产和其他长期资产收回的现金净额",
	N028: "处置子公司及其他营业单位收到的现金净额",
	N029: "收到其他与投资活动有关的现金",
	N030: "投资活动现金流入小计",
	N031: "投资支付的现金",
	N032: "购建固定资产、无形资产和其他长期资产支付的现金",
	N033: "取得子公司及其他营业单位支付的现金净额",
	N034: "支付其他与投资活动有关的现金",
	N035: "投资活动现金流出小计",
	N036: "投资活动现金流量净额",
	N037: "发行债券收到的现金",
	N038: "吸收投资收到的现金",
	N039: "取得借款收到的现金",
	N040: "收到其他与筹资活动有关的现金",
	N041: "筹资活动现金流入小计",
	N042: "偿还债务支付的现金",
	N043: "分配股利、利润或偿付利息支付的现金",
	N044: "支付其他与筹资活动有关的现金",
	N045: "筹资活动现金流出小计",
	N046: "筹资活动现金流量净额",
	N047: "汇率变动对现金及现金等价物的影响",
	N048: "现金及现金等价物净增加额",
	N049: "期初现金及等价物余额",
	N050: "期末现金及等价物余额",
	Tdate: "日期"
};
const BALANCE_FIELDS_NON_FINANCE = {
	N001: "截止日期",
	N002: "货币资金",
	N003: "交易性金融资产",
	N004: "应收票据及账款",
	N005: "应收票据",
	N006: "应收账款",
	N007: "预付账款",
	N008: "其他应收款",
	N009: "应收利息",
	N010: "应收股利",
	N011: "存货",
	N012: "一年内到期非流动资产",
	N013: "合同资产",
	N014: "其他流动资产",
	N015: "流动资产合计",
	N016: "可供出售金融资产",
	N017: "债权投资",
	N018: "其他债权投资",
	N019: "其他权益工具投资",
	N020: "其他非流动金融资产",
	N021: "持有至到期投资",
	N022: "长期应收款",
	N023: "长期股权投资",
	N024: "投资性房地产",
	N025: "固定资产",
	N026: "固定资产清理",
	N027: "在建工程",
	N028: "工程物资",
	N029: "生产性生物资产",
	N030: "油气资产",
	N031: "无形资产",
	N032: "开发支出",
	N033: "商誉",
	N034: "长期待摊费用",
	N035: "递延所得税资产",
	N036: "其他非流动资产",
	N037: "非流动资产合计",
	N038: "资产合计",
	N039: "短期借款",
	N040: "交易性金融负债",
	N041: "衍生金融负债",
	N042: "应付票据及账款",
	N043: "应付票据",
	N044: "应付账款",
	N045: "预收账款",
	N046: "应付职工薪酬",
	N047: "应交税费",
	N048: "应付利息",
	N049: "应付股利",
	N050: "其他应付款",
	N051: "一年内到期非流动负债",
	N052: "预计负债",
	N053: "递延收益",
	N054: "合同负债",
	N055: "其他流动负债",
	N056: "流动负债合计",
	N057: "长期借款",
	N058: "应付债券",
	N059: "长期应付款",
	N060: "专项应付款",
	N061: "预计负债",
	N062: "递延所得税负债",
	N063: "递延收益",
	N064: "其他非流动负债",
	N065: "非流动负债合计",
	N066: "负债合计",
	N067: "实收资本",
	N068: "资本公积",
	N069: "盈余公积",
	N070: "库存股",
	N071: "其他综合收益",
	N072: "其他权益工具",
	N073: "优先股",
	N074: "永续债",
	N075: "未分配利润",
	N076: "所有者权益合计",
	N077: "母公司股东权益",
	N078: "少数股东权益",
	N079: "负债和所有者权益合计",
	Tdate: "日期"
};
const BALANCE_FIELDS_FINANCE = {
	N001: "截止日期",
	N002: "现金及存放中央银行款项",
	N003: "存放同业款项",
	N004: "贵金属",
	N005: "拆出资金",
	N006: "交易性金融资产",
	N007: "衍生金融资产",
	N008: "买入返售金融资产",
	N009: "应收利息",
	N010: "发放贷款及垫款",
	N011: "可供出售金融资产",
	N012: "持有至到期投资",
	N013: "应收款项类投资",
	N014: "长期股权投资",
	N015: "投资性房地产",
	N016: "固定资产",
	N017: "在建工程",
	N018: "无形资产",
	N019: "商誉",
	N020: "递延所得税资产",
	N021: "其他资产",
	N022: "资产总计",
	N023: "向中央银行借款",
	N024: "同业及其他金融机构存放款项",
	N025: "拆入资金",
	N026: "交易性金融负债",
	N027: "衍生金融负债",
	N028: "卖出回购金融资产款",
	N029: "吸收存款",
	N030: "应付职工薪酬",
	N031: "应交税费",
	N032: "应付利息",
	N033: "应付债券",
	N034: "其他负债",
	N035: "负债合计",
	N036: "实收资本",
	N037: "资本公积",
	N038: "其他综合收益",
	N039: "盈余公积",
	N040: "一般风险准备",
	N041: "未分配利润",
	N042: "归属于母公司股东权益合计",
	N043: "少数股东权益",
	N044: "股东权益合计",
	N045: "负债和股东权益总计",
	Tdate: "日期"
};
function parseFinancialStatementsResult(rawData, params) {
	const rowGroups = collectFinancialRowGroups(rawData);
	if (rowGroups.length < 2) return null;
	let isFinance = false;
	const firstMetaRow = rowGroups[0]?.[0];
	if (firstMetaRow && typeof firstMetaRow === "object" && "isjr" in firstMetaRow) isFinance = String(firstMetaRow.isjr) === "1";
	let fieldMap;
	switch (params.reportType) {
		case "income":
			fieldMap = isFinance ? INCOME_FIELDS_FINANCE : INCOME_FIELDS_NON_FINANCE;
			break;
		case "cashflow":
			fieldMap = isFinance ? CASHFLOW_FIELDS_FINANCE : CASHFLOW_FIELDS_NON_FINANCE;
			break;
		case "balance":
			fieldMap = isFinance ? BALANCE_FIELDS_FINANCE : BALANCE_FIELDS_NON_FINANCE;
			break;
		default: return null;
	}
	const dataRows = (rowGroups[1] ?? []).map((row) => mapSelectedRow(row, fieldMap));
	const periodText = params.period === "quarter" ? "单季度" : "报告期";
	return {
		reportType: params.reportType,
		code: params.code,
		isFinance,
		parser: "statements",
		data: dataRows,
		summary: `${params.code} ${REPORT_NAMES[params.reportType] ?? params.reportType} (${periodText}) - ${isFinance ? "金融类" : "非金融类"} - 共 ${dataRows.length} 期数据`
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/financials/rank.ts
const INDUSTRY_RANK_NAMES = {
	"1": "每股收益",
	"2": "每股净资产",
	"3": "销售净利率",
	"4": "净利润增长率",
	"5": "净资产收益率"
};
const VALUATION_RANK_NAMES = {
	"1": "市盈率LYR",
	"2": "市盈率TTM",
	"3": "市净率MRQ",
	"4": "市销率TTM",
	"5": "市现率TTM"
};
function parseIndustryRankResult(rawData, params) {
	const rowGroups = collectFinancialRowGroups(rawData);
	if (rowGroups.length < 1) return null;
	const nameMap = params.reportType === "valuation_rank" ? VALUATION_RANK_NAMES : INDUSTRY_RANK_NAMES;
	const rankings = [];
	for (let i = 0; i < rowGroups.length; i += 1) {
		const rows = rowGroups[i] ?? [];
		if (rows.length === 0) continue;
		const row = rows[0];
		const category = String(row.N004 ?? i + 1);
		rankings.push({
			指标: nameMap[category] || `指标${category}`,
			公司值: toDisplayValue(row.N001, "公司值"),
			行业平均: toDisplayValue(row.N002, "行业平均"),
			排名: toDisplayValue(row.N003, "排名")
		});
	}
	return {
		reportType: params.reportType,
		code: params.code,
		parser: "industry_rank",
		data: rankings,
		summary: `${params.code} ${REPORT_NAMES[params.reportType] ?? params.reportType} - 共 ${rankings.length} 个指标`
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/financials/special.ts
const SPECIAL_BANK_FIELDS = {
	Tdate: "报告期",
	N002: "资本净额",
	N003: "资本充足率",
	N004: "一级资本净额",
	N005: "一级资本充足率",
	N006: "核心一级资本净额",
	N007: "核心一级资本充足率",
	N008: "存款总额",
	N009: "贷款总额",
	N010: "存贷比例",
	N011: "重组贷款",
	N012: "逾期贷款",
	N013: "不良贷款比例",
	N014: "贷款损失准备金",
	N015: "不良贷款拨备覆盖率",
	N016: "单一最大客户贷款比例",
	N017: "最大十家客户贷款比例",
	N018: "贷款五级分类合计",
	N019: "正常类",
	N020: "关注类",
	N021: "次级类",
	N022: "可疑类",
	N023: "损失类",
	N024: "风险加权资产合计",
	N025: "信用风险",
	N026: "市场风险",
	N027: "操作风险",
	N028: "短期资产流动性比率",
	N029: "生息资产平均余额",
	N030: "计息负债平均余额",
	N031: "非利息收入占比",
	N032: "利息收入总额",
	N033: "利息支出总额",
	N034: "成本收入比",
	N035: "净利差",
	N036: "净息差"
};
const SPECIAL_SECURITIES_FIELDS = {
	Tdate: "报告期",
	N002: "净资本",
	N003: "净资本负债率",
	N004: "净资本/净资产",
	N005: "净资本/各项风险准备",
	N006: "自营权益类证券及衍生品占净资本比",
	N007: "自营固定收益类证券占净资本比",
	N008: "手续费及佣金收入",
	N009: "证券经纪业务",
	N010: "证券承销业务",
	N011: "受托资管业务",
	N012: "期货经纪业务",
	N013: "基金管理业务",
	N014: "投资咨询业务",
	N015: "财务顾问业务",
	N016: "保荐业务",
	N017: "其他业务",
	N018: "利息收入",
	N019: "金融企业往来",
	N020: "融资融券业务",
	N021: "金融资产回购",
	N022: "资金拆借业务",
	N023: "其他利息业务",
	N024: "受托管理资产总规模",
	N025: "定向资产管理业务收入",
	N026: "集合资产管理业务收入",
	N027: "专项资产管理业务收入"
};
const SPECIAL_SECURITIES_MONTHLY_FIELDS = {
	N001: "日期",
	N002: "营业收入",
	N003: "净利润",
	N004: "净资产"
};
const SPECIAL_INSURANCE_FIELDS = {
	Tdate: "报告期",
	N002: "核心资本",
	N003: "实际资本",
	N004: "最低资本",
	N005: "核心偿付能力充足率",
	N006: "综合偿付能力充足率",
	N007: "净投资收益率",
	N008: "总投资收益率",
	N009: "内涵价值",
	N010: "经调整的净资产价值",
	N011: "有效业务价值-成本前",
	N012: "有效业务价值-成本后",
	N013: "一年新业务价值-成本前",
	N014: "一年新业务价值-成本后",
	N015: "寿险市场占有率",
	N016: "寿险收入",
	N017: "传统险",
	N018: "分红险",
	N019: "万能险",
	N020: "意外及短期健康险",
	N021: "投资连结保险",
	N022: "保单继续率13个月",
	N023: "保单继续率25个月",
	N024: "退保率",
	N025: "产险市场占有率",
	N026: "产险收入",
	N027: "机动车辆保险",
	N028: "非机动车辆保险",
	N029: "短期意健险",
	N030: "产险综合成本率",
	N031: "产险综合赔付率",
	N032: "按对象投资资产合计",
	N033: "固定收益类资产",
	N034: "定期存款",
	N035: "债券投资",
	N036: "其他固定收益类",
	N037: "权益类资产",
	N038: "股票",
	N039: "基金",
	N040: "长期股权投资",
	N041: "其他权益类",
	N042: "不动产类资产",
	N043: "现金及现金等价物",
	N044: "其他金融资产",
	N045: "按目的投资资产合计",
	N046: "公允价值计量金融资产",
	N047: "可供出售金融资产",
	N048: "持有至到期投资",
	N049: "贷款和应收款项",
	N050: "长期股权投资",
	N051: "其他"
};
function detectSpecialSubtype(firstRow) {
	if ("N048" in firstRow || "N051" in firstRow) return "insurance";
	if ("N036" in firstRow || "N035" in firstRow || "N034" in firstRow) return "bank";
	if ("N027" in firstRow && "N024" in firstRow && "N008" in firstRow) return "securities";
	return "unknown";
}
function parseSpecialResult(rawData, params) {
	const rowGroups = collectFinancialRowGroups(rawData);
	const primaryRows = rowGroups[0] ?? [];
	if (primaryRows.length === 0) return null;
	const subtype = detectSpecialSubtype(primaryRows[0]);
	const fieldMap = subtype === "bank" ? SPECIAL_BANK_FIELDS : subtype === "securities" ? SPECIAL_SECURITIES_FIELDS : subtype === "insurance" ? SPECIAL_INSURANCE_FIELDS : { Tdate: "报告期" };
	const indicators = primaryRows.map((row) => subtype === "unknown" ? mapSelectedRowPreserveUnknown(row, fieldMap) : mapSelectedRow(row, fieldMap));
	const result = {
		reportType: params.reportType,
		code: params.code,
		parser: "special",
		subtype,
		data: indicators,
		summary: subtype === "unknown" ? `${params.code} 专项指标 - 未识别金融子类型，保留原始字段` : `${params.code} 专项指标 - ${subtype === "bank" ? "银行类" : subtype === "securities" ? "证券类" : "保险类"} - 共 ${indicators.length} 期数据`
	};
	if (subtype === "securities" && rowGroups.length > 1) result.monthlyData = (rowGroups[1] ?? []).map((row) => mapSelectedRow(row, SPECIAL_SECURITIES_MONTHLY_FIELDS));
	return result;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/financials/valuation.ts
function parseValuationHistoryResult(rawData, params) {
	const rows = collectFinancialRows(rawData);
	if (rows.length === 0) return null;
	const series = rows.map((row) => ({
		tradeDate: String(row.N002 ?? ""),
		value: toDisplayValue(row.N008, "value")
	}));
	return {
		reportType: params.reportType,
		code: params.code,
		parser: "valuation_history",
		metric: params.valuationMetric,
		timeRange: params.timeRange,
		data: series.map((item) => ({
			交易日: item.tradeDate,
			数值: item.value
		})),
		series,
		summary: `${params.code} ${params.valuationMetric} 估值历史 - ${params.timeRange} - 共 ${series.length} 条`
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/financials/presets.ts
function parseFinancialsResult(rawData, params) {
	if ([
		"income",
		"cashflow",
		"balance"
	].includes(params.reportType)) return parseFinancialStatementsResult(rawData, params);
	if (["industry_rank", "valuation_rank"].includes(params.reportType)) return parseIndustryRankResult(rawData, params);
	if (params.reportType === "special") return parseSpecialResult(rawData, params);
	if (params.reportType === "business") return parseBusinessResult(rawData, params);
	if (params.reportType === "valuation_history") return parseValuationHistoryResult(rawData, params);
	if (params.reportType === "employee_structure") return parseEmployeeStructureResult(rawData, params);
	if (params.reportType === "employee_efficiency") return parseEmployeeEfficiencyResult(rawData, params);
	return null;
}
function transformFinancialsPreset(preset, rawData, request) {
	const code = asOptionalString$1(String(request.code ?? "")) ?? "";
	const fixedTag = asOptionalString$1(String(request.fixedTag ?? ""));
	const extra = asOptionalString$1(String(request.extra ?? ""));
	const extraOne = asOptionalString$1(String(request.extraOne ?? ""));
	const extraTwo = asOptionalString$1(String(request.extraTwo ?? ""));
	let params;
	switch (preset) {
		case "income_statement":
			params = {
				reportType: "income",
				code,
				period: fixedTag === "00102" ? "quarter" : "report"
			};
			break;
		case "cashflow_statement":
			params = {
				reportType: "cashflow",
				code,
				period: fixedTag === "00102" ? "quarter" : "report"
			};
			break;
		case "balance_sheet":
			params = {
				reportType: "balance",
				code
			};
			break;
		case "industry_rank":
			params = {
				reportType: "industry_rank",
				code,
				reportDate: extra
			};
			break;
		case "valuation_rank":
			params = {
				reportType: "valuation_rank",
				code,
				reportDate: extra
			};
			break;
		case "financial_sector_indicators":
			params = {
				reportType: "special",
				code,
				reportDate: extra
			};
			break;
		case "business_composition":
			params = {
				reportType: "business",
				code,
				reportDate: extra
			};
			break;
		case "valuation_history":
			params = {
				reportType: "valuation_history",
				code,
				timeRange: extraOne,
				valuationMetric: extraTwo
			};
			break;
		case "employee_structure":
			params = {
				reportType: "employee_structure",
				code
			};
			break;
		case "employee_efficiency":
			params = {
				reportType: "employee_efficiency",
				code
			};
			break;
		default: return;
	}
	const parsed = parseFinancialsResult(rawData, params);
	if (!parsed) return;
	const tables = [];
	if (parsed.parser === "business") {
		const categories = Array.isArray(parsed.categories) ? parsed.categories : [];
		const itemsByCategory = parsed.itemsByCategory ?? {};
		const detailsByCategory = parsed.detailsByCategory ?? {};
		if (categories.length > 0) tables.push({
			name: "categories",
			rows: categories.map((row) => normalizeParsedRow(row)),
			layout: "table"
		});
		const itemRows = Object.values(itemsByCategory).flat();
		if (itemRows.length > 0) tables.push({
			name: "items",
			rows: itemRows.map((row) => normalizeParsedRow(row)),
			layout: "table"
		});
		const detailRows = Object.values(detailsByCategory).flat();
		if (detailRows.length > 0) tables.push({
			name: "details",
			rows: detailRows.map((row) => normalizeParsedRow(row)),
			layout: "table"
		});
	} else {
		tables.push({
			name: parsed.parser ?? preset,
			rows: Array.isArray(parsed.data) ? parsed.data.map((row) => normalizeParsedRow(row)) : [],
			layout: "table"
		});
		if (Array.isArray(parsed.monthlyData) && parsed.monthlyData.length > 0) tables.push({
			name: "monthly_data",
			rows: parsed.monthlyData.map((row) => normalizeParsedRow(row)),
			layout: "table"
		});
	}
	return {
		parser: parsed.parser ?? String(preset),
		summary: parsed.summary,
		tables
	};
}
function createFinancialsPresetTransform(preset) {
	return (rawData, request) => transformFinancialsPreset(preset, rawData, request);
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/financials/earnings-warning.ts
const EARNINGS_WARNING_RESULT_SET_SPECS = [{
	name: "earnings_warning",
	index: 0,
	fieldMap: {
		N001: "report_period",
		N002: "forecast_type",
		N003: "forecast_profit_10k",
		N003_1: "profit_lower_10k",
		N003_2: "profit_upper_10k",
		N004: "profit_change_pct",
		N004_1: "change_lower_pct",
		N004_2: "change_upper_pct",
		N005: "forecast_count",
		N006: "is_warning",
		N007: "latest_forecast_date"
	},
	headers: [
		"报告期",
		"预告类型",
		"预告净利润(万元)",
		"净利润下限(万元)",
		"净利润上限(万元)",
		"净利润变化幅度(%)",
		"变化下限(%)",
		"变化上限(%)",
		"预告次数",
		"是否预警",
		"最新预告日"
	],
	layout: "table",
	maxRows: 50
}];
function buildEarningsWarningSummary(tables) {
	const rowCount = tables[0]?.rows.length ?? 0;
	const reportPeriod = String(getFirstRowValue(tables[0], "reportPeriod") ?? "").trim();
	const latestForecastDate = String(getFirstRowValue(tables[0], "latestForecastDate") ?? "").trim();
	const parts = nonEmptyParts([
		reportPeriod ? `报告期 ${reportPeriod}` : void 0,
		latestForecastDate ? `最新预告日 ${latestForecastDate}` : void 0,
		rowCount > 0 ? `记录 ${rowCount} 条` : void 0
	]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/hot-topic/specs.ts
const HOT_TOPIC_INFO_OVERVIEW_FIELDS = {
	lmmc: "栏目名称",
	zynr: "内容"
};
const HOT_TOPIC_BOARD_FAMILY_FIELDS = {
	bflag: "分类",
	ztrq: "板块创建日期",
	ztmc: "板块名称",
	gld: "关联度",
	rxsj: "收录时间",
	ztnr: "内容",
	arec: "记录编号",
	id: "板块编号",
	sslb: "配置分类"
};
const HOT_TOPIC_THEME_LIBRARY_FIELDS = {
	bflag: "分类",
	ztrq: "题材日期",
	ztmc: "题材名称",
	gld: "关联度",
	rxsj: "收录时间",
	ztnr: "内容",
	arec: "记录编号",
	id: "板块编号",
	rec_id: "配置分类"
};
const HOT_TOPIC_EVENT_DRIVEN_FIELDS = {
	cjrq: "创建时间",
	sjmc: "事件名称",
	rec_id: "记录编号",
	sjxz: "事件类型"
};
const HOT_TOPIC_INFO_OVERVIEW_RESULT_SET_SPECS = [{
	name: "info_overview",
	index: 0,
	fieldMap: HOT_TOPIC_INFO_OVERVIEW_FIELDS,
	headers: ["栏目名称", "内容"],
	layout: "table",
	maxRows: 50
}];
const HOT_TOPIC_BOARD_FAMILY_RESULT_SET_SPECS = [{
	name: "board_family",
	index: 0,
	fieldMap: HOT_TOPIC_BOARD_FAMILY_FIELDS,
	headers: [
		"分类",
		"板块创建日期",
		"板块名称",
		"关联度",
		"收录时间",
		"内容",
		"记录编号",
		"板块编号",
		"配置分类"
	],
	layout: "table",
	maxRows: 50
}];
const HOT_TOPIC_THEME_LIBRARY_RESULT_SET_SPECS = [{
	name: "theme_library",
	index: 0,
	fieldMap: HOT_TOPIC_THEME_LIBRARY_FIELDS,
	headers: [
		"分类",
		"题材日期",
		"题材名称",
		"关联度",
		"收录时间",
		"内容",
		"记录编号",
		"板块编号",
		"配置分类"
	],
	layout: "table",
	maxRows: 50
}];
const HOT_TOPIC_EVENT_DRIVEN_RESULT_SET_SPECS = [{
	name: "event_driven",
	index: 0,
	fieldMap: HOT_TOPIC_EVENT_DRIVEN_FIELDS,
	headers: [
		"创建时间",
		"事件名称",
		"记录编号",
		"事件类型"
	],
	layout: "table",
	maxRows: 50
}];
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/hot-topic/summary.ts
function buildHotTopicInfoOverviewSummary(tables) {
	const rowCount = tables[0]?.rows.length ?? 0;
	const firstColumn = String(getFirstRowValue(tables[0], "column_name") ?? "").trim();
	const parts = nonEmptyParts([rowCount > 0 ? `栏目 ${rowCount} 条` : void 0, firstColumn ? `首个栏目 ${firstColumn}` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildHotTopicBoardFamilySummary(tables) {
	const rowCount = tables[0]?.rows.length ?? 0;
	const firstBoardName = String(getFirstRowValue(tables[0], "board_name") ?? "").trim();
	const parts = nonEmptyParts([rowCount > 0 ? `板块 ${rowCount} 条` : void 0, firstBoardName ? `首个板块 ${firstBoardName}` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildHotTopicThemeLibrarySummary(tables) {
	const rowCount = tables[0]?.rows.length ?? 0;
	const firstTopicName = String(getFirstRowValue(tables[0], "topic_name") ?? "").trim();
	const parts = nonEmptyParts([rowCount > 0 ? `题材 ${rowCount} 条` : void 0, firstTopicName ? `首个题材 ${firstTopicName}` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildHotTopicEventDrivenSummary(tables) {
	const rowCount = tables[0]?.rows.length ?? 0;
	const firstEventName = String(getFirstRowValue(tables[0], "event_name") ?? "").trim();
	const parts = nonEmptyParts([rowCount > 0 ? `事件 ${rowCount} 条` : void 0, firstEventName ? `首个事件 ${firstEventName}` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
const INDUSTRY_IMPORTANT_EVENTS_RESULT_SET_SPECS = [{
	name: "important_events",
	index: 0,
	fieldMap: {
		bt: "标题",
		rq: "日期",
		crrq: "创建时间",
		rec_id: "记录编号",
		contents: "内容"
	},
	headers: [
		"标题",
		"日期",
		"创建时间",
		"记录编号",
		"内容"
	],
	layout: "table",
	maxRows: 20
}];
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/industry/valuation-specs.ts
const INDUSTRY_VALUATION_QUERY_TYPE_01_FIELDS = {
	T001: "证券代码",
	T002: "证券名称",
	T003: "交易日期",
	T004: "滚动市盈率"
};
const INDUSTRY_VALUATION_QUERY_TYPE_01_META_FIELDS = { rq: "交易日期" };
const INDUSTRY_VALUATION_QUERY_TYPE_02_COMPONENT_FIELDS = {
	T001: "排名",
	T002: "证券代码",
	T003: "证券名称",
	T004: "交易日期",
	T005: "滚动市盈率",
	T006: "静态市盈率",
	T007: "最新市净率",
	T008: "滚动市销率",
	T009: "滚动市现率",
	sc: "市场"
};
const INDUSTRY_VALUATION_QUERY_TYPE_02_SNAPSHOT_FIELDS = {
	T002: "证券代码",
	T003: "证券名称",
	T004: "交易日期",
	T005: "滚动市盈率",
	T006: "静态市盈率",
	T007: "最新市净率",
	T008: "滚动市销率",
	T009: "滚动市现率",
	sc: "市场"
};
const INDUSTRY_VALUATION_QUERY_TYPE_02_MARKET_FIELDS = {
	T004: "交易日期",
	T005: "滚动市盈率",
	T006: "静态市盈率",
	T007: "最新市净率",
	T008: "滚动市销率",
	T009: "滚动市现率"
};
const INDUSTRY_VALUATION_QUERY_TYPE_01_RESULT_SET_SPECS = [
	{
		name: "individual_stock",
		index: 0,
		fieldMap: INDUSTRY_VALUATION_QUERY_TYPE_01_FIELDS,
		headers: [
			"证券代码",
			"证券名称",
			"交易日期",
			"滚动市盈率"
		],
		layout: "table",
		maxRows: 30
	},
	{
		name: "industry_board",
		index: 1,
		fieldMap: INDUSTRY_VALUATION_QUERY_TYPE_01_FIELDS,
		headers: [
			"证券代码",
			"证券名称",
			"交易日期",
			"滚动市盈率"
		],
		layout: "table",
		maxRows: 30
	},
	{
		name: "hs300",
		index: 2,
		fieldMap: INDUSTRY_VALUATION_QUERY_TYPE_01_FIELDS,
		headers: [
			"证券代码",
			"证券名称",
			"交易日期",
			"滚动市盈率"
		],
		layout: "table",
		maxRows: 30
	},
	{
		name: "meta",
		index: 3,
		fieldMap: INDUSTRY_VALUATION_QUERY_TYPE_01_META_FIELDS,
		headers: ["交易日期"],
		layout: "record"
	}
];
const INDUSTRY_VALUATION_QUERY_TYPE_02_RESULT_SET_SPECS = [
	{
		name: "components",
		index: 0,
		fieldMap: INDUSTRY_VALUATION_QUERY_TYPE_02_COMPONENT_FIELDS,
		headers: [
			"排名",
			"证券代码",
			"证券名称",
			"交易日期",
			"滚动市盈率",
			"静态市盈率",
			"最新市净率",
			"滚动市销率",
			"滚动市现率",
			"市场"
		],
		layout: "table",
		maxRows: 30
	},
	{
		name: "industry_board_snapshot",
		index: 1,
		fieldMap: INDUSTRY_VALUATION_QUERY_TYPE_02_SNAPSHOT_FIELDS,
		headers: [
			"证券代码",
			"证券名称",
			"交易日期",
			"滚动市盈率",
			"静态市盈率",
			"最新市净率",
			"滚动市销率",
			"滚动市现率",
			"市场"
		],
		layout: "table",
		maxRows: 20
	},
	{
		name: "hs300_snapshot",
		index: 2,
		fieldMap: INDUSTRY_VALUATION_QUERY_TYPE_02_SNAPSHOT_FIELDS,
		headers: [
			"证券代码",
			"证券名称",
			"交易日期",
			"滚动市盈率",
			"静态市盈率",
			"最新市净率",
			"滚动市销率",
			"滚动市现率",
			"市场"
		],
		layout: "table",
		maxRows: 20
	},
	{
		name: "market_average_snapshot",
		index: 3,
		fieldMap: INDUSTRY_VALUATION_QUERY_TYPE_02_MARKET_FIELDS,
		headers: [
			"交易日期",
			"滚动市盈率",
			"静态市盈率",
			"最新市净率",
			"滚动市销率",
			"滚动市现率"
		],
		layout: "table",
		maxRows: 20
	}
];
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/industry/chain-summary.ts
function buildIndustryChainSummary(tables, request) {
	const title = String(getFirstRowValue(tables[0], "title") ?? "").trim();
	const chartType = String(getFirstRowValue(tables[0], "chartType") ?? "").trim();
	const nodeCount = tables[1]?.rows.length ?? 0;
	const linkCount = tables[2]?.rows.length ?? 0;
	const parts = nonEmptyParts([
		title || void 0,
		chartType || void 0,
		nodeCount > 0 ? `${nodeCount} nodes` : void 0,
		linkCount > 0 ? `${linkCount} links` : void 0
	]);
	return `${request.industryCode} industry chain${parts.length > 0 ? ` - ${parts.join(", ")}` : ""}`;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/industry/chain-parser.ts
const INDUSTRY_CHAIN_METADATA_FIELDS = {
	T001: "标题",
	T002: "状态标记",
	T003: "创建时间",
	T004: "图表类型",
	T005: "画布宽度",
	T006: "画布高度",
	moduser: "修改人",
	modtime: "修改时间",
	rec_id: "记录编号"
};
function parseJsonObject(value) {
	if (typeof value !== "string" || !value.trim()) return;
	try {
		const parsed = JSON.parse(value);
		return isPlainObject(parsed) ? parsed : void 0;
	} catch {
		return;
	}
}
function readNestedValue(value, path) {
	let current = value;
	for (const key of path) {
		if (!isPlainObject(current)) return;
		current = current[key];
	}
	return current;
}
function getTextFromIndustryPayload(payload) {
	const candidates = [readNestedValue(payload, [
		"attrs",
		"text",
		"text"
	]), readNestedValue(payload, [
		"attrs",
		"label",
		"text"
	])];
	for (const candidate of candidates) if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
	const labels = isPlainObject(payload) ? payload.labels : void 0;
	if (Array.isArray(labels)) for (const label of labels) {
		if (!isPlainObject(label)) continue;
		const text = readNestedValue(label, [
			"attrs",
			"text",
			"text"
		]);
		if (typeof text === "string" && text.trim()) return text.trim();
	}
}
function getNumberFromIndustryPayload(payload, path) {
	const value = readNestedValue(payload, path);
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const numeric = Number(value.trim());
		if (Number.isFinite(numeric)) return numeric;
	}
}
function getStringFromIndustryPayload(payload, path) {
	const value = readNestedValue(payload, path);
	return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function normalizeMaybeCodeValue(value) {
	if (!value) return;
	const trimmed = value.trim();
	return trimmed && trimmed !== "0" ? trimmed : void 0;
}
function parseIndustryChainMetadataTable(resultSet) {
	const firstRow = resultSetToRows(resultSet)[0];
	return {
		name: "metadata",
		rows: firstRow ? [mapSelectedRowPreserveUnknown(firstRow, INDUSTRY_CHAIN_METADATA_FIELDS)] : [],
		layout: "record"
	};
}
function parseIndustryChainElementTables(resultSet) {
	const rows = resultSetToRows(resultSet);
	const nodes = [];
	const links = [];
	for (const row of rows) {
		const payload = parseJsonObject(row.T003);
		const payloadType = getStringFromIndustryPayload(payload, ["type"]) || (typeof row.T008 === "string" ? row.T008 : void 0) || "unknown";
		const elementId = getStringFromIndustryPayload(payload, ["id"]) || (typeof row.T002 === "string" ? row.T002 : void 0) || "";
		const groupId = getStringFromIndustryPayload(payload, ["group_id"]) || (row.T004 !== void 0 ? String(row.T004) : void 0);
		if (/arrow/i.test(payloadType)) {
			const linkRow = {
				elementId,
				type: payloadType
			};
			const sourceId = getStringFromIndustryPayload(payload, ["source", "id"]);
			const targetId = getStringFromIndustryPayload(payload, ["target", "id"]);
			const vertexCount = Array.isArray(payload?.vertices) ? payload.vertices.length : 0;
			if (sourceId) linkRow.sourceId = sourceId;
			if (targetId) linkRow.targetId = targetId;
			if (groupId) linkRow.groupId = groupId;
			if (vertexCount > 0) linkRow.vertexCount = vertexCount;
			links.push(linkRow);
			continue;
		}
		const nodeRow = {
			elementId,
			type: payloadType
		};
		const text = getTextFromIndustryPayload(payload);
		const x = getNumberFromIndustryPayload(payload, ["position", "x"]);
		const y = getNumberFromIndustryPayload(payload, ["position", "y"]);
		const width = getNumberFromIndustryPayload(payload, ["size", "width"]);
		const height = getNumberFromIndustryPayload(payload, ["size", "height"]);
		const industryCode = normalizeMaybeCodeValue(getStringFromIndustryPayload(payload, ["hyid"]));
		const productLineId = normalizeMaybeCodeValue(getStringFromIndustryPayload(payload, ["plid"]));
		const stockId = normalizeMaybeCodeValue(getStringFromIndustryPayload(payload, ["gsid"]));
		const backgroundId = normalizeMaybeCodeValue(getStringFromIndustryPayload(payload, ["backid"]));
		const hasStock = row.hasGs !== void 0 ? toDisplayValue(row.hasGs, "hasStock") : void 0;
		if (text) nodeRow.text = text;
		if (x !== void 0) nodeRow.x = x;
		if (y !== void 0) nodeRow.y = y;
		if (width !== void 0) nodeRow.width = width;
		if (height !== void 0) nodeRow.height = height;
		if (industryCode) nodeRow.industryCode = industryCode;
		if (productLineId) nodeRow.productLineId = productLineId;
		if (stockId) nodeRow.stockId = stockId;
		if (backgroundId) nodeRow.backgroundId = backgroundId;
		if (groupId) nodeRow.groupId = groupId;
		if (hasStock !== void 0 && hasStock !== "") nodeRow.hasStock = hasStock;
		nodes.push(nodeRow);
	}
	return [{
		name: "graph_nodes",
		rows: nodes,
		headers: [
			"文本",
			"类型",
			"行业代码",
			"产品线编号",
			"股票编号",
			"横坐标",
			"纵坐标",
			"宽度",
			"高度",
			"分组编号",
			"是否含个股",
			"元素编号"
		],
		layout: "table",
		maxRows: 30
	}, {
		name: "graph_links",
		rows: links,
		headers: [
			"类型",
			"来源编号",
			"目标编号",
			"顶点数量",
			"分组编号",
			"元素编号"
		],
		layout: "table",
		maxRows: 30
	}];
}
function parseIndustryChainResultSets(rawData) {
	const tables = [];
	const { hitCache, errorCode } = readRawCacheInfo(rawData);
	if (!isResultSetResponse(rawData) || !Array.isArray(rawData.ResultSets)) return {
		tables,
		hitCache,
		errorCode
	};
	tables.push(parseIndustryChainMetadataTable(rawData.ResultSets[0]));
	tables.push(...parseIndustryChainElementTables(rawData.ResultSets[1]));
	return {
		tables,
		hitCache,
		errorCode
	};
}
function transformIndustryChainPreset(rawData, request) {
	const { tables, hitCache, errorCode } = parseIndustryChainResultSets(rawData);
	return {
		parser: "industry_chain",
		summary: buildIndustryChainSummary(tables, { industryCode: asOptionalString$1(String(request.industryCode ?? "")) ?? "" }),
		tables: tables.map((table) => normalizeParsedTable(table)),
		hitCache,
		errorCode
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/industry/summary.ts
function buildIndustryImportantEventsSummary(tables) {
	const rowCount = tables[0]?.rows.length ?? 0;
	const latestDate = String(getFirstRowValue(tables[0], "date") ?? getFirstRowValue(tables[0], "createdAt") ?? "").trim();
	const parts = nonEmptyParts([latestDate ? `最新日期 ${String(formatCompactDate(latestDate))}` : void 0, rowCount > 0 ? `事件 ${rowCount} 条` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildIndustryValuationQueryType01Summary(tables) {
	const latestDate = String(getFirstRowValue(tables[3], "tradeDate") ?? getFirstRowValue(tables[0], "tradeDate") ?? getFirstRowValue(tables[1], "tradeDate") ?? getFirstRowValue(tables[2], "tradeDate") ?? "").trim();
	const parts = nonEmptyParts([
		latestDate ? `最新日期 ${String(formatCompactDate(latestDate))}` : void 0,
		(tables[0]?.rows.length ?? 0) > 0 ? `个股 ${tables[0]?.rows.length ?? 0} 条` : void 0,
		(tables[1]?.rows.length ?? 0) > 0 ? `行业板块 ${tables[1]?.rows.length ?? 0} 条` : void 0,
		(tables[2]?.rows.length ?? 0) > 0 ? `沪深300 ${tables[2]?.rows.length ?? 0} 条` : void 0
	]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
function buildIndustryValuationQueryType02Summary(tables) {
	const latestDate = String(getFirstRowValue(tables[1], "tradeDate") ?? getFirstRowValue(tables[2], "tradeDate") ?? getFirstRowValue(tables[3], "tradeDate") ?? getFirstRowValue(tables[0], "tradeDate") ?? "").trim();
	const parts = nonEmptyParts([
		latestDate ? `最新日期 ${String(formatCompactDate(latestDate))}` : void 0,
		(tables[0]?.rows.length ?? 0) > 0 ? `个股 ${tables[0]?.rows.length ?? 0} 条` : void 0,
		(tables[1]?.rows.length ?? 0) > 0 ? `行业板块 ${tables[1]?.rows.length ?? 0} 条` : void 0,
		(tables[2]?.rows.length ?? 0) > 0 ? `沪深300 ${tables[2]?.rows.length ?? 0} 条` : void 0,
		(tables[3]?.rows.length ?? 0) > 0 ? `市场平均 ${tables[3]?.rows.length ?? 0} 条` : void 0
	]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/main-position/summary.ts
function buildInstitutionalHoldingSummarySummary(tables, request) {
	const latestPeriod = String(getFirstRowValue(tables[0], "报告期") ?? "").trim();
	const institutionCount = getFirstRowValue(tables[0], "机构家数");
	const holdingRatio = getFirstRowValue(tables[0], "持仓比例(%)");
	const floatRatio = getFirstRowValue(tables[0], "占流通股比例(%)");
	const parts = nonEmptyParts([
		latestPeriod ? `最新报告期 ${latestPeriod}` : void 0,
		institutionCount !== void 0 ? `机构家数 ${String(institutionCount)}` : void 0,
		holdingRatio !== void 0 ? `持仓比例 ${String(holdingRatio)}%` : void 0,
		floatRatio !== void 0 ? `占流通股 ${String(floatRatio)}%` : void 0
	]);
	return `${request.code} 机构持股汇总${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildInstitutionalHoldingDatesSummary(tables, request) {
	const latestPeriod = String(getFirstRowValue(tables[0], "报告期") ?? "").trim();
	const rowCount = tables[0]?.rows.length ?? 0;
	const parts = nonEmptyParts([rowCount > 0 ? `${rowCount} 个可用报告期` : void 0, latestPeriod ? `最新 ${latestPeriod}` : void 0]);
	return `${request.code} 机构持股可用日期${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildInstitutionalHoldingOverviewSummary(tables, request) {
	const reportDate = request.reportDate ? String(formatCompactDate(request.reportDate)) : "";
	const rowCount = tables[0]?.rows.length ?? 0;
	const topType = String(getFirstRowValue(tables[0], "机构类型") ?? "").trim();
	const topCount = getFirstRowValue(tables[0], "持股家数");
	const parts = nonEmptyParts([
		reportDate ? `报告期 ${reportDate}` : void 0,
		rowCount > 0 ? `${rowCount} 类机构` : void 0,
		topType ? `首行机构类型 ${topType}` : void 0,
		topCount !== void 0 ? `持股家数 ${String(topCount)}` : void 0
	]);
	return `${request.code} 机构持股整体${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildInstitutionalHoldingDetailSummary(tables, request) {
	const reportDate = request.reportDate ? String(formatCompactDate(request.reportDate)) : "";
	const detailRows = tables[0]?.rows.length ?? 0;
	const totalCount = getFirstRowValue(tables[2], "总条数");
	const firstHolder = String(getFirstRowValue(tables[0], "机构名称") ?? "").trim();
	const parts = nonEmptyParts([
		reportDate ? `报告期 ${reportDate}` : void 0,
		detailRows > 0 ? `当前页 ${detailRows} 条` : void 0,
		totalCount !== void 0 ? `总条数 ${String(totalCount)}` : void 0,
		firstHolder ? `首条机构 ${firstHolder}` : void 0
	]);
	return `${request.code} 机构持股明细${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildNorthboundFundsSummary(tables, request) {
	const dateLabel = request.date ? String(formatCompactDate(request.date)) : String(getFirstRowValue(tables[0], "日期") ?? "").trim();
	const holdingAmount = getFirstRowValue(tables[0], "北向持股数量");
	const floatRatio = getFirstRowValue(tables[0], "占流通境内上市普通股比例(%)");
	const rowCount = tables[0]?.rows.length ?? 0;
	const parts = nonEmptyParts([
		dateLabel ? `日期 ${dateLabel}` : void 0,
		holdingAmount !== void 0 ? `持股数量 ${String(holdingAmount)}` : void 0,
		floatRatio !== void 0 ? `占流通境内上市普通股 ${String(floatRatio)}%` : void 0,
		rowCount > 0 ? `${rowCount} 条记录` : void 0
	]);
	return `${request.code} 北向资金${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildInstitutionalHoldingPriceCompareSummary(tables, request) {
	const fundPeriod = String(getFirstRowValue(tables[0], "报告期") ?? "").trim();
	const fundRatio = getFirstRowValue(tables[0], "基金持仓比例(%)");
	const nonFundPeriod = String(getFirstRowValue(tables[1], "报告期") ?? "").trim();
	const nonFundRatio = getFirstRowValue(tables[1], "非基金持仓比例(%)");
	const price = getFirstRowValue(tables[0], "股价(元)") ?? getFirstRowValue(tables[1], "股价(元)");
	const parts = nonEmptyParts([
		fundPeriod ? `基金最新 ${fundPeriod}${fundRatio !== void 0 ? ` / ${String(fundRatio)}%` : ""}` : void 0,
		nonFundPeriod ? `非基金最新 ${nonFundPeriod}${nonFundRatio !== void 0 ? ` / ${String(nonFundRatio)}%` : ""}` : void 0,
		price !== void 0 ? `股价 ${String(price)} 元` : void 0
	]);
	return `${request.code} 机构持仓与股价对比${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/main-position/specs.ts
const INSTITUTIONAL_HOLDING_SUMMARY_FIELDS = {
	T002: "报告期",
	T003: "机构家数",
	T004: "机构家数变化",
	T005: "累计持股数量",
	T006: "累计持股市值",
	T007: "持仓比例(%)",
	T008: "持仓比例变动(%)",
	T010: "占流通股比例(%)",
	T014: "占流通股比例变动(%)"
};
const INSTITUTIONAL_HOLDING_DATES_FIELDS = { T002: "报告期" };
const INSTITUTIONAL_HOLDING_OVERVIEW_FIELDS = {
	sT012: "机构类型",
	T012: "机构类型代码",
	T003: "持股家数",
	T005: "持股数量(万股)",
	T008: "占流通股比例(%)"
};
const INSTITUTIONAL_HOLDING_DETAIL_FIELDS = {
	T003: "机构名称",
	T011: "机构类型",
	T004: "持股数量",
	T005: "持股变动",
	T006: "持仓市值",
	T008: "占流通股比例(%)"
};
const INSTITUTIONAL_HOLDING_DETAIL_PAGE_FIELDS = {
	page: "页码",
	rq: "报告期"
};
const INSTITUTIONAL_HOLDING_DETAIL_SUMMARY_FIELDS = { count: "总条数" };
const NORTHBOUND_FUNDS_FIELDS = {
	N001: "日期",
	N002: "北向持股数量",
	N003: "北向持股市值",
	N004: "占总股本比例(%)",
	N005: "占流通境内上市普通股比例(%)",
	N006: "持股变动"
};
const FUND_HOLDING_PRICE_COMPARE_FIELDS = {
	N001: "报告期",
	N002: "基金持仓比例(%)",
	N003: "股价(元)"
};
const NON_FUND_HOLDING_PRICE_COMPARE_FIELDS = {
	N001: "报告期",
	N002: "非基金持仓比例(%)",
	N003: "股价(元)"
};
const INSTITUTIONAL_HOLDING_SUMMARY_SPEC = {
	getResultSetSpec(resultSetKey, fallbackIndex) {
		const key = resultSetKey || `table${fallbackIndex}`;
		if (fallbackIndex === 0 || key === "table0") return {
			name: "机构持股汇总",
			fieldMap: INSTITUTIONAL_HOLDING_SUMMARY_FIELDS,
			headers: [
				"报告期",
				"机构家数",
				"机构家数变化",
				"累计持股数量",
				"累计持股市值",
				"持仓比例(%)",
				"持仓比例变动(%)",
				"占流通股比例(%)",
				"占流通股比例变动(%)"
			],
			layout: "table",
			maxRows: 20
		};
		return {
			name: key,
			layout: "table"
		};
	},
	buildSummary(tables, request) {
		return buildInstitutionalHoldingSummarySummary(tables, request);
	}
};
const INSTITUTIONAL_HOLDING_DATES_SPEC = {
	getResultSetSpec(resultSetKey, fallbackIndex) {
		const key = resultSetKey || `table${fallbackIndex}`;
		if (fallbackIndex === 0 || key === "table0") return {
			name: "可用报告期",
			fieldMap: INSTITUTIONAL_HOLDING_DATES_FIELDS,
			headers: ["报告期"],
			layout: "table",
			maxRows: 50
		};
		return {
			name: key,
			layout: "table"
		};
	},
	buildSummary(tables, request) {
		return buildInstitutionalHoldingDatesSummary(tables, request);
	}
};
const INSTITUTIONAL_HOLDING_OVERVIEW_SPEC = {
	getResultSetSpec(resultSetKey, fallbackIndex) {
		const key = resultSetKey || `table${fallbackIndex}`;
		if (fallbackIndex === 0 || key === "table0") return {
			name: "机构持股整体",
			fieldMap: INSTITUTIONAL_HOLDING_OVERVIEW_FIELDS,
			headers: [
				"机构类型",
				"持股家数",
				"持股数量(万股)",
				"占流通股比例(%)",
				"机构类型代码"
			],
			layout: "table",
			maxRows: 20
		};
		return {
			name: key,
			layout: "table"
		};
	},
	buildSummary(tables, request) {
		return buildInstitutionalHoldingOverviewSummary(tables, request);
	}
};
const INSTITUTIONAL_HOLDING_DETAIL_SPEC = {
	getResultSetSpec(resultSetKey, fallbackIndex) {
		const key = resultSetKey || `table${fallbackIndex}`;
		if (fallbackIndex === 0 || key === "table0") return {
			name: "机构持股明细",
			fieldMap: INSTITUTIONAL_HOLDING_DETAIL_FIELDS,
			headers: [
				"机构名称",
				"机构类型",
				"持股数量",
				"持股变动",
				"持仓市值",
				"占流通股比例(%)"
			],
			layout: "table",
			maxRows: 30
		};
		if (fallbackIndex === 1 || key === "table1") return {
			name: "分页信息",
			fieldMap: INSTITUTIONAL_HOLDING_DETAIL_PAGE_FIELDS,
			layout: "record"
		};
		if (fallbackIndex === 2 || key === "table2") return {
			name: "汇总信息",
			fieldMap: INSTITUTIONAL_HOLDING_DETAIL_SUMMARY_FIELDS,
			layout: "record"
		};
		return {
			name: key,
			layout: "table"
		};
	},
	buildSummary(tables, request) {
		return buildInstitutionalHoldingDetailSummary(tables, request);
	}
};
const NORTHBOUND_FUNDS_SPEC = {
	getResultSetSpec(resultSetKey, fallbackIndex) {
		const key = resultSetKey || `table${fallbackIndex}`;
		if (fallbackIndex === 0 || key === "table0") return {
			name: "北向资金",
			fieldMap: NORTHBOUND_FUNDS_FIELDS,
			headers: [
				"日期",
				"北向持股数量",
				"北向持股市值",
				"占总股本比例(%)",
				"占流通境内上市普通股比例(%)",
				"持股变动"
			],
			layout: "table",
			maxRows: 20
		};
		return {
			name: key,
			layout: "table"
		};
	},
	buildSummary(tables, request) {
		return buildNorthboundFundsSummary(tables, request);
	}
};
const INSTITUTIONAL_HOLDING_PRICE_COMPARE_SPEC = {
	getResultSetSpec(resultSetKey, fallbackIndex) {
		const key = resultSetKey || `table${fallbackIndex}`;
		if (fallbackIndex === 0 || key === "table0") return {
			name: "基金持仓与股价对比",
			fieldMap: FUND_HOLDING_PRICE_COMPARE_FIELDS,
			headers: [
				"报告期",
				"基金持仓比例(%)",
				"股价(元)"
			],
			layout: "table",
			maxRows: 20
		};
		if (fallbackIndex === 1 || key === "table1") return {
			name: "非基金持仓与股价对比",
			fieldMap: NON_FUND_HOLDING_PRICE_COMPARE_FIELDS,
			headers: [
				"报告期",
				"非基金持仓比例(%)",
				"股价(元)"
			],
			layout: "table",
			maxRows: 20
		};
		return {
			name: key,
			layout: "table"
		};
	},
	buildSummary(tables, request) {
		return buildInstitutionalHoldingPriceCompareSummary(tables, request);
	}
};
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/main-position/parser.ts
function parseMainPositionResultSets(rawData, specGetter) {
	const tables = [];
	const { hitCache, errorCode } = readRawCacheInfo(rawData);
	if (!isResultSetResponse(rawData) || !Array.isArray(rawData.ResultSets)) return {
		tables,
		hitCache,
		errorCode
	};
	rawData.ResultSets.forEach((resultSet, index) => {
		if (!isResultSet(resultSet)) return;
		const spec = specGetter(resultSet.ResultSetKey || "", index);
		tables.push({
			name: spec.name,
			rows: resultSetToRows(resultSet).map((row) => spec.fieldMap ? mapSelectedRowPreserveUnknown(row, spec.fieldMap) : mapResultRow(row)),
			headers: spec.headers,
			layout: spec.layout,
			maxRows: spec.maxRows
		});
	});
	return {
		tables,
		hitCache,
		errorCode
	};
}
function createMainPositionPresetTransform(preset, getSpec, buildRequestParams) {
	return (rawData, request) => {
		const code = asOptionalString$1(String(request.code ?? "")) ?? "";
		const spec = getSpec();
		const { tables, hitCache, errorCode } = parseMainPositionResultSets(rawData, spec.getResultSetSpec);
		return buildTransformedFromParsed(preset, {
			summary: spec.buildSummary(tables, buildRequestParams(request, code)),
			tables,
			hitCache,
			errorCode
		});
	};
}
const REPORT_RATING_RESULT_SET_SPECS = [{
	name: "report_ratings",
	index: 0,
	fieldMap: {
		T001: "机构名称",
		T002: "行业评级",
		T003: "评级变化",
		T004: "报告日期",
		T005: "报告标题",
		T006: "评级变动",
		T007: "评级变化原因"
	},
	headers: [
		"机构名称",
		"行业评级",
		"评级变化",
		"报告日期",
		"报告标题",
		"评级变动",
		"评级变化原因"
	],
	layout: "table",
	maxRows: 20
}];
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/report-rating/summary.ts
function buildReportRatingSummary(tables) {
	const rowCount = tables[0]?.rows.length ?? 0;
	const latestReportDate = String(getFirstRowValue(tables[0], "reportDate") ?? "").trim();
	const parts = nonEmptyParts([latestReportDate ? `最新 ${String(formatCompactDate(latestReportDate))}` : void 0, rowCount > 0 ? `研报 ${rowCount} 条` : void 0]);
	return parts.length > 0 ? parts.join(" | ") : void 0;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/share-capital/summary.ts
function buildShareCapitalStructureSummary(tables, code) {
	const latestChangeDate = String(getFirstRowValue(tables[1], "最新变动日期") ?? getFirstRowValue(tables[0], "变动日期") ?? "").trim();
	const rowCount = tables[0]?.rows.length ?? 0;
	const parts = nonEmptyParts([latestChangeDate ? `最新变动日期 ${latestChangeDate}` : void 0, rowCount > 0 ? `${rowCount} 条记录` : void 0]);
	return `${code} 股本构成${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildShareCapitalChangesSummary(tables, code) {
	const latestChangeDate = String(getFirstRowValue(tables[0], "变动日期") ?? "").trim();
	const reasonCount = tables[1]?.rows.length ?? 0;
	const rowCount = tables[0]?.rows.length ?? 0;
	const parts = nonEmptyParts([
		latestChangeDate ? `最近变动 ${latestChangeDate}` : void 0,
		rowCount > 0 ? `${rowCount} 条变动记录` : void 0,
		reasonCount > 0 ? `${reasonCount} 条原因说明` : void 0
	]);
	return `${code} 股本变动情况${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildRestrictedShareUnlocksSummary(tables, code) {
	const nearestUnlockDate = String(getFirstRowValue(tables[0], "解禁日") ?? "").trim();
	const rowCount = tables[0]?.rows.length ?? 0;
	const refDate = String(getFirstRowValue(tables[2], "日期") ?? "").trim();
	const parts = nonEmptyParts([
		nearestUnlockDate ? `最近解禁日 ${nearestUnlockDate}` : void 0,
		refDate ? `参考日期 ${refDate}` : void 0,
		rowCount > 0 ? `${rowCount} 条记录` : void 0
	]);
	return `${code} 限售解禁${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildStockBuybackSummary(tables, code) {
	const latestNoticeDate = String(getFirstRowValue(tables[0], "最新公告日") ?? "").trim();
	const progress = String(getFirstRowValue(tables[0], "回购进度") ?? "").trim();
	const purpose = String(getFirstRowValue(tables[0], "回购用途") ?? "").trim();
	const parts = nonEmptyParts([
		latestNoticeDate ? `最新公告日 ${latestNoticeDate}` : void 0,
		progress ? `进度 ${progress}` : void 0,
		purpose ? `用途 ${purpose}` : void 0
	]);
	return `${code} 股票回购${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/share-capital/specs.ts
const SHARE_CAPITAL_STRUCTURE_FIELDS = {
	T002: "变动日期",
	T003: "总股本",
	T004: "实际流通境内上市普通股",
	T005: "流通受限股份",
	T009: "限售境内上市普通股",
	T010: "流通境内上市普通股",
	T011: "境内上市普通股合计",
	T013: "实际流通境内上市外资股",
	T014: "境内上市外资股合计",
	T016: "实际流通境外上市外资股",
	T017: "境外上市股份合计",
	T018: "其他",
	T019: "实际流通股份",
	T021: "未流通股份"
};
const SHARE_CAPITAL_STRUCTURE_META_FIELDS = { curd: "最新变动日期" };
const SHARE_CAPITAL_CHANGE_FIELDS = {
	T002: "变动日期",
	T003: "总股本",
	T004: "实际流通境内上市普通股",
	T005: "流通受限股份",
	T006: "总股本变动率(%)",
	T007: "实际流通境内上市普通股变动率(%)",
	T008: "变动原因编码"
};
const SHARE_CAPITAL_CHANGE_REASON_FIELDS = {
	T002: "变动原因编码",
	T003: "变动原因"
};
const RESTRICTED_SHARE_UNLOCK_FIELDS = {
	T003: "解禁日",
	T014: "成本价",
	T013: "限售股份上市日",
	T011: "公告日期",
	T012: "状态",
	cur: "当前日期",
	T006: "限售原因",
	T004: "解禁数量(万股)",
	T010: "总股本(万股)",
	price: "收盘价"
};
const RESTRICTED_SHARE_UNLOCK_ADJUSTMENT_FIELDS = {
	BqDate: "变迁日期",
	Sg: "送股&(比例)"
};
const RESTRICTED_SHARE_UNLOCK_META_FIELDS = { EndDate: "日期" };
const STOCK_BUYBACK_FIELDS = {
	N001: "最新公告日",
	N002: "回购进度",
	N003: "回购预案",
	N004: "董事会预案公告日",
	N005: "拟回购数量(股)",
	N006: "占总股本比例(%)",
	N007: "拟回购价格上限(元)",
	N008: "拟回购资金上限(元)",
	N009: "回购计划开始日",
	N010: "回购计划期满日",
	N011: "回购实施",
	N012: "已回购数量(股)",
	N013: "占拟回购数量比例(%)",
	N014: "占总股本比(%)",
	N015: "已回购金额(元)",
	N016: "占拟回购资金比例(%)",
	N017: "已回购成交最高价(元)",
	N018: "已回购成交最低价(元)",
	N019: "回购均价(元)",
	N020: "较最新收盘价涨跌幅(%)",
	N021: "回购用途",
	N022: "记录编号调整说明"
};
const SHARE_CAPITAL_STRUCTURE_SPEC = {
	toolName: "share_capital_structure",
	fixedTag: "gbjg",
	resultSets: [{
		name: "股本构成",
		fieldMap: SHARE_CAPITAL_STRUCTURE_FIELDS,
		headers: [
			"变动日期",
			"总股本",
			"实际流通境内上市普通股",
			"流通受限股份",
			"限售境内上市普通股",
			"流通境内上市普通股",
			"境内上市普通股合计",
			"实际流通境内上市外资股",
			"境内上市外资股合计",
			"实际流通境外上市外资股",
			"境外上市股份合计",
			"其他",
			"实际流通股份",
			"未流通股份"
		],
		layout: "table",
		maxRows: 20
	}, {
		name: "最新变动日期",
		fieldMap: SHARE_CAPITAL_STRUCTURE_META_FIELDS,
		layout: "record"
	}],
	buildSummary: buildShareCapitalStructureSummary
};
const SHARE_CAPITAL_CHANGES_SPEC = {
	toolName: "share_capital_changes",
	fixedTag: "gbbd",
	resultSets: [{
		name: "股本变动情况",
		fieldMap: SHARE_CAPITAL_CHANGE_FIELDS,
		headers: [
			"变动日期",
			"总股本",
			"实际流通境内上市普通股",
			"流通受限股份",
			"总股本变动率(%)",
			"实际流通境内上市普通股变动率(%)",
			"变动原因编码"
		],
		layout: "table",
		maxRows: 20
	}, {
		name: "变动原因说明",
		fieldMap: SHARE_CAPITAL_CHANGE_REASON_FIELDS,
		headers: ["变动原因编码", "变动原因"],
		layout: "table",
		maxRows: 20
	}],
	buildSummary: buildShareCapitalChangesSummary
};
const RESTRICTED_SHARE_UNLOCKS_SPEC = {
	toolName: "restricted_share_unlocks",
	fixedTag: "xslt",
	resultSets: [
		{
			name: "限售解禁表",
			fieldMap: RESTRICTED_SHARE_UNLOCK_FIELDS,
			headers: [
				"解禁日",
				"成本价",
				"限售股份上市日",
				"公告日期",
				"状态",
				"当前日期",
				"限售原因",
				"解禁数量(万股)",
				"总股本(万股)",
				"收盘价"
			],
			layout: "table",
			maxRows: 20
		},
		{
			name: "变迁信息",
			fieldMap: RESTRICTED_SHARE_UNLOCK_ADJUSTMENT_FIELDS,
			headers: ["变迁日期", "送股&(比例)"],
			layout: "table",
			maxRows: 20
		},
		{
			name: "参考日期",
			fieldMap: RESTRICTED_SHARE_UNLOCK_META_FIELDS,
			layout: "record"
		}
	],
	buildSummary: buildRestrictedShareUnlocksSummary
};
const STOCK_BUYBACK_SPEC = {
	toolName: "stock_buyback",
	fixedTag: "gphg",
	resultSets: [{
		name: "股票回购",
		fieldMap: STOCK_BUYBACK_FIELDS,
		layout: "record"
	}],
	buildSummary: buildStockBuybackSummary
};
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/share-capital/parser.ts
function parseShareCapitalResult(rawData, toolSpec, params) {
	const parsed = parseSequentialResultTables(rawData, toolSpec.resultSets);
	if (!parsed) return null;
	return {
		toolName: toolSpec.toolName,
		code: params.code.trim(),
		fixedTag: toolSpec.fixedTag,
		summary: toolSpec.buildSummary(parsed.tables, params.code.trim()),
		tables: parsed.tables,
		hitCache: parsed.hitCache,
		errorCode: parsed.errorCode
	};
}
function createShareCapitalPresetTransform(preset, getSpec) {
	return (rawData, request) => {
		const code = asOptionalString$1(String(request.code ?? "")) ?? "";
		return buildTransformedFromParsed(preset, parseShareCapitalResult(rawData, getSpec(), { code }));
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/shareholder/summary.ts
function buildControllingShareholderSummary(tables, code) {
	const cutoffDate = String(getFirstRowValue(tables[0], "截止日期") ?? "").trim();
	const controllingHolder = String(getFirstRowValue(tables[0], "控股股东") ?? "").trim();
	const controllingRatio = formatPercentValue(getFirstRowValue(tables[0], "控股股东持股比例(%)"));
	const actualController = String(getFirstRowValue(tables[0], "实际控制人") ?? "").trim();
	const actualControlRatio = formatPercentValue(getFirstRowValue(tables[0], "实际控制人控股持股比例(%)"));
	const parts = nonEmptyParts([
		cutoffDate ? `截止 ${cutoffDate}` : void 0,
		controllingHolder ? `控股股东 ${controllingHolder}${controllingRatio ? ` (${controllingRatio})` : ""}` : void 0,
		actualController ? `实际控制人 ${actualController}${actualControlRatio ? ` (${actualControlRatio})` : ""}` : void 0
	]);
	return `${code} 控股股东与实际控制人${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildShareholderCountSummary(tables, code) {
	const cutoffDate = String(getFirstRowValue(tables[0], "截止日期") ?? "").trim();
	const holderCount = getFirstRowValue(tables[0], "股东人数(户)");
	const changePct = formatPercentValue(getFirstRowValue(tables[0], "股东人数较上期变化(%)"));
	const changeAbs = getFirstRowValue(tables[0], "股东户数较上期变化");
	const price = getFirstRowValue(tables[0], "股价(元)");
	const parts = nonEmptyParts([
		cutoffDate ? `截止 ${cutoffDate}` : void 0,
		holderCount !== void 0 ? `股东人数 ${String(holderCount)} 户` : void 0,
		changeAbs !== void 0 || changePct ? `较上期变化 ${String(changeAbs ?? "-")}${changePct ? ` (${changePct})` : ""}` : void 0,
		price !== void 0 ? `股价 ${String(price)} 元` : void 0
	]);
	return `${code} 股东人数与股价比较${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildShareholderCountRankSummary(tables, code) {
	const rows = tables[0]?.rows ?? [];
	const currentIndex = rows.findIndex((row) => String(row["证券代码"] ?? "").trim() === code);
	const currentChange = formatPercentValue((currentIndex >= 0 ? rows[currentIndex] : void 0)?.["较上期变化(%)"]);
	const parts = nonEmptyParts([
		rows.length > 0 ? `${rows.length} 条排名记录` : void 0,
		currentIndex >= 0 ? `当前股票排名 ${currentIndex + 1}` : void 0,
		currentChange ? `较上期变化 ${currentChange}` : void 0
	]);
	return `${code} 股东人数增减量排名${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildTopFloatShareholdersSummary(tables, code) {
	const latestDate = String(getFirstRowValue(tables[0], "变动日期") ?? getFirstRowValue(tables[1], "变动日期") ?? "").trim();
	const floatShares = getFirstRowValue(tables[0], "实际流通股份");
	const detailRows = tables[1]?.rows.length ?? 0;
	const detailPeriods = countDistinctValues(tables[1]?.rows ?? [], "变动日期");
	const parts = nonEmptyParts([
		latestDate ? `最新变动日 ${latestDate}` : void 0,
		floatShares !== void 0 ? `实际流通股份 ${String(floatShares)}` : void 0,
		detailRows > 0 ? `${detailPeriods || 1} 个日期 / ${detailRows} 条股东明细` : void 0
	]);
	return `${code} 十大流通股东${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
function buildTopShareholdersSummary(tables, code) {
	const rows = tables[0]?.rows ?? [];
	const latestDate = String(getFirstRowValue(tables[0], "日期") ?? "").trim();
	const firstHolder = String(getFirstRowValue(tables[0], "股东名称") ?? "").trim();
	const distinctDates = countDistinctValues(rows, "日期");
	const parts = nonEmptyParts([
		latestDate ? `最新日期 ${latestDate}` : void 0,
		firstHolder ? `首位股东 ${firstHolder}` : void 0,
		rows.length > 0 ? `${distinctDates || 1} 个日期 / ${rows.length} 条记录` : void 0
	]);
	return `${code} 十大股东${parts.length > 0 ? ` - ${parts.join("，")}` : ""}`;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/shareholder/specs.ts
const CONTROLLING_SHAREHOLDER_FIELDS = {
	T001: "截止日期",
	kggd: "控股股东",
	T004: "控股股东持股比例(%)",
	sjkzr: "实际控制人",
	T006: "实际控制人控股持股比例(%)",
	zzkzr: "最终控制人",
	T008: "最终控制人控股持股比例(%)",
	T009: "控股关系",
	N005: "第一大股东",
	ifdidgd: "是否展示第一大股东"
};
const SHAREHOLDER_COUNT_FIELDS = {
	T002: "截止日期",
	T003: "股东人数(户)",
	T004: "人均流通股(股)",
	T005: "股东人数较上期变化(%)",
	T006: "人均流通股数较上期变化(%)",
	T007: "股价(元)",
	T012: "股东户数较上期变化"
};
const SHAREHOLDER_COUNT_RANK_FIELDS = {
	zqdm: "证券代码",
	zqjc: "证券简称",
	sc: "证券市场",
	T003: "股东人数",
	T005: "较上期变化(%)"
};
const TOP_FLOAT_SHAREHOLDER_SUMMARY_FIELDS = {
	rq: "变动日期",
	T004: "实际流通境内上市普通股",
	T013: "实际流通境内上市外资股",
	T016: "实际流通境外上市外资股",
	T019: "实际流通股份"
};
const TOP_FLOAT_SHAREHOLDER_DETAIL_FIELDS = {
	rq: "变动日期",
	gd: "股东名称",
	isbgq: "是否报告期",
	gdid: "股东编号",
	cgs: "持股数",
	lb: "股东类别",
	pos: "职务",
	xz: "股份类别",
	T009: "股份性质编码",
	tdxid: "通达信编号",
	zrr: "自然人",
	gfxz: "股份性质",
	sid: "记录号"
};
const TOP_SHAREHOLDER_FIELDS = {
	gd: "股东名称",
	rq: "日期",
	isbgq: "是否报告期",
	gdid: "股东编号",
	cgs: "持股数量",
	lb: "股东类别",
	pos: "职务",
	stp: "变动原因",
	xz: "股份类别",
	bl: "持股比例(%)",
	T009: "股份性质编码",
	tdxid: "通达信编号",
	zrr: "自然人",
	sid: "记录号",
	yzxdrgxz: "一致行动人关联组"
};
const CONTROLLING_SHAREHOLDER_SPEC = {
	toolName: "controlling_shareholder",
	fixedTag: "kggd",
	resultSets: [{
		name: "控股股东与实际控制人",
		fieldMap: CONTROLLING_SHAREHOLDER_FIELDS,
		layout: "record"
	}],
	buildSummary(tables, _request, code) {
		return buildControllingShareholderSummary(tables, code);
	}
};
const SHAREHOLDER_COUNT_SPEC = {
	toolName: "shareholder_count",
	fixedTag: "gdrs",
	resultSets: [{
		name: "股东人数与股价比较",
		fieldMap: SHAREHOLDER_COUNT_FIELDS,
		headers: [
			"截止日期",
			"股东人数(户)",
			"人均流通股(股)",
			"股东人数较上期变化(%)",
			"人均流通股数较上期变化(%)",
			"股价(元)",
			"股东户数较上期变化"
		],
		layout: "table",
		maxRows: 20
	}],
	buildSummary(tables, _request, code) {
		return buildShareholderCountSummary(tables, code);
	}
};
const SHAREHOLDER_COUNT_RANK_SPEC = {
	toolName: "shareholder_count_rank",
	fixedTag: "thygdrs",
	resultSets: [{
		name: "股东人数增减量排名",
		fieldMap: SHAREHOLDER_COUNT_RANK_FIELDS,
		headers: [
			"证券代码",
			"证券简称",
			"证券市场",
			"股东人数",
			"较上期变化(%)"
		],
		layout: "table",
		maxRows: 20
	}],
	buildSummary(tables, _request, code) {
		return buildShareholderCountRankSummary(tables, code);
	}
};
const TOP_FLOAT_SHAREHOLDERS_SPEC = {
	toolName: "top_float_shareholders",
	fixedTag: "ltgd",
	resultSets: [{
		name: "十大流通股东流通股概览",
		fieldMap: TOP_FLOAT_SHAREHOLDER_SUMMARY_FIELDS,
		headers: [
			"变动日期",
			"实际流通境内上市普通股",
			"实际流通境内上市外资股",
			"实际流通境外上市外资股",
			"实际流通股份"
		],
		layout: "table",
		maxRows: 20
	}, {
		name: "十大流通股东明细",
		fieldMap: TOP_FLOAT_SHAREHOLDER_DETAIL_FIELDS,
		headers: [
			"变动日期",
			"股东名称",
			"是否报告期",
			"股东编号",
			"持股数",
			"股东类别",
			"职务",
			"股份类别",
			"股份性质编码",
			"通达信编号",
			"自然人",
			"股份性质",
			"记录号"
		],
		layout: "table",
		maxRows: 20
	}],
	buildSummary(tables, _request, code) {
		return buildTopFloatShareholdersSummary(tables, code);
	}
};
const TOP_SHAREHOLDERS_SPEC = {
	toolName: "top_shareholders",
	fixedTag: "sdgdbgq",
	resultSets: [{
		name: "十大股东",
		fieldMap: TOP_SHAREHOLDER_FIELDS,
		headers: [
			"股东名称",
			"日期",
			"是否报告期",
			"股东编号",
			"持股数量",
			"股东类别",
			"职务",
			"变动原因",
			"股份类别",
			"持股比例(%)",
			"股份性质编码",
			"通达信编号",
			"自然人",
			"记录号",
			"一致行动人关联组"
		],
		layout: "table",
		maxRows: 20
	}],
	buildSummary(tables, _request, code) {
		return buildTopShareholdersSummary(tables, code);
	}
};
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/shareholder/parser.ts
function parseShareholderResearchResult(rawData, toolSpec, request) {
	const parsed = parseSequentialResultTables(rawData, toolSpec.resultSets);
	if (!parsed) return null;
	return {
		toolName: toolSpec.toolName,
		code: request.code,
		fixedTag: toolSpec.fixedTag,
		request,
		summary: toolSpec.buildSummary(parsed.tables, request, request.code),
		tables: parsed.tables,
		hitCache: parsed.hitCache,
		errorCode: parsed.errorCode
	};
}
function createShareholderResearchPresetTransform(preset, getSpec) {
	return (rawData, request) => {
		const code = asOptionalString$1(String(request.code ?? "")) ?? "";
		return buildTransformedFromParsed(preset, parseShareholderResearchResult(rawData, getSpec(), {
			code,
			clickIndex: asNonNegativeIntegerString(request.cursor, "1"),
			pageNo: asNonNegativeIntegerString(request.pageNo, "1"),
			pageSize: asNonNegativeIntegerString(request.pageSize, "20")
		}));
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/stock-events/summary.ts
function buildShareholderChangePresetSummary(tables, request) {
	const code = asOptionalString$1(String(request.code ?? "")) ?? "";
	const rowCount = tables[0]?.rows.length ?? 0;
	const latestEndDate = String(getFirstRowValue(tables[0], "end_date") ?? "").trim();
	return nonEmptyParts([
		code ? `${code} shareholder change` : void 0,
		latestEndDate ? `latest ${latestEndDate}` : void 0,
		rowCount > 0 ? `${rowCount} rows` : void 0
	]).join(" | ");
}
function buildBlockTradePresetSummary(tables, request) {
	const code = asOptionalString$1(String(request.code ?? "")) ?? "";
	const rowCount = tables[0]?.rows.length ?? 0;
	const latestTradeDate = String(getFirstRowValue(tables[0], "trade_date") ?? "").trim();
	return nonEmptyParts([
		code ? `${code} block trade` : void 0,
		latestTradeDate ? `latest ${latestTradeDate}` : void 0,
		rowCount > 0 ? `${rowCount} rows` : void 0
	]).join(" | ");
}
function buildTopShareholderDetailPresetSummary(tables, request) {
	const code = asOptionalString$1(String(request.code ?? "")) ?? "";
	const totalCount = String(getFirstRowValue(tables[2], "total_count") ?? "").trim();
	const reportDate = String(getFirstRowValue(tables[1], "report_date") ?? "").trim();
	const rowCount = tables[0]?.rows.length ?? 0;
	return nonEmptyParts([
		code ? `${code} top shareholder detail` : void 0,
		reportDate ? `report ${reportDate}` : void 0,
		totalCount ? `total ${totalCount}` : void 0,
		rowCount > 0 ? `page rows ${rowCount}` : void 0
	]).join(" | ");
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/stock-events/parser.ts
function parseStockEventResultSets(rawData, specGetter) {
	const tables = [];
	const { hitCache, errorCode } = readRawCacheInfo(rawData);
	if (!isResultSetResponse(rawData) || !Array.isArray(rawData.ResultSets)) return {
		tables,
		hitCache,
		errorCode
	};
	rawData.ResultSets.forEach((resultSet, index) => {
		if (!isResultSet(resultSet)) return;
		const spec = specGetter(resultSet.ResultSetKey || "", index);
		tables.push({
			name: spec.name,
			rows: resultSetToRows(resultSet).map((row) => mapResultRow(row, spec.fieldMap)),
			headers: spec.headers,
			layout: spec.layout,
			maxRows: spec.maxRows,
			resultSetKey: resultSet.ResultSetKey,
			index
		});
	});
	return {
		tables,
		hitCache,
		errorCode
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/stock-events/specs.ts
function getShareholderChangeResultSetSpec(resultSetKey, fallbackIndex) {
	const key = resultSetKey || `table${fallbackIndex}`;
	if (key === "table0") return {
		name: "change_details",
		fieldMap: {
			qs: "start_date",
			jz: "end_date"
		},
		layout: "table"
	};
	if (key === "table1") return {
		name: "share_capital_history",
		fieldMap: {
			ST002: "report_date",
			T019: "total_shares"
		},
		headers: ["报告期", "总股数"],
		layout: "table"
	};
	return {
		name: key,
		layout: "table"
	};
}
function getBlockTradeResultSetSpec(resultSetKey, fallbackIndex) {
	const key = resultSetKey || `table${fallbackIndex}`;
	if (key === "table0") return {
		name: "block_trades",
		fieldMap: {
			T003: "trade_date",
			T004: "price",
			T005: "amount_10k_cny",
			T006: "volume_10k_shares",
			T007: "buyer_department",
			T008: "seller_department",
			yjl: "premium_discount_rate"
		},
		headers: [
			"交易日期",
			"价格",
			"金额(万元)",
			"成交量(万股)",
			"买方营业部",
			"卖方营业部",
			"溢折价率"
		],
		layout: "table"
	};
	return {
		name: key,
		layout: "table"
	};
}
function getTopShareholderDetailResultSetSpec(resultSetKey, fallbackIndex) {
	const key = resultSetKey || `table${fallbackIndex}`;
	if (key === "table0") return {
		name: "top_shareholders",
		fieldMap: {
			T003: "holder_name",
			T011: "holder_type",
			T004: "holding_shares",
			T005: "share_change",
			T006: "holding_market_value",
			T008: "holding_ratio",
			N007: "ranking_info",
			N008: "short_name",
			T007: "related_code",
			N009: "related_setcode"
		},
		headers: [
			"股东名称",
			"股东类型",
			"持股数量",
			"股份变动",
			"持股市值",
			"持股比例",
			"排名信息",
			"简称",
			"关联代码",
			"关联集合代码"
		],
		layout: "table"
	};
	if (key === "table1") return {
		name: "page_info",
		fieldMap: {
			page: "page_no",
			rq: "report_date"
		},
		headers: ["页码", "报告期"],
		layout: "table"
	};
	if (key === "table2") return {
		name: "summary",
		fieldMap: { count: "total_count" },
		headers: ["总数"],
		layout: "table"
	};
	return {
		name: key,
		layout: "table"
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/stock-events/presets.ts
function createStockEventPresetTransform(preset, specGetter, summaryBuilder) {
	return (rawData, request) => {
		const { tables, hitCache, errorCode } = parseStockEventResultSets(rawData, specGetter);
		return buildTransformedFromParsed(preset, {
			summary: summaryBuilder(tables, request),
			tables,
			hitCache,
			errorCode
		});
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/trading/specs.ts
const COMMON_TRADING_INFO_ENTRY = "TdxSharePCCW.tdxf10_gg_jyds";
const BLOCK_TRADE_INTENTION_SPEC = {
	toolName: "block_trade_intention",
	entry: "TdxSharePCCW.tdxf10_gg_iyds",
	defaultFixedTag: "yxsbxx",
	defaultTableName: "intentions",
	summaryName: "block trade intention",
	firstTableFieldMap: {
		N001: "申报日期",
		N002: "买卖方向",
		N003: "价格",
		N004: "数量",
		N005: "金额",
		N006: "溢价率"
	},
	firstTableHeaders: [
		"申报日期",
		"买卖方向",
		"价格",
		"数量",
		"金额",
		"溢价率"
	]
};
const MARGIN_TRADING_SPEC = {
	toolName: "margin_trading",
	entry: COMMON_TRADING_INFO_ENTRY,
	defaultFixedTag: "rzrq",
	defaultTableName: "margin_trading",
	summaryName: "margin trading",
	firstTableFieldMap: {
		T001: "交易日期",
		T003: "融资余额(元)",
		T004: "融资买入额(元)",
		T005: "融资偿还额(元)",
		T006: "融券余量(股)",
		T007: "融券卖出量(股)",
		T008: "融券偿还量(股)",
		bt009: "成交量",
		bt010: "成交额",
		ClosePrice: "收盘价",
		bdrq: "变动日期",
		T033: "A股股本",
		bshow: "是否显示"
	},
	firstTableHeaders: [
		"交易日期",
		"融资余额(元)",
		"融资买入额(元)",
		"融资偿还额(元)",
		"融券余量(股)",
		"融券卖出量(股)",
		"融券偿还量(股)",
		"成交量",
		"成交额",
		"收盘价",
		"变动日期",
		"A股股本",
		"是否显示"
	]
};
const REFINANCING_SPEC = {
	toolName: "refinancing",
	entry: COMMON_TRADING_INFO_ENTRY,
	defaultFixedTag: "zrq",
	defaultTableName: "refinancing",
	summaryName: "refinancing",
	firstTableFieldMap: {
		N001: "日期",
		N002: "当日收盘价(元)",
		N003: "当日涨跌幅%",
		N004: "期初余量(万股)",
		N005: "转融券融出数量(万股)",
		N006: "期末余量(万股)",
		N007: "融出市值(元)",
		N008: "期末余额(万元)"
	},
	firstTableHeaders: [
		"日期",
		"当日收盘价(元)",
		"当日涨跌幅%",
		"期初余量(万股)",
		"转融券融出数量(万股)",
		"期末余量(万股)",
		"融出市值(元)",
		"期末余额(万元)"
	]
};
const CAPITAL_FLOW_SPEC = {
	toolName: "capital_flow",
	entry: COMMON_TRADING_INFO_ENTRY,
	defaultFixedTag: "zjlx",
	defaultTableName: "capital_flow",
	summaryName: "capital flow",
	firstTableFieldMap: {
		rq: "日期",
		N001: "主力净额金额(元)",
		N002: "主力净额占比(%)",
		N003: "超大单净买入金额(元)",
		N004: "超大单净买入占比(%)",
		N005: "大单净买入金额(元)",
		N006: "大单净买入占比(%)",
		N007: "主买净额金额(元)",
		N008: "主买净额占比(%)"
	},
	firstTableHeaders: [
		"日期",
		"主力净额金额(元)",
		"主力净额占比(%)",
		"超大单净买入金额(元)",
		"超大单净买入占比(%)",
		"大单净买入金额(元)",
		"大单净买入占比(%)",
		"主买净额金额(元)",
		"主买净额占比(%)"
	]
};
const LIMIT_UP_ANALYSIS_FIELDS = {
	currq: "是否当前日期",
	lx: "类型",
	sT002: "日期",
	T011: "首次涨停时间",
	fdje: "封单金额(元)",
	zt: "涨停主题",
	yy: "原因揭秘"
};
const LIMIT_DOWN_ANALYSIS_FIELDS = {
	currq: "是否当前日期",
	lx: "类型",
	sT002: "日期",
	T011: "首次跌停时间",
	fdje: "封单金额(元)",
	zt: "涨停主题",
	yy: "原因揭秘"
};
const LIMIT_UP_ANALYSIS_SPEC = {
	toolName: "limit_up_analysis",
	entry: COMMON_TRADING_INFO_ENTRY,
	defaultFixedTag: "ztfx",
	defaultTableName: "limit_up_analysis",
	summaryName: "limit-up analysis",
	firstTableFieldMap: LIMIT_UP_ANALYSIS_FIELDS,
	firstTableHeaders: [
		"是否当前日期",
		"类型",
		"日期",
		"首次涨停时间",
		"封单金额(元)",
		"涨停主题",
		"原因揭秘"
	]
};
const LIMIT_DOWN_ANALYSIS_SPEC = {
	toolName: "limit_down_analysis",
	entry: COMMON_TRADING_INFO_ENTRY,
	defaultFixedTag: "dtfx",
	defaultTableName: "limit_down_analysis",
	summaryName: "limit-down analysis",
	firstTableFieldMap: LIMIT_DOWN_ANALYSIS_FIELDS,
	firstTableHeaders: [
		"是否当前日期",
		"类型",
		"日期",
		"首次跌停时间",
		"封单金额(元)",
		"涨停主题",
		"原因揭秘"
	]
};
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/trading/summary.ts
function buildTradingInfoSummary(code, summaryName, tables) {
	return `${code} ${summaryName} - ${tables.reduce((sum, table) => sum + table.rows.length, 0)} rows, ${tables.length} result sets`;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/domains/trading/parser.ts
function getTradingInfoResultSetSpec(toolSpec, resultSetKey, fallbackIndex) {
	const key = resultSetKey || `table${fallbackIndex}`;
	if (fallbackIndex === 0 || key === "table0") return {
		name: toolSpec.defaultTableName,
		fieldMap: toolSpec.firstTableFieldMap,
		headers: toolSpec.firstTableHeaders,
		layout: "table"
	};
	return {
		name: key,
		layout: "table"
	};
}
function parseTradingInfoResult(rawData, toolSpec, params) {
	const tables = [];
	const { hitCache, errorCode } = readRawCacheInfo(rawData);
	if (isResultSetResponse(rawData) && Array.isArray(rawData.ResultSets)) rawData.ResultSets.forEach((resultSet, index) => {
		if (!isResultSet(resultSet)) return;
		const spec = getTradingInfoResultSetSpec(toolSpec, resultSet.ResultSetKey || "", index);
		tables.push({
			name: spec.name,
			rows: resultSetToRows(resultSet).map((row) => spec.fieldMap ? mapSelectedRowPreserveUnknown(row, spec.fieldMap) : mapResultRow(row)),
			headers: spec.headers,
			layout: spec.layout,
			maxRows: spec.maxRows
		});
	});
	if (tables.length === 0) tables.push(...transformArrayPayload(rawData, [{
		name: toolSpec.defaultTableName,
		fieldMap: toolSpec.firstTableFieldMap,
		headers: toolSpec.firstTableHeaders,
		layout: "table"
	}]));
	if (tables.length === 0) return null;
	return {
		toolName: toolSpec.toolName,
		code: params.code,
		fixedTag: params.fixedTag,
		extraParam: params.extraParam,
		summary: buildTradingInfoSummary(params.code, toolSpec.summaryName, tables),
		tables,
		hitCache,
		errorCode
	};
}
function createTradingInfoPresetTransform(preset, getSpec) {
	return (rawData, request) => {
		const code = asOptionalString$1(String(request.code ?? "")) ?? "";
		const spec = getSpec();
		return buildTransformedFromParsed(preset, parseTradingInfoResult(rawData, spec, {
			code,
			fixedTag: asOptionalString$1(String(request.fixedTag ?? "")) ?? spec.defaultFixedTag,
			extraParam: asOptionalString$1(String(request.extra ?? "")) ?? ""
		}));
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/presets/registry.ts
function defineCustomPreset(transform) {
	return { transform };
}
function defineStaticPresets(entries) {
	return Object.fromEntries(entries.map(([name, getSpecs, summary]) => [name, defineResultSetPreset(getSpecs, summary)]));
}
function defineCustomPresets(entries) {
	return Object.fromEntries(entries.map(([name, transform]) => [name, defineCustomPreset(transform)]));
}
function defineFinancialsPresets(names) {
	return defineCustomPresets(names.map((name) => [name, createFinancialsPresetTransform(name)]));
}
function defineMainPositionPreset(name, specGetter, buildParams) {
	return [name, defineCustomPreset(createMainPositionPresetTransform(name, specGetter, buildParams))];
}
const REPORT_RATING_PRESETS = defineStaticPresets([[
	"report_rating_consensus",
	() => REPORT_RATING_RESULT_SET_SPECS,
	buildReportRatingSummary
]]);
const HOT_TOPIC_PRESETS = defineStaticPresets([
	[
		"hot_topic_board_family",
		() => HOT_TOPIC_BOARD_FAMILY_RESULT_SET_SPECS,
		buildHotTopicBoardFamilySummary
	],
	[
		"hot_topic_theme_library",
		() => HOT_TOPIC_THEME_LIBRARY_RESULT_SET_SPECS,
		buildHotTopicThemeLibrarySummary
	],
	[
		"hot_topic_event_driven",
		() => HOT_TOPIC_EVENT_DRIVEN_RESULT_SET_SPECS,
		buildHotTopicEventDrivenSummary
	],
	[
		"hot_topic_info_overview",
		() => HOT_TOPIC_INFO_OVERVIEW_RESULT_SET_SPECS,
		buildHotTopicInfoOverviewSummary
	]
]);
const BOARD_PRESETS = defineStaticPresets([
	[
		"board_cpbd_basic_info",
		() => BOARD_CPBD_BASIC_INFO_RESULT_SET_SPECS,
		buildBoardCpbdBasicInfoSummary
	],
	[
		"board_cpbd_detail",
		() => BOARD_CPBD_DETAIL_RESULT_SET_SPECS,
		buildBoardCpbdDetailSummary
	],
	[
		"board_cpbd_stage_return",
		() => BOARD_CPBD_STAGE_RETURN_RESULT_SET_SPECS,
		buildBoardCpbdStageReturnSummary
	],
	[
		"board_cpbd_market_stats",
		() => BOARD_CPBD_MARKET_STATS_RESULT_SET_SPECS,
		buildBoardCpbdMarketStatsSummary
	]
]);
const DIVIDEND_FINANCING_PRESETS = defineStaticPresets([
	[
		"dividend_financing_overview",
		() => DIVIDEND_FINANCING_OVERVIEW_RESULT_SET_SPECS,
		buildDividendFinancingOverviewSummary
	],
	[
		"dividend_chart",
		() => DIVIDEND_CHART_RESULT_SET_SPECS,
		buildDividendChartSummary
	],
	[
		"dividend_table",
		() => DIVIDEND_TABLE_RESULT_SET_SPECS,
		buildDividendTableSummary
	],
	[
		"dividend_viewer_filter",
		() => DIVIDEND_VIEWER_FILTER_RESULT_SET_SPECS,
		buildDividendViewerFilterSummary
	],
	[
		"dividend_viewer_compare",
		() => DIVIDEND_VIEWER_COMPARE_RESULT_SET_SPECS,
		buildDividendViewerCompareSummary
	],
	[
		"rights_issue_plan",
		() => RIGHTS_ISSUE_PLAN_RESULT_SET_SPECS,
		buildRightsIssuePlanSummary
	],
	[
		"placement_detail",
		() => PLACEMENT_DETAIL_RESULT_SET_SPECS,
		buildPlacementDetailSummary
	],
	[
		"holder_change_detail",
		() => HOLDER_CHANGE_DETAIL_RESULT_SET_SPECS,
		buildHolderChangeDetailSummary
	],
	[
		"holder_change_type",
		() => HOLDER_CHANGE_TYPE_RESULT_SET_SPECS,
		buildHolderChangeTypeSummary
	],
	[
		"refinancing_plan",
		() => REFINANCING_PLAN_RESULT_SET_SPECS,
		buildRefinancingPlanSummary
	],
	[
		"dividend_history_payout",
		() => DIVIDEND_HISTORY_PAYOUT_RESULT_SET_SPECS,
		buildDividendHistoryPayoutSummary
	],
	[
		"dividend_history_yield",
		() => DIVIDEND_HISTORY_YIELD_RESULT_SET_SPECS,
		buildDividendHistoryYieldSummary
	],
	[
		"dividend_rank_payout",
		() => DIVIDEND_RANK_PAYOUT_RESULT_SET_SPECS,
		buildDividendRankPayoutSummary
	],
	[
		"dividend_rank_yield",
		() => DIVIDEND_RANK_YIELD_RESULT_SET_SPECS,
		buildDividendRankYieldSummary
	],
	[
		"dividend_rank_cashfin_ratio",
		() => DIVIDEND_RANK_CASHFIN_RATIO_RESULT_SET_SPECS,
		buildDividendRankCashfinRatioSummary
	]
]);
const COMPANY_PRESETS = defineCustomPresets([
	["company_overview", transformCompanyOverviewPreset],
	["company_basic_info", createCompanyGsgkPresetTransform("company_basic_info", () => COMPANY_BASIC_INFO_SPEC)],
	["company_issuance_trading", createCompanyGsgkPresetTransform("company_issuance_trading", () => COMPANY_ISSUANCE_TRADING_SPEC)],
	["company_executives", createCompanyGsgkPresetTransform("company_executives", () => COMPANY_EXECUTIVES_SPEC)],
	["company_affiliates", createCompanyGsgkPresetTransform("company_affiliates", () => COMPANY_AFFILIATES_SPEC)]
]);
const TRADING_PRESETS = defineCustomPresets([
	["block_trade_intention", createTradingInfoPresetTransform("block_trade_intention", () => BLOCK_TRADE_INTENTION_SPEC)],
	["margin_trading", createTradingInfoPresetTransform("margin_trading", () => MARGIN_TRADING_SPEC)],
	["refinancing", createTradingInfoPresetTransform("refinancing", () => REFINANCING_SPEC)],
	["capital_flow", createTradingInfoPresetTransform("capital_flow", () => CAPITAL_FLOW_SPEC)],
	["limit_up_analysis", createTradingInfoPresetTransform("limit_up_analysis", () => LIMIT_UP_ANALYSIS_SPEC)],
	["limit_down_analysis", createTradingInfoPresetTransform("limit_down_analysis", () => LIMIT_DOWN_ANALYSIS_SPEC)]
]);
const DRAGON_TIGER_PRESETS = defineCustomPresets([["dragon_tiger_dates", createDragonTigerPresetTransform("dragon_tiger_dates", "dates")], ["dragon_tiger_list", createDragonTigerPresetTransform("dragon_tiger_list", "list")]]);
const STOCK_EVENT_PRESETS = defineCustomPresets([
	["shareholder_change", createStockEventPresetTransform("shareholder_change", getShareholderChangeResultSetSpec, buildShareholderChangePresetSummary)],
	["block_trade", createStockEventPresetTransform("block_trade", getBlockTradeResultSetSpec, buildBlockTradePresetSummary)],
	["top_shareholder_detail", createStockEventPresetTransform("top_shareholder_detail", getTopShareholderDetailResultSetSpec, buildTopShareholderDetailPresetSummary)]
]);
const MAIN_POSITION_PRESETS = Object.fromEntries([
	defineMainPositionPreset("institutional_holding_summary", () => INSTITUTIONAL_HOLDING_SUMMARY_SPEC, (request, code) => ({
		code,
		fixedTag: "jgcg",
		firstEnter: asNonNegativeIntegerString(request.cursor ?? request.clickIndex, "0"),
		pageNo: asNonNegativeIntegerString(request.pageNo, "1"),
		pageSize: asNonNegativeIntegerString(request.pageSize, "20")
	})),
	defineMainPositionPreset("institutional_holding_dates", () => INSTITUTIONAL_HOLDING_DATES_SPEC, (request, code) => ({
		code,
		fixedTag: asOptionalString$1(String(request.fixedTag ?? "")) ?? "jgcg"
	})),
	defineMainPositionPreset("institutional_holding_overview", () => INSTITUTIONAL_HOLDING_OVERVIEW_SPEC, (request, code) => ({
		code,
		fixedTag: "jgcgqk",
		reportDate: asOptionalString$1(String(request.reportDate ?? request.endDate ?? "")) ?? "",
		firstEnter: asNonNegativeIntegerString(request.cursor ?? request.clickIndex, "0"),
		pageNo: asNonNegativeIntegerString(request.pageNo, "1"),
		pageSize: asNonNegativeIntegerString(request.pageSize, "20")
	})),
	defineMainPositionPreset("institutional_holding_detail", () => INSTITUTIONAL_HOLDING_DETAIL_SPEC, (request, code) => ({
		code,
		sortType: asOptionalString$1(String(request.sortType ?? "")) ?? "0",
		reportDate: asOptionalString$1(String(request.reportDate ?? "")) ?? "",
		institutionType: asOptionalString$1(String(request.typeValue ?? "")) ?? "99",
		clickIndex: asNonNegativeIntegerString(request.clickIndex, "1"),
		pageNo: asNonNegativeIntegerString(request.pageNo, "1"),
		pageSize: asNonNegativeIntegerString(request.pageSize, "30")
	})),
	defineMainPositionPreset("northbound_funds", () => NORTHBOUND_FUNDS_SPEC, (request, code) => ({
		code,
		fixedTag: asOptionalString$1(String(request.fixedTag ?? "")) ?? "bszj",
		date: asOptionalString$1(String(request.date ?? request.extra ?? "")) ?? ""
	})),
	defineMainPositionPreset("institutional_holding_price_compare", () => INSTITUTIONAL_HOLDING_PRICE_COMPARE_SPEC, (request, code) => ({
		code,
		queryKey: asOptionalString$1(String(request.queryKey ?? "")) ?? "00101",
		compareFlag: asOptionalString$1(String(request.compareFlag ?? "")) ?? "0"
	}))
]);
const SHAREHOLDER_PRESETS = Object.fromEntries([
	["controlling_shareholder", defineCustomPreset(createShareholderResearchPresetTransform("controlling_shareholder", () => CONTROLLING_SHAREHOLDER_SPEC))],
	["shareholder_count", defineCustomPreset(createShareholderResearchPresetTransform("shareholder_count", () => SHAREHOLDER_COUNT_SPEC))],
	["shareholder_count_rank", defineCustomPreset(createShareholderResearchPresetTransform("shareholder_count_rank", () => SHAREHOLDER_COUNT_RANK_SPEC))],
	["top_float_shareholders", defineCustomPreset(createShareholderResearchPresetTransform("top_float_shareholders", () => TOP_FLOAT_SHAREHOLDERS_SPEC))],
	["top_shareholders", defineCustomPreset(createShareholderResearchPresetTransform("top_shareholders", () => TOP_SHAREHOLDERS_SPEC))]
]);
const SHARE_CAPITAL_PRESETS = defineCustomPresets([
	["share_capital_structure", createShareCapitalPresetTransform("share_capital_structure", () => SHARE_CAPITAL_STRUCTURE_SPEC)],
	["share_capital_changes", createShareCapitalPresetTransform("share_capital_changes", () => SHARE_CAPITAL_CHANGES_SPEC)],
	["restricted_share_unlocks", createShareCapitalPresetTransform("restricted_share_unlocks", () => RESTRICTED_SHARE_UNLOCKS_SPEC)],
	["stock_buyback", createShareCapitalPresetTransform("stock_buyback", () => STOCK_BUYBACK_SPEC)]
]);
const FINANCIALS_PRESETS = defineFinancialsPresets([
	"income_statement",
	"cashflow_statement",
	"balance_sheet",
	"industry_rank",
	"valuation_rank",
	"financial_sector_indicators",
	"business_composition",
	"valuation_history",
	"employee_structure",
	"employee_efficiency"
]);
const FINANCIALS_STATIC_PRESETS = defineStaticPresets([[
	"earnings_warning",
	() => EARNINGS_WARNING_RESULT_SET_SPECS,
	buildEarningsWarningSummary
]]);
const INDUSTRY_PRESETS = {
	industry_chain: defineCustomPreset(transformIndustryChainPreset),
	...defineStaticPresets([
		[
			"industry_important_events",
			() => INDUSTRY_IMPORTANT_EVENTS_RESULT_SET_SPECS,
			buildIndustryImportantEventsSummary
		],
		[
			"board_valuation_query_type_01",
			() => INDUSTRY_VALUATION_QUERY_TYPE_01_RESULT_SET_SPECS,
			buildIndustryValuationQueryType01Summary
		],
		[
			"board_valuation_query_type_02",
			() => INDUSTRY_VALUATION_QUERY_TYPE_02_RESULT_SET_SPECS,
			buildIndustryValuationQueryType02Summary
		]
	])
};
const PRESET_REGISTRY = {
	...REPORT_RATING_PRESETS,
	...HOT_TOPIC_PRESETS,
	...BOARD_PRESETS,
	...DIVIDEND_FINANCING_PRESETS,
	...COMPANY_PRESETS,
	...TRADING_PRESETS,
	...DRAGON_TIGER_PRESETS,
	...STOCK_EVENT_PRESETS,
	...MAIN_POSITION_PRESETS,
	...SHAREHOLDER_PRESETS,
	...SHARE_CAPITAL_PRESETS,
	...FINANCIALS_PRESETS,
	...FINANCIALS_STATIC_PRESETS,
	...INDUSTRY_PRESETS
};
const BUILTIN_PRESET_NAMES = Object.freeze(Object.keys(PRESET_REGISTRY).sort((left, right) => left.localeCompare(right)));
const BUILTIN_PRESET_NAME_SET = new Set(BUILTIN_PRESET_NAMES);
const BUILTIN_PRESET_LIST_TEXT = BUILTIN_PRESET_NAMES.map((preset) => `\`${preset}\``).join(", ");
//#endregion
//#region extensions/tdx-finance/src/api-data/core/result-sets.ts
function findResultSetBySpec(resultSets, spec, fallbackIndex) {
	if (spec.resultSetKey) {
		const byKey = resultSets.find((item) => item.ResultSetKey === spec.resultSetKey);
		if (byKey) return byKey;
	}
	const candidate = resultSets[spec.index ?? fallbackIndex];
	return isResultSet(candidate) ? candidate : void 0;
}
function buildTransformedResponse(parser, tables, summary, hitCache, errorCode) {
	if (tables.length === 0) return;
	return {
		parser,
		summary,
		tables,
		hitCache,
		errorCode
	};
}
function buildTablesFromResultSetSpecs(rawData, specs) {
	if (specs.length === 0) return [];
	return isResultSetResponse(rawData) && Array.isArray(rawData.ResultSets) ? specs.map((spec, index) => {
		const resultSet = findResultSetBySpec(rawData.ResultSets ?? [], spec, index);
		return {
			name: spec.name,
			rows: resultSetToRows(resultSet).map((row) => mapResultRow(row, spec.fieldMap)),
			headers: spec.headers,
			layout: spec.layout,
			maxRows: spec.maxRows,
			resultSetKey: resultSet?.ResultSetKey,
			index: spec.index ?? index
		};
	}) : transformArrayPayload(rawData, specs);
}
function transformWithResultSetSpecs(parser, rawData, specs, summaryBuilder, request = {}) {
	const tables = buildTablesFromResultSetSpecs(rawData, specs);
	if (tables.length === 0) return;
	const { hitCache, errorCode } = readRawCacheInfo(rawData);
	return buildTransformedResponse(parser, tables, summaryBuilder?.(tables, request), hitCache, errorCode);
}
//#endregion
//#region extensions/tdx-finance/src/api-data/core/response-transform.ts
const RESPONSE_TRANSFORM_DIRECT_OBJECT_EXAMPLE = "{\"kind\":\"preset\",\"preset\":\"income_statement\"}";
function isResultSetLayout(value) {
	return value === "record" || value === "table";
}
function isResultSetTransformSpec(value) {
	if (!isPlainObject(value) || typeof value.name !== "string" || !value.name.trim()) return false;
	if (value.resultSetKey !== void 0 && typeof value.resultSetKey !== "string") return false;
	const indexValue = value.index;
	if (indexValue !== void 0 && (typeof indexValue !== "number" || !Number.isFinite(indexValue) || indexValue < 0 || !Number.isInteger(indexValue))) return false;
	if (value.fieldMap !== void 0 && !isStringRecord(value.fieldMap)) return false;
	if (value.headers !== void 0 && (!Array.isArray(value.headers) || value.headers.some((header) => typeof header !== "string"))) return false;
	if (value.layout !== void 0 && !isResultSetLayout(value.layout)) return false;
	const maxRowsValue = value.maxRows;
	if (maxRowsValue !== void 0 && (typeof maxRowsValue !== "number" || !Number.isFinite(maxRowsValue) || maxRowsValue < 0 || !Number.isInteger(maxRowsValue))) return false;
	return true;
}
function isResponseTransformParams(value) {
	if (!isPlainObject(value) || typeof value.kind !== "string") return false;
	if (value.kind === "preset") return typeof value.preset === "string" && BUILTIN_PRESET_NAME_SET.has(value.preset);
	if (value.kind === "result-sets") return (value.parserName === void 0 || typeof value.parserName === "string") && Array.isArray(value.resultSets) && value.resultSets.length > 0 && value.resultSets.every((spec) => isResultSetTransformSpec(spec));
	return false;
}
function normalizeResponseTransform(value) {
	if (value === void 0 || value === null) return;
	const parsedValue = typeof value === "string" ? (() => {
		const trimmed = value.trim();
		if (!trimmed) return;
		try {
			return JSON.parse(trimmed);
		} catch {
			throw new Error(`responseTransform 必须是 JSON 对象，或可解析的 JSON 字符串。例如 ${RESPONSE_TRANSFORM_DIRECT_OBJECT_EXAMPLE}。更推荐直接传对象。`);
		}
	})() : value;
	if (parsedValue === void 0) return;
	if (!isResponseTransformParams(parsedValue)) throw new Error(`responseTransform 格式无效。请传 JSON 对象，或可解析的 JSON 字符串，例如 ${RESPONSE_TRANSFORM_DIRECT_OBJECT_EXAMPLE}。`);
	return parsedValue;
}
function transformPresetResponse(preset, rawData, request) {
	const definition = PRESET_REGISTRY[preset];
	if (!definition) return;
	if (definition.transform) return definition.transform(rawData, request);
	return transformWithResultSetSpecs(preset, rawData, definition.specs ?? [], definition.summary, request);
}
function transformResponseData(rawData, responseTransform, request) {
	if (!responseTransform) return;
	if (responseTransform.kind === "preset") return transformPresetResponse(responseTransform.preset, rawData, request);
	const tables = buildTablesFromResultSetSpecs(rawData, responseTransform.resultSets);
	if (tables.length === 0) return;
	const { hitCache, errorCode } = readRawCacheInfo(rawData);
	return {
		parser: responseTransform.parserName?.trim() || "result_sets",
		tables,
		hitCache,
		errorCode
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/common.ts
function buildResolvedModeRequest(mode, entry, paramsArray, normalizedRequest) {
	return {
		mode,
		entry,
		paramsArray,
		normalizedRequest: {
			mode,
			entry,
			...normalizedRequest
		},
		requestBody: { Params: paramsArray }
	};
}
const PRESET_NAMES = [...BUILTIN_PRESET_NAMES];
const RESPONSE_TRANSFORM_DIRECT_OBJECT_EXAMPLE_TEXT = RESPONSE_TRANSFORM_DIRECT_OBJECT_EXAMPLE;
const ApiPrimitiveSchema = Type.Union([
	Type.String(),
	Type.Number(),
	Type.Boolean(),
	Type.Null()
], { description: "Single upstream parameter value. Internal TQLEX APIs usually accept JSON scalar values only." });
const AuthSchema = Type.Union([
	Type.Object({ mode: Type.Literal("none", { description: "Do not attach auth headers." }) }, { additionalProperties: false }),
	Type.Object({ mode: Type.Literal("tdx", { description: "Use plugin-configured TDX API token via the token header." }) }, { additionalProperties: false }),
	Type.Object({
		mode: Type.Literal("header", { description: "Send auth using a custom request header." }),
		headerName: Type.String({ description: "Custom auth header name, for example X-API-Key." }),
		value: Type.Optional(Type.String({ description: "Direct header value. If both value and env are provided, value wins." })),
		env: Type.Optional(Type.String({ description: "Read header value from the specified environment variable." }))
	}, { additionalProperties: false })
], { description: "Optional auth config. Sensitive token values are not echoed in results." });
const ResultSetTransformSpecSchema = Type.Object({
	name: Type.String({ description: "Name of the transformed result set, for example overview or consensus_timeline." }),
	resultSetKey: Type.Optional(Type.String({ description: "Match by ResultSetKey in the upstream response." })),
	index: Type.Optional(Type.Number({
		minimum: 0,
		description: "Match by result-set index. 0 means the first result set."
	})),
	fieldMap: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "Field-name mapping, for example defdate -> forecastEndDate." })),
	headers: Type.Optional(Type.Array(Type.String(), { description: "Preferred display order for fields." })),
	layout: Type.Optional(Type.Union([Type.Literal("record"), Type.Literal("table")], { description: "record treats the result as records; table treats it as a table." })),
	maxRows: Type.Optional(Type.Number({
		minimum: 1,
		description: "Suggested max row count for display, returned as metadata only."
	}))
}, { additionalProperties: false });
const PresetLiteralSchemas = PRESET_NAMES.map((preset) => Type.Literal(preset));
const ResponseTransformSchema = Type.Union([Type.Object({
	kind: Type.Literal("preset", { description: "Use a built-in response transform preset." }),
	preset: Type.Union(PresetLiteralSchemas, { description: "Built-in transform presets for supported TDX result formats." })
}, { additionalProperties: false }), Type.Object({
	kind: Type.Literal("result-sets", { description: "Custom ResultSets transform rules." }),
	parserName: Type.Optional(Type.String({ description: "Transformer name. Defaults to result_sets." })),
	resultSets: Type.Array(ResultSetTransformSpecSchema, {
		minItems: 1,
		description: "Array of result-set transform rules."
	})
}, { additionalProperties: false })], { description: `Optional response transform rules. Prefer passing a JSON object directly. Example: responseTransform=${RESPONSE_TRANSFORM_DIRECT_OBJECT_EXAMPLE_TEXT}.` });
const ResponseTransformInputSchema = Type.Union([ResponseTransformSchema, Type.String({ description: `Compatibility mode for stringified JSON. Prefer a direct JSON object. Example: "${RESPONSE_TRANSFORM_DIRECT_OBJECT_EXAMPLE_TEXT}".` })], { description: "Optional response transform rules. Prefer passing a JSON object directly. Stringified JSON is parsed when possible." });
const CommonOptionProperties = {
	apiEndpoint: Type.Optional(Type.String({ description: "Override the default endpoint for this call only." })),
	timeoutMs: Type.Optional(Type.Number({
		minimum: 1e3,
		default: DEFAULT_TIMEOUT_MS$1,
		description: `Request timeout in milliseconds. Default: ${DEFAULT_TIMEOUT_MS$1}.`
	})),
	auth: Type.Optional(AuthSchema),
	responseTransform: Type.Optional(ResponseTransformInputSchema)
};
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/types.ts
function defineMode(definition) {
	return definition;
}
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/raw.ts
const rawMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("raw", { description: "直接传 entry 和 params。内置模板都不适用时使用。" }),
		entry: Type.String({ description: "上游 Entry 名称，例如 TdxShareCW.skef10_hy_zxdt_hyzysj。" }),
		params: Type.Array(ApiPrimitiveSchema, { description: "按上游接口要求的顺序传入 Params 数组。" }),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const paramsArray = Array.isArray(params.params) ? params.params : [];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, { params: paramsArray });
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/code-only.ts
const codeOnlyMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("code-only", { description: "将 Params 组装为 [code]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		code: Type.String({ description: "字符串型代码，例如证券代码、板块代码、行业代码。" }),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const code = ensureRequiredString("code", params.code);
		const paramsArray = [code];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, { code });
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/code-fixed-tag.ts
const codeFixedTagMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("code-fixed-tag", { description: "将 Params 组装为 [code, fixedTag]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		fixedTag: Type.String({ description: "上游固定标识，例如 yzyq、gsgy。" }),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const code = ensureRequiredString("code", params.code);
		const fixedTag = ensureRequiredString("fixedTag", params.fixedTag);
		const paramsArray = [code, fixedTag];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			code,
			fixedTag
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/fixed-tag-code.ts
const fixedTagCodeMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("fixed-tag-code", { description: "Params 组装为 [fixedTag, code]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		fixedTag: Type.String({ description: "上游固定标识。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const fixedTag = ensureRequiredString("fixedTag", params.fixedTag);
		const code = ensureRequiredString("code", params.code);
		const paramsArray = [fixedTag, code];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			fixedTag,
			code
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/code-fixed-tag-extra.ts
const codeFixedTagExtraMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("code-fixed-tag-extra", { description: "将 Params 组装为 [code, fixedTag, extra]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		fixedTag: Type.String({ description: "上游固定标识。" }),
		extra: Type.Optional(ApiPrimitiveSchema),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const code = ensureRequiredString("code", params.code);
		const fixedTag = ensureRequiredString("fixedTag", params.fixedTag);
		const extra = params.extra ?? "";
		const paramsArray = [
			code,
			fixedTag,
			extra
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			code,
			fixedTag,
			extra
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/code-fixed-tag-date-three-extras.ts
const codeFixedTagDateThreeExtrasMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("code-fixed-tag-date-three-extras", { description: "将 Params 组装为 [code, fixedTag, date, extraOne, extraTwo, extraThree]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		fixedTag: Type.String({ description: "上游固定标识。" }),
		date: Type.Optional(Type.String({ description: "日期参数，格式通常为 YYYYMMDD。" })),
		extraOne: Type.Optional(ApiPrimitiveSchema),
		extraTwo: Type.Optional(ApiPrimitiveSchema),
		extraThree: Type.Optional(ApiPrimitiveSchema),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const code = ensureRequiredString("code", params.code);
		const fixedTag = ensureRequiredString("fixedTag", params.fixedTag);
		const date = normalizeDate$1(params.date) ?? params.date ?? "";
		const extraOne = params.extraOne ?? "0";
		const extraTwo = params.extraTwo ?? "0";
		const extraThree = params.extraThree ?? "0";
		const paramsArray = [
			code,
			fixedTag,
			date,
			extraOne,
			extraTwo,
			extraThree
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			code,
			fixedTag,
			date,
			extraOne,
			extraTwo,
			extraThree
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/code-extra.ts
const codeExtraMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("code-extra", { description: "Params 组装为 [code, extra]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		extra: Type.Optional(ApiPrimitiveSchema),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const code = ensureRequiredString("code", params.code);
		const extra = params.extra ?? "";
		const paramsArray = [code, extra];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			code,
			extra
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/code-two-extras.ts
const codeTwoExtrasMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("code-two-extras", { description: "Params 组装为 [code, extraOne, extraTwo]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		extraOne: Type.Optional(ApiPrimitiveSchema),
		extraTwo: Type.Optional(ApiPrimitiveSchema),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const code = ensureRequiredString("code", params.code);
		const extraOne = params.extraOne ?? "";
		const extraTwo = params.extraTwo ?? "";
		const paramsArray = [
			code,
			extraOne,
			extraTwo
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			code,
			extraOne,
			extraTwo
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/fixed-tag-code-extra.ts
const fixedTagCodeExtraMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("fixed-tag-code-extra", { description: "将 Params 组装为 [fixedTag, code, extra]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		fixedTag: Type.String({ description: "上游固定标识。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		extra: Type.Optional(ApiPrimitiveSchema),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const fixedTag = ensureRequiredString("fixedTag", params.fixedTag);
		const code = ensureRequiredString("code", params.code);
		const extra = params.extra ?? "";
		const paramsArray = [
			fixedTag,
			code,
			extra
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			fixedTag,
			code,
			extra
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/fixed-tag-code-three-extras.ts
const fixedTagCodeThreeExtrasMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("fixed-tag-code-three-extras", { description: "将 Params 组装为 [fixedTag, code, extraOne, extraTwo, extraThree]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		fixedTag: Type.String({ description: "上游固定标识。" }),
		code: Type.Optional(Type.String({ description: "证券代码或主体代码。未提供时默认空字符串。" })),
		extraOne: Type.Optional(ApiPrimitiveSchema),
		extraTwo: Type.Optional(ApiPrimitiveSchema),
		extraThree: Type.Optional(ApiPrimitiveSchema),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const fixedTag = ensureRequiredString("fixedTag", params.fixedTag);
		const code = asOptionalString$1(params.code) ?? "";
		const extraOne = params.extraOne ?? "";
		const extraTwo = params.extraTwo ?? "";
		const extraThree = params.extraThree ?? "";
		const paramsArray = [
			fixedTag,
			code,
			extraOne,
			extraTwo,
			extraThree
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			fixedTag,
			code,
			extraOne,
			extraTwo,
			extraThree
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/fixed-tag-code-two-extras.ts
const fixedTagCodeTwoExtrasMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("fixed-tag-code-two-extras", { description: "将 Params 组装为 [fixedTag, code, extraOne, extraTwo]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		fixedTag: Type.String({ description: "上游固定标识。" }),
		code: Type.Optional(Type.String({ description: "证券代码或主体代码。未提供时默认空字符串。" })),
		extraOne: Type.Optional(ApiPrimitiveSchema),
		extraTwo: Type.Optional(ApiPrimitiveSchema),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const fixedTag = ensureRequiredString("fixedTag", params.fixedTag);
		const code = asOptionalString$1(params.code) ?? "";
		const extraOne = params.extraOne ?? "";
		const extraTwo = params.extraTwo ?? "";
		const paramsArray = [
			fixedTag,
			code,
			extraOne,
			extraTwo
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			fixedTag,
			code,
			extraOne,
			extraTwo
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/branch-code-time.ts
const branchCodeTimeMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("branch-code-time", { description: "将 Params 组装为 [branch, code, timeType]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		branch: Type.String({ description: "上游分支或子查询类型，例如 001、004。" }),
		code: Type.String({ description: "板块代码、证券代码或主体代码。" }),
		timeType: Type.Optional(Type.String({ description: "时间类型或第三参数。未提供时默认空字符串。" })),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const branch = ensureRequiredString("branch", params.branch);
		const code = ensureRequiredString("code", params.code);
		const timeType = asOptionalString$1(params.timeType) ?? "";
		const paramsArray = [
			branch,
			code,
			timeType
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			branch,
			code,
			timeType
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/query-type-target-stock.ts
const queryTypeTargetStockMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("query-type-target-stock", { description: "将 Params 组装为 [queryType, targetCode, stockCode]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		queryType: Type.String({ description: "查询类型，例如 01、02。" }),
		targetCode: Type.String({ description: "目标板块、行业或指数代码。" }),
		stockCode: Type.Optional(Type.String({ description: "可选个股代码。未提供时默认空字符串。" })),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const queryType = ensureRequiredString("queryType", params.queryType);
		const targetCode = ensureRequiredString("targetCode", params.targetCode);
		const stockCode = asOptionalString$1(params.stockCode) ?? "";
		const paramsArray = [
			queryType,
			targetCode,
			stockCode
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			queryType,
			targetCode,
			stockCode
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/industry-title.ts
const industryTitleMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("industry-title", { description: "将 Params 组装为 [industryCode, title]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		industryCode: Type.String({ description: "行业代码，例如 881430。" }),
		title: Type.Optional(Type.String({ description: "可选标题过滤词。未提供时默认空字符串。" })),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const industryCode = ensureRequiredString("industryCode", params.industryCode);
		const title = asOptionalString$1(params.title) ?? "";
		const paramsArray = [industryCode, title];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			industryCode,
			title
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/industry-code.ts
const industryCodeMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("industry-code", { description: "Params 组装为 [industryCode]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		industryCode: Type.String({ description: "行业代码，例如 881430。" }),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const industryCode = ensureRequiredString("industryCode", params.industryCode);
		const paramsArray = [industryCode];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, { industryCode });
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/code-date-range-page.ts
const codeDateRangePageMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("code-date-range-page", { description: "将 Params 组装为 [code, fixedTag, beginDate, endDate, clickIndex, pageNo, pageSize]。日期会标准化为 YYYYMMDD。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		fixedTag: Type.Optional(Type.String({ description: "可选固定标识。未提供时默认空字符串。" })),
		beginDate: Type.Optional(Type.String({ description: "开始日期，支持 YYYYMMDD 或 YYYY-MM-DD。" })),
		endDate: Type.Optional(Type.String({ description: "结束日期，支持 YYYYMMDD 或 YYYY-MM-DD。" })),
		clickIndex: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "点击序号。未提供时默认 1。" })),
		pageNo: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "页码。未提供时默认 1。" })),
		pageSize: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "每页条数。未提供时默认 20。" })),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const code = ensureRequiredString("code", params.code);
		const fixedTag = asOptionalString$1(params.fixedTag) ?? "";
		const beginDate = normalizeDate$1(params.beginDate) ?? "";
		const endDate = normalizeDate$1(params.endDate) ?? "";
		const clickIndex = asNonNegativeIntegerString(params.clickIndex, "1");
		const pageNo = asNonNegativeIntegerString(params.pageNo, "1");
		const pageSize = asNonNegativeIntegerString(params.pageSize, "20");
		const paramsArray = [
			code,
			fixedTag,
			beginDate,
			endDate,
			clickIndex,
			pageNo,
			pageSize
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			code,
			fixedTag,
			beginDate,
			endDate,
			clickIndex,
			pageNo,
			pageSize
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/code-fixed-tag-report-cursor-page.ts
const codeFixedTagReportCursorPageMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("code-fixed-tag-report-cursor-page", { description: "Params 组装为 [code, fixedTag, '', reportDate, cursor, pageNo, pageSize]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		fixedTag: Type.String({ description: "上游固定标识。" }),
		reportDate: Type.Optional(Type.String({ description: "可选报告期日期，支持 YYYYMMDD 或 YYYY-MM-DD。" })),
		cursor: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "第五个参数，通常用于 clickIndex 或 firstEnter。" })),
		pageNo: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "页码，默认 1。" })),
		pageSize: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "每页条数，默认 20。" })),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const code = ensureRequiredString("code", params.code);
		const fixedTag = ensureRequiredString("fixedTag", params.fixedTag);
		const reportDate = normalizeDate$1(params.reportDate) ?? "";
		const cursor = asNonNegativeIntegerString(params.cursor, "1");
		const pageNo = asNonNegativeIntegerString(params.pageNo, "1");
		const pageSize = asNonNegativeIntegerString(params.pageSize, "20");
		const paramsArray = [
			code,
			fixedTag,
			"",
			reportDate,
			cursor,
			pageNo,
			pageSize
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			code,
			fixedTag,
			reportDate,
			cursor,
			pageNo,
			pageSize
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/code-sort-report-type-click-page.ts
const codeSortReportTypeClickPageMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("code-sort-report-type-click-page", { description: "Params 组装为 [code, sortType, reportDate, typeValue, clickIndex, pageNo, pageSize]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		sortType: Type.Optional(Type.String({ description: "排序类型或第二参数。" })),
		reportDate: Type.String({ description: "报告期日期，支持 YYYYMMDD 或 YYYY-MM-DD。" }),
		typeValue: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "第四个参数，通常用于机构类型。" })),
		clickIndex: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "点击序号，默认 1。" })),
		pageNo: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "页码，默认 1。" })),
		pageSize: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "每页条数，默认 20。" })),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const code = ensureRequiredString("code", params.code);
		const sortType = asOptionalString$1(params.sortType) ?? "";
		const reportDate = ensureRequiredString("reportDate", normalizeDate$1(params.reportDate));
		const typeValue = asOptionalString$1(String(params.typeValue ?? "")) ?? "99";
		const clickIndex = asNonNegativeIntegerString(params.clickIndex, "1");
		const pageNo = asNonNegativeIntegerString(params.pageNo, "1");
		const pageSize = asNonNegativeIntegerString(params.pageSize, "20");
		const paramsArray = [
			code,
			sortType,
			reportDate,
			typeValue,
			clickIndex,
			pageNo,
			pageSize
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			code,
			sortType,
			reportDate,
			typeValue,
			clickIndex,
			pageNo,
			pageSize
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/query-key-code-flag.ts
const queryKeyCodeFlagMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("query-key-code-flag", { description: "Params 组装为 [queryKey, code, compareFlag]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		queryKey: Type.String({ description: "查询键，例如 00101。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		compareFlag: Type.Optional(Type.String({ description: "对比标识，未提供时默认为空字符串。" })),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const queryKey = ensureRequiredString("queryKey", params.queryKey);
		const code = ensureRequiredString("code", params.code);
		const compareFlag = asOptionalString$1(params.compareFlag) ?? "";
		const paramsArray = [
			queryKey,
			code,
			compareFlag
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			queryKey,
			code,
			compareFlag
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/query-key-code-extra.ts
const queryKeyCodeExtraMode = defineMode({
	schema: Type.Object({
		mode: Type.Literal("query-key-code-extra", { description: "Params 组装为 [queryKey, code, extra]。" }),
		entry: Type.String({ description: "上游 Entry 名称。" }),
		queryKey: Type.String({ description: "查询键，例如 00102。" }),
		code: Type.String({ description: "证券代码或主体代码。" }),
		extra: Type.Optional(ApiPrimitiveSchema),
		...CommonOptionProperties
	}, { additionalProperties: false }),
	buildRequest: (params, entry) => {
		const queryKey = ensureRequiredString("queryKey", params.queryKey);
		const code = ensureRequiredString("code", params.code);
		const extra = params.extra ?? "";
		const paramsArray = [
			queryKey,
			code,
			extra
		];
		return buildResolvedModeRequest(params.mode, entry, paramsArray, {
			queryKey,
			code,
			extra
		});
	}
});
//#endregion
//#region extensions/tdx-finance/src/api-data/modes/registry.ts
const MODE_REGISTRY = {
	raw: rawMode,
	"code-only": codeOnlyMode,
	"code-fixed-tag": codeFixedTagMode,
	"fixed-tag-code": fixedTagCodeMode,
	"code-fixed-tag-extra": codeFixedTagExtraMode,
	"code-fixed-tag-date-three-extras": codeFixedTagDateThreeExtrasMode,
	"code-extra": codeExtraMode,
	"code-two-extras": codeTwoExtrasMode,
	"fixed-tag-code-extra": fixedTagCodeExtraMode,
	"fixed-tag-code-two-extras": fixedTagCodeTwoExtrasMode,
	"fixed-tag-code-three-extras": fixedTagCodeThreeExtrasMode,
	"branch-code-time": branchCodeTimeMode,
	"query-type-target-stock": queryTypeTargetStockMode,
	"industry-title": industryTitleMode,
	"industry-code": industryCodeMode,
	"code-date-range-page": codeDateRangePageMode,
	"code-fixed-tag-report-cursor-page": codeFixedTagReportCursorPageMode,
	"code-sort-report-type-click-page": codeSortReportTypeClickPageMode,
	"query-key-code-flag": queryKeyCodeFlagMode,
	"query-key-code-extra": queryKeyCodeExtraMode
};
const MODE_SCHEMAS = Object.values(MODE_REGISTRY).map((definition) => definition.schema);
function buildResolvedRequest(params) {
	const entry = ensureRequiredString("entry", params.entry);
	const definition = MODE_REGISTRY[params.mode];
	if (!definition) throw new Error(`不支持的 mode：${params.mode}`);
	return definition.buildRequest(params, entry);
}
//#endregion
//#region extensions/tdx-finance/src/api-data/routes/registry.ts
function getOptionalValue(params, key) {
	const value = params[key];
	if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value).toString();
	return asOptionalString$1(value);
}
function hasValue(params, key) {
	return getOptionalValue(params, key) !== void 0;
}
function buildFixedValueEntry(args) {
	return {
		entry: args.entry,
		coverage: args.coverage,
		variants: args.variants.map((variant) => ({
			mode: args.mode,
			preset: variant.preset,
			selectorSummary: `${args.selectorField}=${variant.selectorValue}`,
			description: variant.description,
			example: variant.example,
			match: (params) => getOptionalValue(params, args.selectorField) === variant.selectorValue
		}))
	};
}
const STRUCTURED_ROUTE_REGISTRY = [
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_ybpj",
		selectorField: "fixedTag",
		mode: "code-fixed-tag",
		variants: [{
			selectorValue: "yzyq",
			preset: "report_rating_consensus",
			description: "研报评级一致预期",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_ybpj",
				code: "000001",
				fixedTag: "yzyq"
			}
		}]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_rdtc",
		selectorField: "fixedTag",
		mode: "code-fixed-tag",
		variants: [
			{
				selectorValue: "zttzbkz",
				preset: "hot_topic_board_family",
				description: "热点题材板块族谱",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_rdtc",
					code: "000001",
					fixedTag: "zttzbkz"
				}
			},
			{
				selectorValue: "zttzztk",
				preset: "hot_topic_theme_library",
				description: "热点题材主题库",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_rdtc",
					code: "000001",
					fixedTag: "zttzztk"
				}
			},
			{
				selectorValue: "sjcd",
				preset: "hot_topic_event_driven",
				description: "热点题材事件驱动",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_rdtc",
					code: "000001",
					fixedTag: "sjcd"
				}
			},
			{
				selectorValue: "xxmmg",
				preset: "hot_topic_info_overview",
				description: "热点题材信息面概览",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_rdtc",
					code: "000001",
					fixedTag: "xxmmg"
				}
			}
		]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_zxts",
		selectorField: "fixedTag",
		mode: "code-fixed-tag-extra",
		variants: [{
			selectorValue: "gsgy",
			preset: "company_overview",
			description: "公司概要",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_zxts",
				code: "000001",
				fixedTag: "gsgy"
			}
		}]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_gsgk",
		selectorField: "fixedTag",
		mode: "fixed-tag-code-extra",
		variants: [
			{
				selectorValue: "0",
				preset: "company_basic_info",
				description: "公司基本信息",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gsgk",
					fixedTag: "0",
					code: "000001"
				}
			},
			{
				selectorValue: "8",
				preset: "company_issuance_trading",
				description: "发行与交易",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gsgk",
					fixedTag: "8",
					code: "000001"
				}
			},
			{
				selectorValue: "20",
				preset: "company_executives",
				description: "董监高信息",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gsgk",
					fixedTag: "20",
					code: "000001"
				}
			},
			{
				selectorValue: "3",
				preset: "company_affiliates",
				description: "参股控股公司",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gsgk",
					fixedTag: "3",
					code: "000001"
				}
			},
			{
				selectorValue: "4",
				preset: "employee_structure",
				description: "员工构成",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gsgk",
					fixedTag: "4",
					code: "000001"
				}
			},
			{
				selectorValue: "5",
				preset: "employee_efficiency",
				description: "员工效益",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gsgk",
					fixedTag: "5",
					code: "000001"
				}
			}
		]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_gbjg",
		selectorField: "fixedTag",
		mode: "code-fixed-tag",
		variants: [
			{
				selectorValue: "gbjg",
				preset: "share_capital_structure",
				description: "股本结构",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gbjg",
					code: "000001",
					fixedTag: "gbjg"
				}
			},
			{
				selectorValue: "gbbd",
				preset: "share_capital_changes",
				description: "股本变动",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gbjg",
					code: "000001",
					fixedTag: "gbbd"
				}
			},
			{
				selectorValue: "xslt",
				preset: "restricted_share_unlocks",
				description: "限售解禁",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gbjg",
					code: "000001",
					fixedTag: "xslt"
				}
			},
			{
				selectorValue: "gphg",
				preset: "stock_buyback",
				description: "股票回购",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gbjg",
					code: "000001",
					fixedTag: "gphg"
				}
			}
		]
	}),
	{
		entry: "TdxSharePCCW.tdxf10_gg_gdyj",
		variants: [
			{
				mode: "code-date-range-page",
				preset: "shareholder_change",
				selectorSummary: "fixedTag=cgbd 或仅传 beginDate/endDate",
				description: "股东增减持",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gdyj",
					code: "000001",
					fixedTag: "cgbd",
					beginDate: "20240101",
					endDate: "20241231"
				},
				match: (params) => getOptionalValue(params, "fixedTag") === "cgbd" || !hasValue(params, "fixedTag") && (hasValue(params, "beginDate") || hasValue(params, "endDate"))
			},
			{
				mode: "code-date-range-page",
				preset: "institutional_holding_summary",
				selectorSummary: "fixedTag=jgcg",
				description: "机构持股汇总",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gdyj",
					code: "000001",
					fixedTag: "jgcg",
					pageNo: "1",
					pageSize: "20"
				},
				match: (params) => getOptionalValue(params, "fixedTag") === "jgcg"
			},
			{
				mode: "code-fixed-tag-report-cursor-page",
				preset: "institutional_holding_overview",
				selectorSummary: "fixedTag=jgcgqk",
				description: "机构持股整体分布",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gdyj",
					code: "000001",
					fixedTag: "jgcgqk",
					reportDate: "20241231",
					pageNo: "1",
					pageSize: "20"
				},
				match: (params) => getOptionalValue(params, "fixedTag") === "jgcgqk"
			},
			{
				mode: "code-fixed-tag-report-cursor-page",
				preset: "controlling_shareholder",
				selectorSummary: "fixedTag=kggd",
				description: "控股股东与实控人",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gdyj",
					code: "000001",
					fixedTag: "kggd",
					pageNo: "1",
					pageSize: "20"
				},
				match: (params) => getOptionalValue(params, "fixedTag") === "kggd"
			},
			{
				mode: "code-fixed-tag-report-cursor-page",
				preset: "shareholder_count",
				selectorSummary: "fixedTag=gdrs",
				description: "股东人数",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gdyj",
					code: "000001",
					fixedTag: "gdrs",
					pageNo: "1",
					pageSize: "20"
				},
				match: (params) => getOptionalValue(params, "fixedTag") === "gdrs"
			},
			{
				mode: "code-fixed-tag-report-cursor-page",
				preset: "shareholder_count_rank",
				selectorSummary: "fixedTag=thygdrs",
				description: "股东人数排名",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gdyj",
					code: "000001",
					fixedTag: "thygdrs",
					pageNo: "1",
					pageSize: "20"
				},
				match: (params) => getOptionalValue(params, "fixedTag") === "thygdrs"
			},
			{
				mode: "code-fixed-tag-report-cursor-page",
				preset: "top_float_shareholders",
				selectorSummary: "fixedTag=ltgd",
				description: "十大流通股东",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gdyj",
					code: "000001",
					fixedTag: "ltgd",
					pageNo: "1",
					pageSize: "20"
				},
				match: (params) => getOptionalValue(params, "fixedTag") === "ltgd"
			},
			{
				mode: "code-fixed-tag-report-cursor-page",
				preset: "top_shareholders",
				selectorSummary: "fixedTag=sdgdbgq",
				description: "十大股东",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_gdyj",
					code: "000001",
					fixedTag: "sdgdbgq",
					pageNo: "1",
					pageSize: "20"
				},
				match: (params) => getOptionalValue(params, "fixedTag") === "sdgdbgq"
			}
		]
	},
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_comreq",
		coverage: "partial",
		selectorField: "fixedTag",
		mode: "fixed-tag-code",
		variants: [{
			selectorValue: "jgcg",
			preset: "institutional_holding_dates",
			description: "机构持股可用报告期",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_comreq",
				fixedTag: "jgcg",
				code: "000001"
			}
		}, {
			selectorValue: "jglhb",
			preset: "dragon_tiger_dates",
			description: "龙虎榜可用日期",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_comreq",
				fixedTag: "jglhb",
				code: "000001"
			}
		}]
	}),
	{
		entry: "TdxSharePCCW.tdxf10_gg_gdyj_jgcgmx",
		variants: [{
			mode: "code-sort-report-type-click-page",
			preset: "institutional_holding_detail",
			selectorSummary: "no extra selector",
			description: "机构持股明细",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_gdyj_jgcgmx",
				code: "000001",
				sortType: "0",
				reportDate: "20241231",
				typeValue: "99"
			},
			match: () => true
		}]
	},
	buildFixedValueEntry({
		entry: "TdxShareCW.ph_agf10_gbgd_jgcc",
		coverage: "partial",
		selectorField: "queryKey",
		mode: "query-key-code-flag",
		variants: [{
			selectorValue: "00101",
			preset: "institutional_holding_price_compare",
			description: "机构持仓与股价对比",
			example: {
				entry: "TdxShareCW.ph_agf10_gbgd_jgcc",
				queryKey: "00101",
				code: "000001",
				compareFlag: "0"
			}
		}]
	}),
	buildFixedValueEntry({
		entry: "TdxShareCW.ph_agf10_cw_lyb",
		coverage: "partial",
		selectorField: "fixedTag",
		mode: "fixed-tag-code",
		variants: [{
			selectorValue: "00101",
			preset: "income_statement",
			description: "利润表-报告期",
			example: {
				entry: "TdxShareCW.ph_agf10_cw_lyb",
				fixedTag: "00101",
				code: "600036"
			}
		}, {
			selectorValue: "00102",
			preset: "income_statement",
			description: "利润表-单季度",
			example: {
				entry: "TdxShareCW.ph_agf10_cw_lyb",
				fixedTag: "00102",
				code: "600036"
			}
		}]
	}),
	buildFixedValueEntry({
		entry: "TdxShareCW.ph_agf10_cw_xjllb",
		coverage: "partial",
		selectorField: "fixedTag",
		mode: "fixed-tag-code",
		variants: [{
			selectorValue: "00101",
			preset: "cashflow_statement",
			description: "现金流量表-报告期",
			example: {
				entry: "TdxShareCW.ph_agf10_cw_xjllb",
				fixedTag: "00101",
				code: "600036"
			}
		}, {
			selectorValue: "00102",
			preset: "cashflow_statement",
			description: "现金流量表-单季度",
			example: {
				entry: "TdxShareCW.ph_agf10_cw_xjllb",
				fixedTag: "00102",
				code: "600036"
			}
		}]
	}),
	{
		entry: "TdxShareCW.ph_agf10_cw_zcfzb",
		variants: [{
			mode: "code-only",
			preset: "balance_sheet",
			selectorSummary: "no extra selector",
			description: "资产负债表",
			example: {
				entry: "TdxShareCW.ph_agf10_cw_zcfzb",
				code: "600036"
			},
			match: () => true
		}]
	},
	{
		entry: "TdxSharePCCW.tdxf9_ag_cwsj_yjyj",
		variants: [{
			mode: "code-extra",
			preset: "earnings_warning",
			selectorSummary: "no extra selector",
			description: "业绩预警",
			example: {
				entry: "TdxSharePCCW.tdxf9_ag_cwsj_yjyj",
				code: "000526",
				extra: "gssz0000526"
			},
			match: () => true
		}]
	},
	buildFixedValueEntry({
		entry: "TdxShareCW.ph_agf10_hypm",
		coverage: "partial",
		selectorField: "queryKey",
		mode: "query-key-code-extra",
		variants: [{
			selectorValue: "00102",
			preset: "industry_rank",
			description: "行业财务排名",
			example: {
				entry: "TdxShareCW.ph_agf10_hypm",
				queryKey: "00102",
				code: "688318",
				extra: "20250930"
			}
		}, {
			selectorValue: "00105",
			preset: "valuation_rank",
			description: "行业估值排名",
			example: {
				entry: "TdxShareCW.ph_agf10_hypm",
				queryKey: "00105",
				code: "688318",
				extra: "20250930"
			}
		}]
	}),
	{
		entry: "TdxShareCW.ph_agf10_cw_zxzbxq",
		variants: [{
			mode: "code-extra",
			preset: "financial_sector_indicators",
			selectorSummary: "no extra selector",
			description: "金融行业专项指标",
			example: {
				entry: "TdxShareCW.ph_agf10_cw_zxzbxq",
				code: "600036",
				extra: "20250930"
			},
			match: () => true
		}]
	},
	buildFixedValueEntry({
		entry: "TdxShareCW.ph_agf10_jyfx",
		selectorField: "fixedTag",
		mode: "fixed-tag-code-extra",
		variants: [{
			selectorValue: "00202",
			preset: "business_composition",
			description: "主营构成",
			example: {
				entry: "TdxShareCW.ph_agf10_jyfx",
				fixedTag: "00202",
				code: "600519",
				extra: "20241231"
			}
		}]
	}),
	{
		entry: "TdxShareCW.ph_agf10_gzfx",
		variants: [{
			mode: "code-two-extras",
			preset: "valuation_history",
			selectorSummary: "no extra selector",
			description: "估值历史",
			example: {
				entry: "TdxShareCW.ph_agf10_gzfx",
				code: "000001",
				extraOne: "1Y",
				extraTwo: "PE"
			},
			match: () => true
		}]
	},
	{
		entry: "TdxSharePCCW.cfg_tk_gethy",
		variants: [{
			mode: "industry-code",
			preset: "industry_chain",
			selectorSummary: "no extra selector",
			description: "行业产业链",
			example: {
				entry: "TdxSharePCCW.cfg_tk_gethy",
				industryCode: "881426"
			},
			match: () => true
		}]
	},
	{
		entry: "TdxSharePCCW.skef10_hy_zxdt_hyzysj",
		variants: [{
			mode: "industry-title",
			preset: "industry_important_events",
			selectorSummary: "no extra selector",
			description: "行业重要事件",
			example: {
				entry: "TdxSharePCCW.skef10_hy_zxdt_hyzysj",
				industryCode: "881430"
			},
			match: () => true
		}]
	},
	{
		entry: "TdxShareCW.skef10_hy_zxdt_hyzysj",
		variants: [{
			mode: "industry-title",
			preset: "industry_important_events",
			selectorSummary: "no extra selector",
			description: "行业重要事件",
			example: {
				entry: "TdxShareCW.skef10_hy_zxdt_hyzysj",
				industryCode: "881430"
			},
			match: () => true
		}]
	},
	buildFixedValueEntry({
		entry: "TdxSharePCCW.skef10_bk_cpbd_jczl",
		selectorField: "branch",
		mode: "branch-code-time",
		variants: [
			{
				selectorValue: "001",
				preset: "board_cpbd_basic_info",
				description: "板块基础资料",
				example: {
					entry: "TdxSharePCCW.skef10_bk_cpbd_jczl",
					branch: "001",
					code: "880976"
				}
			},
			{
				selectorValue: "002",
				preset: "board_cpbd_detail",
				description: "板块详解",
				example: {
					entry: "TdxSharePCCW.skef10_bk_cpbd_jczl",
					branch: "002",
					code: "880976"
				}
			},
			{
				selectorValue: "003",
				preset: "board_cpbd_stage_return",
				description: "板块阶段涨幅",
				example: {
					entry: "TdxSharePCCW.skef10_bk_cpbd_jczl",
					branch: "003",
					code: "880976",
					timeType: "1m"
				}
			},
			{
				selectorValue: "004",
				preset: "board_cpbd_market_stats",
				description: "板块市场统计",
				example: {
					entry: "TdxSharePCCW.skef10_bk_cpbd_jczl",
					branch: "004",
					code: "880976"
				}
			}
		]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.skef10_hy_hydw_gzsppm",
		selectorField: "queryType",
		mode: "query-type-target-stock",
		variants: [{
			selectorValue: "01",
			preset: "board_valuation_query_type_01",
			description: "个股在板块中的估值对比",
			example: {
				entry: "TdxSharePCCW.skef10_hy_hydw_gzsppm",
				queryType: "01",
				targetCode: "881430",
				stockCode: "301073"
			}
		}, {
			selectorValue: "02",
			preset: "board_valuation_query_type_02",
			description: "板块或指数历史估值",
			example: {
				entry: "TdxSharePCCW.skef10_hy_hydw_gzsppm",
				queryType: "02",
				targetCode: "881430",
				stockCode: ""
			}
		}]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_iyds",
		coverage: "partial",
		selectorField: "fixedTag",
		mode: "code-fixed-tag-extra",
		variants: [{
			selectorValue: "yxsbxx",
			preset: "block_trade_intention",
			description: "大宗交易意向申报",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_iyds",
				code: "000001",
				fixedTag: "yxsbxx"
			}
		}]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_jyds",
		coverage: "partial",
		selectorField: "fixedTag",
		mode: "code-fixed-tag-extra",
		variants: [
			{
				selectorValue: "jglhb",
				preset: "dragon_tiger_list",
				description: "龙虎榜明细",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_jyds",
					code: "000001",
					fixedTag: "jglhb",
					extra: "20221129"
				}
			},
			{
				selectorValue: "dzjy",
				preset: "block_trade",
				description: "大宗交易明细",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_jyds",
					code: "000001",
					fixedTag: "dzjy",
					extra: "20260107"
				}
			},
			{
				selectorValue: "rzrq",
				preset: "margin_trading",
				description: "融资融券",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_jyds",
					code: "000001",
					fixedTag: "rzrq"
				}
			},
			{
				selectorValue: "zrq",
				preset: "refinancing",
				description: "转融券",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_jyds",
					code: "000001",
					fixedTag: "zrq"
				}
			},
			{
				selectorValue: "zjlx",
				preset: "capital_flow",
				description: "资金流向",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_jyds",
					code: "000001",
					fixedTag: "zjlx"
				}
			},
			{
				selectorValue: "ztfx",
				preset: "limit_up_analysis",
				description: "涨停分析",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_jyds",
					code: "000001",
					fixedTag: "ztfx"
				}
			},
			{
				selectorValue: "dtfx",
				preset: "limit_down_analysis",
				description: "跌停分析",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_jyds",
					code: "000001",
					fixedTag: "dtfx"
				}
			}
		]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_zlcc",
		coverage: "partial",
		selectorField: "fixedTag",
		mode: "code-fixed-tag-date-three-extras",
		variants: [{
			selectorValue: "bszj",
			preset: "northbound_funds",
			description: "北向资金",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_zlcc",
				code: "000001",
				fixedTag: "bszj",
				date: "20241231"
			}
		}]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_fhrz",
		selectorField: "fixedTag",
		mode: "code-fixed-tag",
		variants: [
			{
				selectorValue: "pxmz",
				preset: "dividend_financing_overview",
				description: "分红与募资概览",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_fhrz",
					code: "000001",
					fixedTag: "pxmz"
				}
			},
			{
				selectorValue: "fh",
				preset: "dividend_chart",
				description: "分红图",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_fhrz",
					code: "000001",
					fixedTag: "fh"
				}
			},
			{
				selectorValue: "pf",
				preset: "rights_issue_plan",
				description: "配股已实施方案与预案",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_fhrz",
					code: "000001",
					fixedTag: "pf"
				}
			},
			{
				selectorValue: "zfpg",
				preset: "placement_detail",
				description: "增发获配明细",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_fhrz",
					code: "000001",
					fixedTag: "zfpg"
				}
			},
			{
				selectorValue: "zf",
				preset: "refinancing_plan",
				description: "增发方案与实施",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_fhrz",
					code: "000001",
					fixedTag: "zf"
				}
			},
			{
				selectorValue: "fhlszs_glzfl",
				preset: "dividend_history_payout",
				description: "分红历史走势-股利支付率",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_fhrz",
					code: "601086",
					fixedTag: "fhlszs_glzfl"
				}
			},
			{
				selectorValue: "fhlszs_gxl",
				preset: "dividend_history_yield",
				description: "分红历史走势-股息率",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_fhrz",
					code: "601086",
					fixedTag: "fhlszs_gxl"
				}
			},
			{
				selectorValue: "fhpm_glzfl",
				preset: "dividend_rank_payout",
				description: "分红排名-股利支付率",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_fhrz",
					code: "601086",
					fixedTag: "fhpm_glzfl"
				}
			},
			{
				selectorValue: "fhpm_gxl",
				preset: "dividend_rank_yield",
				description: "分红排名-股息率",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_fhrz",
					code: "601086",
					fixedTag: "fhpm_gxl"
				}
			},
			{
				selectorValue: "fhpm_pxrzb",
				preset: "dividend_rank_cashfin_ratio",
				description: "分红排名-派现融资比",
				example: {
					entry: "TdxSharePCCW.tdxf10_gg_fhrz",
					code: "601086",
					fixedTag: "fhpm_pxrzb"
				}
			}
		]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_fhrz_fh",
		selectorField: "fixedTag",
		mode: "code-fixed-tag-extra",
		variants: [{
			selectorValue: "fh",
			preset: "dividend_table",
			description: "分红表",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_fhrz_fh",
				code: "000001",
				fixedTag: "fh",
				extra: "1"
			}
		}]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_sj",
		selectorField: "fixedTag",
		mode: "fixed-tag-code-two-extras",
		variants: [{
			selectorValue: "qhgp",
			preset: "dividend_viewer_filter",
			description: "分红视界-股票筛选",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_sj",
				fixedTag: "qhgp",
				code: "000001",
				extraOne: "0",
				extraTwo: ""
			}
		}, {
			selectorValue: "fh_sj",
			preset: "dividend_viewer_compare",
			description: "分红视界-对比数据",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_sj",
				fixedTag: "fh_sj",
				code: "000001",
				extraOne: "0",
				extraTwo: "000001,600000,600016,600036,600015,601988,601398,601166"
			}
		}]
	}),
	buildFixedValueEntry({
		entry: "tdxf10_gg_sj",
		selectorField: "fixedTag",
		mode: "fixed-tag-code-two-extras",
		variants: [{
			selectorValue: "fh_sj",
			preset: "dividend_viewer_compare",
			description: "分红视界-对比数据",
			example: {
				entry: "tdxf10_gg_sj",
				fixedTag: "fh_sj",
				code: "000001",
				extraOne: "0",
				extraTwo: "000001,600000,600016,600036,600015,601988,601398,601166"
			}
		}]
	}),
	buildFixedValueEntry({
		entry: "TdxSharePCCW.tdxf10_gg_gdyjcgmx",
		selectorField: "fixedTag",
		mode: "fixed-tag-code-three-extras",
		variants: [{
			selectorValue: "gdjc",
			preset: "holder_change_detail",
			description: "股东进出详情",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_gdyjcgmx",
				fixedTag: "gdjc",
				code: "000001",
				extraOne: "9900002221",
				extraTwo: "8000056",
				extraThree: "1"
			}
		}, {
			selectorValue: "gdjcmxrq",
			preset: "holder_change_type",
			description: "股东进出详情-类别",
			example: {
				entry: "TdxSharePCCW.tdxf10_gg_gdyjcgmx",
				fixedTag: "gdjcmxrq",
				code: "",
				extraOne: "9900002221",
				extraTwo: "8000056",
				extraThree: "1"
			}
		}]
	})
];
const ROUTES_BY_ENTRY = new Map(STRUCTURED_ROUTE_REGISTRY.map((definition) => [definition.entry, definition]));
function buildNoMatchMessage(definition, entry) {
	const selectors = definition.variants.map((variant) => variant.selectorSummary).filter((selector) => selector !== "no extra selector");
	if (entry === "TdxSharePCCW.tdxf10_gg_gdyj") return `entry ${entry} 缺少可用于自动推导的判别参数；请使用 fixedTag=cgbd 并提供 beginDate/endDate，或使用 fixedTag=jgcg/jgcgqk/kggd/gdrs/thygdrs/ltgd/sdgdbgq。`;
	if (selectors.length === 0) return `entry ${entry} 未命中自动推导规则，请显式传 mode。`;
	return `entry ${entry} 未命中自动推导规则；可用判别参数：${selectors.join("；")}。`;
}
function getStructuredRouteDefinition(entry) {
	return ROUTES_BY_ENTRY.get(entry);
}
function resolveStructuredRoute(entry, params) {
	const definition = getStructuredRouteDefinition(entry);
	if (!definition) return;
	const matches = definition.variants.filter((variant) => variant.match(params));
	if (matches.length === 0) {
		if ((definition.coverage ?? "full") === "partial") return;
		throw new Error(buildNoMatchMessage(definition, entry));
	}
	if (matches.length > 1) throw new Error(`entry ${entry} 命中了多个自动推导规则：${matches.map((variant) => variant.selectorSummary).join("；")}。`);
	const [match] = matches;
	return {
		entry,
		mode: match.mode,
		preset: match.preset,
		selectorSummary: match.selectorSummary,
		description: match.description,
		example: match.example,
		coverage: definition.coverage ?? "full"
	};
}
function getStructuredRouteDocRows() {
	return STRUCTURED_ROUTE_REGISTRY.flatMap((definition) => definition.variants.filter((variant) => variant.preset).map((variant) => ({
		entry: definition.entry,
		selector: variant.selectorSummary,
		mode: variant.mode,
		preset: variant.preset ?? "",
		description: variant.description,
		example: variant.example
	})));
}
//#endregion
//#region extensions/tdx-finance/src/api-data/normalize.ts
function normalizePresetResponseTransform(responseTransform, preset) {
	if (responseTransform) return responseTransform;
	if (!preset) return;
	return {
		kind: "preset",
		preset
	};
}
function normalizeTdxApiDataToolParams(params) {
	const responseTransform = normalizeResponseTransform(params.responseTransform);
	const entry = ensureRequiredString("entry", params.entry);
	if (params.mode === "raw") return {
		...params,
		responseTransform
	};
	const resolvedRoute = resolveStructuredRoute(entry, params);
	if (resolvedRoute) return {
		...params,
		mode: resolvedRoute.mode,
		responseTransform: normalizePresetResponseTransform(responseTransform, resolvedRoute.preset)
	};
	if (!params.mode) throw new Error(`entry ${entry} 未纳入自动推导规则，请显式传 mode。`);
	return {
		...params,
		responseTransform
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/index.ts
function buildSuccessResult(args) {
	const transformed = args.response.parsedBody.bodyType === "json" ? transformResponseData(args.response.parsedBody.data, args.responseTransform, args.request.normalizedRequest) : void 0;
	const responseData = transformed ? void 0 : args.response.parsedBody.data;
	return {
		ok: args.response.ok,
		toolName: "tdx_api_data",
		mode: args.request.mode,
		entry: args.request.entry,
		endpoint: args.endpoint,
		request: {
			normalized: args.request.normalizedRequest,
			body: args.request.requestBody,
			auth: args.auth.summary,
			responseTransform: args.responseTransform
		},
		response: {
			ok: args.response.ok,
			status: args.response.status,
			statusText: args.response.statusText,
			contentType: args.response.contentType,
			bodyType: args.response.parsedBody.bodyType,
			data: responseData,
			transformed
		},
		elapsedMs: args.elapsedMs,
		error: args.response.ok ? void 0 : {
			kind: "http",
			message: `HTTP ${args.response.status} ${args.response.statusText}`
		}
	};
}
function buildTextSummary(result) {
	return `${result.ok ? `tdx_api_data 请求成功 | mode=${result.mode} | entry=${result.entry} | status=${result.response?.status} | elapsed=${result.elapsedMs}ms` : `tdx_api_data 请求失败 | mode=${result.mode} | entry=${result.entry ?? "-"} | ${result.error?.message ?? "未知错误"}`}\n\n${result.response?.transformed?.summary ? `转换摘要: ${result.response.transformed.summary}\n\n` : ""}${JSON.stringify(result, null, 2)}`;
}
function executeTdxApiDataTool(context) {
	return async (_toolCallId, params, signal, _onUpdate) => {
		const { logger } = context;
		logger?.info(`tdx-finance: start tdx_api_data request - mode=${params.mode ?? "auto"}`);
		let normalizedParams = params;
		let request;
		try {
			normalizedParams = normalizeTdxApiDataToolParams(params);
			request = buildResolvedRequest(normalizedParams);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger?.warn(`tdx-finance: tdx_api_data validation failed - ${message}`);
			return json$4(createValidationError(params.mode ?? "auto", message));
		}
		let auth;
		try {
			auth = resolveAuthHeaders(normalizedParams.auth ?? { mode: "tdx" }, context.tdxApiToken);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger?.warn(`tdx-finance: tdx_api_data auth failed - ${message}`);
			return json$4({
				ok: false,
				toolName: "tdx_api_data",
				mode: request.mode,
				entry: request.entry,
				request: {
					normalized: request.normalizedRequest,
					body: request.requestBody,
					auth: { mode: normalizedParams.auth?.mode ?? "tdx" },
					responseTransform: normalizedParams.responseTransform
				},
				error: {
					kind: "auth",
					message
				}
			});
		}
		const endpoint = resolveEndpoint(context, normalizedParams);
		const timeoutMs = typeof normalizedParams.timeoutMs === "number" && Number.isFinite(normalizedParams.timeoutMs) ? Math.max(1e3, Math.trunc(normalizedParams.timeoutMs)) : DEFAULT_TIMEOUT_MS$1;
		try {
			const result = await postInternalApi({
				endpoint,
				request,
				auth,
				tdxApiToken: context.tdxApiToken,
				timeoutMs,
				signal,
				logger
			});
			const structured = buildSuccessResult({
				request,
				endpoint,
				auth,
				responseTransform: normalizedParams.responseTransform,
				elapsedMs: result.elapsedMs,
				response: result.response
			});
			if (structured.ok) logger?.info(`tdx-finance: tdx_api_data request succeeded - entry=${request.entry}, elapsed=${result.elapsedMs}ms`);
			else logger?.warn(`tdx-finance: tdx_api_data request returned non-ok response - entry=${request.entry}, status=${result.response.status}`);
			return {
				content: [{
					type: "text",
					text: buildTextSummary(structured)
				}],
				details: structured
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger?.error(`tdx-finance: tdx_api_data request failed - ${message}`);
			return json$4({
				ok: false,
				toolName: "tdx_api_data",
				mode: request.mode,
				entry: request.entry,
				endpoint,
				request: {
					normalized: request.normalizedRequest,
					body: request.requestBody,
					auth: auth.summary,
					responseTransform: normalizedParams.responseTransform
				},
				error: {
					kind: "network",
					message
				}
			});
		}
	};
}
//#endregion
//#region extensions/tdx-finance/src/api-data/schema.ts
const InferenceModeLiteralSchemas = [
	Type.Literal("code-only"),
	Type.Literal("code-fixed-tag"),
	Type.Literal("fixed-tag-code"),
	Type.Literal("code-fixed-tag-extra"),
	Type.Literal("code-fixed-tag-date-three-extras"),
	Type.Literal("code-extra"),
	Type.Literal("code-two-extras"),
	Type.Literal("fixed-tag-code-extra"),
	Type.Literal("branch-code-time"),
	Type.Literal("query-type-target-stock"),
	Type.Literal("industry-title"),
	Type.Literal("industry-code"),
	Type.Literal("code-date-range-page"),
	Type.Literal("code-fixed-tag-report-cursor-page"),
	Type.Literal("code-sort-report-type-click-page"),
	Type.Literal("query-key-code-flag"),
	Type.Literal("query-key-code-extra")
];
const StructuredRouteInferenceSchema = Type.Object({
	entry: Type.String({ description: "上游 Entry 名称。对于已纳入映射的接口，可仅传 entry 与判别参数自动推导 mode/preset。" }),
	mode: Type.Optional(Type.Union([...InferenceModeLiteralSchemas], { description: "可选显式 mode。若 entry 命中已知结构化路由，将以自动推导结果为准。" })),
	code: Type.Optional(Type.String({ description: "证券代码或主体代码。" })),
	fixedTag: Type.Optional(Type.String({ description: "常见判别参数之一，用于区分同一 entry 下的业务子类型。" })),
	extra: Type.Optional(ApiPrimitiveSchema),
	extraOne: Type.Optional(ApiPrimitiveSchema),
	extraTwo: Type.Optional(ApiPrimitiveSchema),
	branch: Type.Optional(Type.String({ description: "常见判别参数之一，用于区分同一 entry 下的分支编号。" })),
	timeType: Type.Optional(Type.String()),
	queryType: Type.Optional(Type.String({ description: "常见判别参数之一，用于区分同一 entry 下的查询类型。" })),
	targetCode: Type.Optional(Type.String()),
	stockCode: Type.Optional(Type.String()),
	industryCode: Type.Optional(Type.String()),
	title: Type.Optional(Type.String()),
	beginDate: Type.Optional(Type.String()),
	endDate: Type.Optional(Type.String()),
	clickIndex: Type.Optional(Type.Union([Type.String(), Type.Number()])),
	pageNo: Type.Optional(Type.Union([Type.String(), Type.Number()])),
	pageSize: Type.Optional(Type.Union([Type.String(), Type.Number()])),
	reportDate: Type.Optional(Type.String()),
	cursor: Type.Optional(Type.Union([Type.String(), Type.Number()])),
	sortType: Type.Optional(Type.String()),
	typeValue: Type.Optional(Type.Union([Type.String(), Type.Number()])),
	queryKey: Type.Optional(Type.String({ description: "常见判别参数之一，用于区分同一 entry 下的查询模板键。" })),
	compareFlag: Type.Optional(Type.String()),
	date: Type.Optional(Type.String()),
	...CommonOptionProperties
}, { additionalProperties: false });
const TdxApiDataToolSchema = Type.Union([StructuredRouteInferenceSchema, ...MODE_SCHEMAS], { description: "统一内部金融 API 参数 schema。优先使用 entry + 判别参数自动推导 mode/preset；只有内置模板不适用时才退回显式 mode 或 raw。" });
const TDX_API_DATA_TOOL_DESCRIPTION = `
统一内部金融 API 调用工具。
用于调用遵循 \`POST { Params: [...] }\` 加 \`?Entry=...\` 约定的 TDX/TQLEX 内部接口。

## 适用场景

- 已知上游 Entry 名称，希望统一通过 1 个工具调用结构化金融接口
- 需要由工具负责 HTTP 请求、认证、超时、HTTP 错误和结构化返回
- 需要对已纳入映射的接口自动推导 \`mode\` 与内置 \`preset\`
- 需要在显式传入 \`responseTransform\` 时保留调用方指定行为

## 自动推导规则

- 对已纳入映射的结构化接口，优先使用 \`entry + 判别参数\` 自动推导 \`mode\` 与默认 \`preset\`
- 判别参数是文档术语，不新增统一字段；实际仍使用 \`fixedTag\`、\`branch\`、\`queryType\`、\`queryKey\` 等现有参数
- 若显式传了错误的非 \`raw\` \`mode\`，命中已知结构化路由时会以自动推导结果为准
- 若显式传了 \`responseTransform.kind="preset"\` 或 \`responseTransform.kind="result-sets"\`，工具会保留调用方指定值，不自动覆盖
- 若 \`entry\` 未纳入自动推导规则，则需要显式传 \`mode\`

## 内置参数模板

| mode | Params 形态 |
|------|--------------|
| raw | 直接透传 params |
| code-only | \`[code]\` |
| code-fixed-tag | \`[code, fixedTag]\` |
| fixed-tag-code | \`[fixedTag, code]\` |
| code-fixed-tag-extra | \`[code, fixedTag, extra]\` |
| code-fixed-tag-date-three-extras | \`[code, fixedTag, date, extraOne, extraTwo, extraThree]\` |
| code-extra | \`[code, extra]\` |
| code-two-extras | \`[code, extraOne, extraTwo]\` |
| fixed-tag-code-extra | \`[fixedTag, code, extra]\` |
| fixed-tag-code-two-extras | \`[fixedTag, code, extraOne, extraTwo]\` |
| fixed-tag-code-three-extras | \`[fixedTag, code, extraOne, extraTwo, extraThree]\` |
| branch-code-time | \`[branch, code, timeType]\` |
| query-type-target-stock | \`[queryType, targetCode, stockCode]\` |
| industry-code | \`[industryCode]\` |
| industry-title | \`[industryCode, title]\` |
| code-date-range-page | \`[code, fixedTag, beginDate, endDate, clickIndex, pageNo, pageSize]\` |
| code-fixed-tag-report-cursor-page | \`[code, fixedTag, '', reportDate, cursor, pageNo, pageSize]\` |
| code-sort-report-type-click-page | \`[code, sortType, reportDate, typeValue, clickIndex, pageNo, pageSize]\` |
| query-key-code-flag | \`[queryKey, code, compareFlag]\` |
| query-key-code-extra | \`[queryKey, code, extra]\` |

## 已纳入自动推导的结构化路由

| entry | 判别参数 | 推导 mode | 默认 preset | 说明 |
|------|------|------|------|------|
${getStructuredRouteDocRows().map((row) => `| \`${row.entry}\` | \`${row.selector}\` | \`${row.mode}\` | \`${row.preset}\` | ${row.description} |`).join("\n")}

## 返回结果转换

- 不传 \`responseTransform\` 且命中已知结构化路由时，工具会自动补齐默认 \`preset\`
- 不传 \`responseTransform\` 且未命中自动推导规则时，工具返回原始响应，放在 \`response.data\`
- 传 \`responseTransform\` 且转换成功时，工具只返回 \`response.transformed\`，不再附带原始 \`response.data\`
- 传 \`responseTransform\` 但未产出转换结果时，工具仍按原样返回 \`response.data\`
- \`responseTransform\` 优先直接传 JSON 对象；如果误传了字符串化后的 \`"{\\"kind\\":\\"preset\\",...}"\`，工具也会自动解析
- 当前内置 preset 支持 ${BUILTIN_PRESET_LIST_TEXT}
- 也支持通过 \`kind="result-sets"\` 自定义 \`fieldMap\`、\`headers\`、\`layout\`

## 使用示例

### 自动推导写法

\`\`\`bash
${[
	"tdx_api_data entry=\"TdxSharePCCW.tdxf10_gg_ybpj\" code=\"000001\" fixedTag=\"yzyq\"",
	"tdx_api_data entry=\"TdxSharePCCW.tdxf10_gg_gsgk\" fixedTag=\"0\" code=\"000001\"",
	"tdx_api_data entry=\"TdxSharePCCW.tdxf10_gg_gdyj\" code=\"000001\" fixedTag=\"gdrs\" pageNo=\"1\" pageSize=\"20\"",
	"tdx_api_data entry=\"TdxSharePCCW.skef10_bk_cpbd_jczl\" branch=\"003\" code=\"880976\" timeType=\"1m\"",
	"tdx_api_data entry=\"TdxSharePCCW.skef10_hy_hydw_gzsppm\" queryType=\"01\" targetCode=\"881430\" stockCode=\"301073\""
].join("\n")}
\`\`\`

### 显式覆盖默认转换

\`\`\`bash
tdx_api_data entry="TdxSharePCCW.tdxf10_gg_rdtc" code="000001" fixedTag="zttzbkz" responseTransform={"kind":"preset","preset":"hot_topic_board_family"}
tdx_api_data mode="raw" entry="TdxShareCW.skef10_bk_cpbd_jczl" params=["001","880976",""]
\`\`\`
`;
//#endregion
//#region extensions/tdx-finance/src/http-error.ts
function compactErrorText(text) {
	return text.replace(/\s+/g, " ").trim();
}
function stringifyErrorPayload(payload) {
	if (typeof payload === "string") return compactErrorText(payload) || void 0;
	if (payload && typeof payload === "object") {
		const record = payload;
		const candidates = [
			record.error,
			record.message,
			record.msg,
			record.errmsg,
			record.errMsg,
			record.detail,
			record.reason,
			record.description
		];
		for (const candidate of candidates) if (typeof candidate === "string") {
			const normalized = compactErrorText(candidate);
			if (normalized) return normalized;
		}
	}
	try {
		return compactErrorText(JSON.stringify(payload));
	} catch {
		return;
	}
}
async function buildHttpErrorMessage(response, prefix, logger) {
	const rawText = await response.text();
	const normalizedText = compactErrorText(rawText);
	let reason = normalizedText;
	if (normalizedText) try {
		reason = stringifyErrorPayload(JSON.parse(rawText)) ?? normalizedText;
	} catch {
		reason = normalizedText;
	}
	if (reason) logger?.debug?.(`tdx-finance: HTTP error response body - status=${response.status}, body=${reason}`);
	return reason ? `${prefix}: ${response.status} ${response.statusText} | reason: ${reason}` : `${prefix}: ${response.status} ${response.statusText}`;
}
//#endregion
//#region extensions/tdx-finance/src/tool.ts
const TdxKlineToolSchema = Type.Object({
	code: Type.String({ description: "证券代码（通常为6位数字）。示例：'600519'（沪市主板）、'000001'（深市主板）、'688318'（科创板）。" }),
	setcode: Type.String({ description: "⚠️【重要】市场代码，必须与 code 匹配！'1'=上海交易所（沪市），'0'=深圳交易所（深市），'2'=北京交易所（北交所）。" }),
	period: Type.Optional(Type.String({
		default: "0",
		description: "K线周期：'0'=5分钟（默认）, '1'=15分钟, '2'=30分钟, '3'=1小时, '4'=日线, '5'=周线, '6'=月线, '7'=1分钟, '8'=多分钟, '9'=多天线, '10'=季线, '11'=年线, '12'=5秒线, '13'=多秒线"
	})),
	wantNum: Type.Optional(Type.String({
		default: "100",
		description: "请求K线数量（1-1000），默认100根K线"
	})),
	startxh: Type.Optional(Type.String({
		default: "0",
		description: "开始位置（倒序，0=最新），默认0"
	})),
	tqFlag: Type.Optional(Type.String({
		default: "11",
		description: "复权方式：'0'=不复权, '11'=前复权（默认）, '12'=后复权"
	})),
	hasAttachInfo: Type.Optional(Type.String({
		default: "1",
		description: "是否返回附加行情信息：'0'=不返回，'1'=返回（默认）"
	})),
	hasLtgb: Type.Optional(Type.String({
		default: "0",
		description: "是否返回流通股本：'0'=不返回（默认），'1'=返回"
	})),
	hasIpoPrice: Type.Optional(Type.String({
		default: "0",
		description: "是否返回发行价：'0'=不返回（默认），'1'=返回"
	}))
}, { additionalProperties: false });
const TdxQuotesToolSchema = Type.Object({
	code: Type.String({ description: "证券代码（通常为6位数字）。示例：'600519'（沪市主板）、'000001'（深市主板）、'688318'（科创板）、'300750'（创业板）、'880564'（板块指数）。" }),
	setcode: Type.String({ description: "⚠️【重要】市场代码，必须与 code 匹配！'1'=上海交易所（沪市），'0'=深圳交易所（深市），'2'=北京交易所（北交所）。code 和 setcode 不匹配会导致查询失败或返回错误数据！" }),
	hasHQInfo: Type.Optional(Type.String({
		default: "1",
		description: "是否包含行情信息：'0'=不包含，'1'=包含（默认）。当 hasCalcInfo='1' 时必须为 '1'。"
	})),
	hasExtInfo: Type.Optional(Type.String({
		default: "1",
		description: "是否包含扩展信息：'0'=不包含，'1'=包含（默认）。当 hasCalcInfo='1' 时必须为 '1'。"
	})),
	bspNum: Type.Optional(Type.String({
		default: "5",
		description: "盘口数量：'0'=不返回，'1'~'10'=返回指定数量盘口数据（默认 '5'）。"
	})),
	hasProInfo: Type.Optional(Type.String({
		default: "0",
		description: "是否包含专业信息：'0'=不包含（默认），'1'=包含。注意：获取 CalcInfo 时必须设为 '1'。"
	})),
	hasCalcInfo: Type.Optional(Type.String({
		default: "0",
		description: "是否包含计算信息：'0'=不包含（默认），'1'=包含。⚠️【重要】当 HasCalcInfo='1' 时，HasHQInfo、HasProInfo、HasExtInfo 必须同时设为 '1'，否则无法获取计算信息！"
	})),
	hasCwInfo: Type.Optional(Type.String({
		default: "0",
		description: "是否包含财务信息：'0'=不包含（默认），'1'=包含。"
	})),
	hasStatInfo: Type.Optional(Type.String({
		default: "0",
		description: "是否包含统计信息：'0'=不包含（默认），'1'=包含。"
	})),
	statParam: Type.Optional(Type.String({ description: "统计参数：当 hasStatInfo='1' 时生效，可选：'3'（3天）、'5'（5天）、'10'（10天）。" }))
}, { additionalProperties: false });
const DEFAULT_API_ENDPOINT = "http://tdxhub.icfqs.com:7615/TQLEX";
function getEnvVar$2(key) {
	try {
		return typeof process !== "undefined" ? process.env?.[key] : void 0;
	} catch {
		return;
	}
}
function logDebug$2(logger, message) {
	logger?.debug?.(message);
}
async function fetchQuotes(params, apiEndpoint, tdxApiToken, logger) {
	const requestBody = {
		Head: {
			Target: "0",
			CharSet: "UTF8"
		},
		Code: params.code,
		Setcode: params.setcode,
		HasHQInfo: params.hasHQInfo ?? "1",
		HasExtInfo: params.hasExtInfo ?? "1",
		BspNum: params.bspNum ?? "5",
		HasProInfo: params.hasProInfo ?? "0",
		HasCalcInfo: params.hasCalcInfo ?? "0",
		HasCwInfo: params.hasCwInfo ?? "0",
		HasStatInfo: params.hasStatInfo ?? "0",
		StatParam: params.statParam
	};
	const url = `${apiEndpoint}?Entry=TdxShare.PBHQInfo`;
	logDebug$2(logger, `tdx-finance: 请求行情数据 - code=${params.code}, setcode=${params.setcode}`);
	logDebug$2(logger, `tdx-finance: 请求 URL: ${url}`);
	const startTime = Date.now();
	const response = await fetch(url, {
		method: "POST",
		headers: appendTdxTokenHeader({ "Content-Type": "application/json" }, tdxApiToken),
		body: JSON.stringify(requestBody)
	});
	const elapsedMs = Date.now() - startTime;
	if (!response.ok) {
		logger?.error(`tdx-finance: API 请求失败 - status=${response.status}, elapsed=${elapsedMs}ms`);
		throw new Error(await buildHttpErrorMessage(response, "API 请求失败", logger));
	}
	logger?.info(`tdx-finance: API 请求成功 - code=${params.code}, elapsed=${elapsedMs}ms`);
	return response.json();
}
function json$3(payload) {
	return {
		content: [{
			type: "text",
			text: JSON.stringify(payload, null, 2)
		}],
		details: payload
	};
}
function validateCalcInfoParams(params) {
	if ((params.hasCalcInfo ?? "0") !== "1") return;
	const hasHQInfo = params.hasHQInfo ?? "1";
	const hasExtInfo = params.hasExtInfo ?? "1";
	const hasProInfo = params.hasProInfo ?? "0";
	if (hasHQInfo === "1" && hasExtInfo === "1" && hasProInfo === "1") return;
	return "参数组合无效：当 hasCalcInfo='1' 时，hasHQInfo、hasExtInfo、hasProInfo 必须同时为 '1'";
}
function formatQuotesResult(data, logger) {
	const result = data ?? {};
	const baseInfo = result.BaseInfo;
	const hqInfo = result.HQInfo;
	const calcInfo = result.CalcInfo;
	const summary = [];
	if (baseInfo) {
		const name = String(baseInfo.Name ?? "未知");
		const code = baseInfo.Code ? String(baseInfo.Code) : "";
		summary.push(code ? `【${name}】${code}` : `【${name}】`);
	}
	if (hqInfo) {
		const now = hqInfo.Now;
		const close = hqInfo.Close;
		if (now != null && close != null && Number(close) !== 0) {
			const change = (Number(now) - Number(close)) / Number(close) * 100;
			const changeStr = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
			summary.push(`现价: ${String(now)} (${changeStr})`);
		} else if (now != null) summary.push(`现价: ${String(now)}`);
		if (hqInfo.Volume != null) summary.push(`成交量: ${(Number(hqInfo.Volume) / 1e4).toFixed(0)}万手`);
		if (hqInfo.HSL != null) summary.push(`换手率: ${String(hqInfo.HSL)}%`);
	}
	if (calcInfo?.CAZAF != null) summary.push(`涨幅: ${String(calcInfo.CAZAF)}%`);
	if (baseInfo?.Name) logDebug$2(logger, `tdx-finance: 格式化结果 - ${String(baseInfo.Name)}(${String(baseInfo.Code ?? "")})`);
	return {
		content: [{
			type: "text",
			text: summary.length > 0 ? `${summary.join(" | ")}\n\n详细信息:\n${JSON.stringify(data, null, 2)}` : JSON.stringify(data, null, 2)
		}],
		details: data
	};
}
function executeTdxQuotesTool(context) {
	return async (_toolCallId, params, _signal, _onUpdate) => {
		const { logger } = context;
		logger?.info(`tdx-finance: 开始执行行情查询 - code=${params.code}, setcode=${params.setcode}`);
		if (!params.code?.trim() || !params.setcode?.trim()) return json$3({
			error: "缺少必填参数：code / setcode",
			params
		});
		const calcInfoValidationError = validateCalcInfoParams(params);
		if (calcInfoValidationError) {
			logger?.warn(`tdx-finance: 行情查询参数校验失败 - ${calcInfoValidationError}`);
			return json$3({
				error: calcInfoValidationError,
				params
			});
		}
		try {
			const apiEndpoint = context.apiEndpoint || getEnvVar$2("TDX_API_ENDPOINT") || DEFAULT_API_ENDPOINT;
			logDebug$2(logger, `tdx-finance: 使用 API 端点: ${apiEndpoint}`);
			return formatQuotesResult(await fetchQuotes(params, apiEndpoint, context.tdxApiToken, logger), logger);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger?.error(`tdx-finance: 行情查询失败 - ${errorMsg}`);
			logger?.error(`tdx-finance: 请求参数 - ${JSON.stringify(params)}`);
			return json$3({
				error: errorMsg,
				params
			});
		}
	};
}
const TDX_QUOTES_TOOL_DESCRIPTION = `
实时行情查询工具。
用于查询股票、指数、板块等证券品种的实时行情，可按需返回基础行情、扩展信息、盘口、专业信息、财务信息和统计信息。

## 关键要求

- \`code\` 与 \`setcode\` 必须匹配，否则容易返回错误结果
- \`setcode="1"\` 通常对应沪市，\`setcode="0"\` 对应深市，\`setcode="2"\` 对应北交所
- 当 \`hasCalcInfo="1"\` 时，\`hasHQInfo\`、\`hasExtInfo\`、\`hasProInfo\` 需要同时设为 \`"1"\`

## 常用参数

| 参数 | 必填 | 说明 |
|------|------|------|
| code | 是 | 证券代码，如 \`600519\`、\`000001\`、\`399001\`、\`880564\` |
| setcode | 是 | 市场代码，\`1\`=沪市，\`0\`=深市，\`2\`=北交所 |
| hasHQInfo | 否 | 是否返回基础行情，默认 \`1\` |
| hasExtInfo | 否 | 是否返回扩展信息，默认 \`1\` |
| bspNum | 否 | 返回盘口档位数，默认 \`5\` |
| hasProInfo | 否 | 是否返回专业信息，默认 \`0\` |
| hasCalcInfo | 否 | 是否返回计算指标，默认 \`0\` |
| hasCwInfo | 否 | 是否返回财务信息，默认 \`0\` |
| hasStatInfo | 否 | 是否返回统计信息，默认 \`0\` |

## 使用示例

\`\`\`bash
tdx_quotes code="600519" setcode="1"
tdx_quotes code="000001" setcode="0" hasExtInfo="0" bspNum="0"
tdx_quotes code="399001" setcode="0"
\`\`\`
`;
async function fetchKline(params, apiEndpoint, tdxApiToken, logger) {
	const requestBody = {
		Head: {
			Target: 0,
			CharSet: "UTF8"
		},
		Code: params.code,
		Setcode: Number(params.setcode),
		Period: Number(params.period ?? "0"),
		Startxh: Number(params.startxh ?? "0"),
		WantNum: Number(params.wantNum ?? "100"),
		TQFlag: Number(params.tqFlag ?? "11"),
		MPData: 0,
		HasAttachInfo: Number(params.hasAttachInfo ?? "1"),
		HasLtgb: Number(params.hasLtgb ?? "0"),
		ForRefresh: 0,
		HasIpoPrice: Number(params.hasIpoPrice ?? "0")
	};
	const url = `${apiEndpoint}?Entry=TdxShare.PBFXT`;
	logDebug$2(logger, `tdx-finance: 请求K线数据 - code=${params.code}, setcode=${params.setcode}, period=${params.period ?? "0"}`);
	logDebug$2(logger, `tdx-finance: 请求 URL: ${url}`);
	const startTime = Date.now();
	const response = await fetch(url, {
		method: "POST",
		headers: appendTdxTokenHeader({ "Content-Type": "application/json" }, tdxApiToken),
		body: JSON.stringify(requestBody)
	});
	const elapsedMs = Date.now() - startTime;
	if (!response.ok) {
		logger?.error(`tdx-finance: K线API请求失败 - status=${response.status}, elapsed=${elapsedMs}ms`);
		throw new Error(await buildHttpErrorMessage(response, "K线API请求失败", logger));
	}
	logger?.info(`tdx-finance: K线API请求成功 - code=${params.code}, elapsed=${elapsedMs}ms`);
	return response.json();
}
function formatKlineResult(data, logger) {
	const result = data ?? {};
	const attachInfo = result.AttachInfo;
	const listItem = result.ListItem;
	const summary = [];
	if (attachInfo) {
		const name = String(attachInfo.Name ?? "未知");
		const code = result.Code ? String(result.Code) : "";
		summary.push(code ? `【${name}】${code}` : `【${name}】`);
		if (attachInfo.Now != null && attachInfo.Close != null && Number(attachInfo.Close) !== 0) {
			const change = (Number(attachInfo.Now) - Number(attachInfo.Close)) / Number(attachInfo.Close) * 100;
			const changeStr = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
			summary.push(`现价: ${String(attachInfo.Now)} (${changeStr})`);
		}
		if (attachInfo.fHSL != null) summary.push(`换手率: ${String(attachInfo.fHSL)}%`);
	}
	if (listItem && listItem.length > 0) {
		summary.push(`K线数量: ${listItem.length}根`);
		const closes = listItem.map((item) => Number(item.Item?.[5])).filter((v) => Number.isFinite(v));
		if (closes.length >= 2) {
			const firstClose = closes[closes.length - 1];
			const periodChange = (closes[0] - firstClose) / firstClose * 100;
			const periodChangeStr = periodChange >= 0 ? `+${periodChange.toFixed(2)}%` : `${periodChange.toFixed(2)}%`;
			summary.push(`区间涨跌: ${periodChangeStr}`);
		}
		const highs = listItem.map((item) => Number(item.Item?.[3])).filter((v) => Number.isFinite(v));
		const lows = listItem.map((item) => Number(item.Item?.[4])).filter((v) => Number.isFinite(v));
		if (highs.length > 0 && lows.length > 0) {
			const maxHigh = Math.max(...highs);
			const minLow = Math.min(...lows);
			summary.push(`区间最高: ${maxHigh.toFixed(2)}, 最低: ${minLow.toFixed(2)}`);
		}
	}
	if (attachInfo?.Name) logDebug$2(logger, `tdx-finance: K线格式化结果 - ${String(attachInfo.Name)}(${String(result.Code ?? "")})`);
	return {
		content: [{
			type: "text",
			text: summary.length > 0 ? `${summary.join(" | ")}\n\n详细K线数据:\n${JSON.stringify(data, null, 2)}` : JSON.stringify(data, null, 2)
		}],
		details: data
	};
}
function executeTdxKlineTool(context) {
	return async (_toolCallId, params, _signal, _onUpdate) => {
		const { logger } = context;
		logger?.info(`tdx-finance: 开始执行K线查询 - code=${params.code}, setcode=${params.setcode}, period=${params.period ?? "0"}`);
		if (!params.code?.trim() || !params.setcode?.trim()) return json$3({
			error: "缺少必填参数：code / setcode",
			params
		});
		try {
			const apiEndpoint = context.apiEndpoint || getEnvVar$2("TDX_API_ENDPOINT") || DEFAULT_API_ENDPOINT;
			logDebug$2(logger, `tdx-finance: 使用 API 端点: ${apiEndpoint}`);
			return formatKlineResult(await fetchKline(params, apiEndpoint, context.tdxApiToken, logger), logger);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger?.error(`tdx-finance: K线查询失败 - ${errorMsg}`);
			logger?.error(`tdx-finance: 请求参数 - ${JSON.stringify(params)}`);
			return json$3({
				error: errorMsg,
				params
			});
		}
	};
}
const TDX_KLINE_TOOL_DESCRIPTION = `
K 线查询工具。
用于查询股票、指数、板块等证券品种的 K 线数据，支持分钟线、日线、周线、月线以及前复权、后复权。

## 关键要求

- \`code\` 与 \`setcode\` 必须匹配
- \`period\` 默认 \`0\`，表示 5 分钟线
- \`tqFlag\` 默认 \`11\`，表示前复权

## 常用参数

| 参数 | 必填 | 说明 |
|------|------|------|
| code | 是 | 证券代码 |
| setcode | 是 | 市场代码，\`1\`=沪市，\`0\`=深市，\`2\`=北交所 |
| period | 否 | 周期代码，常用 \`0\`=5 分钟、\`4\`=日线、\`5\`=周线、\`6\`=月线 |
| wantNum | 否 | 返回 K 线条数，默认 \`100\` |
| startxh | 否 | 起始偏移，默认 \`0\` |
| tqFlag | 否 | 复权方式，\`0\`=不复权，\`11\`=前复权，\`12\`=后复权 |
| hasAttachInfo | 否 | 是否附带附加信息，默认 \`1\` |
| hasLtgb | 否 | 是否附带流通股本信息，默认 \`0\` |
| hasIpoPrice | 否 | 是否附带发行价信息，默认 \`0\` |

## 使用示例

\`\`\`bash
tdx_kline code="600519" setcode="1" period="4"
tdx_kline code="000001" setcode="0" period="0" wantNum="120"
tdx_kline code="399001" setcode="0" period="4"
\`\`\`
`;
const RAG_API_URL = "https://ai.icfqs.com:8965/v1/rag-entity-retrieve";
const RANGE_TYPES = {
	AG: "A股",
	"HK-GP": "港股股票",
	"HK-JJ": "港股基金",
	JJ: "基金",
	"MG-GP": "美股",
	ZS: "指数"
};
const TdxLookupStockToolSchema = Type.Object({
	query: Type.String({ description: "实体名称或别名，如'平安银行'、'茅台'、'腾讯'、'上证指数'等" }),
	range: Type.Optional(Type.String({
		default: "AG",
		description: "市场类型：'AG'=A股(默认), 'HK-GP'=港股股票, 'HK-JJ'=港股基金, 'JJ'=基金, 'MG-GP'=美股, 'ZS'=指数"
	}))
}, { additionalProperties: false });
function getRangeDesc(range) {
	return RANGE_TYPES[range] || range;
}
function formatEntityResult(payload) {
	const lines = [`【${payload.entity_code}】${payload.entity_name}`, `  类型: ${payload.entity_type}${payload.entity_setcode !== void 0 ? ` | setcode: ${payload.entity_setcode}` : ""}`];
	if (payload.aliases && payload.aliases.length > 0) {
		const allAliases = payload.aliases.flatMap((alias) => typeof alias === "string" ? alias.split("|") : [alias]).filter((alias) => String(alias).trim());
		if (allAliases.length > 0) lines.push(`  别名: ${allAliases.slice(0, 5).join(", ")}${allAliases.length > 5 ? "..." : ""}`);
	}
	return lines.join("\n");
}
async function searchEntities(query, range, tdxApiToken, logger) {
	logDebug$2(logger, `tdx-finance: 实体检索请求 - query=${query}, range=${range}`);
	const requestBody = { query };
	if (range) requestBody.range = range;
	const response = await fetch(RAG_API_URL, {
		method: "POST",
		headers: appendTdxTokenHeader({ "Content-Type": "application/json" }, tdxApiToken),
		body: JSON.stringify(requestBody)
	});
	if (!response.ok) throw new Error(await buildHttpErrorMessage(response, "实体检索API请求失败", logger));
	const data = await response.json();
	logDebug$2(logger, `tdx-finance: 实体检索响应 - ${JSON.stringify(data)}`);
	if (!data.retrieved_entities || !Array.isArray(data.retrieved_entities)) return [];
	return data.retrieved_entities;
}
function formatSearchResult(results, query, range) {
	if (results.length === 0) return { content: [{
		type: "text",
		text: `未找到与"${query}"匹配的${getRangeDesc(range)}实体。请尝试其他关键词。`
	}] };
	const formattedResults = results.map((entity, index) => {
		return `\n${index + 1}. ${formatEntityResult(entity)}`;
	}).join("\n");
	return {
		content: [{
			type: "text",
			text: `${`找到 ${results.length} 个与"${query}"相关的${getRangeDesc(range)}:\n`}${formattedResults}\n\n快速参考: ${results.slice(0, 5).map((r) => `${r.entity_code}(${r.entity_name})`).join(", ")}`
		}],
		details: results.map((r) => ({
			code: r.entity_code,
			name: r.entity_name,
			type: r.entity_type,
			setcode: r.entity_setcode,
			aliases: r.aliases
		}))
	};
}
function executeTdxLookupStockTool(context) {
	return async (_toolCallId, params, _signal, _onUpdate) => {
		const { logger } = context;
		const range = params.range ?? "AG";
		logger?.info(`tdx-finance: 开始执行代码搜索 - query=${params.query}, range=${range}`);
		if (!params.query?.trim()) return json$3({
			error: "缺少必填参数：query（查询关键词）",
			params
		});
		const validRanges = [
			"AG",
			"HK-GP",
			"HK-JJ",
			"JJ",
			"MG-GP",
			"ZS"
		];
		if (!validRanges.includes(range)) return json$3({
			error: `无效的市场类型: ${range}，支持的类型: ${validRanges.join(", ")}`,
			params
		});
		try {
			return formatSearchResult(await searchEntities(params.query, range, context.tdxApiToken, logger), params.query, range);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger?.error(`tdx-finance: 代码搜索失败 - ${errorMsg}`);
			return json$3({
				error: errorMsg,
				params
			});
		}
	};
}
const TDX_LOOKUP_STOCK_TOOL_DESCRIPTION = `
证券代码检索工具。
根据名称、简称或别名检索股票、指数、基金、板块,等实体代码。适合在调用其他依赖代码参数的工具前，先查出正确代码。

## 常用参数

| 参数 | 必填 | 说明 |
|------|------|------|
| query | 是 | 查询词，如 \`平安银行\`、\`茅台\`、\`腾讯\`、\`上证指数\` |
| range | 否 | 检索范围，默认 \`AG\` |

## \`range\` 可选值

| 取值 | 说明 |
|------|------|
| AG | A 股 |
| HK-GP | 港股股票 |
| HK-JJ | 港股基金 |
| JJ | 基金 |
| MG-GP | 美股 |
| ZS | 指数 |

## 使用示例

\`\`\`bash
tdx_lookup_stock query="平安银行"
tdx_lookup_stock query="腾讯" range="HK-GP"
tdx_lookup_stock query="上证指数" range="ZS"
\`\`\`
`;
//#endregion
//#region extensions/tdx-finance/src/screener.ts
const TdxScreenerToolSchema = Type.Object({
	message: Type.String({ description: "自然语言查询指令。示例：'涨停'、'跌停'、'放量'、'主力流入'、'破位'、'金叉'等" }),
	rang: Type.Optional(Type.String({
		default: "AG",
		description: "市场范围代码：'AG'=A股（默认）, 'JJ'=基金, 'ZS'=指数, 'ZG-JJJL'=基金经理, 'GG-GP'=港股"
	})),
	pageNo: Type.Optional(Type.String({
		default: "1",
		description: "页码，从1开始，默认'1'"
	})),
	pageSize: Type.Optional(Type.String({
		default: "10",
		description: "每页记录数，默认'10'，建议5-20"
	}))
}, { additionalProperties: false });
const DEFAULT_SCREENER_ENDPOINT = "http://tdxhub.icfqs.com:7615/TQLEX";
const RANG_DESCRIPTIONS = {
	AG: "A股市场",
	JJ: "基金",
	ZS: "指数",
	"ZG-JJJL": "基金经理",
	"GG-GP": "港股"
};
function getEnvVar$1(key) {
	try {
		return typeof process !== "undefined" ? process.env?.[key] : void 0;
	} catch {
		return;
	}
}
function logDebug$1(logger, message) {
	logger?.debug?.(message);
}
async function fetchScreener(params, apiEndpoint, tdxApiToken, logger) {
	const requestBody = [{
		message: params.message,
		rang: params.rang ?? "AG",
		pageNo: params.pageNo ?? "1",
		pageSize: params.pageSize ?? "10"
	}];
	const url = `${apiEndpoint}?Entry=JNLPSE:wendaQuery`;
	logDebug$1(logger, `tdx-finance: 请求选股数据 - message=${params.message}, rang=${params.rang ?? "AG"}`);
	logDebug$1(logger, `tdx-finance: 请求 URL: ${url}`);
	const startTime = Date.now();
	const response = await fetch(url, {
		method: "POST",
		headers: appendTdxTokenHeader({ "Content-Type": "application/json" }, tdxApiToken),
		body: JSON.stringify(requestBody)
	});
	const elapsedMs = Date.now() - startTime;
	if (!response.ok) {
		logger?.error(`tdx-finance: 选股API请求失败 - status=${response.status}, elapsed=${elapsedMs}ms`);
		throw new Error(await buildHttpErrorMessage(response, "选股API请求失败", logger));
	}
	logger?.info(`tdx-finance: 选股API请求成功 - message=${params.message}, elapsed=${elapsedMs}ms`);
	return response.json();
}
function json$2(payload) {
	return {
		content: [{
			type: "text",
			text: JSON.stringify(payload, null, 2)
		}],
		details: payload
	};
}
/**
* 解析选股接口返回的特殊数组结构
* [0]: 元数据行 [错误码, 错误信息, 总数, 保留, 当前页数量]
* [1]: 表头行
* [2]: 格式化标识行
* [3...]: 数据行
*/
function parseScreenerResult(rawData, params, logger) {
	if (!Array.isArray(rawData) || rawData.length < 3) return null;
	const metaRow = rawData[0];
	if (!Array.isArray(metaRow) || metaRow.length < 5) return null;
	const errorCode = Number(metaRow[0]) || 0;
	const errorMsg = String(metaRow[1] || "");
	const totalCount = Number(metaRow[2]) || 0;
	const currentPageCount = Number(metaRow[4]) || 0;
	const headers = rawData[1];
	if (!Array.isArray(headers)) return null;
	const formatFlags = rawData[2];
	const numericColumns = /* @__PURE__ */ new Set();
	if (Array.isArray(formatFlags)) formatFlags.forEach((flag, index) => {
		const parts = String(flag).split("|");
		if (parts.length >= 2 && parts[1] === "9") numericColumns.add(index);
	});
	const dataRows = [];
	for (let i = 3; i < rawData.length; i++) {
		const row = rawData[i];
		if (!Array.isArray(row)) continue;
		const dataObj = {};
		headers.forEach((header, index) => {
			const value = row[index];
			if (numericColumns.has(index) && typeof value === "string") {
				const numValue = parseFloat(value);
				dataObj[header] = isNaN(numValue) ? value : numValue;
			} else dataObj[header] = value ?? "";
		});
		dataRows.push(dataObj);
	}
	const rang = params.rang ?? "AG";
	const result = {
		meta: {
			code: errorCode,
			message: errorMsg,
			total: totalCount,
			currentPageCount,
			pageNo: Number(params.pageNo ?? "1"),
			pageSize: Number(params.pageSize ?? "10"),
			rang,
			rangDescription: RANG_DESCRIPTIONS[rang] || rang,
			query: params.message
		},
		headers,
		data: dataRows,
		summary: `查询"${params.message}"在${RANG_DESCRIPTIONS[rang] || rang}中共找到 ${totalCount} 条记录，当前第 ${params.pageNo ?? "1"} 页，显示 ${currentPageCount} 条`
	};
	logDebug$1(logger, `tdx-finance: 选股解析完成 - 共${totalCount}条记录`);
	return result;
}
function formatScreenerResult(rawData, params, logger) {
	const parsed = parseScreenerResult(rawData, params, logger);
	if (!parsed) return {
		content: [{
			type: "text",
			text: `选股查询结果（原始格式）:\n${JSON.stringify(rawData, null, 2)}`
		}],
		details: rawData
	};
	if (parsed.meta.code !== 0) return json$2({
		error: parsed.meta.message || "查询失败",
		code: parsed.meta.code,
		params
	});
	const summaryLines = [];
	summaryLines.push(`## ${parsed.summary}`);
	summaryLines.push("");
	if (parsed.data.length > 0) {
		summaryLines.push("| 序号 | 代码 | 名称 | 现价 | 涨跌幅 |");
		summaryLines.push("|------|------|------|------|--------|");
		parsed.data.forEach((row, index) => {
			const pos = row["POS"] ?? index + 1;
			const code = row["sec_code"] ?? "";
			const name = row["sec_name"] ?? "";
			const price = row["now_price"] ?? "-";
			const chg = row["chg"] ?? "-";
			summaryLines.push(`| ${pos} | ${code} | ${name} | ${price} | ${chg}% |`);
		});
		summaryLines.push("");
		summaryLines.push("---");
		summaryLines.push("");
		summaryLines.push("**完整数据:**");
		summaryLines.push("");
		summaryLines.push("```json");
		summaryLines.push(JSON.stringify(parsed, null, 2));
		summaryLines.push("```");
	}
	return {
		content: [{
			type: "text",
			text: summaryLines.join("\n")
		}],
		details: parsed
	};
}
function executeTdxScreenerTool(context) {
	return async (_toolCallId, params, _signal, _onUpdate) => {
		const { logger } = context;
		logger?.info(`tdx-finance: 开始执行选股查询 - message=${params.message}, rang=${params.rang ?? "AG"}`);
		if (!params.message?.trim()) return json$2({
			error: "缺少必填参数：message（查询条件）",
			params
		});
		try {
			const apiEndpoint = context.apiEndpoint || getEnvVar$1("TDX_SCREENER_ENDPOINT") || getEnvVar$1("TDX_API_ENDPOINT") || DEFAULT_SCREENER_ENDPOINT;
			logDebug$1(logger, `tdx-finance: 使用选股 API 端点: ${apiEndpoint}`);
			return formatScreenerResult(await fetchScreener(params, apiEndpoint, context.tdxApiToken, logger), params, logger);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger?.error(`tdx-finance: 选股查询失败 - ${errorMsg}`);
			logger?.error(`tdx-finance: 请求参数 - ${JSON.stringify(params)}`);
			return json$2({
				error: errorMsg,
				params
			});
		}
	};
}
const TDX_SCREENER_TOOL_DESCRIPTION = `
条件选股工具。
通过自然语言描述选股条件，返回符合条件的股票、基金、指数或港股结果列表。

## 参数说明

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| message | 是 | - | 自然语言选股条件 |
| rang | 否 | \`AG\` | 市场范围 |
| pageNo | 否 | \`1\` | 页码，从 1 开始 |
| pageSize | 否 | \`10\` | 每页条数 |

## \`rang\` 可选值

| 取值 | 说明 |
|------|------|
| AG | A 股 |
| JJ | 基金 |
| ZS | 指数 |
| ZG-JJJL | 基金经理 |
| GG-GP | 港股 |

## 自然语言示例

- \`涨停\`
- \`3连板\`
- \`放量上涨\`
- \`主力净流入\`
- \`MACD金叉\`
- \`北向资金连续流入\`

## 使用示例

\`\`\`bash
tdx_screener message="涨停" rang="AG"
tdx_screener message="主力净流入" pageNo="2" pageSize="20"
tdx_screener message="放量上涨" rang="GG-GP"
\`\`\`
`;
//#endregion
//#region extensions/tdx-finance/src/indicator-select.ts
const TdxIndicatorSelectToolSchema = Type.Object({
	message: Type.String({ description: "金融指标数据查询条件。必须在一个 message 中同时包含“查询实体”和“查询目标”。支持单个或多个股票/指数/基金实体，也支持一个或多个指标、属性、资料项。示例：'贵州茅台 市盈率'、'宁德时代 主营构成'、'贵州茅台和宁德时代的市盈率、市净率'、'上证指数和创业板指 估值水平'。不支持只写主题词/概念词/产业链词，例如：'人工智能 AI 智能计算 产业链 概念板块'。" }),
	rang: Type.Optional(Type.String({
		default: "AG",
		description: "市场范围：'AG'=A股个股（默认）, 'ZS'=指数, 'JJ'=基金。"
	}))
}, { additionalProperties: false });
const DEFAULT_INDICATOR_SELECT_ENDPOINT = "http://tdxhub.icfqs.com:7615/TQLEX";
const VALID_RANGES = [
	"AG",
	"ZS",
	"JJ"
];
function getEnvVar(key) {
	try {
		return typeof process !== "undefined" ? process.env?.[key] : void 0;
	} catch {
		return;
	}
}
function logDebug(logger, message) {
	logger?.debug?.(message);
}
function json$1(payload) {
	return {
		content: [{
			type: "text",
			text: JSON.stringify(payload, null, 2)
		}],
		details: payload
	};
}
async function fetchIndicatorSelect(params, apiEndpoint, tdxApiToken, logger) {
	const requestBody = {
		message: params.message,
		rang: params.rang ?? "AG"
	};
	const url = `${apiEndpoint}?Entry=NLPSE:InfoSelectV2`;
	logDebug(logger, `tdx-finance: 请求金融指标查询 - message=${params.message}, rang=${params.rang ?? "AG"}`);
	logDebug(logger, `tdx-finance: 请求 URL: ${url}`);
	const startTime = Date.now();
	const response = await fetch(url, {
		method: "POST",
		headers: appendTdxTokenHeader({ "Content-Type": "application/json" }, tdxApiToken),
		body: JSON.stringify(requestBody)
	});
	const elapsedMs = Date.now() - startTime;
	if (!response.ok) {
		logger?.error(`tdx-finance: 金融指标查询API请求失败 - status=${response.status}, elapsed=${elapsedMs}ms`);
		throw new Error(await buildHttpErrorMessage(response, "金融指标查询API请求失败", logger));
	}
	logger?.info(`tdx-finance: 金融指标查询API请求成功 - message=${params.message}, elapsed=${elapsedMs}ms`);
	return response.json();
}
function formatIndicatorSelectResult(data) {
	return {
		content: [{
			type: "text",
			text: JSON.stringify(data, null, 2)
		}],
		details: data
	};
}
function executeTdxIndicatorSelectTool(context) {
	return async (_toolCallId, params, _signal, _onUpdate) => {
		const { logger } = context;
		const rang = params.rang ?? "AG";
		logger?.info(`tdx-finance: 开始执行金融指标查询 - message=${params.message}, rang=${rang}`);
		if (!params.message?.trim()) return json$1({
			error: "缺少必填参数：message（查询条件）",
			params
		});
		if (!VALID_RANGES.includes(rang)) return json$1({
			error: `无效的市场范围: ${rang}，支持的范围: ${VALID_RANGES.join(", ")}`,
			params
		});
		try {
			const apiEndpoint = context.apiEndpoint || getEnvVar("TDX_INDICATOR_SELECT_ENDPOINT") || DEFAULT_INDICATOR_SELECT_ENDPOINT;
			logDebug(logger, `tdx-finance: 使用金融指标查询 API 端点: ${apiEndpoint}`);
			return formatIndicatorSelectResult(await fetchIndicatorSelect({
				...params,
				rang
			}, apiEndpoint, context.tdxApiToken, logger));
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger?.error(`tdx-finance: 金融指标查询失败 - ${errorMsg}`);
			logger?.error(`tdx-finance: 请求参数 - ${JSON.stringify(params)}`);
			return json$1({
				error: errorMsg,
				params: {
					...params,
					rang
				}
			});
		}
	};
}
const TDX_INDICATOR_SELECT_TOOL_DESCRIPTION = `
金融指标查询入口工具。
适用于查询股票、指数、基金的指标数据、基础资料、财务指标、估值指标等结构化信息。

## 调用约束

- \`message\` 必须在一个字符串里同时包含“查询实体”和“查询目标”
- 查询实体必须能落到具体股票、指数或基金
- 一个 \`message\` 可以包含多个实体，也可以包含多个目标
- 多实体场景下，所有实体仍需是明确可识别的股票、指数或基金
- 不要只给主题词、概念词、板块词、产业链词
- 当 \`rang="AG"\` 时，\`message\` 必须对应具体 A 股股票； 当 \`rang="ZS"\` 时，\`message\` 必须对应具体指数代码； 当 \`rang="JJ"\` 时，\`message\` 必须对应具体基金代码
- 如果需求是“找某个主题下有哪些股票”，应改用 \`tdx_screener\`，或先用 \`tdx_lookup_stock\` 找到具体股票后再查

## 参数说明

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| message | 是 | - | 单字符串自然语言查询，必须写成“实体 + 查询目标”；支持多个实体、多个目标 |
| rang | 否 | \`AG\` | 查询范围；当为 \`AG\` 时应理解为“查询 A 股个股属性/指标”，不是“在 A 股里按主题找股票” |

## \`rang\` 可选值

| 取值 | 说明 |
|------|------|
| AG | A 股 |
| ZS | 指数 |
| JJ | 基金 |

## 适用场景

- 查询个股估值、财务、主营构成、股本股东等指标
- 查询指数资料、行情指标、技术指标、估值水平
- 查询基金资料、净值指标、规模等信息

## 不适用场景

- \`人工智能 AI 智能计算 产业链 概念板块\`
- \`算力 概念 有哪些股票\`
- \`半导体 产业链\`
- \`高股息\`

以上问题不适合调用 \`tdx_indicator_select\`，因为它们缺少明确证券实体，或本质上属于主题发现/选股问题。

## 自然语言示例

- \`贵州茅台的市盈率和市净率\`
- \`宁德时代主营构成\`
- \`贵州茅台和宁德时代的市盈率、市净率\`
- \`中科曙光、寒武纪 概念板块、产业链\`
- \`上证指数近一年涨跌幅\`
- \`上证指数和创业板指 估值水平\`
- \`创业板指估值水平\`
- \`华夏上证50ETF基金规模\`
- \`中科曙光 概念板块\`
- \`寒武纪 产业链\`
`;
//#endregion
//#region extensions/tdx-finance/index.ts
const STATIC_TOOLS = [
	{
		name: "tdx_api_data",
		label: "TDX API Data",
		description: TDX_API_DATA_TOOL_DESCRIPTION,
		parameters: TdxApiDataToolSchema,
		createExecute: executeTdxApiDataTool
	},
	{
		name: "tdx_quotes",
		label: "TDX Quotes",
		description: TDX_QUOTES_TOOL_DESCRIPTION,
		parameters: TdxQuotesToolSchema,
		createExecute: executeTdxQuotesTool
	},
	{
		name: "tdx_kline",
		label: "TDX K-Line",
		description: TDX_KLINE_TOOL_DESCRIPTION,
		parameters: TdxKlineToolSchema,
		createExecute: executeTdxKlineTool
	},
	{
		name: "tdx_lookup_stock",
		label: "TDX Lookup Stock",
		description: TDX_LOOKUP_STOCK_TOOL_DESCRIPTION,
		parameters: TdxLookupStockToolSchema,
		createExecute: executeTdxLookupStockTool
	},
	{
		name: "tdx_screener",
		label: "TDX Screener",
		description: TDX_SCREENER_TOOL_DESCRIPTION,
		parameters: TdxScreenerToolSchema,
		createExecute: executeTdxScreenerTool
	},
	{
		name: "tdx_indicator_select",
		label: "TDX Indicator Select",
		description: TDX_INDICATOR_SELECT_TOOL_DESCRIPTION,
		parameters: TdxIndicatorSelectToolSchema,
		createExecute: executeTdxIndicatorSelectTool
	}
];
const plugin = {
	id: "tdx-finance-mcp",
	name: "TDX Finance MCP",
	description: "TDX finance data plugin.",
	configSchema: TDX_FINANCE_PLUGIN_CONFIG_SCHEMA,
	register(api) {
		api.logger.info("tdx-finance-mcp: registering plugin...");
		const context = {
			logger: api.logger,
			tdxApiToken: resolveTdxApiToken(api.pluginConfig)
		};
		for (const tool of STATIC_TOOLS) {
			api.registerTool({
				name: tool.name,
				label: tool.label,
				description: tool.description,
				parameters: tool.parameters,
				execute: tool.createExecute(context)
			});
			api.logger.info(`tdx-finance-mcp: registered tool: ${tool.name}`);
		}
	}
};
//#endregion
export { plugin as default };
