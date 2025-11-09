# Analytics Dashboard

Comprehensive analytics dashboard for Life Navigator mobile app with AI-powered insights, interactive charts, and predictive analytics.

## Features

### 1. Overview Section
- **Life Score Circle**: Circular progress chart (0-100) showing overall life score
- **Domain Scores**: 4 domain cards (Health, Finance, Career, Education)
- **Status Indicators**: Color-coded badges (excellent/good/fair/poor)
- **Trend Arrows**: Visual indicators (↑/↓/→) with percentage changes

### 2. Cross-Domain Insights
- AI-powered recommendations across all life domains
- Priority actions with impact scores (visual bar indicators)
- Risk alerts and opportunity identification
- Type categorization (recommendation/risk/opportunity)
- Domain tags showing affected areas
- Actionable status indicators

### 3. Interactive Charts
All charts built with `react-native-chart-kit`:
- **Line Chart**: 30-day trend across all 4 domains with legend
- **Bar Chart**: Weekly goals completion rate by domain
- **Pie Chart**: Time allocation across life areas
- **Progress Visualization**: Goals completion percentage

### 4. Period Comparisons
- Multiple period options: Week/Month/Quarter/Year
- Current vs Previous comparisons
- Percentage change calculations
- Color-coded improvements/declines
- Domain-specific breakdowns

### 5. Predictive Analytics
- 30-day score projections for each domain
- Goal completion probability visualizations
- Risk forecasts with probability percentages
- Opportunity windows identification
- Confidence level indicators
- Interactive domain selection

### 6. Export & Reports
- **PDF Export**: Complete analytics report with all charts
- **CSV Export**: Raw data export for external analysis
- **Share Functionality**: Native sharing integration
- **Scheduled Reports**: Daily/Weekly/Monthly automated reports
- File system integration via Expo

## Tech Stack

- **React Query**: Data fetching and caching
- **react-native-chart-kit**: All chart visualizations
- **Expo File System**: File handling for exports
- **Expo Sharing**: Native share functionality
- **TypeScript**: Full type safety

## API Integration

Endpoint: `/api/v1/analytics/dashboard`

Response structure:
```typescript
{
  lifeScore: { overall, trend, change, lastUpdated },
  domainScores: Array<{ domain, score, trend, change, status }>,
  insights: Array<CrossDomainInsight>,
  trendData: Array<TrendDataPoint>,
  timeAllocation: Array<TimeAllocation>,
  goalCompletion: Array<GoalCompletion>,
  comparisons: Array<DomainComparison>,
  predictions: Array<PredictiveAnalytics>
}
```

## Components

### Core Components
1. `LifeScoreCircle` - Circular progress indicator
2. `DomainScoresCard` - 4-grid domain scores display
3. `CrossDomainInsights` - AI recommendations list
4. `TrendCharts` - All chart visualizations
5. `PeriodComparisons` - Time period comparisons
6. `PredictiveAnalytics` - Future predictions
7. `ExportReports` - Export and sharing
8. `LoadingSkeleton` - Loading state UI

### Main Screen
`AnalyticsDashboardScreen` - Orchestrates all components with:
- Pull-to-refresh functionality
- Section collapse/expand
- Loading states
- Error handling
- Empty states

## Features

### UX Enhancements
- **Pull-to-Refresh**: Native refresh control
- **Collapsible Sections**: Tap headers to expand/collapse
- **Loading Skeletons**: Animated shimmer effects
- **Error States**: User-friendly error messages with retry
- **Empty States**: Helpful messaging when no data
- **Responsive Charts**: Auto-sizing based on screen width

### Dark Mode Support
All components use theme-aware colors from the design system, ready for dark mode implementation.

## Usage

```typescript
import { AnalyticsDashboardScreen } from './screens/analytics';

// In navigation
<Stack.Screen
  name="Analytics"
  component={AnalyticsDashboardScreen}
/>
```

## File Structure

```
apps/mobile/src/
├── screens/analytics/
│   ├── AnalyticsDashboardScreen.tsx
│   ├── index.ts
│   └── README.md
├── components/analytics/
│   ├── LifeScoreCircle.tsx
│   ├── DomainScoresCard.tsx
│   ├── CrossDomainInsights.tsx
│   ├── TrendCharts.tsx
│   ├── PeriodComparisons.tsx
│   ├── PredictiveAnalytics.tsx
│   ├── ExportReports.tsx
│   ├── LoadingSkeleton.tsx
│   └── index.ts
├── types/
│   └── analytics.ts
└── api/
    └── analytics.ts
```

## Performance

- React Query caching (5-minute stale time)
- Optimized re-renders with proper memoization
- Lazy loading of chart components
- Efficient data transformations

## Accessibility

- Semantic color coding
- Clear labels and descriptions
- Touch-friendly button sizes
- Readable font sizes and contrast ratios

## Future Enhancements

- Custom date range selection
- Deep-dive domain analytics
- Comparison with other users (anonymized)
- Goal recommendation engine
- Notification scheduling
- Offline mode with local caching
