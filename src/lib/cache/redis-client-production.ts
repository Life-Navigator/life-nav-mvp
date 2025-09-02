/**
 * Production-Ready Redis Client with Enterprise Features
 * Includes: Connection pooling, circuit breaker, monitoring, retry logic, and health checks
 */

import Redis, { Redis as RedisClient, RedisOptions, Cluster } from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Circuit Breaker States
 */
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Redis Client Configuration
 */
interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  connectionName?: string;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  connectTimeout?: number;
  commandTimeout?: number;
  keepAlive?: number;
  noDelay?: boolean;
  connectionPoolSize?: number;
  enableOfflineQueue?: boolean;
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
  enableMetrics?: boolean;
  tls?: {
    enabled: boolean;
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  sentinel?: {
    sentinels: Array<{ host: string; port: number }>;
    name: string;
    password?: string;
  };
  cluster?: {
    nodes: Array<{ host: string; port: number }>;
    options?: any;
  };
}

/**
 * Connection Metrics
 */
interface RedisMetrics {
  totalCommands: number;
  failedCommands: number;
  avgResponseTime: number;
  connectionErrors: number;
  lastError?: string;
  lastErrorTime?: Date;
  circuitBreakerState: CircuitState;
  connectedClients: number;
  memoryUsage?: number;
  hitRate?: number;
  uptime?: number;
}

/**
 * Production Redis Manager
 */
export class RedisManager extends EventEmitter {
  private client: RedisClient | Cluster | null = null;
  private config: RedisConfig;
  private metrics: RedisMetrics;
  private circuitBreaker: {
    state: CircuitState;
    failures: number;
    lastFailureTime: Date | null;
    halfOpenTests: number;
  };
  private responseTimeBuffer: number[] = [];
  private readonly MAX_RESPONSE_TIME_BUFFER = 100;
  private healthCheckInterval?: NodeJS.Timeout;
  private connectionPool: Map<string, RedisClient> = new Map();
  private isShuttingDown = false;

  constructor(config?: Partial<RedisConfig>) {
    super();
    
    // Load configuration with defaults
    this.config = this.loadConfiguration(config);
    
    // Initialize metrics
    this.metrics = {
      totalCommands: 0,
      failedCommands: 0,
      avgResponseTime: 0,
      connectionErrors: 0,
      circuitBreakerState: CircuitState.CLOSED,
      connectedClients: 0,
    };
    
    // Initialize circuit breaker
    this.circuitBreaker = {
      state: CircuitState.CLOSED,
      failures: 0,
      lastFailureTime: null,
      halfOpenTests: 0,
    };
    
    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Load configuration with production defaults
   */
  private loadConfiguration(config?: Partial<RedisConfig>): RedisConfig {
    const defaults: RedisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      connectionName: `lifenavigator-${process.env.NODE_ENV || 'dev'}-${process.pid}`,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000, // 10 seconds
      commandTimeout: 5000, // 5 seconds
      keepAlive: 30000, // 30 seconds
      noDelay: true,
      connectionPoolSize: 10,
      enableOfflineQueue: true,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000, // 60 seconds
      enableMetrics: true,
    };

    // Check for TLS configuration (Azure Redis)
    if (process.env.REDIS_TLS === 'true') {
      defaults.tls = {
        enabled: true,
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      };
    }

    // Check for Sentinel configuration (High Availability)
    if (process.env.REDIS_SENTINELS) {
      const sentinels = process.env.REDIS_SENTINELS.split(',').map(s => {
        const [host, port] = s.split(':');
        return { host, port: parseInt(port) };
      });
      defaults.sentinel = {
        sentinels,
        name: process.env.REDIS_SENTINEL_NAME || 'mymaster',
        password: process.env.REDIS_SENTINEL_PASSWORD,
      };
    }

    // Check for Cluster configuration
    if (process.env.REDIS_CLUSTER_NODES) {
      const nodes = process.env.REDIS_CLUSTER_NODES.split(',').map(s => {
        const [host, port] = s.split(':');
        return { host, port: parseInt(port) };
      });
      defaults.cluster = { nodes };
    }

    return { ...defaults, ...config };
  }

  /**
   * Initialize Redis connection with proper error handling
   */
  async connect(): Promise<void> {
    if (this.client && this.client.status === 'ready') {
      return; // Already connected
    }

    try {
      // Create appropriate client based on configuration
      if (this.config.cluster) {
        this.client = await this.createClusterClient();
      } else if (this.config.sentinel) {
        this.client = await this.createSentinelClient();
      } else {
        this.client = await this.createStandardClient();
      }

      // Setup event handlers
      this.setupEventHandlers();

      // Start health check monitoring
      if (this.config.enableMetrics) {
        this.startHealthMonitoring();
      }

      this.emit('connected');
      console.log('Redis client connected successfully');
    } catch (error) {
      this.handleConnectionError(error);
      throw error;
    }
  }

  /**
   * Create standard Redis client
   */
  private async createStandardClient(): Promise<RedisClient> {
    const options: RedisOptions = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      connectionName: this.config.connectionName,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      enableReadyCheck: this.config.enableReadyCheck,
      connectTimeout: this.config.connectTimeout,
      commandTimeout: this.config.commandTimeout,
      keepAlive: this.config.keepAlive,
      noDelay: this.config.noDelay,
      enableOfflineQueue: this.config.enableOfflineQueue,
      retryStrategy: (times: number) => {
        if (times > 10) {
          return null; // Stop retrying after 10 attempts
        }
        // Exponential backoff with jitter
        const delay = Math.min(times * 1000, 30000);
        const jitter = Math.random() * 1000;
        return delay + jitter;
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true; // Reconnect when Redis is in readonly mode
        }
        return false;
      },
    };

    // Add TLS configuration if enabled
    if (this.config.tls?.enabled) {
      options.tls = {
        rejectUnauthorized: this.config.tls.rejectUnauthorized,
        ca: this.config.tls.ca,
        cert: this.config.tls.cert,
        key: this.config.tls.key,
      };
    }

    return new Redis(options);
  }

  /**
   * Create Sentinel client for High Availability
   */
  private async createSentinelClient(): Promise<RedisClient> {
    if (!this.config.sentinel) {
      throw new Error('Sentinel configuration is missing');
    }

    return new Redis({
      sentinels: this.config.sentinel.sentinels,
      name: this.config.sentinel.name,
      password: this.config.password,
      sentinelPassword: this.config.sentinel.password,
      connectionName: this.config.connectionName,
      enableReadyCheck: this.config.enableReadyCheck,
      connectTimeout: this.config.connectTimeout,
      commandTimeout: this.config.commandTimeout,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
    });
  }

  /**
   * Create Cluster client for horizontal scaling
   */
  private async createClusterClient(): Promise<Cluster> {
    if (!this.config.cluster) {
      throw new Error('Cluster configuration is missing');
    }

    return new Redis.Cluster(this.config.cluster.nodes, {
      redisOptions: {
        password: this.config.password,
        connectionName: this.config.connectionName,
      },
      clusterRetryStrategy: (times: number) => {
        if (times > 10) return null;
        return Math.min(times * 1000, 30000);
      },
      ...this.config.cluster.options,
    });
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      console.log('Redis: Connection established');
      this.metrics.connectedClients++;
    });

    this.client.on('ready', () => {
      console.log('Redis: Ready to accept commands');
      this.circuitBreaker.state = CircuitState.CLOSED;
      this.circuitBreaker.failures = 0;
    });

    this.client.on('error', (error: Error) => {
      console.error('Redis error:', error.message);
      this.metrics.connectionErrors++;
      this.metrics.lastError = error.message;
      this.metrics.lastErrorTime = new Date();
      this.handleCircuitBreakerFailure();
      this.emit('error', error);
    });

    this.client.on('close', () => {
      console.log('Redis: Connection closed');
      this.metrics.connectedClients = Math.max(0, this.metrics.connectedClients - 1);
    });

    this.client.on('reconnecting', (delay: number) => {
      console.log(`Redis: Reconnecting in ${delay}ms`);
    });

    this.client.on('end', () => {
      console.log('Redis: Connection ended');
    });

    // Monitor command performance
    if (this.config.enableMetrics) {
      this.client.on('command', (command: any) => {
        command.startTime = Date.now();
      });

      this.client.on('reply', (reply: any, command: any) => {
        if (command.startTime) {
          const responseTime = Date.now() - command.startTime;
          this.recordResponseTime(responseTime);
        }
        this.metrics.totalCommands++;
      });

      this.client.on('reply_error', () => {
        this.metrics.failedCommands++;
        this.handleCircuitBreakerFailure();
      });
    }
  }

  /**
   * Circuit Breaker pattern implementation
   */
  private handleCircuitBreakerFailure(): void {
    if (!this.config.enableCircuitBreaker) return;

    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = new Date();

    if (this.circuitBreaker.failures >= (this.config.circuitBreakerThreshold || 5)) {
      this.circuitBreaker.state = CircuitState.OPEN;
      this.metrics.circuitBreakerState = CircuitState.OPEN;
      
      console.error('Redis: Circuit breaker OPENED due to excessive failures');
      this.emit('circuit-breaker-open');

      // Schedule circuit breaker half-open test
      setTimeout(() => {
        this.circuitBreaker.state = CircuitState.HALF_OPEN;
        this.metrics.circuitBreakerState = CircuitState.HALF_OPEN;
        this.circuitBreaker.halfOpenTests = 0;
        console.log('Redis: Circuit breaker entering HALF-OPEN state');
      }, this.config.circuitBreakerTimeout || 60000);
    }
  }

  /**
   * Execute command with circuit breaker protection
   */
  async execute<T = any>(command: string, ...args: any[]): Promise<T | null> {
    // Check circuit breaker state
    if (this.circuitBreaker.state === CircuitState.OPEN) {
      throw new Error('Circuit breaker is OPEN - Redis operations are temporarily disabled');
    }

    if (!this.client) {
      throw new Error('Redis client is not connected');
    }

    const startTime = Date.now();

    try {
      // Execute command with timeout
      const result = await Promise.race([
        (this.client as any)[command](...args),
        this.commandTimeout(),
      ]);

      // Record success metrics
      const responseTime = Date.now() - startTime;
      this.recordResponseTime(responseTime);
      this.metrics.totalCommands++;

      // Handle circuit breaker half-open success
      if (this.circuitBreaker.state === CircuitState.HALF_OPEN) {
        this.circuitBreaker.halfOpenTests++;
        if (this.circuitBreaker.halfOpenTests >= 3) {
          this.circuitBreaker.state = CircuitState.CLOSED;
          this.circuitBreaker.failures = 0;
          this.metrics.circuitBreakerState = CircuitState.CLOSED;
          console.log('Redis: Circuit breaker CLOSED - service recovered');
        }
      }

      return result;
    } catch (error) {
      // Record failure metrics
      this.metrics.failedCommands++;
      this.handleCircuitBreakerFailure();
      
      // Log error with context
      console.error(`Redis command failed: ${command}`, error);
      
      if (this.config.enableOfflineQueue) {
        return null; // Return null for offline queue mode
      }
      
      throw error;
    }
  }

  /**
   * Command timeout implementation
   */
  private commandTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Redis command timeout after ${this.config.commandTimeout}ms`));
      }, this.config.commandTimeout || 5000);
    });
  }

  /**
   * Record response time for metrics
   */
  private recordResponseTime(responseTime: number): void {
    this.responseTimeBuffer.push(responseTime);
    
    if (this.responseTimeBuffer.length > this.MAX_RESPONSE_TIME_BUFFER) {
      this.responseTimeBuffer.shift();
    }
    
    // Calculate average response time
    const sum = this.responseTimeBuffer.reduce((a, b) => a + b, 0);
    this.metrics.avgResponseTime = Math.round(sum / this.responseTimeBuffer.length);
  }

  /**
   * Health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        // Ping to check connection
        const start = Date.now();
        await this.execute('ping');
        const latency = Date.now() - start;
        
        // Get memory usage
        const info = await this.execute<string>('info', 'memory');
        if (info) {
          const usedMemory = this.parseInfoField(info, 'used_memory');
          if (usedMemory) {
            this.metrics.memoryUsage = parseInt(usedMemory);
          }
        }
        
        // Get connected clients
        const clientInfo = await this.execute<string>('client', 'list');
        if (clientInfo) {
          this.metrics.connectedClients = clientInfo.split('\n').length - 1;
        }
        
        // Emit health status
        this.emit('health', {
          status: 'healthy',
          latency,
          metrics: { ...this.metrics },
        });
      } catch (error) {
        this.emit('health', {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          metrics: { ...this.metrics },
        });
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Parse Redis INFO command output
   */
  private parseInfoField(info: string | undefined, field: string): string | null {
    if (!info) return null;
    const regex = new RegExp(`${field}:(.+)`, 'i');
    const match = info.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Get connection from pool
   */
  async getConnection(poolKey: string = 'default'): Promise<RedisClient> {
    if (this.connectionPool.has(poolKey)) {
      const connection = this.connectionPool.get(poolKey);
      if (connection && connection.status === 'ready') {
        return connection;
      }
    }

    // Create new connection for pool
    const connection = await this.createStandardClient();
    this.connectionPool.set(poolKey, connection);
    
    // Limit pool size
    if (this.connectionPool.size > (this.config.connectionPoolSize || 10)) {
      const firstKey = this.connectionPool.keys().next().value;
      const oldConnection = this.connectionPool.get(firstKey);
      if (oldConnection) {
        await oldConnection.quit();
      }
      this.connectionPool.delete(firstKey);
    }
    
    return connection;
  }

  /**
   * Get current metrics
   */
  getMetrics(): RedisMetrics {
    return { ...this.metrics };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): {
    state: CircuitState;
    failures: number;
    lastFailureTime: Date | null;
  } {
    return { ...this.circuitBreaker };
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: any): void {
    console.error('Redis connection error:', error);
    this.metrics.connectionErrors++;
    this.metrics.lastError = error.message;
    this.metrics.lastErrorTime = new Date();
    this.emit('connection-error', error);
  }

  /**
   * Graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, starting graceful shutdown...`);
      this.isShuttingDown = true;
      
      try {
        // Clear health check interval
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
        }
        
        // Close all connections in pool
        for (const [key, connection] of this.connectionPool) {
          console.log(`Closing connection pool: ${key}`);
          await connection.quit();
        }
        this.connectionPool.clear();
        
        // Close main client
        if (this.client) {
          await this.client.quit();
          this.client = null;
        }
        
        console.log('Redis client shutdown complete');
        this.emit('shutdown');
      } catch (error) {
        console.error('Error during Redis shutdown:', error);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.setupGracefulShutdown();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }
}

/**
 * Singleton instance
 */
let redisManager: RedisManager | null = null;

/**
 * Get Redis Manager instance
 */
export function getRedisManager(): RedisManager {
  if (!redisManager) {
    redisManager = new RedisManager();
  }
  return redisManager;
}

/**
 * Initialize Redis Manager with configuration
 */
export async function initializeRedis(config?: Partial<RedisConfig>): Promise<RedisManager> {
  const manager = getRedisManager();
  await manager.connect();
  return manager;
}

export default getRedisManager();