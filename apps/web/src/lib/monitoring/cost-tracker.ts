/**
 * Azure Cost Tracking and Optimization
 * Monitors spending and auto-scales to control costs
 */

import { EventEmitter } from 'events';

export interface CostMetrics {
  database: number;
  compute: number;
  storage: number;
  bandwidth: number;
  total: number;
  projected: number;
  budget: number;
}

export interface UsageMetrics {
  apiCalls: number;
  dbQueries: number;
  storageGB: number;
  bandwidthGB: number;
  computeHours: number;
}

/**
 * Real-time cost tracking and optimization
 */
export class CostTracker extends EventEmitter {
  private dailyBudget: number;
  private monthlyBudget: number;
  private currentSpend: number = 0;
  private usage: UsageMetrics = {
    apiCalls: 0,
    dbQueries: 0,
    storageGB: 0,
    bandwidthGB: 0,
    computeHours: 0,
  };
  
  // Azure pricing (rough estimates)
  private readonly PRICING = {
    API_CALL: 0.000001,        // $1 per million
    DB_QUERY: 0.0000025,       // $2.50 per million
    STORAGE_GB_MONTH: 0.10,    // $0.10 per GB/month
    BANDWIDTH_GB: 0.087,       // $0.087 per GB
    COMPUTE_HOUR: 0.10,        // $0.10 per hour (B2 instance)
  };
  
  constructor(monthlyBudget: number = 500) {
    super();
    this.monthlyBudget = monthlyBudget;
    this.dailyBudget = monthlyBudget / 30;
    this.startMonitoring();
  }
  
  /**
   * Start cost monitoring
   */
  private startMonitoring() {
    // Check costs every hour
    setInterval(() => {
      this.checkCosts();
    }, 60 * 60 * 1000);
    
    // Reset daily counters at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    setTimeout(() => {
      this.resetDaily();
      setInterval(() => {
        this.resetDaily();
      }, 24 * 60 * 60 * 1000);
    }, tomorrow.getTime() - now.getTime());
  }
  
  /**
   * Track API call
   */
  trackAPICall() {
    this.usage.apiCalls++;
    this.currentSpend += this.PRICING.API_CALL;
    this.checkThresholds();
  }
  
  /**
   * Track database query
   */
  trackDBQuery(complexity: 'simple' | 'complex' = 'simple') {
    this.usage.dbQueries++;
    const cost = complexity === 'complex' 
      ? this.PRICING.DB_QUERY * 3 
      : this.PRICING.DB_QUERY;
    this.currentSpend += cost;
    this.checkThresholds();
  }
  
  /**
   * Track bandwidth usage
   */
  trackBandwidth(megabytes: number) {
    const gb = megabytes / 1024;
    this.usage.bandwidthGB += gb;
    this.currentSpend += gb * this.PRICING.BANDWIDTH_GB;
    this.checkThresholds();
  }
  
  /**
   * Check cost thresholds and emit warnings
   */
  private checkThresholds() {
    const dailySpendRate = this.currentSpend;
    const projectedMonthly = dailySpendRate * 30;
    
    // 50% budget warning
    if (this.currentSpend > this.dailyBudget * 0.5 && 
        this.currentSpend < this.dailyBudget * 0.6) {
      this.emit('warning', {
        level: 'low',
        message: '50% of daily budget consumed',
        spend: this.currentSpend,
        budget: this.dailyBudget,
      });
    }
    
    // 80% budget warning
    if (this.currentSpend > this.dailyBudget * 0.8 && 
        this.currentSpend < this.dailyBudget * 0.9) {
      this.emit('warning', {
        level: 'medium',
        message: '80% of daily budget consumed',
        spend: this.currentSpend,
        budget: this.dailyBudget,
        recommendations: this.getOptimizationRecommendations(),
      });
    }
    
    // 100% budget critical
    if (this.currentSpend >= this.dailyBudget) {
      this.emit('critical', {
        level: 'high',
        message: 'Daily budget exceeded!',
        spend: this.currentSpend,
        budget: this.dailyBudget,
        actions: this.getCostReductionActions(),
      });
      
      // Auto-apply cost reduction
      this.applyCostReduction();
    }
    
    // Projection warning
    if (projectedMonthly > this.monthlyBudget) {
      this.emit('projection-warning', {
        projected: projectedMonthly,
        budget: this.monthlyBudget,
        overage: projectedMonthly - this.monthlyBudget,
      });
    }
  }
  
  /**
   * Get optimization recommendations
   */
  private getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // High API usage
    if (this.usage.apiCalls > 100000) {
      recommendations.push('Enable aggressive caching to reduce API calls');
      recommendations.push('Batch API requests where possible');
    }
    
    // High DB usage
    if (this.usage.dbQueries > 50000) {
      recommendations.push('Optimize database queries with indexes');
      recommendations.push('Enable query result caching');
      recommendations.push('Use read replicas for read-heavy workloads');
    }
    
    // High bandwidth
    if (this.usage.bandwidthGB > 10) {
      recommendations.push('Enable CDN for static assets');
      recommendations.push('Compress API responses');
      recommendations.push('Optimize image sizes');
    }
    
    return recommendations;
  }
  
  /**
   * Get cost reduction actions
   */
  private getCostReductionActions(): string[] {
    return [
      'Switching to economy mode',
      'Reducing cache TTL',
      'Throttling background jobs',
      'Disabling non-essential features',
      'Scaling down compute resources',
    ];
  }
  
  /**
   * Apply automatic cost reduction
   */
  private applyCostReduction() {
    // Enable economy mode
    process.env.ECONOMY_MODE = 'true';
    
    // Reduce cache TTL
    process.env.CACHE_TTL = '60';
    
    // Disable expensive features
    process.env.DISABLE_ANALYTICS = 'true';
    process.env.DISABLE_REALTIME = 'true';
    
    this.emit('cost-reduction-applied', {
      mode: 'economy',
      features: ['analytics', 'realtime'],
    });
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): CostMetrics {
    const projected = this.currentSpend * 30;
    
    return {
      database: this.usage.dbQueries * this.PRICING.DB_QUERY,
      compute: this.usage.computeHours * this.PRICING.COMPUTE_HOUR,
      storage: this.usage.storageGB * this.PRICING.STORAGE_GB_MONTH,
      bandwidth: this.usage.bandwidthGB * this.PRICING.BANDWIDTH_GB,
      total: this.currentSpend,
      projected,
      budget: this.monthlyBudget,
    };
  }
  
  /**
   * Get usage breakdown
   */
  getUsageBreakdown() {
    return {
      usage: this.usage,
      costs: this.getMetrics(),
      efficiency: {
        cacheHitRate: 0, // Would be calculated from cache stats
        queryOptimization: 0, // Would be calculated from query stats
        compressionRatio: 0, // Would be calculated from bandwidth stats
      },
      recommendations: this.getOptimizationRecommendations(),
    };
  }
  
  /**
   * Reset daily counters
   */
  private resetDaily() {
    const previousSpend = this.currentSpend;
    
    this.emit('daily-reset', {
      date: new Date(),
      spend: previousSpend,
      usage: { ...this.usage },
    });
    
    // Reset counters
    this.currentSpend = 0;
    this.usage = {
      apiCalls: 0,
      dbQueries: 0,
      storageGB: this.usage.storageGB, // Storage persists
      bandwidthGB: 0,
      computeHours: 0,
    };
  }
  
  /**
   * Check current costs from Azure
   */
  private async checkCosts() {
    // In production, this would call Azure Cost Management API
    // For now, we use our tracked metrics
    
    const metrics = this.getMetrics();
    
    if (metrics.projected > this.monthlyBudget * 1.2) {
      this.emit('cost-alert', {
        severity: 'critical',
        message: 'Projected costs exceed budget by 20%',
        metrics,
      });
    }
  }
}

/**
 * Cost optimization middleware for Express/Next.js
 */
export function costTrackingMiddleware(tracker: CostTracker) {
  return (req: any, res: any, next: any) => {
    // Track API call
    tracker.trackAPICall();
    
    // Track response size for bandwidth
    const originalSend = res.send;
    res.send = function(data: any) {
      if (data) {
        const size = Buffer.byteLength(JSON.stringify(data));
        tracker.trackBandwidth(size / 1024 / 1024); // Convert to MB
      }
      return originalSend.call(this, data);
    };
    
    next();
  };
}

/**
 * Database query tracking wrapper
 */
export function trackDatabaseQuery(tracker: CostTracker) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      tracker.trackDBQuery('simple');
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

// Singleton instance
export const costTracker = new CostTracker(
  parseInt(process.env.MONTHLY_BUDGET || '500')
);

// Listen for warnings
costTracker.on('warning', (data) => {
  console.warn('Cost Warning:', data);
});

costTracker.on('critical', (data) => {
  console.error('Cost Critical:', data);
  // Could trigger alerts, scale down, etc.
});

export default costTracker;