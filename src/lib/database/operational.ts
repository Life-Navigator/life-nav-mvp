/**
 * Database Operational Utilities for Production Grade System
 * Handles soft deletes, versioning, retention, and monitoring
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import cron from 'node-cron';

export interface SoftDeleteOptions {
  userId?: string;
  reason?: string;
  permanent?: boolean;
}

export interface VersioningOptions {
  userId: string;
  reason?: string;
  source?: 'API' | 'UI' | 'SYSTEM' | 'MIGRATION';
}

/**
 * Enhanced Prisma Client with Operational Features
 */
export class OperationalPrismaClient extends PrismaClient {
  private retentionJobs: Map<string, cron.ScheduledTask> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(options?: Prisma.PrismaClientOptions) {
    super(options);
    this.setupMiddleware();
    this.initializeOperationalFeatures();
  }

  /**
   * Setup Prisma middleware for soft deletes and versioning
   */
  private setupMiddleware() {
    // Soft Delete Middleware
    this.$use(async (params, next) => {
      // Handle soft delete for DELETE operations
      if (params.action === 'delete') {
        params.action = 'update';
        params.args['data'] = {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: params.args['deletedBy'] || 'SYSTEM',
          deletedReason: params.args['deletedReason']
        };
      }

      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        params.args['data'] = {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: params.args['deletedBy'] || 'SYSTEM'
        };
      }

      // Filter out soft-deleted records for READ operations
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.args = params.args || {};
        params.args['where'] = {
          ...params.args['where'],
          isDeleted: false
        };
      }

      if (params.action === 'findMany') {
        params.args = params.args || {};
        params.args['where'] = {
          ...params.args['where'],
          isDeleted: params.args['includeDeleted'] ? undefined : false
        };
      }

      return next(params);
    });

    // Versioning Middleware
    this.$use(async (params, next) => {
      if (params.action === 'update' || params.action === 'updateMany') {
        // Capture old state before update
        const model = params.model;
        if (model && this.shouldVersionTable(model)) {
          const oldRecord = await (this as any)[model].findUnique({
            where: params.args.where
          });

          if (oldRecord) {
            // Increment version
            params.args.data = {
              ...params.args.data,
              version: { increment: 1 },
              updatedBy: params.args['updatedBy'] || 'SYSTEM'
            };

            // Store history after update
            const result = await next(params);
            
            await this.createChangeHistory({
              entityId: oldRecord.id,
              entityType: model,
              operation: 'UPDATE',
              oldValues: oldRecord,
              newValues: result,
              userId: params.args['updatedBy'],
              changeSource: params.args['changeSource'] || 'API'
            });

            return result;
          }
        }
      }

      return next(params);
    });
  }

  /**
   * Initialize operational features
   */
  private async initializeOperationalFeatures() {
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Initialize retention policies
    await this.initializeRetentionPolicies();
    
    // Load feature flags
    await this.loadFeatureFlags();
  }

  /**
   * Determine if a table should have versioning
   */
  private shouldVersionTable(modelName: string): boolean {
    const versionedTables = [
      'User', 'FinancialAccount', 'Transaction', 'HealthRecord',
      'Document', 'Goal', 'RiskAssessment'
    ];
    return versionedTables.includes(modelName);
  }

  /**
   * Create change history record
   */
  private async createChangeHistory(data: any) {
    try {
      const changedFields = this.getChangedFields(data.oldValues, data.newValues);
      
      await this.changeHistory.create({
        data: {
          entityId: data.entityId,
          entityType: data.entityType,
          operation: data.operation,
          oldValues: data.oldValues,
          newValues: data.newValues,
          changedFields,
          changeSource: data.changeSource,
          userId: data.userId,
          version: data.newValues?.version || 1,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to create change history:', error);
    }
  }

  /**
   * Get list of changed fields
   */
  private getChangedFields(oldValues: any, newValues: any): string[] {
    const changed: string[] = [];
    
    for (const key in newValues) {
      if (oldValues[key] !== newValues[key]) {
        changed.push(key);
      }
    }
    
    return changed;
  }

  /**
   * Soft delete with recovery capability
   */
  async softDelete(
    model: string,
    where: any,
    options: SoftDeleteOptions = {}
  ): Promise<any> {
    const result = await (this as any)[model].update({
      where,
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: options.userId || 'SYSTEM',
        deletedReason: options.reason
      }
    });

    // Create snapshot for recovery
    await this.createDataSnapshot({
      entityId: result.id,
      entityType: model,
      snapshotData: result,
      snapshotReason: 'SOFT_DELETE'
    });

    return result;
  }

  /**
   * Restore soft-deleted record
   */
  async restore(model: string, where: any, userId?: string): Promise<any> {
    return await (this as any)[model].update({
      where,
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        deletedReason: null,
        updatedBy: userId || 'SYSTEM'
      }
    });
  }

  /**
   * Permanent delete with audit trail
   */
  async permanentDelete(
    model: string,
    where: any,
    options: SoftDeleteOptions
  ): Promise<any> {
    if (!options.userId || !options.reason) {
      throw new Error('Permanent deletion requires userId and reason');
    }

    // Create final snapshot
    const record = await (this as any)[model].findUnique({ where });
    
    await this.createDataSnapshot({
      entityId: record.id,
      entityType: model,
      snapshotData: record,
      snapshotReason: 'PERMANENT_DELETE'
    });

    // Actually delete
    return await (this as any)[model].delete({ where });
  }

  /**
   * Create data snapshot for recovery
   */
  private async createDataSnapshot(data: {
    entityId: string;
    entityType: string;
    snapshotData: any;
    snapshotReason: string;
  }) {
    const checksum = createHash('sha256')
      .update(JSON.stringify(data.snapshotData))
      .digest('hex');

    await this.dataSnapshot.create({
      data: {
        entityId: data.entityId,
        entityType: data.entityType,
        snapshotData: data.snapshotData,
        snapshotReason: data.snapshotReason,
        checksum,
        createdAt: new Date()
      }
    });
  }

  /**
   * Initialize data retention policies
   */
  private async initializeRetentionPolicies() {
    const policies = await this.dataRetentionPolicy.findMany({
      where: { purgeEnabled: true }
    });

    for (const policy of policies) {
      const job = cron.schedule(policy.purgeSchedule, async () => {
        await this.executePurge(policy);
      });

      this.retentionJobs.set(policy.tableName, job);
    }
  }

  /**
   * Execute data purge based on retention policy
   */
  private async executePurge(policy: any) {
    const purgeStarted = new Date();
    
    try {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      // Soft delete old records
      const result = await (this as any)[policy.tableName].updateMany({
        where: {
          createdAt: { lt: cutoffDate },
          isDeleted: false
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: 'RETENTION_POLICY',
          deletedReason: `Data retention policy: ${policy.complianceReason}`
        }
      });

      // Log purge history
      await this.purgeHistory.create({
        data: {
          tableName: policy.tableName,
          purgeType: 'SOFT_DELETE',
          recordCount: result.count,
          startedAt: purgeStarted,
          completedAt: new Date(),
          status: 'COMPLETED',
          conditions: { cutoffDate },
          performedBy: 'SYSTEM'
        }
      });

      // Update policy
      await this.dataRetentionPolicy.update({
        where: { id: policy.id },
        data: {
          lastPurgeAt: new Date(),
          lastPurgeCount: result.count
        }
      });

      // If archive is enabled, archive soft-deleted records
      if (policy.archiveEnabled) {
        await this.archiveRecords(policy, cutoffDate);
      }

    } catch (error) {
      await this.purgeHistory.create({
        data: {
          tableName: policy.tableName,
          purgeType: 'SOFT_DELETE',
          recordCount: 0,
          startedAt: purgeStarted,
          completedAt: new Date(),
          status: 'FAILED',
          errorMessage: (error as Error).message,
          conditions: {},
          performedBy: 'SYSTEM'
        }
      });
    }
  }

  /**
   * Archive old records
   */
  private async archiveRecords(policy: any, cutoffDate: Date) {
    // Implementation would export to S3/Azure Blob
    console.log(`Archiving records for ${policy.tableName} older than ${cutoffDate}`);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring() {
    // Check every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  /**
   * Perform database health check
   */
  private async performHealthCheck() {
    try {
      // Get connection stats
      const poolStats = await this.$queryRaw`
        SELECT 
          count(*) as connection_count,
          count(*) FILTER (WHERE state = 'active') as active_queries,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      // Get database size
      const sizeStats = await this.$queryRaw`
        SELECT 
          pg_database_size(current_database()) as database_size,
          (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
          (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') as index_count
      `;

      // Get performance stats
      const perfStats = await this.$queryRaw`
        SELECT 
          sum(blks_hit)::float / nullif(sum(blks_hit + blks_read), 0) * 100 as cache_hit_ratio,
          count(*) FILTER (WHERE query_start < now() - interval '1 second') as slow_queries
        FROM pg_stat_database
        WHERE datname = current_database()
      `;

      // Determine health status
      const healthStatus = this.calculateHealthStatus(poolStats, perfStats);

      // Store health metrics
      await this.databaseHealth.create({
        data: {
          connectionCount: poolStats[0].connection_count,
          activeQueries: poolStats[0].active_queries,
          idleConnections: poolStats[0].idle_connections,
          maxConnections: 100, // Configure based on your setup
          avgQueryTime: 0, // Would need query stats
          slowQueries: perfStats[0].slow_queries || 0,
          deadlocks: 0,
          blockingQueries: 0,
          cacheHitRatio: perfStats[0].cache_hit_ratio || 0,
          databaseSize: BigInt(sizeStats[0].database_size),
          tableCount: sizeStats[0].table_count,
          indexCount: sizeStats[0].index_count,
          unusedIndexes: [],
          bloatPercentage: 0,
          cpuUsage: 0, // Would need system stats
          memoryUsage: 0,
          diskUsage: 0,
          iopsRead: 0,
          iopsWrite: 0,
          healthStatus,
          checkTime: new Date()
        }
      });

    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  /**
   * Calculate overall health status
   */
  private calculateHealthStatus(poolStats: any, perfStats: any): string {
    const activeRatio = poolStats[0].active_queries / poolStats[0].connection_count;
    const cacheHitRatio = perfStats[0].cache_hit_ratio || 0;

    if (activeRatio > 0.8 || cacheHitRatio < 90) {
      return 'DEGRADED';
    }
    
    if (activeRatio > 0.9 || cacheHitRatio < 80) {
      return 'CRITICAL';
    }

    return 'HEALTHY';
  }

  /**
   * Load feature flags
   */
  private async loadFeatureFlags() {
    // Load and cache feature flags
    const flags = await this.featureFlag.findMany({
      where: { isEnabled: true }
    });

    // Store in memory for fast access
    global.featureFlags = flags;
  }

  /**
   * Check if a feature flag is enabled
   */
  async isFeatureEnabled(
    flagKey: string,
    userId?: string,
    context?: any
  ): Promise<boolean> {
    const flag = await this.featureFlag.findUnique({
      where: { flagKey }
    });

    if (!flag || !flag.isEnabled || flag.killSwitch) {
      return false;
    }

    // Check schedule
    const now = new Date();
    if (flag.enabledFrom && now < flag.enabledFrom) return false;
    if (flag.enabledUntil && now > flag.enabledUntil) return false;

    // Check targeting
    if (userId) {
      if (flag.targetUsers.includes(userId)) return true;
      
      if (context?.role && flag.targetRoles.includes(context.role)) {
        return true;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== null && flag.rolloutPercentage !== undefined) {
      const hash = createHash('md5').update(`${flagKey}${userId}`).digest('hex');
      const hashValue = parseInt(hash.substring(0, 8), 16);
      const userPercentage = (hashValue % 100) + 1;
      return userPercentage <= flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Create backup metadata
   */
  async createBackup(type: 'FULL' | 'INCREMENTAL' | 'DIFFERENTIAL'): Promise<string> {
    const backupId = `backup_${Date.now()}`;
    
    await this.backupMetadata.create({
      data: {
        backupId,
        backupType: type,
        backupStatus: 'RUNNING',
        startedAt: new Date(),
        databaseName: 'lifenavigator',
        schemaVersion: '1.0.0',
        tablesIncluded: [],
        recordCount: BigInt(0),
        backupSize: BigInt(0),
        storageLocation: 'AZURE_BLOB',
        storageUrl: `https://storage.azure.com/backups/${backupId}`,
        encryptionKeyId: 'backup_key_1',
        checksum: '',
        recoveryPoint: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });

    return backupId;
  }

  /**
   * Cleanup on disconnect
   */
  async $disconnect() {
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Stop retention jobs
    for (const job of this.retentionJobs.values()) {
      job.stop();
    }

    await super.$disconnect();
  }
}

// Export singleton instance
export const operationalDb = new OperationalPrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'pretty'
});

export default operationalDb;