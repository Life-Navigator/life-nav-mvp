"""
Market Data API Endpoints
Real-time quotes, indices, and portfolio tracking
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.services.market_data import MarketDataService

router = APIRouter()

@router.get("/indices")
async def get_market_indices(
    current_user: dict = Depends(get_current_user)
):
    """
    Get real-time quotes for major market indices
    Returns S&P 500, Dow, NASDAQ, VIX, Treasury yields, Gold, Oil, Bitcoin
    """
    market_service = MarketDataService()
    indices = await market_service.get_market_indices()
    
    return {
        "indices": [
            {
                "symbol": idx.symbol,
                "name": idx.name,
                "value": round(idx.value, 2),
                "change": round(idx.change, 2),
                "change_percent": round(idx.change_percent, 2),
                "timestamp": idx.timestamp.isoformat()
            }
            for idx in indices
        ],
        "market_status": market_service.get_market_status()
    }

@router.get("/quote/{symbol}")
async def get_quote(
    symbol: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get real-time quote for a single stock/ETF
    """
    market_service = MarketDataService()
    quote = await market_service.get_quote(symbol.upper())
    
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quote not found for symbol: {symbol}"
        )
    
    return {
        "symbol": quote.symbol,
        "price": quote.price,
        "change": quote.change,
        "change_percent": quote.change_percent,
        "volume": quote.volume,
        "market_cap": quote.market_cap,
        "day_range": {
            "high": quote.day_high,
            "low": quote.day_low
        },
        "open": quote.open_price,
        "previous_close": quote.previous_close,
        "timestamp": quote.timestamp.isoformat()
    }

@router.post("/quotes/bulk")
async def get_bulk_quotes(
    symbols: List[str],
    current_user: dict = Depends(get_current_user)
):
    """
    Get quotes for multiple symbols at once
    """
    if len(symbols) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 50 symbols allowed per request"
        )
    
    market_service = MarketDataService()
    quotes = await market_service.get_bulk_quotes([s.upper() for s in symbols])
    
    return {
        "quotes": {
            symbol: {
                "price": quote.price,
                "change": quote.change,
                "change_percent": quote.change_percent,
                "volume": quote.volume
            }
            for symbol, quote in quotes.items()
        }
    }

@router.post("/portfolio/performance")
async def calculate_portfolio_performance(
    holdings: List[dict],
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate real-time portfolio performance
    Input: [{"symbol": "AAPL", "shares": 100, "cost_basis": 15000}, ...]
    """
    market_service = MarketDataService()
    performance = await market_service.get_portfolio_performance(holdings)
    
    return performance

@router.get("/retirement-funds")
async def get_retirement_funds(
    category: Optional[str] = Query(None, description="Filter by category: etf, target-date"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get performance data for popular retirement funds
    """
    market_service = MarketDataService()
    funds = await market_service.get_retirement_fund_performance()
    
    # Filter by category if specified
    if category:
        funds = {
            symbol: data
            for symbol, data in funds.items()
            if data['category'].lower() == category.lower()
        }
    
    # Sort by YTD return
    sorted_funds = sorted(
        funds.items(),
        key=lambda x: x[1].get('ytd_return', 0),
        reverse=True
    )
    
    return {
        "funds": [
            {
                "symbol": symbol,
                **data
            }
            for symbol, data in sorted_funds
        ]
    }

@router.get("/sectors")
async def get_sector_performance(
    current_user: dict = Depends(get_current_user)
):
    """
    Get performance of major market sectors
    """
    market_service = MarketDataService()
    sectors = await market_service.get_sector_performance()
    
    # Sort by performance
    sorted_sectors = sorted(
        sectors.items(),
        key=lambda x: x[1].get('monthly_return', 0),
        reverse=True
    )
    
    return {
        "sectors": [
            {
                "name": sector,
                "etf": data['symbol'],
                "monthly_return": round(data['monthly_return'], 2),
                "current_price": round(data['current_price'], 2)
            }
            for sector, data in sorted_sectors
        ]
    }

@router.get("/economic-indicators")
async def get_economic_indicators(
    current_user: dict = Depends(get_current_user)
):
    """
    Get key economic indicators (Treasury yields, Dollar index)
    """
    market_service = MarketDataService()
    indicators = await market_service.get_economic_indicators()
    
    return {
        "indicators": indicators,
        "timestamp": datetime.now().isoformat()
    }

@router.get("/market-movers")
async def get_market_movers(
    current_user: dict = Depends(get_current_user)
):
    """
    Get today's top gainers and losers
    """
    market_service = MarketDataService()
    movers = await market_service.get_market_movers()
    
    return movers

@router.get("/watchlist/suggestions")
async def get_watchlist_suggestions(
    risk_level: str = Query("moderate", description="conservative, moderate, aggressive"),
    investment_amount: Optional[float] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get personalized stock/ETF suggestions based on risk profile
    """
    suggestions = {
        "conservative": {
            "etfs": ["AGG", "BND", "TLT", "VCSH", "VTEB"],
            "stocks": ["JNJ", "PG", "KO", "PEP", "VZ"],
            "description": "Focus on bonds and dividend aristocrats"
        },
        "moderate": {
            "etfs": ["SPY", "VOO", "VTI", "VIG", "VYM"],
            "stocks": ["AAPL", "MSFT", "JPM", "UNH", "HD"],
            "description": "Balanced mix of growth and value"
        },
        "aggressive": {
            "etfs": ["QQQ", "ARKK", "ICLN", "SOXX", "XBI"],
            "stocks": ["NVDA", "TSLA", "AMD", "SQ", "ROKU"],
            "description": "Growth stocks and thematic ETFs"
        }
    }
    
    profile = suggestions.get(risk_level, suggestions["moderate"])
    
    # Get current prices
    market_service = MarketDataService()
    all_symbols = profile["etfs"] + profile["stocks"]
    quotes = await market_service.get_bulk_quotes(all_symbols)
    
    # Add affordability filter if amount specified
    if investment_amount:
        affordable = {
            symbol: quote
            for symbol, quote in quotes.items()
            if quote.price <= investment_amount
        }
    else:
        affordable = quotes
    
    return {
        "risk_level": risk_level,
        "description": profile["description"],
        "suggestions": {
            "etfs": [
                {
                    "symbol": symbol,
                    "price": quotes[symbol].price if symbol in quotes else None,
                    "change_percent": quotes[symbol].change_percent if symbol in quotes else None
                }
                for symbol in profile["etfs"]
                if symbol in affordable or investment_amount is None
            ],
            "stocks": [
                {
                    "symbol": symbol,
                    "price": quotes[symbol].price if symbol in quotes else None,
                    "change_percent": quotes[symbol].change_percent if symbol in quotes else None
                }
                for symbol in profile["stocks"]
                if symbol in affordable or investment_amount is None
            ]
        }
    }

# Import datetime for timestamp
from datetime import datetime