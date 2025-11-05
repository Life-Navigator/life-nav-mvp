"""
Real-Time Market Data Service
Free market data from Yahoo Finance, Alpha Vantage, and other sources
"""

import yfinance as yf
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass
import aiohttp
import json
from cachetools import TTLCache
import pandas as pd

@dataclass
class MarketQuote:
    symbol: str
    price: float
    change: float
    change_percent: float
    volume: int
    market_cap: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    open_price: Optional[float] = None
    previous_close: Optional[float] = None
    timestamp: datetime = None

@dataclass
class MarketIndex:
    symbol: str
    name: str
    value: float
    change: float
    change_percent: float
    timestamp: datetime

class MarketDataService:
    
    # Major indices to track
    MAJOR_INDICES = {
        '^GSPC': 'S&P 500',
        '^DJI': 'Dow Jones',
        '^IXIC': 'NASDAQ',
        '^RUT': 'Russell 2000',
        '^VIX': 'VIX (Volatility)',
        '^TNX': '10-Year Treasury',
        'GC=F': 'Gold',
        'CL=F': 'Crude Oil',
        'BTC-USD': 'Bitcoin',
        'ETH-USD': 'Ethereum'
    }
    
    # Popular ETFs for retirement accounts
    RETIREMENT_ETFS = {
        'SPY': 'SPDR S&P 500',
        'VOO': 'Vanguard S&P 500',
        'VTI': 'Vanguard Total Market',
        'QQQ': 'Invesco QQQ',
        'IWM': 'iShares Russell 2000',
        'EFA': 'iShares MSCI EAFE',
        'EEM': 'iShares MSCI Emerging',
        'AGG': 'iShares Core US Aggregate Bond',
        'BND': 'Vanguard Total Bond',
        'VNQ': 'Vanguard Real Estate',
        'GLD': 'SPDR Gold',
        'TLT': 'iShares 20+ Year Treasury'
    }
    
    # Target-date retirement funds
    TARGET_DATE_FUNDS = {
        'VTTSX': 'Vanguard 2060',
        'VFIFX': 'Vanguard 2050',
        'VTTVX': 'Vanguard 2045',
        'VFORX': 'Vanguard 2040',
        'VTHRX': 'Vanguard 2035',
        'VTTHX': 'Vanguard 2030',
        'VTWNX': 'Vanguard 2025',
        'VTTVX': 'Vanguard 2020'
    }
    
    def __init__(self):
        # Cache for 60 seconds to avoid rate limits
        self.quote_cache = TTLCache(maxsize=1000, ttl=60)
        self.index_cache = TTLCache(maxsize=50, ttl=60)
        
    async def get_market_indices(self) -> List[MarketIndex]:
        """
        Get real-time quotes for major market indices
        """
        # Check cache first
        cache_key = 'market_indices'
        if cache_key in self.index_cache:
            return self.index_cache[cache_key]
        
        indices = []
        
        for symbol, name in self.MAJOR_INDICES.items():
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                history = ticker.history(period="2d")
                
                if len(history) >= 2:
                    current_price = history['Close'].iloc[-1]
                    previous_close = history['Close'].iloc[-2]
                    change = current_price - previous_close
                    change_percent = (change / previous_close) * 100
                    
                    index = MarketIndex(
                        symbol=symbol,
                        name=name,
                        value=current_price,
                        change=change,
                        change_percent=change_percent,
                        timestamp=datetime.now()
                    )
                    indices.append(index)
            except Exception as e:
                print(f"Error fetching {symbol}: {e}")
                continue
        
        # Cache the results
        self.index_cache[cache_key] = indices
        
        return indices
    
    async def get_quote(self, symbol: str) -> Optional[MarketQuote]:
        """
        Get real-time quote for a single symbol
        """
        # Check cache
        if symbol in self.quote_cache:
            return self.quote_cache[symbol]
        
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            # Get current data
            quote = MarketQuote(
                symbol=symbol,
                price=info.get('currentPrice', info.get('regularMarketPrice', 0)),
                change=info.get('regularMarketChange', 0),
                change_percent=info.get('regularMarketChangePercent', 0),
                volume=info.get('volume', info.get('regularMarketVolume', 0)),
                market_cap=info.get('marketCap'),
                day_high=info.get('dayHigh', info.get('regularMarketDayHigh')),
                day_low=info.get('dayLow', info.get('regularMarketDayLow')),
                open_price=info.get('open', info.get('regularMarketOpen')),
                previous_close=info.get('previousClose', info.get('regularMarketPreviousClose')),
                timestamp=datetime.now()
            )
            
            # Cache the result
            self.quote_cache[symbol] = quote
            
            return quote
            
        except Exception as e:
            print(f"Error fetching quote for {symbol}: {e}")
            return None
    
    async def get_bulk_quotes(self, symbols: List[str]) -> Dict[str, MarketQuote]:
        """
        Get quotes for multiple symbols efficiently
        """
        quotes = {}
        
        # Create tasks for parallel fetching
        tasks = []
        for symbol in symbols:
            tasks.append(self.get_quote(symbol))
        
        # Fetch all quotes in parallel
        results = await asyncio.gather(*tasks)
        
        for symbol, quote in zip(symbols, results):
            if quote:
                quotes[symbol] = quote
        
        return quotes
    
    async def get_portfolio_performance(self, holdings: List[Dict]) -> Dict:
        """
        Calculate portfolio performance metrics
        Holdings format: [{'symbol': 'AAPL', 'shares': 100, 'cost_basis': 15000}, ...]
        """
        total_value = 0
        total_cost = 0
        total_day_change = 0
        holdings_performance = []
        
        # Get quotes for all holdings
        symbols = [h['symbol'] for h in holdings]
        quotes = await self.get_bulk_quotes(symbols)
        
        for holding in holdings:
            symbol = holding['symbol']
            shares = holding['shares']
            cost_basis = holding['cost_basis']
            
            if symbol in quotes:
                quote = quotes[symbol]
                current_value = quote.price * shares
                total_value += current_value
                total_cost += cost_basis
                
                day_change = quote.change * shares
                total_day_change += day_change
                
                holding_return = ((current_value - cost_basis) / cost_basis) * 100 if cost_basis > 0 else 0
                
                holdings_performance.append({
                    'symbol': symbol,
                    'shares': shares,
                    'current_price': quote.price,
                    'current_value': current_value,
                    'cost_basis': cost_basis,
                    'unrealized_gain': current_value - cost_basis,
                    'return_percent': holding_return,
                    'day_change': day_change,
                    'day_change_percent': quote.change_percent
                })
        
        # Calculate portfolio metrics
        total_return = ((total_value - total_cost) / total_cost * 100) if total_cost > 0 else 0
        
        return {
            'total_value': total_value,
            'total_cost': total_cost,
            'total_return': total_return,
            'total_unrealized_gain': total_value - total_cost,
            'day_change': total_day_change,
            'day_change_percent': (total_day_change / (total_value - total_day_change)) * 100 if total_value > total_day_change else 0,
            'holdings': holdings_performance,
            'timestamp': datetime.now()
        }
    
    async def get_retirement_fund_performance(self) -> Dict:
        """
        Get performance of popular retirement funds
        """
        funds_data = {}
        
        # Combine ETFs and target-date funds
        all_funds = {**self.RETIREMENT_ETFS, **self.TARGET_DATE_FUNDS}
        
        for symbol, name in all_funds.items():
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                history = ticker.history(period="1y")
                
                if not history.empty:
                    current_price = history['Close'].iloc[-1]
                    year_ago_price = history['Close'].iloc[0]
                    ytd_return = ((current_price - year_ago_price) / year_ago_price) * 100
                    
                    # Get expense ratio if available
                    expense_ratio = info.get('annualReportExpenseRatio', 0) * 100 if info else 0
                    
                    funds_data[symbol] = {
                        'name': name,
                        'price': current_price,
                        'ytd_return': ytd_return,
                        'expense_ratio': expense_ratio,
                        'category': 'ETF' if symbol in self.RETIREMENT_ETFS else 'Target-Date',
                        'assets': info.get('totalAssets', 0) if info else 0
                    }
            except:
                continue
        
        return funds_data
    
    async def get_market_movers(self) -> Dict:
        """
        Get today's top gainers and losers
        """
        try:
            # Get S&P 500 components (simplified - top movers)
            gainers = yf.Tickers('^GSPC').tickers['^GSPC'].info.get('components', [])[:5]
            losers = gainers  # Would need actual calculation
            
            return {
                'gainers': gainers,
                'losers': losers,
                'most_active': []  # Would need volume data
            }
        except:
            return {'gainers': [], 'losers': [], 'most_active': []}
    
    async def get_economic_indicators(self) -> Dict:
        """
        Get key economic indicators for investment decisions
        """
        indicators = {}
        
        # Treasury yields
        treasury_symbols = {
            '^IRX': '3-Month',
            '^FVX': '5-Year',
            '^TNX': '10-Year',
            '^TYX': '30-Year'
        }
        
        for symbol, name in treasury_symbols.items():
            try:
                ticker = yf.Ticker(symbol)
                history = ticker.history(period="5d")
                if not history.empty:
                    indicators[name] = {
                        'yield': history['Close'].iloc[-1],
                        'change': history['Close'].iloc[-1] - history['Close'].iloc[-2]
                    }
            except:
                continue
        
        # Dollar index
        try:
            dxy = yf.Ticker('DX-Y.NYB')
            history = dxy.history(period="5d")
            if not history.empty:
                indicators['Dollar Index'] = {
                    'value': history['Close'].iloc[-1],
                    'change': history['Close'].iloc[-1] - history['Close'].iloc[-2]
                }
        except:
            pass
        
        return indicators
    
    async def get_sector_performance(self) -> Dict:
        """
        Get performance of major market sectors
        """
        sector_etfs = {
            'XLK': 'Technology',
            'XLF': 'Financials',
            'XLV': 'Healthcare',
            'XLE': 'Energy',
            'XLI': 'Industrials',
            'XLY': 'Consumer Discretionary',
            'XLP': 'Consumer Staples',
            'XLB': 'Materials',
            'XLRE': 'Real Estate',
            'XLU': 'Utilities',
            'XLC': 'Communication Services'
        }
        
        sector_performance = {}
        
        for symbol, sector in sector_etfs.items():
            try:
                ticker = yf.Ticker(symbol)
                history = ticker.history(period="1mo")
                
                if len(history) >= 2:
                    current = history['Close'].iloc[-1]
                    month_ago = history['Close'].iloc[0]
                    change = ((current - month_ago) / month_ago) * 100
                    
                    sector_performance[sector] = {
                        'symbol': symbol,
                        'monthly_return': change,
                        'current_price': current
                    }
            except:
                continue
        
        return sector_performance
    
    def get_market_status(self) -> Dict:
        """
        Check if markets are open
        """
        now = datetime.now()
        weekday = now.weekday()
        current_time = now.time()
        
        # NYSE hours: 9:30 AM - 4:00 PM ET
        market_open = datetime.strptime("09:30", "%H:%M").time()
        market_close = datetime.strptime("16:00", "%H:%M").time()
        
        is_weekday = weekday < 5  # Monday = 0, Friday = 4
        is_market_hours = market_open <= current_time <= market_close
        
        if is_weekday and is_market_hours:
            status = "open"
            message = "Markets are open"
        elif is_weekday and current_time < market_open:
            status = "pre-market"
            message = "Pre-market trading"
        elif is_weekday and current_time > market_close:
            status = "after-hours"
            message = "After-hours trading"
        else:
            status = "closed"
            message = "Markets are closed"
        
        return {
            'status': status,
            'message': message,
            'next_open': self._get_next_market_open(),
            'timestamp': now
        }
    
    def _get_next_market_open(self) -> datetime:
        """Calculate next market open time"""
        now = datetime.now()
        
        # If it's before 9:30 AM on a weekday
        if now.weekday() < 5 and now.time() < datetime.strptime("09:30", "%H:%M").time():
            return now.replace(hour=9, minute=30, second=0, microsecond=0)
        
        # Otherwise, find next weekday
        days_ahead = 1
        while True:
            next_day = now + timedelta(days=days_ahead)
            if next_day.weekday() < 5:  # Monday-Friday
                return next_day.replace(hour=9, minute=30, second=0, microsecond=0)
            days_ahead += 1
            
        return now