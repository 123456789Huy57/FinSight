// ============================================================
// FinSight API Client
// ============================================================

export type DataMode = 'synthetic-demo' | 'market-provider' | 'external-feed'

export type MarketDataStatus = {
  source: string
  dataMode: DataMode
  status: 'current' | 'stale' | 'no_data'
  stale: boolean
  priceAsOf: string | null
  indexAsOf: string | null
  symbolCoverage?: {
    listed: number
    withHistory: number
    currentToIndexDate: number
  }
  lastRun: {
    status: 'running' | 'success' | 'partial' | 'failed'
    startedAt: string
    finishedAt: string | null
    summary: Record<string, number | string> | null
  } | null
}

export type ScreenerOptions = {
  q?: string
  exchange?: string
  sector?: string
  sort?: 'gainers' | 'losers' | 'volume' | 'symbol' | 'marketCap' | 'tradingValue'
  limit?: number
  offset?: number
}

export type NewsQuery = {
  q?: string
  category?: string
  sentiment?: 'positive' | 'neutral' | 'negative'
  symbol?: string
  limit?: number
  offset?: number
}

export type MarketIndex = {
  symbol: string
  exchange: string
  points: number
  change: number | null
  percent_change: number | null
  volume: number | null
  updated_at: string
  data_mode?: 'synthetic-demo' | 'market-provider'
  source?: string | null
}

export type MarketMover = {
  symbol: string
  exchange: string
  current_price: number | null
  price_change: number | null
  percent_change: number | null
  volume: number | null
}

export type Quote = {
  symbol: string
  exchange: string
  current_price: number | null
  price_change: number | null
  percent_change: number | null
  volume: number | null
  updated_at: string
  data_mode?: 'synthetic-demo' | 'market-provider'
  source?: string | null
}

export type OHLCVCandle = {
  time: string | null
  open: number | null
  high: number | null
  low: number | null
  close: number
  adjustedClose?: number | null
  volume: number | null
  source?: string
  dataMode?: DataMode
}

export type StockHistoryResponse = {
  symbol: string
  days: number
  candles: OHLCVCandle[]
  updated_at: string
  source?: string | null
  data_mode?: DataMode | null
}

export type IndexHistoryResponse = StockHistoryResponse

export type StockIndicators = {
  symbol: string
  indicators: {
    rsi14: number | null
    macd: number | null
    macdSignal: number | null
    macdHistogram: number | null
    sma20: number | null
    sma50: number | null
    sma200: number | null
    ema20: number | null
    ema50: number | null
    bollingerMiddle: number | null
    bollingerUpper: number | null
    bollingerLower: number | null
  } | null
  lastPrice: number | null
  asOf: string | null
  source: string | null
  dataMode: DataMode | null
}

export type SearchResult = {
  symbol: string
  name: string
  exchange: string
}

export type SearchResponse = {
  results: SearchResult[]
}

export type MarketIndicesResponse = {
  timestamp: string
  indices: MarketIndex[]
  data_mode?: 'synthetic-demo' | 'market-provider'
}

export type MarketSession =
  | 'morning' | 'afternoon' | 'lunch_break'
  | 'pre_open' | 'closed' | 'weekend'

export type MarketStatus = {
  is_open: boolean
  session: MarketSession
  server_time: string
  weekday: number
}

export type TopMoversResponse = {
  updated_at: string
  gainers: MarketMover[]
  losers: MarketMover[]
}

export type MarketBreadth = {
  updated_at?: string
  advancers: number
  decliners: number
  unchanged: number
  sentiment: string
  status: string
}

export type SectorItem = {
  name: string
  percent_change: number | null
  stocks: number
}

export type SectorPerformanceResponse = {
  updated_at: string
  leading: SectorItem[]
  weak: SectorItem[]
}

export type MostActiveResponse = {
  updated_at: string
  stocks: MarketMover[]
}

export type MarketCommentaryResponse = {
  updated_at: string
  headline?: string
  summary: string
  key_drivers: string[]
  bullish_factors: string[]
  risk_factors: string[]
  watch_next: string[]
  breadth: MarketBreadth
  leading_sectors: SectorItem[]
  weak_sectors: SectorItem[]
  top_gainers: MarketMover[]
  top_losers: MarketMover[]
  method?: string
}

export type NewsItem = {
  id: string
  headline: string
  source: string
  time: string
  insight: string
  marketImpact: string
  affectedTickers: string[]
  url?: string
  category?: string | null
  sentimentScore?: number
  sentimentMethod?: string
  reactions?: NewsReaction[]
}

export type EventWindow = {
  status: 'measured' | 'pending' | 'insufficient_data' | 'overlapping_event'
  endDate: string | null
  returnPct: number | null
  benchmarkReturnPct: number | null
  abnormalReturnPct: number | null
  reason: string | null
}

export type NewsReaction = {
  symbol: string
  status: 'measured' | 'pending' | 'insufficient_data' | 'overlapping_event'
  methodVersion: string | null
  benchmarkSymbol: string
  dataMode: 'synthetic-demo' | 'market-provider' | null
  priceSource: string | null
  benchmarkSource: string | null
  eventTradeDate?: string | null
  asOf: string | null
  t1: EventWindow
  t5: EventWindow
}

export type NewsIntelligenceResponse = {
  updated_at: string
  items: NewsItem[]
  total?: number
  limit?: number
  offset?: number
  source?: string | null
  data_mode?: DataMode | null
  as_of?: string | null
  status?: 'disabled' | 'available' | 'no_data'
}

export type AIExplainRequest = {
  type: 'index' | 'sector' | 'stock' | 'market' | 'breadth' | 'sentiment' | 'sectors' | 'movers' | 'news'
  title: string
  symbol?: string
  sector?: string
  context?: string
  snapshot?: Record<string, string | number | boolean | null | undefined>
}

export type AIExplainResponse = {
  summary: string
  key_drivers: string[]
  bullish_factors: string[]
  risk_factors: string[]
  watch_next: string[]
  technical_snapshot?: {
    trend?: string
    last_price?: number
    daily_change_pct?: number
    rsi14?: number
    ma20?: number
    ma50?: number
    ret_5d_pct?: number
    ret_20d_pct?: number
  }
  fundamental_snapshot?: {
    sector?: string
    read?: string
  }
}

export type StockProfile = {
  symbol: string
  company_name: string | null
  sector: string | null
  week52_high: number | null
  week52_low: number | null
  exchange?: string | null
  industry?: string | null
  description?: string | null
  employees?: number | null
  website?: string | null
  market_cap?: number | null
  pe?: number | null
  pb?: number | null
  eps?: number | null
  dividend_yield?: number | null
  avg_volume?: number | null
  fundamental_as_of?: string | null
  fundamental_source?: string | null
  as_of?: string | null
  source?: string | null
  data_mode?: DataMode | null
}

export type ScreenerStock = {
  symbol: string
  name?: string | null
  exchange: string
  sector: string
  current_price: number | null
  reference_price?: number | null
  price_change: number | null
  percent_change: number | null
  volume: number | null
  trading_value?: number | null
  market_cap?: number | null
  pe?: number | null
  pb?: number | null
  eps?: number | null
  dividend_yield?: number | null
  fundamental_as_of?: string | null
  fundamental_source?: string | null
  as_of?: string | null
  source?: string | null
}

export type ScreenerResponse = {
  updated_at: string
  count: number
  stocks: ScreenerStock[]
  data_mode?: 'synthetic-demo' | 'market-provider'
  source?: string
  limit?: number
  offset?: number
}

export type DataSourcesResponse = {
  ai_enabled?: boolean
  market: {
    indices: string
    quote: string
    top_movers: string
    breadth: string
    sectors: string
    most_active: string
    search: string
  }
  history: string
  news: string
  ai: {
    commentary: string
    chat: string
  }
  fallbacks: string[]
}

// ============================================================
// HTTP helpers
// ============================================================

async function get<T>(path: string, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(path, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `${res.status} ${res.statusText}`)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

// ============================================================
// Market endpoints
// ============================================================

export const getMarketIndices = async (): Promise<MarketIndicesResponse> => {
  const response = await get<{ items: Array<{ symbol: string; exchange: string | null; price: number; change: number | null; percentChange: number | null; volume: number | null; asOf: string; source?: string; dataMode?: 'synthetic-demo' | 'market-provider' }>; asOf: string | null; source?: string; dataMode?: 'synthetic-demo' | 'market-provider' }>('/api/v1/market/indices')
  return {
    timestamp: response.asOf ?? '',
    indices: response.items.map((item) => ({
      symbol: item.symbol,
      exchange: item.exchange ?? '',
      points: item.price,
      change: item.change,
      percent_change: item.percentChange,
      volume: item.volume,
      updated_at: item.asOf,
      data_mode: item.dataMode ?? response.dataMode,
      source: item.source ?? response.source,
    })),
    data_mode: response.dataMode,
  }
}
export const getMarketStatus = () => get<MarketStatus>('/api/v1/market/status')
export const getTopMovers = async (): Promise<TopMoversResponse> => {
  const [gainers, losers] = await Promise.all([
    get<{ items: Array<{ symbol: string; exchange: string | null; price: number | null; change: number | null; percentChange: number | null; volume: number | null }>; asOf: string | null }>('/api/v1/market/movers?type=gainers&limit=10'),
    get<{ items: Array<{ symbol: string; exchange: string | null; price: number | null; change: number | null; percentChange: number | null; volume: number | null }>; asOf: string | null }>('/api/v1/market/movers?type=losers&limit=10'),
  ])
  const mapMovers = (items: typeof gainers.items): MarketMover[] => items.map((item) => ({
    symbol: item.symbol, exchange: item.exchange ?? '', current_price: item.price,
    price_change: item.change, percent_change: item.percentChange, volume: item.volume,
  }))
  return { updated_at: gainers.asOf ?? losers.asOf ?? '', gainers: mapMovers(gainers.items), losers: mapMovers(losers.items) }
}
export const getMarketBreadth = async (): Promise<MarketBreadth> => {
  const response = await get<{ advancing: number; declining: number; unchanged: number; asOf: string | null }>('/api/v1/market/breadth')
  return { advancers: response.advancing, decliners: response.declining, unchanged: response.unchanged,
    sentiment: response.advancing >= response.declining ? 'RISK-ON' : 'RISK-OFF',
    status: 'Số mã đã đồng bộ', updated_at: response.asOf ?? '' }
}
export const getSectorPerformance = async (): Promise<SectorPerformanceResponse> => {
  const response = await get<{ items: Array<{ sector: string; percentChange: number | null; stockCount: number }>; asOf: string | null }>('/api/v1/market/sectors')
  const items = response.items.map((item) => ({ name: item.sector, percent_change: item.percentChange, stocks: item.stockCount }))
  return { updated_at: response.asOf ?? '', leading: items.slice(0, 6), weak: [...items].reverse().slice(0, 6) }
}
export const getMostActive = async (): Promise<MostActiveResponse> => {
  const response = await get<{ items: Array<{ symbol: string; exchange: string | null; price: number; change: number | null; percentChange: number | null; volume: number | null }>; asOf: string | null }>('/api/v1/market/active?limit=10')
  return {
    updated_at: response.asOf ?? '',
    stocks: response.items.map((item) => ({ symbol: item.symbol, exchange: item.exchange ?? '', current_price: item.price,
      price_change: item.change, percent_change: item.percentChange, volume: item.volume })),
  }
}
export const getMarketCommentary = async (): Promise<MarketCommentaryResponse> => {
  const response = await get<{
    headline: string; summary: string; keyDrivers: string[]; bullishFactors: string[]; riskFactors: string[];
    watchNext: string[]; breadth: { advancing: number; declining: number; unchanged: number };
    leadingSectors: Array<{ sector: string; percentChange: number | null; stockCount: number }>;
    weakSectors: Array<{ sector: string; percentChange: number | null; stockCount: number }>;
    topGainers: Array<{ symbol: string; exchange: string | null; price: number; change: number | null; percentChange: number | null; volume: number | null }>;
    topLosers: Array<{ symbol: string; exchange: string | null; price: number; change: number | null; percentChange: number | null; volume: number | null }>;
    asOf: string | null; method: string
  }>('/api/v1/market/commentary')
  const movers = (items: typeof response.topGainers): MarketMover[] => items.map((item) => ({
    symbol: item.symbol, exchange: item.exchange ?? '', current_price: item.price,
    price_change: item.change, percent_change: item.percentChange, volume: item.volume,
  }))
  const sectors = (items: typeof response.leadingSectors): SectorItem[] => items.map((item) => ({
    name: item.sector, percent_change: item.percentChange, stocks: item.stockCount,
  }))
  return {
    updated_at: response.asOf ?? '', headline: response.headline, summary: response.summary,
    key_drivers: response.keyDrivers, bullish_factors: response.bullishFactors,
    risk_factors: response.riskFactors, watch_next: response.watchNext,
    breadth: { advancers: response.breadth.advancing, decliners: response.breadth.declining,
      unchanged: response.breadth.unchanged, sentiment: response.breadth.advancing >= response.breadth.declining ? 'RISK-ON' : 'RISK-OFF', status: 'Số mã đã đồng bộ' },
    leading_sectors: sectors(response.leadingSectors), weak_sectors: sectors(response.weakSectors),
    top_gainers: movers(response.topGainers), top_losers: movers(response.topLosers), method: response.method,
  }
}
export const getScreenerData = async (options: ScreenerOptions = {}): Promise<ScreenerResponse> => {
  const params = new URLSearchParams()
  const query = options.q?.trim()
  if (query) params.set('q', query)
  if (options.exchange) params.set('exchange', options.exchange)
  if (options.sector) params.set('sector', options.sector)
  params.set('sort', options.sort ?? 'gainers')
  params.set('limit', String(Math.min(200, Math.max(1, options.limit ?? 200))))
  params.set('offset', String(Math.max(0, options.offset ?? 0)))
  const response = await get<{
    items: Array<{ symbol: string; name: string | null; exchange: string | null; sector: string | null; price: number | null; change: number | null; percentChange: number | null; volume: number | null; tradingValue: number | null; marketCap: number | null; pe: number | null; pb: number | null; eps: number | null; dividendYield: number | null; fundamentalAsOf: string | null; fundamentalSource: string | null; asOf: string | null; source: string | null }>
    total: number
    asOf: string | null
    dataMode?: 'synthetic-demo' | 'market-provider'
    source?: string
    limit: number
    offset: number
  }>(`/api/v1/stocks?${params.toString()}`)
  return {
    updated_at: response.asOf ?? '',
    count: response.total,
    data_mode: response.dataMode,
    source: response.source,
    limit: response.limit,
    offset: response.offset,
    stocks: response.items.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      exchange: item.exchange ?? '',
      sector: item.sector ?? '',
      current_price: item.price,
      price_change: item.change,
      percent_change: item.percentChange,
      volume: item.volume,
      trading_value: item.tradingValue,
      market_cap: item.marketCap,
      pe: item.pe,
      pb: item.pb,
      eps: item.eps,
      dividend_yield: item.dividendYield,
      as_of: item.asOf ?? undefined,
      source: item.source ?? undefined,
      fundamental_as_of: item.fundamentalAsOf ?? undefined,
      fundamental_source: item.fundamentalSource ?? undefined,
    })),
  }
}

export type MarketBoardResponse = {
  stocks: ScreenerStock[]
  count: number
  data_mode: 'synthetic-demo' | 'market-provider'
  source: string
  snapshot_at: string | null
  quote_source: string | null
  status: 'current' | 'stale' | 'no_data'
}

export const getMarketBoard = async (): Promise<MarketBoardResponse> => {
  const response = await get<{
    items: Array<{ symbol: string; name: string | null; exchange: string | null; sector: string | null;
      price: number | null; referencePrice?: number | null; change: number | null;
      percentChange: number | null; volume?: number | null }>
    total: number
    dataMode: 'synthetic-demo' | 'market-provider'
    source: string
    quoteSource: string | null
    snapshotAt: string | null
    status: 'current' | 'stale' | 'no_data'
  }>('/api/v1/market/board')
  return {
    count: response.total, data_mode: response.dataMode, source: response.source,
    snapshot_at: response.snapshotAt, quote_source: response.quoteSource, status: response.status,
    stocks: response.items.map((item) => ({
      symbol: item.symbol, name: item.name, exchange: item.exchange ?? '', sector: item.sector ?? '',
      current_price: item.price, reference_price: item.referencePrice ?? null,
      price_change: item.change, percent_change: item.percentChange,
      volume: item.volume ?? null,
    })),
  }
}

// ============================================================
// Stock endpoints
// ============================================================

export const getQuote = async (symbol: string): Promise<Quote> => {
  const data = await get<{ symbol: string; exchange: string | null; price: number | null; change: number | null;
    percentChange: number | null; volume: number | null; asOf: string | null; source: string | null; dataMode?: 'synthetic-demo' | 'market-provider' }>(`/api/v1/stocks/${encodeURIComponent(symbol.toUpperCase())}`)
  return { symbol: data.symbol, exchange: data.exchange ?? '', current_price: data.price,
    price_change: data.change, percent_change: data.percentChange, volume: data.volume,
    updated_at: data.asOf ?? '', data_mode: data.dataMode, source: data.source }
}

export const getStockHistory = async (symbol: string, days = 180): Promise<StockHistoryResponse> => {
  const data = await get<{ symbol: string; items: OHLCVCandle[]; asOf: string | null; source?: string | null; dataMode?: DataMode | null }>(
    `/api/v1/stocks/${encodeURIComponent(symbol.toUpperCase())}/history?limit=${Math.max(1, Math.min(days, 2500))}`,
  )
  return { symbol: data.symbol, days, candles: data.items, updated_at: data.asOf ?? '',
    source: data.source, data_mode: data.dataMode }
}

export const getIndexHistory = async (symbol: string, days = 180): Promise<IndexHistoryResponse> => {
  const data = await get<{ symbol: string; items: OHLCVCandle[]; asOf: string | null; source?: string | null; dataMode?: DataMode | null }>(
    `/api/v1/market/indices/${encodeURIComponent(symbol.toUpperCase())}/history?limit=${Math.max(1, Math.min(days, 2500))}`,
  )
  return { symbol: data.symbol, days, candles: data.items, updated_at: data.asOf ?? '',
    source: data.source, data_mode: data.dataMode }
}

export const getStockIndicators = async (symbol: string): Promise<StockIndicators> =>
  get<StockIndicators>(`/api/v1/stocks/${encodeURIComponent(symbol.toUpperCase())}/indicators`)

export const getStockProfile = async (symbol: string): Promise<StockProfile> => {
  const data = await get<{ symbol: string; name: string | null; sector: string | null; exchange: string | null; industry: string | null; description: string | null; employees: number | null; website: string | null; yearHigh: number | null; yearLow: number | null; marketCap: number | null; pe: number | null; pb: number | null; eps: number | null; dividendYield: number | null; fundamentalAsOf: string | null; fundamentalSource: string | null; avgVolume: number | null; asOf: string | null; source: string | null; dataMode: DataMode | null }>(
    `/api/v1/stocks/${encodeURIComponent(symbol.toUpperCase())}`,
  )
  return { symbol: data.symbol, company_name: data.name, sector: data.sector,
    week52_high: data.yearHigh, week52_low: data.yearLow, exchange: data.exchange,
    industry: data.industry, description: data.description, employees: data.employees,
    website: data.website, market_cap: data.marketCap, pe: data.pe, pb: data.pb, eps: data.eps,
    dividend_yield: data.dividendYield, avg_volume: data.avgVolume, as_of: data.asOf,
    source: data.source, data_mode: data.dataMode, fundamental_as_of: data.fundamentalAsOf,
    fundamental_source: data.fundamentalSource }
}

export const searchStocks = async (query: string): Promise<SearchResponse> => {
  const response = await get<{ items: SearchResult[] }>(`/api/v1/search?q=${encodeURIComponent(query)}`)
  return { results: response.items }
}

// ============================================================
// News endpoints
// ============================================================

export const getNewsIntelligence = async (options: NewsQuery = {}): Promise<NewsIntelligenceResponse> => {
  const params = new URLSearchParams()
  if (options.q?.trim()) params.set('q', options.q.trim())
  if (options.category) params.set('category', options.category)
  if (options.sentiment) params.set('sentiment', options.sentiment)
  if (options.symbol) params.set('symbol', options.symbol.toUpperCase())
  params.set('limit', String(Math.min(200, Math.max(1, options.limit ?? 50))))
  params.set('offset', String(Math.max(0, options.offset ?? 0)))
  const response = await get<{ items: Array<{ id: string; headline: string; summary: string | null; source: string; timestamp: string; sentiment: string; sentimentScore: number; sentimentMethod: string; category: string | null; relatedSymbols: string[]; reactions: NewsReaction[]; url: string }>; total: number; limit: number; offset: number; source: string | null; dataMode: DataMode | null; asOf: string | null; status: 'disabled' | 'available' | 'no_data' }>(`/api/v1/news?${params.toString()}`)
  const impact: Record<string, string> = { positive: 'Tích cực', negative: 'Tiêu cực', neutral: 'Trung lập' }
  return {
    updated_at: response.asOf ?? response.items[0]?.timestamp ?? '',
    as_of: response.asOf,
    total: response.total,
    limit: response.limit,
    offset: response.offset,
    source: response.source,
    data_mode: response.dataMode,
    status: response.status,
    items: response.items.map((item) => ({ id: item.id, headline: item.headline, source: item.source,
      time: item.timestamp, insight: item.summary ?? '', marketImpact: impact[item.sentiment] ?? 'Theo dõi',
      affectedTickers: item.relatedSymbols, url: item.url, category: item.category,
      sentimentScore: item.sentimentScore, sentimentMethod: item.sentimentMethod, reactions: item.reactions })),
  }
}
export const getDataSources = () => get<DataSourcesResponse>('/api/v1/meta')
export const getMarketDataStatus = () => get<MarketDataStatus>('/api/v1/market/data-status')

// ============================================================
// AI endpoints
// ============================================================

export const explainItem = (request: AIExplainRequest) =>
  post<AIExplainResponse>('/api/v1/ai/explain', request)

export const chatWithAI = (question: string, contextData?: Record<string, unknown>) =>
  post<{ response: string }>('/api/v1/ai/chat', {
    question,
    context_type: contextData?.type,
    context_title: contextData?.title,
    context_data: contextData?.data,
  })
