// ============================================================
// FinSight API Client
// ============================================================

export type MarketIndex = {
  symbol: string
  exchange: string
  points: number
  change: number
  percent_change: number
  volume: number
  updated_at: string
}

export type MarketMover = {
  symbol: string
  exchange: string
  current_price: number
  price_change: number
  percent_change: number
  volume: number
}

export type Quote = {
  symbol: string
  exchange: string
  current_price: number
  price_change: number
  percent_change: number
  volume: number
  updated_at: string
}

export type OHLCVCandle = {
  time: string | null
  open: number | null
  high: number | null
  low: number | null
  close: number
  volume: number | null
}

export type StockHistoryResponse = {
  symbol: string
  days: number
  candles: OHLCVCandle[]
  updated_at: string
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
  percent_change: number
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
}

export type NewsIntelligenceResponse = {
  updated_at: string
  items: NewsItem[]
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
}

export type ScreenerStock = {
  symbol: string
  exchange: string
  sector: string
  current_price: number | null
  price_change: number | null
  percent_change: number | null
  volume: number | null
}

export type ScreenerResponse = {
  updated_at: string
  count: number
  stocks: ScreenerStock[]
}

export type DataSourcesResponse = {
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

export const getMarketIndices = () => get<MarketIndicesResponse>('/api/market/indices')
export const getMarketStatus = () => get<MarketStatus>('/api/market/status')
export const getTopMovers = () => get<TopMoversResponse>('/api/market/top-movers')
export const getMarketBreadth = () => get<MarketBreadth>('/api/market/breadth')
export const getSectorPerformance = () => get<SectorPerformanceResponse>('/api/market/sectors')
export const getMostActive = () => get<MostActiveResponse>('/api/market/most-active')
export const getMarketCommentary = () => get<MarketCommentaryResponse>('/api/market/commentary')
export const getScreenerData = () => get<ScreenerResponse>('/api/market/screener')

// ============================================================
// Stock endpoints
// ============================================================

export const getQuote = (symbol: string) =>
  get<Quote>(`/api/quote/${encodeURIComponent(symbol.toUpperCase())}`)

export const getStockHistory = (symbol: string, days = 180) =>
  get<StockHistoryResponse>(`/api/stock/${encodeURIComponent(symbol.toUpperCase())}/history?days=${days}`)

export const getStockProfile = (symbol: string) =>
  get<StockProfile>(`/api/stock/${encodeURIComponent(symbol.toUpperCase())}/profile`)

export const searchStocks = (query: string) =>
  get<SearchResponse>(`/api/market/search?q=${encodeURIComponent(query)}`)

// ============================================================
// News endpoints
// ============================================================

export const getNewsIntelligence = () => get<NewsIntelligenceResponse>('/api/news/intelligence')
export const getDataSources = () => get<DataSourcesResponse>('/api/meta/data-sources')

// ============================================================
// AI endpoints
// ============================================================

export const explainItem = (request: AIExplainRequest) =>
  post<AIExplainResponse>('/api/ai/explain', request)

export const chatWithAI = (question: string, contextData?: Record<string, unknown>) =>
  post<{ response: string }>('/api/ai/chat', {
    question,
    context_type: contextData?.type,
    context_title: contextData?.title,
    context_data: contextData?.data,
  })
