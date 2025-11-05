/**
 * Azure Database for PostgreSQL Configuration
 * Optimized for Azure PostgreSQL Flexible Server
 */

import { PrismaClient } from '@prisma/client';

/**
 * Azure PostgreSQL connection configuration
 */
export const azureDbConfig = {
  // Connection string format for Azure
  connectionString: process.env.AZURE_DATABASE_URL || 
    `postgresql://${process.env.AZURE_DB_USER}@${process.env.AZURE_DB_SERVER}:${process.env.AZURE_DB_PASSWORD}@${process.env.AZURE_DB_SERVER}.postgres.database.azure.com:5432/${process.env.AZURE_DB_NAME}?sslmode=require`,
  
  // Use PgBouncer for connection pooling
  pooledConnectionString: process.env.AZURE_DATABASE_POOLED_URL ||
    `postgresql://${process.env.AZURE_DB_USER}@${process.env.AZURE_DB_SERVER}:${process.env.AZURE_DB_PASSWORD}@${process.env.AZURE_DB_SERVER}.postgres.database.azure.com:6432/${process.env.AZURE_DB_NAME}?sslmode=require&pgbouncer=true`,

  // SSL configuration for Azure
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.AZURE_DB_SSL_CERT // Azure PostgreSQL CA certificate
  },

  // Connection pool settings optimized for Azure
  pool: {
    min: 2,
    max: 20, // Azure default max is 50
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500, // Refresh connections periodically
  }
};

/**
 * Azure-optimized Prisma Client
 */
export class AzurePrismaClient extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          url: azureDbConfig.pooledConnectionString
        }
      },
      log: process.env.NODE_ENV === 'production' 
        ? ['error'] 
        : ['query', 'error', 'warn'],
      errorFormat: 'minimal'
    });
  }

  /**
   * Azure-specific health check
   */
  async checkHealth(): Promise<{
    connected: boolean;
    latency: number;
    version: string;
  }> {
    const start = Date.now();
    
    try {
      // Simple connectivity check
      const result = await this.$queryRaw<any>`
        SELECT version() as version, 
               current_database() as database,
               pg_is_in_recovery() as is_replica
      `;
      
      return {
        connected: true,
        latency: Date.now() - start,
        version: result[0].version
      };
    } catch (error) {
      return {
        connected: false,
        latency: Date.now() - start,
        version: 'unknown'
      };
    }
  }

  /**
   * Azure Blob Storage configuration for backups
   */
  async configureBackupStorage() {
    return {
      accountName: process.env.AZURE_STORAGE_ACCOUNT,
      containerName: 'backups',
      sasToken: process.env.AZURE_STORAGE_SAS_TOKEN,
      backupPath: `postgresql/${new Date().toISOString().split('T')[0]}/`
    };
  }
}

/**
 * Azure Functions replacement for pg_cron
 */
export class AzureScheduledJobs {
  /**
   * Data retention job (runs as Azure Function)
   */
  static async runDataRetention(): Promise<void> {
    const prisma = new AzurePrismaClient();
    
    try {
      // Get retention policies
      const policies = await prisma.$queryRaw<any[]>`
        SELECT * FROM operational.data_retention_policies 
        WHERE purge_enabled = true
      `;

      for (const policy of policies) {
        await AzureScheduledJobs.executePurge(prisma, policy);
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Execute purge for a specific policy
   */
  private static async executePurge(
    prisma: AzurePrismaClient, 
    policy: any
  ): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

    // Use parameterized query for safety
    await prisma.$executeRaw`
      UPDATE ${policy.table_name}
      SET is_deleted = true,
          deleted_at = CURRENT_TIMESTAMP,
          deleted_by = 'RETENTION_POLICY',
          deleted_reason = ${policy.compliance_reason}
      WHERE created_at < ${cutoffDate}
        AND is_deleted = false
    `;
  }

  /**
   * Backup job (runs as Azure Function)
   */
  static async runBackup(): Promise<void> {
    // Azure Database for PostgreSQL has automatic backups
    // This would trigger additional app-level backups if needed
    
    const prisma = new AzurePrismaClient();
    
    try {
      // Create backup metadata
      await prisma.$queryRaw`
        INSERT INTO operational.backup_metadata (
          backup_id, backup_type, backup_status, 
          started_at, storage_location, storage_url
        ) VALUES (
          gen_random_uuid(), 
          'AUTOMATIC', 
          'COMPLETED',
          CURRENT_TIMESTAMP,
          'AZURE_NATIVE',
          'Managed by Azure'
        )
      `;
    } finally {
      await prisma.$disconnect();
    }
  }
}

/**
 * Azure Monitor integration for health metrics
 */
export class AzureMonitorIntegration {
  private appInsights: any;

  constructor() {
    // Initialize Application Insights
    if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
      const appInsights = require('applicationinsights');
      appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true)
        .setUseDiskRetryCaching(true)
        .start();
      
      this.appInsights = appInsights.defaultClient;
    }
  }

  /**
   * Track database metrics
   */
  trackDatabaseMetric(name: string, value: number, properties?: any) {
    if (this.appInsights) {
      this.appInsights.trackMetric({
        name: `Database.${name}`,
        value,
        properties
      });
    }
  }

  /**
   * Track database events
   */
  trackDatabaseEvent(name: string, properties?: any) {
    if (this.appInsights) {
      this.appInsights.trackEvent({
        name: `Database.${name}`,
        properties
      });
    }
  }

  /**
   * Track database exceptions
   */
  trackDatabaseException(error: Error, properties?: any) {
    if (this.appInsights) {
      this.appInsights.trackException({
        exception: error,
        properties: {
          ...properties,
          source: 'Database'
        }
      });
    }
  }
}

/**
 * Azure Key Vault integration for encryption keys
 */
export class AzureKeyVaultIntegration {
  private keyVaultUrl: string;

  constructor() {
    this.keyVaultUrl = `https://${process.env.AZURE_KEY_VAULT_NAME}.vault.azure.net`;
  }

  /**
   * Get encryption key from Key Vault
   */
  async getEncryptionKey(keyName: string): Promise<Buffer> {
    // Use Azure SDK
    const { DefaultAzureCredential } = require('@azure/identity');
    const { SecretClient } = require('@azure/keyvault-secrets');
    
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(this.keyVaultUrl, credential);
    
    const secret = await client.getSecret(keyName);
    return Buffer.from(secret.value!, 'base64');
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyName: string): Promise<string> {
    const { DefaultAzureCredential } = require('@azure/identity');
    const { SecretClient } = require('@azure/keyvault-secrets');
    
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(this.keyVaultUrl, credential);
    
    // Create new version of the key
    const newKey = require('crypto').randomBytes(32).toString('base64');
    await client.setSecret(keyName, newKey);
    
    return newKey;
  }
}

/**
 * Azure-specific database extensions to enable
 */
export const AZURE_POSTGRESQL_EXTENSIONS = [
  'pgcrypto',          // ✅ Cryptographic functions
  'uuid-ossp',         // ✅ UUID generation
  'pg_stat_statements', // ✅ Query performance (requires config)
  'pg_trgm',           // ✅ Trigram text search
  'btree_gin',         // ✅ GIN index support
  'btree_gist',        // ✅ GIST index support
  'pg_buffercache',    // ✅ Buffer cache inspection
  // 'pg_cron',        // ❌ NOT AVAILABLE - Use Azure Functions
  // 'pg_partman',     // ❌ NOT AVAILABLE - Manual partitioning
];

/**
 * Azure PostgreSQL Flexible Server tiers and recommendations
 */
export const AZURE_DB_RECOMMENDATIONS = {
  development: {
    tier: 'Burstable',
    compute: 'Standard_B1ms', // 1 vCore, 2 GB RAM
    storage: 32, // GB
    backup: 7, // days
    cost: '~$15/month'
  },
  production: {
    tier: 'General Purpose',
    compute: 'Standard_D4s_v3', // 4 vCores, 16 GB RAM
    storage: 128, // GB
    backup: 30, // days
    highAvailability: true,
    readReplicas: 1,
    cost: '~$300/month'
  },
  enterprise: {
    tier: 'Memory Optimized',
    compute: 'Standard_E4s_v3', // 4 vCores, 32 GB RAM
    storage: 512, // GB
    backup: 35, // days
    highAvailability: true,
    readReplicas: 2,
    geoRedundantBackup: true,
    cost: '~$600/month'
  }
};

// Export singleton instance
export const azureDb = new AzurePrismaClient();

export default azureDb;