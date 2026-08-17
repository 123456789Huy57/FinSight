# FinSight AI - Premium Vietnam Stock Market Intelligence Dashboard

A sophisticated, institutional-grade financial intelligence platform for Vietnam's stock markets with AI-powered insights. Built with Next.js 16, TypeScript, and Tailwind CSS featuring a premium dark theme with frosted-glass aesthetics and deep navy color palette.

## ✨ Features Overview

### 🏠 Dashboard - Market Analysis Hub
Complete market overview with 9 integrated panels:

- **Sticky Navbar**: Navigation across 4 main pages with search functionality
- **Ticker Bar**: Real-time scrolling ticker showing major indices (VN-Index, HNX-Index, etc.)
- **Index Cards (4-Column)**: VN-Index, HNX-Index, Upcom, VN30 with gradient styling
- **Top Gainers Panel**: Best performing stocks with prices and percentages
- **Top Losers Panel**: Worst performing stocks with visual indicators
- **Market Breadth**: Advancing/declining/unchanged stock ratios with progress bars
- **Sector Performance**: Industry-level analysis with color-coded indicators
- **Market News**: Sentiment-classified news feed with timestamps
- **Watchlist**: Personal stock tracking with exchange badges

### 📊 Market Screener Page (/market)
Advanced stock filtering and analysis:

- **Search & Filter**: Find stocks by symbol or company name
- **Sort Options**: By gainers, losers, or trading volume
- **Data Table**: All stocks with symbol, name, exchange, price, change, volume, P/E, P/B
- **Exchange Badges**: Visual identification (HOSE, HNX, UPCOM)
- **Statistics**: Live counts of advancing/declining stocks and average changes
- **Performance**: Filter results with real-time statistics

### 📈 Stock Detail Page (/stock)
Comprehensive single-stock analysis:

- **Company Header**: Symbol, exchange badge, current price with change indicator
- **Quick Stats**: Volume, strength assessment, risk level, rating, trend direction
- **Financial Metrics**: Market cap, P/E, P/B, EPS, dividend yield, 52-week highs/lows
- **Price History**: 5-year, 1-year, quarterly, monthly, and weekly performance tracking
- **Company Info**: Description, sector, industry, employee count, website
- **Recent News**: Company-specific news feed with sentiment badges

### 📰 News Intelligence Page (/news)
Market news aggregation and sentiment analysis:

- **Real-time News Feed**: 8+ pre-configured news articles with images
- **Sentiment Analysis**: Color-coded positive, neutral, negative indicators
- **Category Filtering**: Market, Stock, Economic, Regulatory classifications
- **Advanced Search**: Find news by headline, keyword, or related stock symbols
- **Source Attribution**: Credible sources with timestamps
- **Related Stocks**: Quick links to mentioned company symbols

## 🎨 Premium Design System

### Color Palette
```
Background:    #070d1a (Deep Navy)
Cards:         #0e1726 (Darker Navy)
Primary:       #6387ff (Electric Blue)
Accent:        #6387ff (Matching Blue)
Borders:       rgba(99, 135, 255, 0.12) (Blue Glow)
Text:          #e0e6f5 (Premium Light)
Success:       #10b981 (Emerald)
Warning:       #ff3333 (Crimson)
```

### Component Styling
- **Frosted Glass**: Cards with subtle blue-glow borders
- **Gradient Index Cards**: Unique gradients for each index
- **Hover Effects**: Smooth transitions and shadow elevation
- **Rounded Corners**: Consistent 11px (0.625rem) border-radius
- **Typography**: Premium spacing and hierarchy with Geist fonts

## 📁 Project Structure

```
app/
├── page.tsx                  # Home (Dashboard)
├── market/page.tsx          # Market Screener
├── stock/page.tsx           # Stock Detail (default: VCB)
├── news/page.tsx            # News Intelligence
├── layout.tsx               # Root layout with dark theme
└── globals.css              # Design tokens & Tailwind config

components/
├── Navbar.tsx               # Main navigation (4 pages + search)
├── TickerBar.tsx            # Scrolling ticker with indices
├── Badge.tsx                # Sentiment & status badges
├── PriceChange.tsx          # Price change with gain/loss colors
└── ExchangeBadge.tsx        # HOSE/HNX/UPCOM indicators

lib/
└── types.ts                 # Full TypeScript interface definitions
```

## 🇻🇳 Vietnam Market Integration

### Stock Exchanges
- **HOSE** - Sở Giao Dịch Chứng Chỉ Thành phố Hồ Chí Minh (Primary)
- **HNX** - Sàn Giao Dịch Chứng Chỉ Hà Nội (Secondary)
- **UPCOM** - Sàn Giao Dịch Chứng Chỉ Nasdac (Unlisted)

### Key Indices
- **VN-Index**: Primary market index
- **HNX-Index**: Secondary market index
- **Upcom-Index**: Unlisted company index
- **VN30**: Top 30 largest stocks

### Included Stocks
- **Banking**: VCB, ACB, MBB, BID, TCH
- **Technology**: FPT, CMG, SSI
- **Real Estate**: VRE, DXG, KDC
- **Energy**: PVD, POW, GAS
- **Trading**: HPG, SAB

### Vietnamese Labels
Complete Vietnamese language support:
- "Phân tích thị trường" (Market Analysis)
- "Cổ phiếu tăng mạnh" (Top Gainers)
- "Cổ phiếu giảm mạnh" (Top Losers)
- "Ngành" (Sectors)
- And more throughout the application

## 📊 Data Types

```typescript
// Vietnam stock with exchange info
interface VietnamStock {
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

// Index with gradient styling
interface IndexData {
  symbol: string;
  vietnamName: string;
  price: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  gradient?: { from: string; to: string };
}

// News with sentiment analysis
interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  timestamp: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  category?: 'market' | 'stock' | 'economic' | 'regulatory';
}
```

## 🚀 Getting Started

### Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

Dashboard available at `http://localhost:3000`

### Navigation

- **Home** (`/`) - Main dashboard with market overview
- **Chứng chỉ** (`/market`) - Stock screener with filtering
- **Chi tiết** (`/stock`) - Individual stock analysis (default: VCB)
- **Tin tức** (`/news`) - Market news and intelligence

## 🔌 API Integration Ready

All components use TypeScript-typed mock data matching real API response structures. Ready for connection to:

- Vietnam stock market APIs (SSI, VietStock, etc.)
- Real-time data providers
- News aggregation services
- Chart data providers

Replace mock data in page components without changing component code.

## 🎯 Component Usage

### Price Change Display
```tsx
<PriceChange 
  change={250} 
  percentChange={0.28} 
  showPercent={true}
  size="md"
/>
```

### Exchange Badge
```tsx
<ExchangeBadge exchange="HOSE" />
```

### Sentiment Badge
```tsx
<Badge variant="gain">Tích cực</Badge>
<Badge variant="loss">Tiêu cực</Badge>
<Badge variant="neutral">Trung tính</Badge>
```

## 📈 Performance

- **Next.js 16**: Turbopack bundler (stable)
- **Code Splitting**: Automatic per-route
- **Image Optimization**: News images with lazy loading
- **CSS**: Tailwind v4 with purging
- **Fonts**: Geist Sans/Mono pre-configured

## 🌐 Internationalization

Complete Vietnamese language support:
- Navigation labels
- Panel titles
- Data labels
- Time indicators ("2 giờ trước")
- Formatting (Vietnamese number locale)

## ♿ Accessibility

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Color contrast compliance
- Screen reader optimization

## 📱 Responsive Design

- Mobile-first approach
- Tablet and desktop optimized
- Collapsible navigation
- Scrollable tables for mobile
- Touch-friendly interactive elements

## 🔮 Future Enhancements

- [ ] WebSocket real-time data streaming
- [ ] Advanced charting library integration
- [ ] User authentication & personal watchlists
- [ ] Portfolio tracking and analytics
- [ ] Price alerts and notifications
- [ ] Export to CSV/Excel
- [ ] Mobile native app
- [ ] Dark/light theme toggle
- [ ] Multi-language support
- [ ] Backtesting system

## 🛠️ Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS v4 with custom design tokens
- **Icons**: Lucide React
- **Fonts**: Geist Sans & Mono (next/font)
- **State Management**: React hooks (SWR-ready)
- **Package Manager**: pnpm

## 📄 License

MIT - Created for Vietnam stock market analysis

---

**FinSight AI** - Premium intelligence for Vietnam's stock markets 📊
