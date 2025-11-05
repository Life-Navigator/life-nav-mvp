import { AzureFunction, Context } from "@azure/functions"
import { AzurePrismaClient, AzureMonitorIntegration } from "../../src/lib/database/azure-config"

/**
 * Azure Function for Database Health Monitoring
 * Runs every 5 minutes
 */
const healthCheckTimer: AzureFunction = async function (
  context: Context, 
  myTimer: any
): Promise<void> {
  const monitor = new AzureMonitorIntegration();
  const prisma = new AzurePrismaClient();
  
  try {
    // Check database health
    const health = await prisma.checkHealth();
    
    // Track metrics
    monitor.trackDatabaseMetric('Latency', health.latency);
    monitor.trackDatabaseMetric('Connected', health.connected ? 1 : 0);
    
    // Get connection pool stats from Azure metrics API
    const stats = await getAzureMetrics(context);
    
    if (stats) {
      monitor.trackDatabaseMetric('ConnectionCount', stats.connectionCount);
      monitor.trackDatabaseMetric('CPUPercent', stats.cpuPercent);
      monitor.trackDatabaseMetric('MemoryPercent', stats.memoryPercent);
      monitor.trackDatabaseMetric('IOPercent', stats.ioPercent);
    }
    
    // Store in database
    await prisma.$queryRaw`
      INSERT INTO operational.database_health (
        connection_count, cpu_usage, memory_usage, 
        health_status, check_time
      ) VALUES (
        ${stats?.connectionCount || 0},
        ${stats?.cpuPercent || 0},
        ${stats?.memoryPercent || 0},
        ${health.connected ? 'HEALTHY' : 'CRITICAL'},
        CURRENT_TIMESTAMP
      )
    `;
    
    context.log('Health check completed successfully');
    
  } catch (error) {
    context.log.error('Health check failed:', error);
    monitor.trackDatabaseException(error as Error);
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get metrics from Azure Monitor API
 */
async function getAzureMetrics(context: Context): Promise<any> {
  // This would call Azure Monitor API
  // Using Azure SDK for JavaScript
  
  try {
    const { DefaultAzureCredential } = require('@azure/identity');
    const { MetricsQueryClient } = require('@azure/monitor-query');
    
    const credential = new DefaultAzureCredential();
    const metricsClient = new MetricsQueryClient(credential);
    
    const resourceId = `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}/resourceGroups/${process.env.AZURE_RESOURCE_GROUP}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${process.env.AZURE_DB_SERVER}`;
    
    const metrics = await metricsClient.queryResource(
      resourceId,
      ['cpu_percent', 'memory_percent', 'io_consumption_percent', 'active_connections'],
      {
        timespan: 'PT5M', // Last 5 minutes
        interval: 'PT1M'  // 1 minute granularity
      }
    );
    
    // Get latest values
    const latest = {
      cpuPercent: metrics.metrics[0]?.timeseries[0]?.data[0]?.average || 0,
      memoryPercent: metrics.metrics[1]?.timeseries[0]?.data[0]?.average || 0,
      ioPercent: metrics.metrics[2]?.timeseries[0]?.data[0]?.average || 0,
      connectionCount: metrics.metrics[3]?.timeseries[0]?.data[0]?.average || 0
    };
    
    return latest;
    
  } catch (error) {
    context.log.error('Failed to get Azure metrics:', error);
    return null;
  }
}

export default healthCheckTimer;