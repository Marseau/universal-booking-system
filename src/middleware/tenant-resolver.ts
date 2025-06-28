import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/database'

// Extend Request interface to include tenant
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: string
        slug: string
        domain: string
        business_name: string
      }
    }
  }
}

/**
 * Middleware para resolver tenant baseado em diferentes estratégias:
 * 1. Header X-Tenant-Slug
 * 2. Subdomain (tenant.domain.com)
 * 3. Query parameter (?tenant=slug)
 * 4. URL path (/tenants/:slug/...)
 */
export const resolveTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let tenantSlug: string | null = null

    // Strategy 1: Header
    tenantSlug = req.headers['x-tenant-slug'] as string || null

    // Strategy 2: Subdomain
    if (!tenantSlug) {
      const host = req.headers.host
      if (host && host.includes('.')) {
        const parts = host.split('.')
        if (parts.length > 2) {
          tenantSlug = parts[0] || null
        }
      }
    }

    // Strategy 3: Query parameter
    if (!tenantSlug) {
      tenantSlug = (req.query.tenant as string) || null
    }

    // Strategy 4: URL path
    if (!tenantSlug) {
      const pathMatch = req.path.match(/^\/tenants\/([^\/]+)/)
      if (pathMatch) {
        tenantSlug = pathMatch[1] || null
      }
    }

    if (!tenantSlug) {
      res.status(400).json({
        error: 'Tenant not specified',
        message: 'Please provide tenant via header X-Tenant-Slug, subdomain, query param, or URL path'
      })
      return
    }

    // Fetch tenant from database
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, slug, domain, business_name, status')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .single()

    if (error || !tenant) {
      res.status(404).json({
        error: 'Tenant not found',
        tenant_slug: tenantSlug
      })
      return
    }

    // Add tenant to request
    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      domain: tenant.domain,
      business_name: tenant.business_name
    }

    next()
  } catch (error) {
    console.error('Error resolving tenant:', error)
    res.status(500).json({
      error: 'Failed to resolve tenant',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Middleware opcional para resolver tenant (não falha se não encontrar)
 */
export const optionalTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Try to resolve tenant, but don't fail if not found
    await resolveTenant(req, res, () => {
      // Continue even if tenant resolution fails
      next()
    })
  } catch (error) {
    // Continue without tenant
    next()
  }
}

export default resolveTenant
