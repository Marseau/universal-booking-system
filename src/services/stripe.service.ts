import Stripe from 'stripe';
import { supabaseAdmin } from '@/config/database';
import { Database } from '@/types/database.types';
import { logger } from '@/utils/logger';

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
type TenantRow = Database['public']['Tables']['tenants']['Row'];

export interface PlanConfig {
  id: string;
  name: string;
  priceId: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  maxMessages: number;
  maxNumbers: number;
  trialDays: number;
}

export class StripeService {
  private stripe: Stripe;
  
  // Plan configurations
  private plans: Record<string, PlanConfig> = {
    starter: {
      id: 'starter',
      name: 'Starter',
      priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
      price: 9700, // R$ 97.00 in centavos
      currency: 'brl',
      interval: 'month',
      features: [
        'Até 1.000 mensagens/mês',
        '1 número WhatsApp',
        'IA especializada',
        'Google Calendar',
        'Email automático',
        'Dashboard básico'
      ],
      maxMessages: 1000,
      maxNumbers: 1,
      trialDays: 7
    },
    professional: {
      id: 'professional',
      name: 'Professional',
      priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || '',
      price: 19700, // R$ 197.00 in centavos
      currency: 'brl',
      interval: 'month',
      features: [
        'Até 5.000 mensagens/mês',
        '3 números WhatsApp',
        'IA especializada',
        'Google Calendar',
        'Email automático',
        'Dashboard avançado',
        'Analytics completo',
        'Suporte prioritário'
      ],
      maxMessages: 5000,
      maxNumbers: 3,
      trialDays: 7
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
      price: 39700, // R$ 397.00 in centavos
      currency: 'brl',
      interval: 'month',
      features: [
        'Mensagens ilimitadas',
        'Números ilimitados',
        'IA especializada',
        'Google Calendar',
        'Email automático',
        'Dashboard enterprise',
        'Analytics avançado',
        'API personalizada',
        'Suporte dedicado'
      ],
      maxMessages: -1, // Unlimited
      maxNumbers: -1, // Unlimited
      trialDays: 7
    }
  };

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
  }

  /**
   * Get all available plans
   */
  getPlans(): PlanConfig[] {
    return Object.values(this.plans);
  }

  /**
   * Get specific plan by ID
   */
  getPlan(planId: string): PlanConfig | null {
    return this.plans[planId] || null;
  }

  /**
   * Create Stripe customer
   */
  async createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          source: 'ubs_registration',
          ...metadata
        }
      });

      logger.info('Stripe customer created', { customerId: customer.id, email });
      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer', { error, email });
      throw new Error('Failed to create customer');
    }
  }

  /**
   * Create checkout session for subscription
   */
  async createCheckoutSession(
    planId: string,
    customerEmail: string,
    tenantId?: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<Stripe.Checkout.Session> {
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Invalid plan: ${planId}`);
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card', 'boleto'],
        customer_email: customerEmail,
        line_items: [
          {
            price: plan.priceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: plan.trialDays,
          metadata: {
            plan_id: planId,
            tenant_id: tenantId || '',
          },
        },
        metadata: {
          plan_id: planId,
          tenant_id: tenantId || '',
        },
        success_url: successUrl || `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/pricing`,
        locale: 'pt-BR',
        billing_address_collection: 'required',
        allow_promotion_codes: true,
      });

      logger.info('Checkout session created', { 
        sessionId: session.id, 
        planId, 
        customerEmail,
        tenantId 
      });

      return session;
    } catch (error) {
      logger.error('Failed to create checkout session', { error, planId, customerEmail });
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Create billing portal session
   */
  async createBillingPortalSession(customerId: string, returnUrl?: string): Promise<Stripe.BillingPortal.Session> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || `${process.env.FRONTEND_URL}/settings`,
      });

      logger.info('Billing portal session created', { customerId, sessionId: session.id });
      return session;
    } catch (error) {
      logger.error('Failed to create billing portal session', { error, customerId });
      throw new Error('Failed to create billing portal session');
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, reason?: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          cancellation_reason: reason || 'user_requested',
          cancelled_at: new Date().toISOString(),
        },
      });

      logger.info('Subscription cancelled', { subscriptionId, reason });
      return subscription;
    } catch (error) {
      logger.error('Failed to cancel subscription', { error, subscriptionId });
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Immediately cancel subscription
   */
  async cancelSubscriptionImmediately(subscriptionId: string, reason?: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId, {
        invoice_now: false,
        prorate: true,
      });

      logger.info('Subscription cancelled immediately', { subscriptionId, reason });
      return subscription;
    } catch (error) {
      logger.error('Failed to cancel subscription immediately', { error, subscriptionId });
      throw new Error('Failed to cancel subscription immediately');
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      logger.info('Subscription reactivated', { subscriptionId });
      return subscription;
    } catch (error) {
      logger.error('Failed to reactivate subscription', { error, subscriptionId });
      throw new Error('Failed to reactivate subscription');
    }
  }

  /**
   * Change subscription plan
   */
  async changeSubscriptionPlan(subscriptionId: string, newPlanId: string): Promise<Stripe.Subscription> {
    const newPlan = this.getPlan(newPlanId);
    if (!newPlan) {
      throw new Error(`Invalid plan: ${newPlanId}`);
    }

    try {
      // Get current subscription
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price'],
      });

      // Update subscription with new price
      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPlan.priceId,
          },
        ],
        proration_behavior: 'always_invoice',
        metadata: {
          ...subscription.metadata,
          plan_id: newPlanId,
          plan_changed_at: new Date().toISOString(),
        },
      });

      logger.info('Subscription plan changed', { subscriptionId, newPlanId });
      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to change subscription plan', { error, subscriptionId, newPlanId });
      throw new Error('Failed to change subscription plan');
    }
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['customer', 'items.data.price'],
      });
    } catch (error) {
      logger.error('Failed to get subscription', { error, subscriptionId });
      throw new Error('Failed to get subscription');
    }
  }

  /**
   * Get customer subscriptions
   */
  async getCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        expand: ['data.items.data.price'],
      });

      return subscriptions.data;
    } catch (error) {
      logger.error('Failed to get customer subscriptions', { error, customerId });
      throw new Error('Failed to get customer subscriptions');
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(body: string | Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      logger.error('Webhook signature verification failed', { error });
      throw new Error('Webhook signature verification failed');
    }

    logger.info('Processing Stripe webhook', { eventType: event.type, eventId: event.id });

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.info('Unhandled webhook event type', { eventType: event.type });
    }
  }

  /**
   * Handle checkout session completed
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    try {
      const { plan_id: planId, tenant_id: tenantId } = session.metadata || {};
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (!planId || !tenantId) {
        logger.error('Missing metadata in checkout session', { sessionId: session.id });
        return;
      }

      // Update tenant with subscription info
      await supabaseAdmin
        .from('tenants')
        .update({
          stripe_customer_id: customerId,
          subscription_id: subscriptionId,
          plan_id: planId,
          subscription_status: 'active',
          trial_ends_at: session.subscription 
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() 
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      // Create subscription record
      const subscriptionData: SubscriptionInsert = {
        tenant_id: tenantId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        plan_id: planId,
        status: 'trialing',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        trial_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await supabaseAdmin
        .from('subscriptions')
        .insert(subscriptionData);

      logger.info('Checkout completed and tenant updated', { tenantId, planId, subscriptionId });
    } catch (error) {
      logger.error('Failed to handle checkout completed', { error, sessionId: session.id });
    }
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const subscriptionUpdate = {
        status: subscription.status as Database['public']['Enums']['subscription_status'],
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_end: subscription.trial_end 
          ? new Date(subscription.trial_end * 1000).toISOString() 
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at 
          ? new Date(subscription.canceled_at * 1000).toISOString() 
          : null,
        updated_at: new Date().toISOString(),
      };

      // Update subscription record
      await supabaseAdmin
        .from('subscriptions')
        .update(subscriptionUpdate)
        .eq('stripe_subscription_id', subscription.id);

      // Update tenant status
      await supabaseAdmin
        .from('tenants')
        .update({
          subscription_status: subscription.status as Database['public']['Enums']['subscription_status'],
          updated_at: new Date().toISOString(),
        })
        .eq('subscription_id', subscription.id);

      logger.info('Subscription updated', { subscriptionId: subscription.id, status: subscription.status });
    } catch (error) {
      logger.error('Failed to handle subscription updated', { error, subscriptionId: subscription.id });
    }
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      // Update subscription record
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);

      // Update tenant status
      await supabaseAdmin
        .from('tenants')
        .update({
          subscription_status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('subscription_id', subscription.id);

      logger.info('Subscription deleted', { subscriptionId: subscription.id });
    } catch (error) {
      logger.error('Failed to handle subscription deleted', { error, subscriptionId: subscription.id });
    }
  }

  /**
   * Handle payment succeeded
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      const subscriptionId = invoice.subscription as string;
      
      if (subscriptionId) {
        // Record successful payment
        await supabaseAdmin
          .from('payment_history')
          .insert({
            subscription_id: subscriptionId,
            stripe_invoice_id: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: 'succeeded',
            paid_at: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
          });

        logger.info('Payment succeeded', { subscriptionId, invoiceId: invoice.id, amount: invoice.amount_paid });
      }
    } catch (error) {
      logger.error('Failed to handle payment succeeded', { error, invoiceId: invoice.id });
    }
  }

  /**
   * Handle payment failed
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      const subscriptionId = invoice.subscription as string;
      
      if (subscriptionId) {
        // Record failed payment
        await supabaseAdmin
          .from('payment_history')
          .insert({
            subscription_id: subscriptionId,
            stripe_invoice_id: invoice.id,
            amount: invoice.amount_due,
            currency: invoice.currency,
            status: 'failed',
            failed_at: new Date().toISOString(),
          });

        // Update tenant status if subscription is past due
        const subscription = await this.getSubscription(subscriptionId);
        if (subscription.status === 'past_due') {
          await supabaseAdmin
            .from('tenants')
            .update({
              subscription_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('subscription_id', subscriptionId);
        }

        logger.info('Payment failed', { subscriptionId, invoiceId: invoice.id, amount: invoice.amount_due });
      }
    } catch (error) {
      logger.error('Failed to handle payment failed', { error, invoiceId: invoice.id });
    }
  }
}

// Export singleton instance
export const stripeService = new StripeService();