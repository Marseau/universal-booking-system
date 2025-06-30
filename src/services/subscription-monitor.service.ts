import { supabaseAdmin } from '../config/database';
import { logger } from '../utils/logger';
import { Database } from '../types/database.types';

type TenantRow = Database['public']['Tables']['tenants']['Row'];

export interface SubscriptionAlert {
  id: string;
  tenantId: string;
  type: 'trial_ending' | 'trial_ended' | 'payment_failed' | 'subscription_expired' | 'usage_limit';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  daysRemaining?: number;
  actionRequired: boolean;
}

export class SubscriptionMonitorService {
  private isRunning: boolean = false;

  constructor() {
    // Simplified constructor
  }

  /**
   * Start subscription monitoring
   */
  public startMonitoring(): void {
    if (this.isRunning) {
      logger.warn('Subscription monitoring already running');
      return;
    }

    logger.info('Starting subscription monitoring service');
    this.isRunning = true;
    
    // Simplified monitoring without cron dependency
    logger.info('Subscription monitoring service started (simplified mode)');
  }

  /**
   * Stop subscription monitoring
   */
  public stopMonitoring(): void {
    if (!this.isRunning) {
      logger.warn('Subscription monitoring not running');
      return;
    }

    logger.info('Stopping subscription monitoring service');
    this.isRunning = false;
  }

  /**
   * Check trial subscriptions for expiration
   */
  private async checkTrialSubscriptions(): Promise<void> {
    try {
      logger.info('Checking trial subscriptions...');

      const { data: tenants, error } = await supabaseAdmin
        .from('tenants')
        .select('id, business_name, email, status, created_at')
        .eq('status', 'trial');

      if (error) {
        logger.error('Error fetching trial subscriptions', { error });
        return;
      }

      for (const tenant of tenants || []) {
        await this.processTrial(tenant as TenantRow);
      }

      logger.info(`Processed ${tenants?.length || 0} trial subscriptions`);

    } catch (error) {
      logger.error('Error in checkTrialSubscriptions', { error });
    }
  }

  /**
   * Process trial tenant
   */
  private async processTrial(tenant: TenantRow): Promise<void> {
    try {
      const trialStart = new Date(tenant.created_at || '');
      const trialEnd = new Date(trialStart);
      trialEnd.setDate(trialEnd.getDate() + 14); // 14 day trial

      const now = new Date();
      const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 0) {
        await this.handleTrialExpired(tenant);
      } else if (daysRemaining <= 3) {
        await this.handleTrialEnding(tenant, daysRemaining);
      }

    } catch (error) {
      logger.error('Error processing trial', { error, tenantId: tenant.id });
    }
  }

  /**
   * Handle trial ending
   */
  private async handleTrialEnding(tenant: TenantRow, daysRemaining: number): Promise<void> {
    const alert: SubscriptionAlert = {
      id: `trial_ending_${tenant.id}_${Date.now()}`,
      tenantId: tenant.id,
      type: 'trial_ending',
      severity: 'warning',
      title: 'Trial Ending Soon',
      message: `Your trial expires in ${daysRemaining} day(s). Please upgrade to continue using the service.`,
      daysRemaining,
      actionRequired: true
    };

    await this.createAlert(alert);
    logger.info('Trial ending alert created', { tenantId: tenant.id, daysRemaining });
  }

  /**
   * Handle trial expired
   */
  private async handleTrialExpired(tenant: TenantRow): Promise<void> {
    const alert: SubscriptionAlert = {
      id: `trial_expired_${tenant.id}_${Date.now()}`,
      tenantId: tenant.id,
      type: 'trial_ended',
      severity: 'critical',
      title: 'Trial Expired',
      message: 'Your trial has expired. Please upgrade to continue using the service.',
      actionRequired: true
    };

    await this.createAlert(alert);
    
    // Update tenant status
    await supabaseAdmin
      .from('tenants')
      .update({ status: 'expired' })
      .eq('id', tenant.id);

    logger.info('Trial expired - tenant suspended', { tenantId: tenant.id });
  }

  /**
   * Check active subscriptions for issues
   */
  private async checkActiveSubscriptions(): Promise<void> {
    try {
      logger.info('Checking active subscriptions...');

      const { data: tenants, error } = await supabaseAdmin
        .from('tenants')
        .select('id, business_name, email, status, subscription_plan')
        .in('status', ['active', 'past_due']);

      if (error) {
        logger.error('Error fetching active subscriptions', { error });
        return;
      }

      for (const tenant of tenants || []) {
        await this.processActiveSubscription(tenant as TenantRow);
      }

      logger.info(`Processed ${tenants?.length || 0} active subscriptions`);

    } catch (error) {
      logger.error('Error in checkActiveSubscriptions', { error });
    }
  }

  /**
   * Process active subscription
   */
  private async processActiveSubscription(tenant: TenantRow): Promise<void> {
    try {
      // Simplified active subscription processing
      if (tenant.status === 'past_due') {
        const alert: SubscriptionAlert = {
          id: `payment_failed_${tenant.id}_${Date.now()}`,
          tenantId: tenant.id,
          type: 'payment_failed',
          severity: 'critical',
          title: 'Payment Failed',
          message: 'Your payment failed. Please update your payment method.',
          actionRequired: true
        };

        await this.createAlert(alert);
        logger.info('Payment failed alert created', { tenantId: tenant.id });
      }

    } catch (error) {
      logger.error('Error processing active subscription', { error, tenantId: tenant.id });
    }
  }

  /**
   * Check usage limits
   */
  private async checkUsageLimits(): Promise<void> {
    try {
      logger.info('Checking usage limits...');

      const { data: tenants, error } = await supabaseAdmin
        .from('tenants')
        .select('id, business_name, subscription_plan, domain_config')
        .eq('status', 'active');

      if (error) {
        logger.error('Error fetching tenants for usage check', { error });
        return;
      }

      for (const tenant of tenants || []) {
        await this.processUsageLimit(tenant as TenantRow);
      }

      logger.info(`Processed usage limits for ${tenants?.length || 0} tenants`);

    } catch (error) {
      logger.error('Error in checkUsageLimits', { error });
    }
  }

  /**
   * Process usage limit for tenant
   */
  private async processUsageLimit(tenant: TenantRow): Promise<void> {
    try {
      // Get appointment count for current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: appointmentCount } = await supabaseAdmin
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .gte('created_at', startOfMonth.toISOString());

      // Define limits based on plan
      const limits = {
        basic: 100,
        pro: 500,
        enterprise: 2000
      };

      const planLimit = limits[tenant.subscription_plan as keyof typeof limits] || 100;
      const usagePercentage = ((appointmentCount || 0) / planLimit) * 100;

      if (usagePercentage >= 90) {
        const alert: SubscriptionAlert = {
          id: `usage_limit_${tenant.id}_${Date.now()}`,
          tenantId: tenant.id,
          type: 'usage_limit',
          severity: usagePercentage >= 100 ? 'critical' : 'warning',
          title: usagePercentage >= 100 ? 'Usage Limit Exceeded' : 'Usage Limit Warning',
          message: `You have used ${Math.round(usagePercentage)}% of your monthly appointment limit.`,
          actionRequired: usagePercentage >= 100
        };

        await this.createAlert(alert);
        logger.info('Usage limit alert created', { 
          tenantId: tenant.id, 
          usagePercentage,
          appointmentCount,
          planLimit 
        });
      }

    } catch (error) {
      logger.error('Error processing usage limit', { error, tenantId: tenant.id });
    }
  }

  /**
   * Create alert record
   */
  private async createAlert(alert: SubscriptionAlert): Promise<void> {
    try {
      // Store alert in email_logs table (simplified)
      await supabaseAdmin
        .from('email_logs')
        .insert({
          tenant_id: alert.tenantId,
          recipient_email: 'admin@system.com',
          subject: alert.title,
          template_name: alert.type,
          status: 'pending'
        });

      logger.info('Alert created', { alertId: alert.id, type: alert.type });

    } catch (error) {
      logger.error('Error creating alert', { error, alertId: alert.id });
    }
  }

  /**
   * Get alerts for tenant
   */
  public async getAlertsForTenant(tenantId: string): Promise<SubscriptionAlert[]> {
    try {
      const { data: logs, error } = await supabaseAdmin
        .from('email_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Error fetching alerts', { error, tenantId });
        return [];
      }

      // Convert email logs to alerts format
      return (logs || []).map(log => ({
        id: log.id,
        tenantId: log.tenant_id || '',
        type: (log.template_name as any) || 'info',
        severity: 'info' as any,
        title: log.subject || 'Alert',
        message: log.subject || '',
        actionRequired: false
      }));

    } catch (error) {
      logger.error('Error getting alerts for tenant', { error, tenantId });
      return [];
    }
  }

  /**
   * Get health summary
   */
  public async getHealthSummary(): Promise<any> {
    try {
      const { data: tenants, error } = await supabaseAdmin
        .from('tenants')
        .select('status')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const summary = {
        total: tenants?.length || 0,
        active: tenants?.filter(t => t.status === 'active').length || 0,
        trial: tenants?.filter(t => t.status === 'trial').length || 0,
        expired: tenants?.filter(t => t.status === 'expired').length || 0,
        suspended: tenants?.filter(t => t.status === 'suspended').length || 0
      };

      return summary;

    } catch (error) {
      logger.error('Error getting health summary', { error });
      return {
        total: 0,
        active: 0,
        trial: 0,
        expired: 0,
        suspended: 0
      };
    }
  }
}

// Export singleton instance
export const subscriptionMonitor = new SubscriptionMonitorService();