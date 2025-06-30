# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
```bash
npm run dev           # Start development server with hot reload
npm run build         # Compile TypeScript to dist/
npm run start         # Run production build
npm run setup         # Install dependencies and build
```

### Code Quality
```bash
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix linting issues
npm run format        # Prettier formatting
```

### Testing & AI System
```bash
npm run test:ai              # Run AI system test scenarios
npm run test:ai-full         # Run comprehensive AI tests
npm run test:whatsapp        # Test WhatsApp integration
npm run test:action-executor # Test function execution service
npm run test:intent-recognition # Test intent classification
npm run test:multimodal      # Test image/audio processing
npm run test:stress          # Stress test with multiple messages
npm run test:all             # Run all AI tests
```

### Database & Deployment
```bash
npm run db:migrate    # Run database migrations
npm run db:seed       # Seed database with test data
npm run logs         # View application logs
npm run deploy       # Build and push to production
```

## Architecture Overview

### Multi-Tenant SaaS Platform
This is a universal booking system that serves multiple business tenants through a single codebase. Each tenant can operate in different business domains (legal, healthcare, education, beauty, sports, consulting) with specialized AI agents.

**Key Architecture Principles:**
- **Row Level Security (RLS)**: All database queries are tenant-scoped via Supabase RLS policies
- **Domain-Driven Design**: Each business domain has specialized AI agents with domain-specific logic
- **Multi-Modal AI**: Supports text, images, audio, and document processing via OpenAI APIs
- **Intent-Based Routing**: Messages are classified by intent and routed to appropriate domain agents

### Core System Components

#### 1. AI Agent System (`src/services/agents/`)
- **Agent Factory** (`agent-factory.ts`): Creates appropriate agent instances based on business domain
- **Specialized Agents**: Each domain has a dedicated agent class:
  - `healthcare-agent.ts`: Mental health crisis detection, therapy booking
  - `beauty-agent.ts`: Salon services, consultation booking
  - `legal-agent.ts`: Legal consultation, case urgency assessment
  - `education-agent.ts`: Tutoring, academic assessment
  - `sports-agent.ts`: Fitness coaching, workout planning
  - `consulting-agent.ts`: Business consulting, strategic planning
  - `general-agent.ts`: Fallback for unspecialized domains

#### 2. WhatsApp Business API Integration
- **Webhook Processing**: Handles incoming WhatsApp messages via `/api/whatsapp/webhook`
- **Message Routing**: Multi-tenant message routing based on phone number mapping
- **Media Support**: Images, audio, documents processed through multi-modal AI
- **Template Management**: WhatsApp Business template messages stored per tenant

#### 3. AI Service Layer (`src/services/`)
- **Memory Service** (`memory.service.ts`): Session-based conversation context management
- **Intent Router** (`intent-router.service.ts`): GPT-4 powered intent classification
- **Function Executor** (`function-executor.service.ts`): Rate-limited AI function calling
- **Media Processor** (`media-processor.service.ts`): GPT-4 Vision + Whisper integration
- **AI Testing** (`ai-testing.service.ts`): Comprehensive testing framework for AI scenarios

#### 4. Database Schema (Supabase PostgreSQL)
**Core Tables:**
- `tenants`: Business configuration, domain settings, AI personality
- `users`: Cross-tenant user profiles with phone number as primary identifier
- `appointments`: Booking records with flexible appointment_data JSON field
- `services`: Configurable service offerings per tenant
- `conversation_history`: Complete WhatsApp conversation logs with AI context
- `conversation_states`: Stateful conversation management per user/tenant
- `whatsapp_media`: Media file tracking and processing status

**Multi-Tenancy:**
- All tables include `tenant_id` foreign key
- RLS policies enforce tenant isolation
- Users can interact with multiple tenants via `user_tenants` junction table

### Type System Architecture

#### Core AI Types (`src/types/ai.types.ts`)
- **ConversationContext**: Complete conversation state including history, user profile, tenant config
- **AIAgent**: Agent configuration with functions, capabilities, and domain specialization
- **Intent & Entity**: NLP classification results with confidence scores
- **FunctionResult**: Standardized response format for AI function calls
- **MemoryManager**: Session and long-term memory interface for conversation context

#### Domain-Specific Contexts
Each business domain extends the base conversation context:
- `LegalContext`: Case types, urgency levels, document requirements
- `HealthcareContext`: Crisis detection, session types, treatment plans
- `BeautyContext`: Service categories, skin types, professional preferences
- `EducationContext`: Subjects, learning levels, session formats
- `SportsContext`: Activities, skill levels, fitness goals
- `ConsultingContext`: Business stages, industry types, consultation areas

### Environment Configuration

**Required Environment Variables:**
```bash
# Database
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# WhatsApp Business API
WHATSAPP_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token

# AI Services
OPENAI_API_KEY=your_openai_api_key
```

See `.env.example` for complete configuration options.

## Development Patterns

### Adding New Business Domains
1. Add domain to `business_domain` enum in database schema
2. Create specialized agent class in `src/services/agents/`
3. Define domain-specific context type in `ai.types.ts`
4. Update `AgentFactory` to handle new domain
5. Add test scenarios in `AITestingService`

### AI Function Development
All AI functions must implement the `AIFunction` interface:
```typescript
interface AIFunction {
  name: string
  description: string
  parameters: FunctionParameter[]
  handler: (args: any, context: ConversationContext) => Promise<FunctionResult>
}
```

Functions should be rate-limited, validated, and return structured `FunctionResult` objects.

### Conversation State Management
- Use `MemoryService` for session-based context storage
- Store conversation history in `conversation_history` table
- Maintain stateful conversations via `conversation_states` table
- Context includes user profile, tenant config, and domain-specific data

### Multi-Modal Processing
- Images: Processed via GPT-4 Vision for content analysis
- Audio: Transcribed via Whisper API
- Documents: Text extraction for AI processing
- All media stored in `whatsapp_media` table with processing results

### Testing AI Scenarios
Use `AITestingService` to test conversation flows:
- Domain-specific test scenarios in `getTestScenarios()`
- Intent accuracy measurement
- Function call validation
- Response quality assessment
- Performance metrics tracking

Run `npm run test:ai-full` for comprehensive AI system validation.

## External Integrations

### Google Calendar Integration (`calendar.service.ts`)
- **Bi-directional sync** with Google Calendar API
- **Event management**: Create, update, cancel calendar events for appointments
- **Conflict detection**: Check for scheduling conflicts before booking
- **Available slots**: Generate available time slots based on calendar busy times
- **Sync tokens**: Maintain incremental sync with calendar changes

Key methods:
- `createCalendarEvent()`: Create calendar event from appointment
- `updateCalendarEvent()`: Update existing calendar event
- `cancelCalendarEvent()`: Remove calendar event
- `checkCalendarConflicts()`: Detect scheduling conflicts
- `getAvailableSlots()`: Get free time slots
- `syncWithCalendar()`: Bi-directional synchronization

### Zoho Email Service (`email.service.ts`)
- **SMTP integration** with Zoho Mail
- **Template system** with branded HTML emails
- **Automated notifications**: Confirmations, reminders, cancellations
- **Scheduling**: Day-before and hour-before appointment reminders
- **Business communications**: Welcome emails, daily summaries

Email types:
- **Appointment confirmation** with calendar attachment
- **Reminder emails** (24h and 1h before)
- **Cancellation notifications**
- **Welcome emails** for new customers
- **Daily summaries** for business owners

### Analytics & Reporting (`analytics.service.ts`)
- **Comprehensive metrics**: Appointments, revenue, customers, AI performance
- **Real-time dashboard**: Live appointment status and recent conversations
- **Growth tracking**: Period-over-period comparisons
- **Domain benchmarks**: Performance comparison across business domains
- **Health scoring**: Automated business health assessment

## Admin Dashboard

### Frontend Interface (`src/frontend/`)
- **Responsive web dashboard** built with Bootstrap 5
- **Real-time charts** using Chart.js
- **Role-based access**: Super admin, tenant admin, support roles
- **Multi-tenant support**: Switch between business accounts
- **Mobile-friendly**: Responsive design for mobile devices

Dashboard sections:
- **Overview**: Key metrics, charts, today's appointments
- **Appointments**: Manage all bookings with filters
- **Customers**: User management and analytics
- **Services**: Service configuration and performance
- **Conversations**: WhatsApp chat history and AI insights
- **Analytics**: Detailed reports and metrics
- **Settings**: System configuration and user management

### Authentication & Permissions (`admin-auth.ts`)
- **JWT-based authentication** with role-based access control
- **Permission system**: Granular permissions for different features
- **Tenant isolation**: Automatic tenant-scoped access for tenant admins
- **Password management**: Secure password hashing with bcrypt
- **Session management**: Token refresh and secure logout

Available roles:
- **Super Admin**: Full system access, manage all tenants
- **Tenant Admin**: Access to single tenant's data and settings
- **Support**: Limited access for customer support tasks

### API Routes (`admin.ts`)
- **RESTful API** for all admin dashboard functionality
- **Comprehensive endpoints**: Dashboard, analytics, user management
- **Secure access**: JWT authentication and permission checks
- **Data validation**: Input validation and error handling
- **Audit logging**: Track admin actions and changes

## Database Schema Extensions

### Admin Tables (`database/admin-schema.sql`)
- **admin_users**: Admin user accounts with roles and permissions
- **admin_permissions**: Granular permission assignments
- **email_logs**: Track all sent emails with delivery status
- **function_executions**: Monitor AI function calls and performance
- **calendar_sync_tokens**: Maintain Google Calendar sync state
- **system_health_logs**: Track system component health

### Setup Instructions

1. **Run setup script**: `./scripts/setup.sh`
2. **Configure environment**: Edit `.env` with your API keys
3. **Setup database**: Execute `database/admin-schema.sql` in Supabase
4. **Start development**: `npm run dev`
5. **Access dashboard**: `http://localhost:3000/admin`
6. **Change default password**: Login with `admin@universalbooking.com` / `admin123`

### Production Deployment

```bash
npm run setup     # Install and build
npm run start     # Start production server
```

**Essential configurations:**
- **WhatsApp Business API**: Token and phone number ID
- **OpenAI API**: Key for AI functionality
- **Supabase**: Database URL and keys
- **Zoho SMTP**: Email credentials
- **Google Calendar**: OAuth credentials (optional)

The system is now **production-ready** with full administrative capabilities, external integrations, and comprehensive monitoring.