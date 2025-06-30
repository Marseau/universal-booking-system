import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { supabase } from '../config/database'

// Extend Express Request type to include admin user
declare global {
  namespace Express {
    interface Request {
      admin?: AdminUser
      tenantId?: string
    }
  }
}

interface AdminUser {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'tenant_admin' | 'support'
  tenantId?: string
  permissions: string[]
}

interface LoginCredentials {
  email: string
  password: string
}

export class AdminAuthMiddleware {
  private jwtSecret: string

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key'
  }

  /**
   * Authenticate admin user with email/password
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      const { email, password } = credentials

      // Get admin user from database
      const { data: admin, error } = await supabase
        .from('admin_users')
        .select(`
          id, email, name, password_hash, role, tenant_id, is_active,
          admin_permissions (permission)
        `)
        .eq('email', email.toLowerCase())
        .eq('is_active', true)
        .single()

      if (error || !admin) {
        return {
          success: false,
          message: 'Invalid credentials'
        }
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, admin.password_hash)
      if (!isValidPassword) {
        return {
          success: false,
          message: 'Invalid credentials'
        }
      }

      // Get user permissions
      const permissions = admin.admin_permissions?.map((p: any) => p.permission) || []

      // Generate JWT token
      const token = jwt.sign(
        {
          id: admin.id,
          email: admin.email,
          role: admin.role as 'super_admin' | 'tenant_admin' | 'support',
          tenantId: admin.tenant_id || undefined
        },
        this.jwtSecret,
        { expiresIn: '24h' }
      )

      // Update last login
      await supabase
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', admin.id)

      return {
        success: true,
        token,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role as 'super_admin' | 'tenant_admin' | 'support',
          tenantId: admin.tenant_id || undefined || undefined,
          permissions
        }
      }

    } catch (error) {
      console.error('Login error:', error)
      return {
        success: false,
        message: 'Authentication failed'
      }
    }
  }

  /**
   * Middleware to verify JWT token
   */
  verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const authHeader = req.headers.authorization
      const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

      if (!token) {
        return res.status(401).json({
          error: 'Access token required',
          code: 'NO_TOKEN'
        })
      }

      // Verify JWT
      const decoded = jwt.verify(token, this.jwtSecret) as any

      // Get current admin user with permissions
      const { data: admin, error } = await supabase
        .from('admin_users')
        .select(`
          id, email, name, role, tenant_id, is_active,
          admin_permissions (permission)
        `)
        .eq('id', decoded.id)
        .eq('is_active', true)
        .single()

      if (error || !admin) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        })
      }

      // Add admin user to request
      req.admin = {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role as 'super_admin' | 'tenant_admin' | 'support',
        tenantId: admin.tenant_id || undefined,
        permissions: admin.admin_permissions?.map((p: any) => p.permission) || []
      }

      // Set tenant context if user is tenant admin
      if (admin.tenant_id) {
        req.tenantId = admin.tenant_id || undefined
      }

      next()

    } catch (error) {
      console.error('Token verification error:', error)
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'TOKEN_VERIFICATION_FAILED'
      })
    }
  }

  /**
   * Middleware to check if user has super admin role
   */
  requireSuperAdmin = (req: Request, res: Response, next: NextFunction): any => {
    if (!req.admin || req.admin.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Super admin access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      })
    }
    next()
  }

  /**
   * Middleware to check if user has specific permission
   */
  requirePermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.admin) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'NO_AUTH'
        })
      }

      // Super admins have all permissions
      if (req.admin.role === 'super_admin') {
        return next()
      }

      // Check if user has specific permission
      if (!req.admin.permissions.includes(permission)) {
        return res.status(403).json({
          error: `Permission required: ${permission}`,
          code: 'INSUFFICIENT_PERMISSIONS'
        })
      }

      next()
    }
  }

  /**
   * Middleware to check tenant access
   */
  requireTenantAccess = (req: Request, res: Response, next: NextFunction) => {
    const requestedTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId

    if (!req.admin) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_AUTH'
      })
    }

    // Super admins can access any tenant
    if (req.admin.role === 'super_admin') {
      return next()
    }

    // Tenant admins can only access their own tenant
    if (req.admin.role === 'tenant_admin') {
      if (!req.admin.tenantId || req.admin.tenantId !== requestedTenantId) {
        return res.status(403).json({
          error: 'Tenant access denied',
          code: 'TENANT_ACCESS_DENIED'
        })
      }
    }

    next()
  }

  /**
   * Create new admin user (super admin only)
   */
  async createAdminUser(userData: CreateAdminUserData): Promise<AdminUser | null> {
    try {
      const { email, password, name, role, tenantId, permissions } = userData

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12)

      // Create admin user
      const { data: admin, error } = await supabase
        .from('admin_users')
        .insert({
          email: email.toLowerCase(),
          password_hash: passwordHash,
          name,
          role,
          tenant_id: tenantId,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      // Add permissions
      if (permissions && permissions.length > 0) {
        const permissionInserts = permissions.map(permission => ({
          admin_user_id: admin.id,
          permission
        }))

        await supabase
          .from('admin_permissions')
          .insert(permissionInserts)
      }

      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role as 'super_admin' | 'tenant_admin' | 'support',
        tenantId: admin.tenant_id || undefined,
        permissions: permissions || []
      }

    } catch (error) {
      console.error('Failed to create admin user:', error)
      return null
    }
  }

  /**
   * Change admin password
   */
  async changePassword(adminId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Get current password hash
      const { data: admin, error } = await supabase
        .from('admin_users')
        .select('password_hash')
        .eq('id', adminId)
        .single()

      if (error || !admin) {
        return false
      }

      // Verify old password
      const isValidOldPassword = await bcrypt.compare(oldPassword, admin.password_hash)
      if (!isValidOldPassword) {
        return false
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12)

      // Update password
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ 
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminId)

      return !updateError

    } catch (error) {
      console.error('Failed to change password:', error)
      return false
    }
  }

  /**
   * Get admin user profile
   */
  async getAdminProfile(adminId: string): Promise<AdminUser | null> {
    try {
      const { data: admin, error } = await supabase
        .from('admin_users')
        .select(`
          id, email, name, role, tenant_id, last_login_at, created_at,
          admin_permissions (permission)
        `)
        .eq('id', adminId)
        .eq('is_active', true)
        .single()

      if (error || !admin) {
        return null
      }

      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role as 'super_admin' | 'tenant_admin' | 'support',
        tenantId: admin.tenant_id || undefined,
        permissions: admin.admin_permissions?.map((p: any) => p.permission) || []
      }

    } catch (error) {
      console.error('Failed to get admin profile:', error)
      return null
    }
  }

  /**
   * List all admin users (super admin only)
   */
  async listAdminUsers(): Promise<AdminUser[]> {
    try {
      const { data: admins, error } = await supabase
        .from('admin_users')
        .select(`
          id, email, name, role, tenant_id, last_login_at, created_at, is_active,
          admin_permissions (permission)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return admins.map(admin => ({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role as 'super_admin' | 'tenant_admin' | 'support',
        tenantId: admin.tenant_id || undefined,
        permissions: admin.admin_permissions?.map((p: any) => p.permission) || []
      }))

    } catch (error) {
      console.error('Failed to list admin users:', error)
      return []
    }
  }

  /**
   * Deactivate admin user
   */
  async deactivateAdminUser(adminId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminId)

      return !error

    } catch (error) {
      console.error('Failed to deactivate admin user:', error)
      return false
    }
  }
}

// Types
interface AuthResult {
  success: boolean
  token?: string
  user?: AdminUser
  message?: string
}

interface CreateAdminUserData {
  email: string
  password: string
  name: string
  role: 'super_admin' | 'tenant_admin' | 'support'
  tenantId?: string
  permissions?: string[]
}

// Available permissions
export const ADMIN_PERMISSIONS = {
  // Tenant management
  MANAGE_TENANTS: 'manage_tenants',
  VIEW_TENANTS: 'view_tenants',
  
  // User management
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  
  // Analytics
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_DATA: 'export_data',
  
  // System
  MANAGE_SYSTEM: 'manage_system',
  VIEW_LOGS: 'view_logs',
  
  // AI & WhatsApp
  MANAGE_AI_SETTINGS: 'manage_ai_settings',
  VIEW_CONVERSATIONS: 'view_conversations',
  
  // Billing & Support
  MANAGE_BILLING: 'manage_billing',
  PROVIDE_SUPPORT: 'provide_support'
} as const

export default AdminAuthMiddleware