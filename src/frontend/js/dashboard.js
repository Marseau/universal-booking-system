// Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.apiUrl = '/api/admin'
        this.token = localStorage.getItem('adminToken')
        this.currentUser = null
        this.currentTenant = null
        this.charts = {}
        
        this.init()
    }

    async init() {
        // Check if user is logged in
        if (this.token) {
            await this.loadUserProfile()
        } else {
            this.showLogin()
        }

        this.bindEvents()
    }

    bindEvents() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault()
            this.login()
        })

        // Navigation
        document.querySelectorAll('.nav-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault()
                this.navigateTo(link.dataset.page)
            })
        })

        // Chart period change
        document.querySelectorAll('input[name="chartPeriod"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.loadDashboardData(radio.value)
            })
        })
    }

    // Authentication
    async login() {
        const email = document.getElementById('email').value
        const password = document.getElementById('password').value
        const errorDiv = document.getElementById('loginError')

        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            })

            const data = await response.json()

            if (data.success) {
                this.token = data.token
                this.currentUser = data.user
                localStorage.setItem('adminToken', this.token)
                
                this.showDashboard()
                this.loadDashboardData()
            } else {
                errorDiv.textContent = data.error || 'Login failed'
                errorDiv.style.display = 'block'
            }
        } catch (error) {
            errorDiv.textContent = 'Erro de conexão'
            errorDiv.style.display = 'block'
        }
    }

    async loadUserProfile() {
        try {
            const response = await this.apiCall('/profile')
            this.currentUser = response
            
            document.getElementById('adminName').textContent = this.currentUser.name
            
            // Show tenant-specific UI
            if (this.currentUser.role === 'super_admin') {
                document.getElementById('tenantsMenuItem').style.display = 'block'
            }

            this.showDashboard()
            this.loadDashboardData()
        } catch (error) {
            this.showLogin()
        }
    }

    logout() {
        localStorage.removeItem('adminToken')
        this.token = null
        this.currentUser = null
        this.showLogin()
    }

    // UI Navigation
    showLogin() {
        document.getElementById('loginScreen').style.display = 'flex'
        document.getElementById('dashboardScreen').style.display = 'none'
    }

    showDashboard() {
        document.getElementById('loginScreen').style.display = 'none'
        document.getElementById('dashboardScreen').style.display = 'block'
    }

    navigateTo(page) {
        // Update active nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active')
        })
        document.querySelector(`[data-page="${page}"]`).classList.add('active')

        // Hide all pages
        document.querySelectorAll('.page-content').forEach(pageDiv => {
            pageDiv.style.display = 'none'
        })

        // Show selected page
        document.getElementById(`${page}Page`).style.display = 'block'
        
        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            appointments: 'Agendamentos',
            users: 'Clientes',
            services: 'Serviços',
            conversations: 'Conversas',
            analytics: 'Analytics',
            tenants: 'Empresas',
            settings: 'Configurações'
        }
        document.getElementById('pageTitle').textContent = titles[page] || page

        // Load page data
        this.loadPageData(page)
    }

    async loadPageData(page) {
        switch (page) {
            case 'dashboard':
                await this.loadDashboardData()
                break
            case 'appointments':
                await this.loadAppointments()
                break
            case 'users':
                await this.loadUsers()
                break
            case 'services':
                await this.loadServices()
                break
            case 'conversations':
                await this.loadConversations()
                break
            case 'analytics':
                await this.loadAnalytics()
                break
            case 'tenants':
                await this.loadTenants()
                break
        }
    }

    // Dashboard Data Loading
    async loadDashboardData(period = '30d') {
        try {
            const tenantParam = this.currentUser.role === 'tenant_admin' 
                ? '' 
                : '?tenantId=' + (this.currentTenant || 'default')

            const response = await this.apiCall(`/dashboard${tenantParam}`)
            
            this.updateStatsCards(response.analytics)
            this.updateCharts(response.analytics, period)
            this.updateTodayAppointments(response.realTime.todayAppointments)
            
        } catch (error) {
            this.showNotification('Erro ao carregar dados do dashboard', 'error')
        }
    }

    updateStatsCards(analytics) {
        // Total appointments
        document.getElementById('totalAppointments').textContent = 
            analytics.appointments.total.toLocaleString()
        
        const appointmentsGrowth = analytics.appointments.growthRate
        const appointmentsGrowthEl = document.getElementById('appointmentsGrowth')
        appointmentsGrowthEl.textContent = `${appointmentsGrowth >= 0 ? '+' : ''}${appointmentsGrowth.toFixed(1)}%`
        appointmentsGrowthEl.className = `metric-growth ${appointmentsGrowth >= 0 ? 'positive' : 'negative'}`

        // Revenue
        document.getElementById('totalRevenue').textContent = 
            'R$ ' + analytics.revenue.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        
        const revenueGrowth = analytics.revenue.revenueGrowth
        const revenueGrowthEl = document.getElementById('revenueGrowth')
        revenueGrowthEl.textContent = `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%`
        revenueGrowthEl.className = `metric-growth ${revenueGrowth >= 0 ? 'positive' : 'negative'}`

        // New customers
        document.getElementById('newCustomers').textContent = 
            analytics.customers.newCustomers.toLocaleString()
        
        const customersGrowth = analytics.customers.customerGrowth
        const customersGrowthEl = document.getElementById('customersGrowth')
        customersGrowthEl.textContent = `${customersGrowth >= 0 ? '+' : ''}${customersGrowth.toFixed(1)}%`
        customersGrowthEl.className = `metric-growth ${customersGrowth >= 0 ? 'positive' : 'negative'}`

        // AI Accuracy
        document.getElementById('aiAccuracy').textContent = 
            analytics.ai.intentAccuracy.toFixed(1) + '%'
        
        document.getElementById('aiGrowth').textContent = 
            `${analytics.ai.aiBookings} agendamentos`
    }

    updateCharts(analytics, period) {
        this.updateAppointmentsChart(analytics.appointments.dailyStats)
        this.updateStatusChart(analytics.appointments.statusDistribution)
    }

    updateAppointmentsChart(dailyStats) {
        const ctx = document.getElementById('appointmentsChart').getContext('2d')
        
        if (this.charts.appointments) {
            this.charts.appointments.destroy()
        }

        this.charts.appointments = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyStats.map(stat => {
                    const date = new Date(stat.date)
                    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                }),
                datasets: [{
                    label: 'Agendamentos',
                    data: dailyStats.map(stat => stat.count),
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    }
                }
            }
        })
    }

    updateStatusChart(statusDistribution) {
        const ctx = document.getElementById('statusChart').getContext('2d')
        
        if (this.charts.status) {
            this.charts.status.destroy()
        }

        const data = Object.entries(statusDistribution)
        
        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(([status]) => this.getStatusLabel(status)),
                datasets: [{
                    data: data.map(([, count]) => count),
                    backgroundColor: [
                        '#198754', // confirmed
                        '#0dcaf0', // completed  
                        '#ffc107', // pending
                        '#dc3545', // cancelled
                        '#fd7e14'  // no_show
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        })
    }

    updateTodayAppointments(appointments) {
        const tbody = document.getElementById('todayAppointments')
        
        if (!appointments || appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum agendamento para hoje</td></tr>'
            return
        }

        tbody.innerHTML = appointments.map(apt => `
            <tr>
                <td>
                    <strong>${new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
                    <br>
                    <small class="text-muted">${new Date(apt.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
                </td>
                <td>
                    <div>${apt.users?.name || 'N/A'}</div>
                    <small class="text-muted">${apt.users?.phone || ''}</small>
                </td>
                <td>${apt.services?.name || 'N/A'}</td>
                <td>
                    <span class="badge ${this.getStatusBadgeClass(apt.status)} status-badge ${apt.status}">
                        ${this.getStatusLabel(apt.status)}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="dashboard.viewAppointment('${apt.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="dashboard.editAppointment('${apt.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('')
    }

    // Placeholder methods for other pages
    async loadAppointments() {
        // TODO: Implement appointments loading
        console.log('Loading appointments...')
    }

    async loadUsers() {
        // TODO: Implement users loading  
        console.log('Loading users...')
    }

    async loadServices() {
        // TODO: Implement services loading
        console.log('Loading services...')
    }

    async loadConversations() {
        // TODO: Implement conversations loading
        console.log('Loading conversations...')
    }

    async loadAnalytics() {
        // TODO: Implement analytics loading
        console.log('Loading analytics...')
    }

    async loadTenants() {
        // TODO: Implement tenants loading
        console.log('Loading tenants...')
    }

    // Utility Methods
    async apiCall(endpoint, options = {}) {
        const url = this.apiUrl + endpoint
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            ...options
        }

        const response = await fetch(url, config)
        
        if (response.status === 401) {
            this.logout()
            throw new Error('Unauthorized')
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        return await response.json()
    }

    getStatusLabel(status) {
        const labels = {
            'confirmed': 'Confirmado',
            'pending': 'Pendente',
            'cancelled': 'Cancelado',
            'completed': 'Concluído',
            'no_show': 'Não compareceu'
        }
        return labels[status] || status
    }

    getStatusBadgeClass(status) {
        const classes = {
            'confirmed': 'bg-success',
            'pending': 'bg-warning',
            'cancelled': 'bg-danger',
            'completed': 'bg-info',
            'no_show': 'bg-secondary'
        }
        return classes[status] || 'bg-secondary'
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div')
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show notification`
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `
        
        document.body.appendChild(notification)
        
        setTimeout(() => {
            notification.remove()
        }, 5000)
    }

    // Action Methods
    viewAppointment(appointmentId) {
        // TODO: Implement view appointment
        console.log('View appointment:', appointmentId)
        this.showNotification(`Visualizando agendamento ${appointmentId}`)
    }

    editAppointment(appointmentId) {
        // TODO: Implement edit appointment
        console.log('Edit appointment:', appointmentId)
        this.showNotification(`Editando agendamento ${appointmentId}`)
    }

    // UI Helpers
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar')
        const mainContent = document.querySelector('.main-content')
        
        sidebar.classList.toggle('collapsed')
        mainContent.classList.toggle('expanded')
    }
}

// Global functions
function logout() {
    window.dashboard.logout()
}

function toggleSidebar() {
    window.dashboard.toggleSidebar()
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AdminDashboard()
})