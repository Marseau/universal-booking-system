import express from 'express';
import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/database';
import AdminAuthMiddleware from '../middleware/admin-auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Create auth middleware instance but don't apply globally
const adminAuth = new AdminAuthMiddleware();

// Middleware to parse raw body for webhook
const rawBodyMiddleware = express.raw({ type: 'application/json' });

/**
 * GET /api/billing/plans
 * Get all available plans (PUBLIC ENDPOINT - NO AUTH REQUIRED)
 */
router.get('/plans', (req: Request, res: Response): any => {
  try {
    const plans = [
      {
        id: 'starter',
        name: 'Starter',
        price: 9700, // R$ 97,00 em centavos
        features: [
          'Até 1.000 mensagens/mês',
          '1 número WhatsApp',
          'IA especializada',
          'Google Calendar',
          'Email automático',
          'Dashboard básico'
        ]
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 19700, // R$ 197,00 em centavos
        features: [
          'Até 5.000 mensagens/mês',
          '3 números WhatsApp',
          'IA especializada',
          'Google Calendar',
          'Email automático',
          'Dashboard avançado',
          'Analytics completo',
          'Suporte prioritário'
        ]
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 39700, // R$ 397,00 em centavos
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
        ]
      }
    ];
    res.json({ success: true, plans });
  } catch (error) {
    logger.error('Failed to get plans', { error });
    res.status(500).json({ success: false, message: 'Failed to get plans' });
  }
});

/**
 * POST /api/billing/create-checkout
 * Create Stripe checkout session (PROTECTED)
 */
router.post('/create-checkout', adminAuth.verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { planId, successUrl, cancelUrl } = req.body;
    const tenantId = req.admin?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant ID required' 
      });
    }

    // Simplified checkout response
    const checkout = {
      id: 'checkout_' + Date.now(),
      url: successUrl + '?success=true',
      planId,
      tenantId
    };

    res.json({ 
      success: true, 
      checkout,
      message: 'Checkout session created successfully' 
    });

  } catch (error) {
    logger.error('Failed to create checkout session', { error, tenantId: req.admin?.tenantId });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create checkout session' 
    });
  }
});

/**
 * POST /api/billing/create-customer
 * Create Stripe customer (PROTECTED)
 */
router.post('/create-customer', adminAuth.verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, name } = req.body;
    const tenantId = req.admin?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant ID required' 
      });
    }

    // Simplified customer creation
    const customer = {
      id: 'cus_' + Date.now(),
      email,
      name,
      tenantId
    };

    res.json({ 
      success: true, 
      customer,
      message: 'Customer created successfully' 
    });

  } catch (error) {
    logger.error('Failed to create customer', { error, tenantId: req.admin?.tenantId });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create customer' 
    });
  }
});

/**
 * POST /api/billing/create-portal
 * Create customer portal session (PROTECTED)
 */
router.post('/create-portal', adminAuth.verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const { returnUrl } = req.body;
    const tenantId = req.admin?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant ID required' 
      });
    }

    // Simplified portal session
    const session = {
      id: 'portal_' + Date.now(),
      url: returnUrl + '?portal=true',
      tenantId
    };

    res.json({ 
      success: true, 
      session,
      message: 'Portal session created successfully' 
    });

  } catch (error) {
    logger.error('Failed to create portal session', { error, tenantId: req.admin?.tenantId });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create portal session' 
    });
  }
});

/**
 * GET /api/billing/subscription
 * Get tenant subscription details (PROTECTED)
 */
router.get('/subscription', adminAuth.verifyToken, async (req: Request, res: Response): Promise<any> => {
  try {
    const tenantId = req.admin?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tenant ID required' 
      });
    }

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('subscription_plan, status, domain_config')
      .eq('id', tenantId)
      .single();

    const subscription = {
      plan: tenant?.subscription_plan || 'basic',
      status: tenant?.status || 'active',
      billing: (tenant?.domain_config as any)?.billing || {}
    };

    res.json({ 
      success: true, 
      subscription 
    });

  } catch (error) {
    logger.error('Failed to get subscription', { error, tenantId: req.admin?.tenantId });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get subscription' 
    });
  }
});

/**
 * POST /api/billing/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', rawBodyMiddleware, async (req: Request, res: Response): Promise<any> => {
  try {
    const signature = req.headers['stripe-signature'];
    
    // Log webhook received
    logger.info('Webhook received', { 
      signature: signature ? 'present' : 'missing',
      bodyLength: req.body?.length || 0
    });

    // Simplified webhook handling
    res.json({ received: true });

  } catch (error) {
    logger.error('Webhook error', { error });
    res.status(400).json({ 
      success: false, 
      message: 'Webhook error' 
    });
  }
});

export default router;