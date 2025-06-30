import express from 'express'
import { AdminAuthMiddleware, ADMIN_PERMISSIONS } from '../middleware/admin-auth'
import { AnalyticsService } from '../services/analytics.service'
// import { CalendarService } from '../services/calendar.service'
// import { EmailService } from '../services/email.service'
import { supabase } from '../config/database'

const router = express.Router()
const adminAuth = new AdminAuthMiddleware()
const analyticsService = new AnalyticsService()
// const calendarService = new CalendarService()
// const emailService = new EmailService()

// Auth routes
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    const result = await adminAuth.login({ email, password })
    if (!result.success) {
      return res.status(401).json({ error: result.message || 'Authentication failed' })
    }
    return res.json({ success: true, token: result.token, user: result.user })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Apply authentication middleware to all routes below
router.use(adminAuth.verifyToken)

// Get current admin profile
router.get('/profile', async (req, res) => {
  try {
    const profile = await adminAuth.getAdminProfile(req.admin!.id)
    res.json(profile)
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ error: 'Failed to get profile' })
  }
})

// Change password
router.post('/profile/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        error: 'Old password and new password are required'
      })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters long'
      })
    }

    const success = await adminAuth.changePassword(req.admin!.id, oldPassword, newPassword)
    
    if (!success) {
      return res.status(400).json({
        error: 'Invalid old password'
      })
    }

    return res.json({ success: true })

  } catch (error) {
    console.error('Change password error:', error)
    return res.status(500).json({ error: 'Failed to change password' })
  }
})

// Dashboard overview
router.get('/dashboard', adminAuth.requirePermission(ADMIN_PERMISSIONS.VIEW_ANALYTICS), async (req, res) => {
  try {
    let tenantId = req.query.tenantId as string
    
    // If user is tenant admin, use their tenant
    if (req.admin!.role === 'tenant_admin') {
      tenantId = req.admin!.tenantId!
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' })
    }

    const [analytics, realTimeDashboard] = await Promise.all([
      analyticsService.getTenantAnalytics(tenantId, '30d'),
      analyticsService.getRealTimeDashboard(tenantId)
    ])

    return res.json({
      analytics,
      realTime: realTimeDashboard
    })

  } catch (error) {
    console.error('Dashboard error:', error)
    return res.status(500).json({ error: 'Failed to load dashboard data' })
  }
})

// Tenant management routes (super admin only)
router.get('/tenants', adminAuth.requireSuperAdmin, async (req, res) => {
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select(`
        id, slug, business_name, email, phone, domain, status,
        created_at, subscription_plan,
        whatsapp_settings,
        ai_settings
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get tenant stats
    const tenantStats = await Promise.all(
      tenants.map(async (tenant) => {
        const [appointments, users] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, status')
            .eq('tenant_id', tenant.id)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
          supabase
            .from('user_tenants')
            .select('user_id')
            .eq('tenant_id', tenant.id)
        ])

        return {
          ...tenant,
          stats: {
            appointmentsLast30Days: appointments.data?.length || 0,
            totalUsers: users.data?.length || 0,
            confirmedAppointments: appointments.data?.filter(a => a.status === 'confirmed').length || 0
          }
        }
      })
    )

    res.json(tenantStats)

  } catch (error) {
    console.error('Get tenants error:', error)
    res.status(500).json({ error: 'Failed to get tenants' })
  }
})

router.get('/tenants/:tenantId', adminAuth.requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' })
    }

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select(`
        *,
        services (id, name, base_price, is_active),
        user_tenants (
          user_id,
          users (name, email, phone)
        )
      `)
      .eq('id', tenantId)
      .single()

    if (error) throw error

    return res.json(tenant)

  } catch (error) {
    console.error('Get tenant error:', error)
    return res.status(500).json({ error: 'Failed to get tenant' })
  }
})

router.put('/tenants/:tenantId', adminAuth.requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params
    const updateData = req.body

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' })
    }

    // Remove read-only fields
    delete updateData.id
    delete updateData.created_at
    delete updateData.slug

    const { data: tenant, error } = await supabase
      .from('tenants')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId)
      .select()
      .single()

    if (error) throw error

    return res.json(tenant)

  } catch (error) {
    console.error('Update tenant error:', error)
    return res.status(500).json({ error: 'Failed to update tenant' })
  }
})

// Analytics routes
router.get('/analytics/:tenantId', adminAuth.requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params
    const { period = '30d' } = req.query

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' })
    }

    const analytics = await analyticsService.getTenantAnalytics(tenantId, period as string)
    return res.json(analytics)

  } catch (error) {
    console.error('Analytics error:', error)
    return res.status(500).json({ error: 'Failed to get analytics' })
  }
})

router.get('/analytics/:tenantId/real-time', adminAuth.requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' })
    }

    const dashboard = await analyticsService.getRealTimeDashboard(tenantId)
    return res.json(dashboard)

  } catch (error) {
    console.error('Real-time analytics error:', error)
    return res.status(500).json({ error: 'Failed to get real-time data' })
  }
})

// Appointments management
router.get('/appointments/:tenantId', adminAuth.requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params
    const { 
      page = 1, 
      limit = 50, 
      status, 
      startDate, 
      endDate,
      serviceId 
    } = req.query

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' })
    }

    let query = supabase
      .from('appointments')
      .select(`
        id, start_time, end_time, status, quoted_price, final_price,
        customer_notes, created_at,
        services (name),
        users (name, phone, email)
      `)
      .eq('tenant_id', tenantId)

    const allowedStatus = [
      'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'
    ]
    if (status && typeof status === 'string' && allowedStatus.includes(status)) {
      query = query.eq('status', status as any)
    }

    if (startDate) {
      query = query.gte('start_time', startDate)
    }

    if (endDate) {
      query = query.lte('start_time', endDate)
    }

    const safeServiceId = serviceId ? String(serviceId) : ''
    if (safeServiceId) {
      query = query.eq('service_id', safeServiceId)
    }

    const { data: appointments, error, count } = await query
      .order('start_time', { ascending: false })
      .range((Number(page) - 1) * Number(limit), Number(page) * Number(limit) - 1)

    if (error) throw error

    return res.json({
      appointments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    })

  } catch (error) {
    console.error('Get appointments error:', error)
    return res.status(500).json({ error: 'Failed to get appointments' })
  }
})

router.put('/appointments/:appointmentId', adminAuth.requirePermission(ADMIN_PERMISSIONS.MANAGE_USERS), async (req, res) => {
  try {
    const { appointmentId } = req.params
    const { status, customer_notes, internal_notes } = req.body

    if (!appointmentId) {
      return res.status(400).json({ error: 'Appointment ID is required' })
    }

    const safeAppointmentId = String(appointmentId)

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update({
        status,
        customer_notes,
        internal_notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', safeAppointmentId)
      .select(`
        *,
        services (name),
        users (name, phone, email)
      `)
      .single()

    if (error) throw error

    // Update calendar if status changed
    if (status === 'cancelled') {
      // await calendarService.cancelCalendarEvent(appointment)
    } else {
      // await calendarService.updateCalendarEvent(appointment)
    }

    // Send notification email
    if (status === 'cancelled') {
      // await emailService.sendAppointmentCancellation(safeAppointmentId, internal_notes)
    }

    return res.json(appointment)

  } catch (error) {
    console.error('Update appointment error:', error)
    return res.status(500).json({ error: 'Failed to update appointment' })
  }
})

// Conversations management
router.get('/conversations/:tenantId', adminAuth.requirePermission(ADMIN_PERMISSIONS.VIEW_CONVERSATIONS), async (req, res) => {
  try {
    const { tenantId } = req.params
    const { page = 1, limit = 20, phoneNumber } = req.query

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' })
    }

    let query = supabase
      .from('conversation_history')
      .select('*')
      .eq('tenant_id', tenantId)

    const safePhoneNumber = phoneNumber ? String(phoneNumber) : ''
    if (safePhoneNumber) {
      query = query.eq('phone_number', safePhoneNumber)
    }

    const { data: conversations, error, count } = await query
      .order('created_at', { ascending: false })
      .range((Number(page) - 1) * Number(limit), Number(page) * Number(limit) - 1)

    if (error) throw error

    return res.json({
      conversations,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    })

  } catch (error) {
    console.error('Get conversations error:', error)
    return res.status(500).json({ error: 'Failed to get conversations' })
  }
})

// Users management
router.get('/users/:tenantId', adminAuth.requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params
    const { page = 1, limit = 50, search } = req.query

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' })
    }

    let query = supabase
      .from('users')
      .select(`
        id, name, email, phone, created_at,
        user_tenants!inner (
          tenant_id, total_bookings, first_interaction, last_interaction
        )
      `)
      .eq('user_tenants.tenant_id', tenantId)

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data: users, error, count } = await query
      .order('user_tenants.last_interaction', { ascending: false })
      .range((Number(page) - 1) * Number(limit), Number(page) * Number(limit) - 1)

    if (error) throw error

    return res.json({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    })

  } catch (error) {
    console.error('Get users error:', error)
    return res.status(500).json({ error: 'Failed to get users' })
  }
})

// Services management
router.get('/services/:tenantId', adminAuth.requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' })
    }

    const { data: services, error } = await supabase
      .from('services')
      .select(`
        *,
        service_categories (name)
      `)
      .eq('tenant_id', tenantId)
      .order('display_order')

    if (error) throw error

    return res.json(services)

  } catch (error) {
    console.error('Get services error:', error)
    return res.status(500).json({ error: 'Failed to get services' })
  }
})

router.post('/services/:tenantId', adminAuth.requireTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params
    const serviceData = req.body

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' })
    }

    const { data: service, error } = await supabase
      .from('services')
      .insert({
        ...serviceData,
        tenant_id: tenantId,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return res.status(201).json(service)

  } catch (error) {
    console.error('Create service error:', error)
    return res.status(500).json({ error: 'Failed to create service' })
  }
})

router.put('/services/:serviceId', adminAuth.requirePermission(ADMIN_PERMISSIONS.MANAGE_TENANTS), async (req, res) => {
  try {
    const { serviceId } = req.params
    const updateData = req.body

    if (!serviceId) {
      return res.status(400).json({ error: 'Service ID is required' })
    }

    delete updateData.id
    delete updateData.created_at
    delete updateData.tenant_id

    const { data: service, error } = await supabase
      .from('services')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', serviceId)
      .select()
      .single()

    if (error) throw error

    return res.json(service)

  } catch (error) {
    console.error('Update service error:', error)
    return res.status(500).json({ error: 'Failed to update service' })
  }
})

// System health and status
router.get('/system/health', adminAuth.requirePermission(ADMIN_PERMISSIONS.MANAGE_SYSTEM), async (req, res) => {
  try {
    const [calendarStatus, emailStatus] = await Promise.all([
      // calendarService.checkCalendarConflicts('test', new Date().toISOString(), new Date().toISOString()),
      // emailService.testConfiguration()
      Promise.resolve({ hasConflicts: false }),
      Promise.resolve({ success: true })
    ])

    return res.json({
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy' },
        calendar: { status: calendarStatus.hasConflicts ? 'error' : 'healthy' },
        email: { status: emailStatus.success ? 'healthy' : 'error' },
        ai: { status: process.env.OPENAI_API_KEY ? 'healthy' : 'error' },
        whatsapp: { status: process.env.WHATSAPP_TOKEN ? 'healthy' : 'error' }
      }
    })

  } catch (error) {
    console.error('Health check error:', error)
    return res.status(500).json({ error: 'Health check failed' })
  }
})

// Admin users management (super admin only)
router.get('/admin-users', adminAuth.requireSuperAdmin, async (req, res) => {
  try {
    const adminUsers = await adminAuth.listAdminUsers()
    return res.json(adminUsers)
  } catch (error) {
    console.error('Get admin users error:', error)
    return res.status(500).json({ error: 'Failed to get admin users' })
  }
})

router.post('/admin-users', adminAuth.requireSuperAdmin, async (req, res) => {
  try {
    const { email, password, name, role, tenantId, permissions } = req.body

    if (!email || !password || !name || !role) {
      return res.status(400).json({
        error: 'Email, password, name, and role are required'
      })
    }

    const adminUser = await adminAuth.createAdminUser({
      email,
      password,
      name,
      role,
      tenantId,
      permissions
    })

    if (!adminUser) {
      return res.status(400).json({
        error: 'Failed to create admin user'
      })
    }

    return res.status(201).json(adminUser)

  } catch (error) {
    console.error('Create admin user error:', error)
    return res.status(500).json({ error: 'Failed to create admin user' })
  }
})

router.delete('/admin-users/:adminId', adminAuth.requireSuperAdmin, async (req, res) => {
  try {
    const { adminId } = req.params

    if (!adminId) {
      return res.status(400).json({ error: 'Admin ID is required' })
    }

    if (adminId === req.admin!.id) {
      return res.status(400).json({
        error: 'Cannot deactivate your own account'
      })
    }

    const safeAdminId = String(adminId)

    const success = await adminAuth.deactivateAdminUser(safeAdminId)
    
    if (!success) {
      return res.status(400).json({
        error: 'Failed to deactivate admin user'
      })
    }

    return res.json({ success: true })

  } catch (error) {
    console.error('Deactivate admin user error:', error)
    return res.status(500).json({ error: 'Failed to deactivate admin user' })
  }
})

export default router