import express from 'express'
import { supabase, bypassRLS } from '../config/database'
import { resolveTenant } from '../middleware/tenant-resolver'
import { BusinessDomain } from '../types/database.types'

const router = express.Router()

/**
 * GET /api/tenants
 * Lista todos os tenants (admin only)
 */
router.get('/', async (req, res) => {
  try {
    await bypassRLS()
    
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select(`
        id,
        slug, 
        business_name,
        domain,
        email,
        phone,
        status,
        subscription_plan,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({
      tenants,
      total: tenants?.length || 0
    })
  } catch (error) {
    console.error('Error fetching tenants:', error)
    res.status(500).json({
      error: 'Failed to fetch tenants',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/tenants/:slug
 * Obter detalhes de um tenant específico
 */
router.get('/:slug', resolveTenant, async (req, res) => {
  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', req.tenant!.id)
      .single()

    if (error) throw error

    res.json({ tenant })
  } catch (error) {
    console.error('Error fetching tenant:', error)
    res.status(500).json({
      error: 'Failed to fetch tenant',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * POST /api/tenants
 * Criar novo tenant
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      slug,
      domain,
      email,
      phone,
      whatsapp_phone,
      business_name,
      business_description,
      domain_config = {},
      ai_settings = {},
      business_rules = {}
    } = req.body

    // Validação básica
    if (!name || !slug || !domain || !email || !phone || !business_name) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'slug', 'domain', 'email', 'phone', 'business_name']
      })
    }

    // Validar domain enum
    const validDomains: BusinessDomain[] = ['legal', 'healthcare', 'education', 'beauty', 'sports', 'consulting', 'other']
    if (!validDomains.includes(domain)) {
      return res.status(400).json({
        error: 'Invalid domain',
        valid_domains: validDomains
      })
    }

    await bypassRLS()

    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        name,
        slug,
        domain,
        email,
        phone,
        whatsapp_phone,
        business_name,
        business_description,
        domain_config,
        ai_settings,
        business_rules,
        status: 'active',
        subscription_plan: 'free'
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'Tenant already exists',
          message: 'Slug, email or phone already in use'
        })
      }
      throw error
    }

    res.status(201).json({
      message: 'Tenant created successfully',
      tenant
    })
  } catch (error) {
    console.error('Error creating tenant:', error)
    res.status(500).json({
      error: 'Failed to create tenant',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * PUT /api/tenants/:slug
 * Atualizar tenant existente
 */
router.put('/:slug', resolveTenant, async (req, res) => {
  try {
    const {
      name,
      business_name,
      business_description,
      domain_config,
      ai_settings,
      business_rules,
      phone,
      whatsapp_phone
    } = req.body

    const { data: tenant, error } = await supabase
      .from('tenants')
      .update({
        ...(name && { name }),
        ...(business_name && { business_name }),
        ...(business_description && { business_description }),
        ...(domain_config && { domain_config }),
        ...(ai_settings && { ai_settings }),
        ...(business_rules && { business_rules }),
        ...(phone && { phone }),
        ...(whatsapp_phone && { whatsapp_phone }),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.tenant!.id)
      .select()
      .single()

    if (error) throw error

    res.json({
      message: 'Tenant updated successfully',
      tenant
    })
  } catch (error) {
    console.error('Error updating tenant:', error)
    res.status(500).json({
      error: 'Failed to update tenant',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * GET /api/tenants/:slug/services
 * Listar serviços do tenant
 */
router.get('/:slug/services', resolveTenant, async (req, res) => {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select(`
        *,
        service_categories (
          id,
          name,
          description
        )
      `)
      .eq('tenant_id', req.tenant!.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) throw error

    res.json({
      services,
      tenant: req.tenant
    })
  } catch (error) {
    console.error('Error fetching services:', error)
    res.status(500).json({
      error: 'Failed to fetch services',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router
