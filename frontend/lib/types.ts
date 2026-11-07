// Vietnam Stock Market Data Types
export interface IndexData {
  symbol: string;
  name: string;
  vietnamName: string;
  price: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  volume?: number;
  gradient?: {
    from: string;
    to: string;
  };
}

export interface VietnamStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  percentChange: number;
  volume: number;
  exchange: 'HOSE' | 'HNX' | 'UPCOM';
  marketCap?: number;
  pe?: number;
}

export interface Mover extends VietnamStock {
  rank: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  headlineViet?: string;
  summary: string;
  source: string;
  timestamp: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  category?: 'market' | 'stock' | 'economic' | 'regulatory';
}

export interface SectorPerformance {
  sector: string;
  vietnamName: string;
  change: number;
  percentChange: number;
  leaders: string[];
  color?: string;
}

export interface MarketBreadthData {
  advancing: number;
  declining: number;
  unchanged: number;
  totalVolume: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  percentChange: number;
  exchange: 'HOSE' | 'HNX' | 'UPCOM';
  addedDate: string;
}

export interface StockDetail extends VietnamStock {
  description?: string;
  sector?: string;
  industry?: string;
  employees?: number;
  website?: string;
  yearHigh?: number;
  yearLow?: number;
  avgVolume?: number;
  board?: 'HOSE' | 'HNX' | 'UPCOM';
}
