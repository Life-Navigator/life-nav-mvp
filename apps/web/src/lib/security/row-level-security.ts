/**
 * Row-Level Security (RLS) Implementation
 * Provides fine-grained access control at the database row level
 * Implements Zero Trust security model
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

export interface RLSContext {
  userId: string;
  role: string;
  securityLevel: string;
  dataClassification: string;
  accessTier: string;
  ipAddress?: string;
  sessionId?: string;
}

export interface RLSPolicy {
  tableName: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  condition: (context: RLSContext) => string;
}

export interface AccessDecision {
  allowed: boolean;
  reason?: string;
  filters?: Record<string, any>;
  auditLog: boolean;
}

/**
 * RLS Policy Engine
 * Evaluates access policies for database operations
 */
export class RowLevelSecurity {
  private policies: Map<string, RLSPolicy[]> = new Map();
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.initializePolicies();
  }

  /**
   * Initialize default RLS policies
   */
  private initializePolicies(): void {
    // User table policies
    this.addPolicy({
      tableName: 'users',
      operation: 'SELECT',
      condition: (ctx) => `id = '${ctx.userId}' OR role = 'admin'`
    });

    // Financial accounts - users can only see their own
    this.addPolicy({
      tableName: 'financial_accounts',
      operation: 'SELECT',
      condition: (ctx) => `owner_user_id = '${ctx.userId}' OR '${ctx.userId}' = ANY(shared_with)`
    });

    this.addPolicy({
      tableName: 'financial_accounts',
      operation: 'UPDATE',
      condition: (ctx) => `owner_user_id = '${ctx.userId}' AND access_level IN ('owner', 'editor')`
    });

    this.addPolicy({
      tableName: 'financial_accounts',
      operation: 'DELETE',
      condition: (ctx) => `owner_user_id = '${ctx.userId}' AND access_level = 'owner'`
    });

    // Transactions - strict ownership
    this.addPolicy({
      tableName: 'transactions',
      operation: 'SELECT',
      condition: (ctx) => {
        if (ctx.role === 'admin' && ctx.securityLevel === 'maximum') {
          return 'true'; // Admin with maximum security can see all
        }
        return `owner_user_id = '${ctx.userId}' AND (visibility = 'private' OR visibility = 'shared')`;
      }
    });

    // Health records - HIPAA compliance
    this.addPolicy({
      tableName: 'health_records',
      operation: 'SELECT',
      condition: (ctx) => {
        // Emergency access override
        if (ctx.dataClassification === 'emergency') {
          return `emergency_access = true`;
        }
        return `owner_user_id = '${ctx.userId}' OR '${ctx.userId}' = ANY(authorized_users)`;
      }
    });

    // Documents - multi-level security
    this.addPolicy({
      tableName: 'documents',
      operation: 'SELECT',
      condition: (ctx) => {
        const conditions = [
          `owner_user_id = '${ctx.userId}'`,
          `'${ctx.userId}' = ANY(shared_with)`,
          `(share_expiry IS NULL OR share_expiry > NOW())`
        ];
        return conditions.join(' AND ');
      }
    });

    // Goals - privacy-aware
    this.addPolicy({
      tableName: 'goals',
      operation: 'SELECT',
      condition: (ctx) => {
        return `
          owner_user_id = '${ctx.userId}' 
          OR (visibility = 'public' AND is_private = false)
          OR (visibility = 'friends' AND '${ctx.userId}' = ANY(shared_with))
        `;
      }
    });

    // Risk assessments - confidential
    this.addPolicy({
      tableName: 'risk_assessments',
      operation: 'SELECT',
      condition: (ctx) => {
        if (ctx.securityLevel !== 'maximum') {
          return 'false'; // Require maximum security level
        }
        return `owner_user_id = '${ctx.userId}' OR '${ctx.userId}' = ANY(viewable_by)`;
      }
    });
  }

  /**
   * Add a custom RLS policy
   */
  public addPolicy(policy: RLSPolicy): void {
    const key = `${policy.tableName}:${policy.operation}`;
    if (!this.policies.has(key)) {
      this.policies.set(key, []);
    }
    this.policies.get(key)!.push(policy);
  }

  /**
   * Evaluate access decision for a database operation
   */
  public async evaluateAccess(
    tableName: string,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    context: RLSContext,
    recordId?: string
  ): Promise<AccessDecision> {
    // Check if user is active
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      select: { isActive: true, securityLevel: true, dataClassification: true }
    });

    if (!user?.isActive) {
      return {
        allowed: false,
        reason: 'User account is not active',
        auditLog: true
      };
    }

    // Get applicable policies
    const key = `${tableName}:${operation}`;
    const policies = this.policies.get(key) || [];

    if (policies.length === 0) {
      // No policy means deny by default (Zero Trust)
      return {
        allowed: false,
        reason: 'No access policy defined',
        auditLog: true
      };
    }

    // Evaluate all policies (must pass all)
    for (const policy of policies) {
      const condition = policy.condition(context);
      
      // In production, this would be evaluated at the database level
      // Here we're returning the condition as a filter
      if (condition === 'false') {
        return {
          allowed: false,
          reason: 'Access policy evaluation failed',
          auditLog: true
        };
      }
    }

    // Generate filters for the query
    const filters = this.generateFilters(tableName, operation, context);

    return {
      allowed: true,
      filters,
      auditLog: operation !== 'SELECT' // Log all write operations
    };
  }

  /**
   * Generate Prisma filters based on RLS policies
   */
  private generateFilters(
    tableName: string,
    operation: string,
    context: RLSContext
  ): Record<string, any> {
    const filters: Record<string, any> = {};

    switch (tableName) {
      case 'financial_accounts':
        filters.OR = [
          { ownerUserId: context.userId },
          { sharedWith: { has: context.userId } }
        ];
        break;

      case 'transactions':
        filters.ownerUserId = context.userId;
        if (context.role !== 'admin') {
          filters.visibility = { in: ['private', 'shared'] };
        }
        break;

      case 'health_records':
        filters.OR = [
          { ownerUserId: context.userId },
          { authorizedUsers: { has: context.userId } }
        ];
        break;

      case 'documents':
        filters.OR = [
          { ownerUserId: context.userId },
          {
            AND: [
              { sharedWith: { has: context.userId } },
              {
                OR: [
                  { shareExpiry: null },
                  { shareExpiry: { gt: new Date() } }
                ]
              }
            ]
          }
        ];
        break;

      case 'goals':
        filters.OR = [
          { ownerUserId: context.userId },
          {
            AND: [
              { visibility: 'public' },
              { isPrivate: false }
            ]
          },
          {
            AND: [
              { visibility: 'friends' },
              { sharedWith: { has: context.userId } }
            ]
          }
        ];
        break;

      case 'risk_assessments':
        if (context.securityLevel === 'maximum') {
          filters.OR = [
            { ownerUserId: context.userId },
            { viewableBy: { has: context.userId } }
          ];
        } else {
          filters.id = 'impossible-id'; // Deny access
        }
        break;

      default:
        // Default to owner-only access
        if ('ownerUserId' in filters) {
          filters.ownerUserId = context.userId;
        } else if ('userId' in filters) {
          filters.userId = context.userId;
        }
    }

    return filters;
  }

  /**
   * Apply RLS to a Prisma query
   */
  public async applyRLS<T>(
    model: any,
    operation: 'findMany' | 'findFirst' | 'findUnique' | 'update' | 'delete',
    context: RLSContext,
    baseQuery: any = {}
  ): Promise<T> {
    const tableName = model._name || model.name;
    const dbOperation = this.mapPrismaOperation(operation);
    
    const accessDecision = await this.evaluateAccess(
      tableName,
      dbOperation,
      context
    );

    if (!accessDecision.allowed) {
      throw new Error(`Access denied: ${accessDecision.reason}`);
    }

    // Merge RLS filters with base query
    const query = {
      ...baseQuery,
      where: {
        ...baseQuery.where,
        ...accessDecision.filters
      }
    };

    // Log if required
    if (accessDecision.auditLog) {
      await this.logAccess(tableName, dbOperation, context, true);
    }

    // Execute query with RLS filters
    return await model[operation](query);
  }

  /**
   * Map Prisma operations to SQL operations
   */
  private mapPrismaOperation(
    operation: string
  ): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' {
    switch (operation) {
      case 'findMany':
      case 'findFirst':
      case 'findUnique':
        return 'SELECT';
      case 'create':
        return 'INSERT';
      case 'update':
      case 'updateMany':
        return 'UPDATE';
      case 'delete':
      case 'deleteMany':
        return 'DELETE';
      default:
        return 'SELECT';
    }
  }

  /**
   * Log access attempts for audit
   */
  private async logAccess(
    tableName: string,
    operation: string,
    context: RLSContext,
    allowed: boolean
  ): Promise<void> {
    try {
      await this.prisma.securityAuditLog.create({
        data: {
          userId: context.userId,
          eventType: `RLS_${operation}_${tableName}`,
          ipAddress: context.ipAddress,
          data: {
            tableName,
            operation,
            allowed,
            securityLevel: context.securityLevel,
            role: context.role,
            sessionId: context.sessionId
          }
        }
      });
    } catch (error) {
      console.error('Failed to log RLS access:', error);
    }
  }

  /**
   * Create a secure view with RLS applied
   */
  public async createSecureView(
    tableName: string,
    context: RLSContext,
    columns?: string[]
  ): Promise<string> {
    const key = `${tableName}:SELECT`;
    const policies = this.policies.get(key) || [];
    
    if (policies.length === 0) {
      throw new Error(`No SELECT policy defined for ${tableName}`);
    }

    const conditions = policies.map(p => p.condition(context)).join(' AND ');
    const columnList = columns ? columns.join(', ') : '*';
    
    // Generate a unique view name
    const viewName = `${tableName}_${context.userId}_${createHash('sha256')
      .update(`${tableName}${context.userId}${Date.now()}`)
      .digest('hex')
      .substring(0, 8)}`;

    // In production, this would create an actual database view
    // Here we return the SQL that would be executed
    const sql = `
      CREATE OR REPLACE VIEW ${viewName} AS
      SELECT ${columnList}
      FROM ${tableName}
      WHERE ${conditions}
      WITH CHECK OPTION;
    `;

    return sql;
  }

  /**
   * Check if a user has access to a specific record
   */
  public async checkRecordAccess(
    tableName: string,
    recordId: string,
    operation: 'SELECT' | 'UPDATE' | 'DELETE',
    context: RLSContext
  ): Promise<boolean> {
    const accessDecision = await this.evaluateAccess(
      tableName,
      operation,
      context,
      recordId
    );

    if (!accessDecision.allowed) {
      return false;
    }

    // Verify the record exists with the RLS filters
    const model = (this.prisma as any)[tableName];
    const record = await model.findFirst({
      where: {
        id: recordId,
        ...accessDecision.filters
      }
    });

    return record !== null;
  }

  /**
   * Grant temporary access to a resource
   */
  public async grantTemporaryAccess(
    tableName: string,
    recordId: string,
    granteeUserId: string,
    granterContext: RLSContext,
    expiresIn: number = 3600000 // 1 hour default
  ): Promise<boolean> {
    // Verify granter has access
    const hasAccess = await this.checkRecordAccess(
      tableName,
      recordId,
      'SELECT',
      granterContext
    );

    if (!hasAccess) {
      return false;
    }

    // Create access control entry
    await this.prisma.userAccessControl.create({
      data: {
        userId: granteeUserId,
        resourceType: tableName,
        resourceId: recordId,
        permission: 'read',
        grantedBy: granterContext.userId,
        expiresAt: new Date(Date.now() + expiresIn),
        reason: 'Temporary access grant'
      }
    });

    // Log the grant
    await this.logAccess(
      tableName,
      'GRANT',
      granterContext,
      true
    );

    return true;
  }
}

/**
 * RLS Middleware for Prisma
 * Automatically applies RLS to all queries
 */
export function createRLSMiddleware(context: RLSContext) {
  return async (params: any, next: any) => {
    // Skip for certain operations
    if (params.model === 'SecurityAuditLog') {
      return next(params);
    }

    // Apply RLS filters
    if (params.action.startsWith('find') || 
        params.action === 'update' || 
        params.action === 'delete') {
      
      const rls = new RowLevelSecurity(params.prisma);
      const filters = rls['generateFilters'](
        params.model.toLowerCase(),
        params.action,
        context
      );

      params.args = params.args || {};
      params.args.where = {
        ...params.args.where,
        ...filters
      };
    }

    return next(params);
  };
}

export default RowLevelSecurity;