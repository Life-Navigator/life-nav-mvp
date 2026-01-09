# @life-navigator/market-types

TypeScript types for market data snapshots.

Used by web and mobile apps to consume normalized market data from the market-data service.

## Installation

```bash
# From workspace root
pnpm add @life-navigator/market-types
```

## Usage

### Basic Types

```typescript
import {
  MarketSnapshot,
  SnapshotResponse,
  ConfidenceLevel,
  DataSource,
} from '@life-navigator/market-types';

// Type-safe snapshot consumption
function processSnapshot(snapshot: MarketSnapshot) {
  if (snapshot.equity_vol.confidence === ConfidenceLevel.HIGH) {
    console.log('Equity vol:', snapshot.equity_vol.value);
  }
}
```

### Runtime Validation

```typescript
import { SnapshotResponseSchema } from '@life-navigator/market-types/zod';

// Validate API response
const response = await fetch('/api/market/latest');
const data = await response.json();

const validated = SnapshotResponseSchema.parse(data); // Throws if invalid
```

### Market Context

```typescript
import { MarketContext } from '@life-navigator/market-types';

// Risk engine integration
const marketContext: MarketContext = {
  equity_vol_annual: 0.15,
  bond_vol_annual: 0.06,
  rates_short_term: 0.04,
  rates_long_term: 0.045,
  inflation_yoy: 0.03,
  risk_on_score: 0.7,
  volatility_regime: 'low',
};
```

## Schema Contract

This package mirrors the Python Pydantic schema in `services/market-data/app/domain/schema.py`.

**DO NOT modify** these types without corresponding changes to the Python schema.

## Building

```bash
pnpm run build
```

Output: `dist/index.js` and `dist/index.d.ts`

## License

UNLICENSED - Internal use only
