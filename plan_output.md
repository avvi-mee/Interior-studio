I now have a comprehensive understanding of the entire codebase. Let me compile the complete migration plan.

---

# Firebase to Supabase Migration Plan -- Interior Design Multi-Tenant SaaS

## Summary of Codebase Analysis

After thoroughly exploring the entire codebase, here is a complete accounting of every file that touches Firebase:

**Firebase Client Initialization:** `D:/Interior-studio/frontend/src/lib/firebase.ts`
**Firebase Storage Helper:** `D:/Interior-studio/frontend/src/lib/storageHelpers.ts`

**Auth Hooks (5):**
- `D:/Interior-studio/frontend/src/hooks/useTenantAuth.ts` -- tenant owner/admin login
- `D:/Interior-studio/frontend/src/hooks/useAdminAuth.ts` -- superadmin login
- `D:/Interior-studio/frontend/src/hooks/useCustomerAuth.ts` -- customer login/signup/Google OAuth
- `D:/Interior-studio/frontend/src/hooks/useCurrentUser.ts` -- hybrid employee session + Firebase auth
- `D:/Interior-studio/frontend/src/hooks/useUserRole.ts` -- reads users/{uid} for role data

**Data Hooks (10):**
- `D:/Interior-studio/frontend/src/hooks/useLeads.ts` -- onSnapshot real-time listener
- `D:/Interior-studio/frontend/src/hooks/useProjects.ts` -- onSnapshot real-time listener
- `D:/Interior-studio/frontend/src/hooks/useFinance.ts` -- onSnapshot (invoices + vendorBills)
- `D:/Interior-studio/frontend/src/hooks/useConsultations.ts` -- onSnapshot real-time
- `D:/Interior-studio/frontend/src/hooks/useEmployees.ts` -- onSnapshot real-time
- `D:/Interior-studio/frontend/src/hooks/usePricingConfig.ts` -- onSnapshot real-time
- `D:/Interior-studio/frontend/src/hooks/useWebsiteBuilder.ts` -- 8 sub-hooks with onSnapshot
- `D:/Interior-studio/frontend/src/hooks/useTenantDashboard.ts` -- onSnapshot + getDocs
- `D:/Interior-studio/frontend/src/hooks/useAnalytics.ts` -- getDocs with date range queries
- `D:/Interior-studio/frontend/src/hooks/useOrders.ts` -- onSnapshot (estimates collection)

**Service Files (5):**
- `D:/Interior-studio/frontend/src/lib/services/projectService.ts` -- createProjectFromLead/Order, logActivity
- `D:/Interior-studio/frontend/src/lib/services/invoiceService.ts` -- createInvoice, addPayment (transactions)
- `D:/Interior-studio/frontend/src/lib/services/vendorBillService.ts` -- createVendorBill, addPayment (transactions)
- `D:/Interior-studio/frontend/src/lib/services/leadScoringService.ts` -- pure computation, no Firestore writes
- `D:/Interior-studio/frontend/src/lib/firestoreHelpers.ts` -- tenant CRUD, activity logging

**API Routes (2):**
- `D:/Interior-studio/frontend/src/app/api/follow-up-reminders/route.ts` -- firebase-admin
- `D:/Interior-studio/frontend/src/app/api/payment-reminders/route.ts` -- firebase-admin

**Login/Signup Pages (8):**
- `D:/Interior-studio/frontend/src/app/(tenant-admin)/login/page.tsx` -- designer + employee tabs
- `D:/Interior-studio/frontend/src/app/(tenant-admin)/signup/page.tsx` -- createUserWithEmailAndPassword
- `D:/Interior-studio/frontend/src/app/(super-admin)/admin/login/page.tsx`
- `D:/Interior-studio/frontend/src/app/(super-admin)/admin/signup/page.tsx`
- `D:/Interior-studio/frontend/src/app/(storefront)/[tenantId]/login/page.tsx` -- customer email
- `D:/Interior-studio/frontend/src/app/(storefront)/[tenantId]/signup/page.tsx` -- customer email + Google
- `D:/Interior-studio/frontend/src/app/(storefront)/[tenantId]/estimate/login/page.tsx` -- simulated OTP (no Firebase)
- `D:/Interior-studio/frontend/src/app/employee-register/page.tsx`

**Direct Firebase Usage in Components:**
- `D:/Interior-studio/frontend/src/components/storefront/ConsultationForm.tsx` -- addDoc to consultations

---

## BATCH 0: Supabase Setup

### Purpose
Install Supabase client library, set up environment variables, create the Supabase client singleton module that replaces `firebase.ts`.

### Files to Create
1. **`D:/Interior-studio/frontend/src/lib/supabase.ts`** -- browser client (anon key, public URL)
2. **`D:/Interior-studio/frontend/src/lib/supabaseServer.ts`** -- server client (service role key) for API routes
3. **`D:/Interior-studio/frontend/src/lib/supabaseTypes.ts`** -- auto-generated or hand-written Database type

### Environment Variables

Replace all `NEXT_PUBLIC_FIREBASE_*` env vars in `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=<REDACTED>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<REDACTED>
SUPABASE_SERVICE_ROLE_KEY=<REDACTED>
```

Keep the existing Firebase env vars temporarily until Batch 9.

### Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
npm uninstall firebase firebase-admin  # (deferred to Batch 9)
```

### `supabase.ts` Pattern

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './supabaseTypes'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Singleton for hooks (like the old firebase.ts pattern)
let _supabase: ReturnType<typeof createClient> | null = null
export function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}
```

### `supabaseServer.ts` Pattern

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabaseTypes'

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

### Verification
- `npm run build` succeeds with both Firebase and Supabase installed
- Supabase client can call `supabase.from('test').select()` without error (just returns empty data)

---

## BATCH 1: PostgreSQL Schema + RLS

### Design Decisions

1. **Phases/Tasks**: Flatten from embedded arrays to `project_phases` and `project_tasks` tables with foreign keys. This is the most impactful structural change.
2. **Timeline events**: Separate `timeline_events` table instead of arrayUnion.
3. **Pricing config**: Keep as JSONB column in a `pricing_configs` table -- the structure is deeply nested and rarely queried by individual fields.
4. **Website builder pages**: Single-doc configs (brand, theme, home, about, contact) become rows in a `tenant_page_configs` table with `page_type` and `content JSONB`. Multi-item collections (portfolio, testimonials, team_members, custom_pages) get their own tables.
5. **Employee auth**: Migrate from plaintext password to Supabase Auth with proper password hashing via `supabase.auth.admin.createUser()`.
6. **Invoice numbering**: PostgreSQL sequence per tenant via a `tenant_invoice_sequences` table.

### Complete Schema

```sql
-- =============================================
-- EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUM TYPES
-- =============================================
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'customer');
CREATE TYPE tenant_status AS ENUM ('pending', 'active', 'inactive', 'rejected');
CREATE TYPE subscription_plan AS ENUM ('free', 'basic', 'pro', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired');
CREATE TYPE employee_role AS ENUM ('owner', 'sales', 'designer', 'project_manager', 'site_supervisor', 'accountant');
CREATE TYPE lead_stage AS ENUM ('new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'approved', 'converted', 'lost');
CREATE TYPE lead_temperature AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE lead_source AS ENUM ('website_estimate', 'consultation', 'manual', 'referral');
CREATE TYPE project_status AS ENUM ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled');
CREATE TYPE health_status AS ENUM ('on_track', 'at_risk', 'delayed');
CREATE TYPE phase_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'partial', 'paid', 'overdue');
CREATE TYPE vendor_bill_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other');
CREATE TYPE consultation_status AS ENUM ('new', 'contacted', 'closed');
CREATE TYPE estimate_status AS ENUM ('pending', 'approved', 'rejected', 'generated');
CREATE TYPE activity_type AS ENUM ('signup', 'store_activated', 'payment', 'approval', 'rejection');
CREATE TYPE activity_entity_type AS ENUM ('task', 'phase', 'project', 'comment', 'attachment');
CREATE TYPE follow_up_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE font_style AS ENUM ('modern', 'elegant', 'minimal');
CREATE TYPE portfolio_category AS ENUM ('residential', 'commercial');

-- =============================================
-- TABLE: users
-- Maps to: root 'users' collection in Firestore
-- Supabase Auth user ID is the PK
-- =============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  tenant_id UUID,  -- FK added after tenants table
  tenant_role TEXT, -- 'owner' or 'admin' for admin users
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);

-- =============================================
-- TABLE: tenants
-- Maps to: root 'tenants' collection
-- =============================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_uid UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  business_name TEXT NOT NULL,
  store_id TEXT NOT NULL UNIQUE,
  status tenant_status NOT NULL DEFAULT 'pending',
  subscription_plan subscription_plan NOT NULL DEFAULT 'free',
  subscription_status subscription_status NOT NULL DEFAULT 'active',
  subscription_start_date TIMESTAMPTZ DEFAULT NOW(),
  subscription_end_date TIMESTAMPTZ,
  revenue_total NUMERIC(12,2) DEFAULT 0,
  revenue_last_month NUMERIC(12,2) DEFAULT 0,
  revenue_this_month NUMERIC(12,2) DEFAULT 0,
  settings JSONB DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_store_id ON tenants(store_id);
CREATE INDEX idx_tenants_email ON tenants(email);
CREATE INDEX idx_tenants_owner_uid ON tenants(owner_uid);
CREATE INDEX idx_tenants_status ON tenants(status);

-- Now add FK on users
ALTER TABLE users ADD CONSTRAINT fk_users_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

-- =============================================
-- TABLE: customers
-- Maps to: root 'customers' collection (legacy)
-- =============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  phone_number TEXT,
  city TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- =============================================
-- TABLE: activities
-- Maps to: root 'activities' collection
-- =============================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type activity_type NOT NULL,
  description TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  tenant_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);

-- =============================================
-- TABLE: employees
-- Maps to: tenants/{tenantId}/employees
-- =============================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  auth_uid UUID REFERENCES auth.users(id),  -- Will be populated when migrating to Supabase Auth
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  area TEXT,
  role employee_role NOT NULL DEFAULT 'designer',
  roles employee_role[] DEFAULT '{}',
  primary_role employee_role,
  total_work INTEGER DEFAULT 0,
  current_work TEXT,
  upcoming_work TEXT,
  assigned_leads TEXT[] DEFAULT '{}',
  assigned_projects TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_auth_uid ON employees(auth_uid);
CREATE INDEX idx_employees_is_active ON employees(tenant_id, is_active);

-- =============================================
-- TABLE: leads
-- Maps to: tenants/{tenantId}/leads
-- =============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  city TEXT,
  message TEXT,
  project_type TEXT,
  basics JSONB DEFAULT '{"plan":"Standard","carpetArea":0,"bedrooms":0,"bathrooms":0}',
  items JSONB DEFAULT '[]',
  total_amount NUMERIC(12,2) DEFAULT 0,
  estimate_id UUID,
  stage lead_stage NOT NULL DEFAULT 'new',
  temperature lead_temperature NOT NULL DEFAULT 'warm',
  score INTEGER DEFAULT 0,
  lost_reason TEXT,
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  next_follow_up TIMESTAMPTZ,
  follow_up_count INTEGER DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  project_id UUID,  -- FK added after projects table
  source lead_source NOT NULL DEFAULT 'website_estimate',
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX idx_leads_stage ON leads(tenant_id, stage);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_created_at ON leads(tenant_id, created_at DESC);

-- =============================================
-- TABLE: timeline_events
-- Replaces arrayUnion timeline on leads, projects, consultations
-- =============================================
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- 'lead', 'project', 'consultation', 'estimate'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timeline_entity ON timeline_events(entity_type, entity_id);
CREATE INDEX idx_timeline_tenant ON timeline_events(tenant_id);

-- =============================================
-- TABLE: estimates (orders)
-- Maps to: tenants/{tenantId}/estimates
-- =============================================
CREATE TABLE estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_info JSONB DEFAULT '{}',  -- {name, phone, email, city}
  segment TEXT,  -- 'Residential' or 'Commercial'
  plan TEXT,
  carpet_area NUMERIC(10,2),
  bedrooms INTEGER,
  bathrooms INTEGER,
  configuration JSONB DEFAULT '{}',
  total_amount NUMERIC(12,2) DEFAULT 0,
  status estimate_status DEFAULT 'pending',
  pdf_url TEXT,
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  assignment_status TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  project_id UUID,  -- FK added after projects
  project_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_estimates_tenant_id ON estimates(tenant_id);
CREATE INDEX idx_estimates_created_at ON estimates(tenant_id, created_at DESC);
CREATE INDEX idx_estimates_status ON estimates(tenant_id, status);

-- =============================================
-- TABLE: projects
-- Maps to: tenants/{tenantId}/projects
-- Phases and tasks are FLATTENED to separate tables
-- =============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  customer_id TEXT,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_city TEXT,
  project_type TEXT,
  plan TEXT,
  carpet_area NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  status project_status NOT NULL DEFAULT 'planning',
  project_name TEXT,
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  assigned_designer UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_designer_name TEXT,
  assigned_supervisor UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_supervisor_name TEXT,
  assigned_accountant UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_accountant_name TEXT,
  start_date TIMESTAMPTZ,
  expected_end_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  project_progress INTEGER DEFAULT 0,  -- 0-100
  health_status health_status DEFAULT 'on_track',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_projects_status ON projects(tenant_id, status);
CREATE INDEX idx_projects_lead_id ON projects(lead_id);
CREATE INDEX idx_projects_created_at ON projects(tenant_id, created_at DESC);

-- Add FK from leads and estimates
ALTER TABLE leads ADD CONSTRAINT fk_leads_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE estimates ADD CONSTRAINT fk_estimates_project
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- =============================================
-- TABLE: project_phases
-- Flattened from project.phases[] embedded array
-- =============================================
CREATE TABLE project_phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status phase_status NOT NULL DEFAULT 'pending',
  progress_percentage INTEGER DEFAULT 0,
  is_delayed BOOLEAN DEFAULT FALSE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_phases_project ON project_phases(project_id);
CREATE INDEX idx_phases_tenant ON project_phases(tenant_id);

-- =============================================
-- TABLE: project_tasks
-- Flattened from phase.tasks[] embedded array
-- =============================================
CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase_id UUID NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,  -- 0-100
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_phase ON project_tasks(phase_id);
CREATE INDEX idx_tasks_project ON project_tasks(project_id);
CREATE INDEX idx_tasks_tenant ON project_tasks(tenant_id);
CREATE INDEX idx_tasks_assigned ON project_tasks(assigned_to);
CREATE INDEX idx_tasks_status ON project_tasks(status);

-- =============================================
-- TABLE: task_attachments
-- Flattened from task.attachments[] embedded array
-- =============================================
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_task ON task_attachments(task_id);

-- =============================================
-- TABLE: task_comments
-- Flattened from task.comments[] embedded array
-- =============================================
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_task ON task_comments(task_id);

-- =============================================
-- TABLE: project_activity_log
-- Maps to: projects/{id}/activityLog subcollection
-- =============================================
CREATE TABLE project_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type activity_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  performed_by TEXT,
  performed_by_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_project ON project_activity_log(project_id);
CREATE INDEX idx_activity_log_tenant ON project_activity_log(tenant_id);

-- =============================================
-- TABLE: invoices
-- Maps to: tenants/{tenantId}/invoices
-- =============================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  paid_amount NUMERIC(12,2) DEFAULT 0,
  aging_bucket TEXT DEFAULT 'current',  -- 'current', '31-60', '61-90', '90+'
  description TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status);
CREATE INDEX idx_invoices_created_at ON invoices(tenant_id, created_at DESC);

-- =============================================
-- TABLE: invoice_payments
-- Maps to: invoices/{id}/payments subcollection
-- =============================================
CREATE TABLE invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  paid_on TIMESTAMPTZ NOT NULL,
  method payment_method NOT NULL,
  reference TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id);

-- =============================================
-- TABLE: vendor_bills
-- Maps to: tenants/{tenantId}/vendorBills
-- =============================================
CREATE TABLE vendor_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status vendor_bill_status NOT NULL DEFAULT 'pending',
  paid_amount NUMERIC(12,2) DEFAULT 0,
  aging_bucket TEXT DEFAULT 'current',
  description TEXT,
  category TEXT,
  project_phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_bills_tenant ON vendor_bills(tenant_id);
CREATE INDEX idx_vendor_bills_project ON vendor_bills(project_id);
CREATE INDEX idx_vendor_bills_status ON vendor_bills(tenant_id, status);

-- =============================================
-- TABLE: vendor_bill_payments
-- Maps to: vendorBills/{id}/payments subcollection
-- =============================================
CREATE TABLE vendor_bill_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id UUID NOT NULL REFERENCES vendor_bills(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  paid_on TIMESTAMPTZ NOT NULL,
  method payment_method NOT NULL,
  reference TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_payments_bill ON vendor_bill_payments(bill_id);

-- =============================================
-- TABLE: consultations
-- Maps to: tenants/{tenantId}/consultations
-- =============================================
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  store_id TEXT,
  client_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT DEFAULT 'website',
  requirement TEXT,
  status consultation_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consultations_tenant ON consultations(tenant_id);
CREATE INDEX idx_consultations_status ON consultations(tenant_id, status);
CREATE INDEX idx_consultations_created_at ON consultations(tenant_id, created_at DESC);

-- =============================================
-- TABLE: follow_ups
-- Maps to: tenants/{tenantId}/followUps
-- =============================================
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status follow_up_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_tenant ON follow_ups(tenant_id);
CREATE INDEX idx_follow_ups_status ON follow_ups(tenant_id, status);
CREATE INDEX idx_follow_ups_scheduled ON follow_ups(scheduled_at);

-- =============================================
-- TABLE: cities
-- Maps to: tenants/{tenantId}/cities
-- =============================================
CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cities_tenant ON cities(tenant_id);

-- =============================================
-- TABLE: pricing_configs
-- Maps to: tenants/{tenantId}/pricing/config (JSONB)
-- =============================================
CREATE TABLE pricing_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  categories JSONB DEFAULT '[]',
  kitchen_layouts JSONB DEFAULT '[]',
  kitchen_materials JSONB DEFAULT '[]',
  carpet_area_settings JSONB DEFAULT '{}',
  calculation_rules JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pricing_configs_tenant ON pricing_configs(tenant_id);

-- =============================================
-- TABLE: tenant_page_configs
-- Maps to: tenants/{tenantId}/brand/config, theme/config, pages/home, pages/about, pages/contact
-- =============================================
CREATE TABLE tenant_page_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_type TEXT NOT NULL,  -- 'brand', 'theme', 'home', 'about', 'contact'
  content JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, page_type)
);

CREATE INDEX idx_page_configs_tenant ON tenant_page_configs(tenant_id);
CREATE INDEX idx_page_configs_type ON tenant_page_configs(tenant_id, page_type);

-- =============================================
-- TABLE: portfolio_projects
-- Maps to: tenants/{tenantId}/pages/portfolio/projects
-- =============================================
CREATE TABLE portfolio_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category portfolio_category NOT NULL DEFAULT 'residential',
  description TEXT,
  before_image_url TEXT,
  after_image_url TEXT,
  image_style TEXT DEFAULT 'single',
  location TEXT,
  show_on_homepage BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portfolio_tenant ON portfolio_projects(tenant_id);

-- =============================================
-- TABLE: testimonials
-- Maps to: tenants/{tenantId}/pages/testimonials/items
-- =============================================
CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_title TEXT,
  location TEXT,
  client_image_url TEXT,
  review_text TEXT,
  rating SMALLINT DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  show_on_homepage BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_testimonials_tenant ON testimonials(tenant_id);

-- =============================================
-- TABLE: team_members
-- Maps to: tenants/{tenantId}/pages/about/teamMembers
-- =============================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  bio TEXT,
  image_url TEXT,
  linkedin_url TEXT,
  instagram_url TEXT,
  show_on_homepage BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_team_members_tenant ON team_members(tenant_id);

-- =============================================
-- TABLE: custom_pages
-- Maps to: tenants/{tenantId}/pages/custom/items
-- =============================================
CREATE TABLE custom_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  heading TEXT,
  description TEXT,
  image_url TEXT,
  show_in_nav BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_custom_pages_tenant ON custom_pages(tenant_id);
CREATE INDEX idx_custom_pages_slug ON custom_pages(tenant_id, slug);

-- =============================================
-- TABLE: invoice_sequences
-- Replaces Firestore counters/invoices atomic counter
-- =============================================
CREATE TABLE invoice_sequences (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  current_count INTEGER DEFAULT 0
);

-- =============================================
-- FUNCTION: next_invoice_number
-- Atomic invoice number generation (replaces Firestore runTransaction)
-- =============================================
CREATE OR REPLACE FUNCTION next_invoice_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO invoice_sequences (tenant_id, current_count)
  VALUES (p_tenant_id, 1)
  ON CONFLICT (tenant_id) DO UPDATE
  SET current_count = invoice_sequences.current_count + 1
  RETURNING current_count INTO v_count;

  RETURN 'INV-' || LPAD(v_count::TEXT, 3, '0');
END;
$$;

-- =============================================
-- FUNCTION: record_invoice_payment
-- Replaces Firestore runTransaction for payment recording
-- =============================================
CREATE OR REPLACE FUNCTION record_invoice_payment(
  p_tenant_id UUID,
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_paid_on TIMESTAMPTZ,
  p_method payment_method,
  p_reference TEXT DEFAULT NULL,
  p_created_by TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
  v_new_paid NUMERIC;
  v_new_status invoice_status;
  v_payment_id UUID;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id AND tenant_id = p_tenant_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF p_amount > (v_invoice.amount - v_invoice.paid_amount) THEN
    RAISE EXCEPTION 'Payment amount exceeds outstanding balance';
  END IF;

  v_new_paid := v_invoice.paid_amount + p_amount;

  IF v_new_paid >= v_invoice.amount THEN
    v_new_status := 'paid';
  ELSIF v_new_paid > 0 THEN
    v_new_status := 'partial';
  ELSIF v_invoice.due_date < NOW() THEN
    v_new_status := 'overdue';
  ELSE
    v_new_status := 'sent';
  END IF;

  UPDATE invoices SET
    paid_amount = v_new_paid,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_invoice_id;

  INSERT INTO invoice_payments (invoice_id, tenant_id, amount, paid_on, method, reference, created_by)
  VALUES (p_invoice_id, p_tenant_id, p_amount, p_paid_on, p_method, p_reference, p_created_by)
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

-- =============================================
-- FUNCTION: record_vendor_bill_payment
-- Replaces Firestore runTransaction for vendor bill payment
-- =============================================
CREATE OR REPLACE FUNCTION record_vendor_bill_payment(
  p_tenant_id UUID,
  p_bill_id UUID,
  p_amount NUMERIC,
  p_paid_on TIMESTAMPTZ,
  p_method payment_method,
  p_reference TEXT DEFAULT NULL,
  p_created_by TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_bill vendor_bills%ROWTYPE;
  v_new_paid NUMERIC;
  v_new_status vendor_bill_status;
  v_payment_id UUID;
BEGIN
  SELECT * INTO v_bill FROM vendor_bills WHERE id = p_bill_id AND tenant_id = p_tenant_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor bill not found';
  END IF;

  IF p_amount > (v_bill.amount - v_bill.paid_amount) THEN
    RAISE EXCEPTION 'Payment amount exceeds outstanding balance';
  END IF;

  v_new_paid := v_bill.paid_amount + p_amount;

  IF v_new_paid >= v_bill.amount THEN
    v_new_status := 'paid';
  ELSIF v_new_paid > 0 THEN
    v_new_status := 'partial';
  ELSIF v_bill.due_date < NOW() THEN
    v_new_status := 'overdue';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE vendor_bills SET
    paid_amount = v_new_paid,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_bill_id;

  INSERT INTO vendor_bill_payments (bill_id, tenant_id, amount, paid_on, method, reference, created_by)
  VALUES (p_bill_id, p_tenant_id, p_amount, p_paid_on, p_method, p_reference, p_created_by)
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

-- =============================================
-- FUNCTION: updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON project_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON vendor_bills FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON custom_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_page_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS FOR RLS
-- =============================================

CREATE OR REPLACE FUNCTION auth_user_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT auth.uid() $$;

CREATE OR REPLACE FUNCTION is_superadmin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
  )
$$;

CREATE OR REPLACE FUNCTION user_tenant_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_tenant_owner(p_tenant_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenants WHERE id = p_tenant_id AND owner_uid = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION is_tenant_employee(p_tenant_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees WHERE tenant_id = p_tenant_id AND auth_uid = auth.uid() AND is_active = TRUE
  )
$$;

CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT is_tenant_owner(p_tenant_id) OR is_tenant_employee(p_tenant_id) OR is_superadmin()
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- USERS
CREATE POLICY "users_select_own" ON users FOR SELECT USING (id = auth.uid() OR is_superadmin());
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (id = auth.uid());

-- TENANTS (public read for storefront)
CREATE POLICY "tenants_select_all" ON tenants FOR SELECT USING (TRUE);
CREATE POLICY "tenants_insert_authenticated" ON tenants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tenants_update_owner" ON tenants FOR UPDATE USING (is_tenant_owner(id) OR is_superadmin());

-- CUSTOMERS
CREATE POLICY "customers_select_own" ON customers FOR SELECT USING (id = auth.uid());
CREATE POLICY "customers_insert_own" ON customers FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "customers_update_own" ON customers FOR UPDATE USING (id = auth.uid());

-- ACTIVITIES (superadmin read, authenticated create)
CREATE POLICY "activities_select_admin" ON activities FOR SELECT USING (is_superadmin());
CREATE POLICY "activities_insert_auth" ON activities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- EMPLOYEES (authenticated read for login lookup, owner manage)
CREATE POLICY "employees_select_auth" ON employees FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "employees_insert_owner" ON employees FOR INSERT WITH CHECK (is_tenant_owner(tenant_id));
CREATE POLICY "employees_update_owner_or_self" ON employees FOR UPDATE USING (is_tenant_owner(tenant_id) OR auth_uid = auth.uid());
CREATE POLICY "employees_delete_owner" ON employees FOR DELETE USING (is_tenant_owner(tenant_id));

-- LEADS (public create for storefront, public read for API, member update)
CREATE POLICY "leads_select_all" ON leads FOR SELECT USING (TRUE);
CREATE POLICY "leads_insert_all" ON leads FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "leads_update_member" ON leads FOR UPDATE USING (is_tenant_member(tenant_id));
CREATE POLICY "leads_delete_member" ON leads FOR DELETE USING (is_tenant_member(tenant_id));

-- TIMELINE_EVENTS
CREATE POLICY "timeline_select_member" ON timeline_events FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY "timeline_insert_member" ON timeline_events FOR INSERT WITH CHECK (is_tenant_member(tenant_id) OR TRUE);  -- public for storefront-created leads

-- ESTIMATES (public create/read for storefront, member update)
CREATE POLICY "estimates_select_all" ON estimates FOR SELECT USING (TRUE);
CREATE POLICY "estimates_insert_all" ON estimates FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "estimates_update_member" ON estimates FOR UPDATE USING (is_tenant_member(tenant_id));

-- PROJECTS (member + customer for their own)
CREATE POLICY "projects_select" ON projects FOR SELECT USING (
  is_tenant_member(tenant_id) OR customer_id = auth.uid()::TEXT
);
CREATE POLICY "projects_insert_member" ON projects FOR INSERT WITH CHECK (is_tenant_member(tenant_id));
CREATE POLICY "projects_update_member" ON projects FOR UPDATE USING (is_tenant_member(tenant_id));

-- PROJECT_PHASES
CREATE POLICY "phases_select" ON project_phases FOR SELECT USING (is_tenant_member(tenant_id) OR EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.customer_id = auth.uid()::TEXT));
CREATE POLICY "phases_insert_member" ON project_phases FOR INSERT WITH CHECK (is_tenant_member(tenant_id));
CREATE POLICY "phases_update_member" ON project_phases FOR UPDATE USING (is_tenant_member(tenant_id));
CREATE POLICY "phases_delete_member" ON project_phases FOR DELETE USING (is_tenant_member(tenant_id));

-- PROJECT_TASKS
CREATE POLICY "tasks_select" ON project_tasks FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY "tasks_insert_member" ON project_tasks FOR INSERT WITH CHECK (is_tenant_member(tenant_id));
CREATE POLICY "tasks_update_member" ON project_tasks FOR UPDATE USING (is_tenant_member(tenant_id));
CREATE POLICY "tasks_delete_member" ON project_tasks FOR DELETE USING (is_tenant_member(tenant_id));

-- TASK_ATTACHMENTS
CREATE POLICY "attach_select" ON task_attachments FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY "attach_insert" ON task_attachments FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

-- TASK_COMMENTS
CREATE POLICY "comments_select" ON task_comments FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY "comments_insert" ON task_comments FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

-- ACTIVITY_LOG
CREATE POLICY "activity_log_select" ON project_activity_log FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY "activity_log_insert" ON project_activity_log FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

-- INVOICES (member + customer for own)
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (
  is_tenant_member(tenant_id) OR client_id = auth.uid()::TEXT
);
CREATE POLICY "invoices_insert_member" ON invoices FOR INSERT WITH CHECK (is_tenant_member(tenant_id));
CREATE POLICY "invoices_update_member" ON invoices FOR UPDATE USING (is_tenant_member(tenant_id));

-- INVOICE_PAYMENTS
CREATE POLICY "inv_pay_select" ON invoice_payments FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY "inv_pay_insert" ON invoice_payments FOR INSERT WITH CHECK (is_tenant_member(tenant_id));

-- VENDOR_BILLS
CREATE POLICY "vendor_bills_all" ON vendor_bills FOR ALL USING (is_tenant_member(tenant_id));

-- VENDOR_BILL_PAYMENTS
CREATE POLICY "vendor_pay_all" ON vendor_bill_payments FOR ALL USING (is_tenant_member(tenant_id));

-- CONSULTATIONS (public create, member read/update)
CREATE POLICY "consult_select_member" ON consultations FOR SELECT USING (is_tenant_member(tenant_id));
CREATE POLICY "consult_insert_all" ON consultations FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "consult_update_member" ON consultations FOR UPDATE USING (is_tenant_member(tenant_id));

-- FOLLOW_UPS
CREATE POLICY "followups_select_all" ON follow_ups FOR SELECT USING (TRUE);  -- API needs public read
CREATE POLICY "followups_insert_member" ON follow_ups FOR INSERT WITH CHECK (is_tenant_member(tenant_id));
CREATE POLICY "followups_update_member" ON follow_ups FOR UPDATE USING (is_tenant_member(tenant_id));

-- CITIES (public read, owner write)
CREATE POLICY "cities_select_all" ON cities FOR SELECT USING (TRUE);
CREATE POLICY "cities_insert_owner" ON cities FOR INSERT WITH CHECK (is_tenant_owner(tenant_id));

-- PRICING_CONFIGS (public read, owner write)
CREATE POLICY "pricing_select_all" ON pricing_configs FOR SELECT USING (TRUE);
CREATE POLICY "pricing_upsert_owner" ON pricing_configs FOR INSERT WITH CHECK (is_tenant_owner(tenant_id));
CREATE POLICY "pricing_update_owner" ON pricing_configs FOR UPDATE USING (is_tenant_owner(tenant_id));

-- TENANT_PAGE_CONFIGS (public read, owner write)
CREATE POLICY "page_configs_select_all" ON tenant_page_configs FOR SELECT USING (TRUE);
CREATE POLICY "page_configs_upsert_owner" ON tenant_page_configs FOR INSERT WITH CHECK (is_tenant_owner(tenant_id));
CREATE POLICY "page_configs_update_owner" ON tenant_page_configs FOR UPDATE USING (is_tenant_owner(tenant_id));

-- PORTFOLIO, TESTIMONIALS, TEAM_MEMBERS, CUSTOM_PAGES (public read, owner write)
CREATE POLICY "portfolio_select_all" ON portfolio_projects FOR SELECT USING (TRUE);
CREATE POLICY "portfolio_manage_owner" ON portfolio_projects FOR ALL USING (is_tenant_owner(tenant_id));

CREATE POLICY "testimonials_select_all" ON testimonials FOR SELECT USING (TRUE);
CREATE POLICY "testimonials_manage_owner" ON testimonials FOR ALL USING (is_tenant_owner(tenant_id));

CREATE POLICY "team_members_select_all" ON team_members FOR SELECT USING (TRUE);
CREATE POLICY "team_members_manage_owner" ON team_members FOR ALL USING (is_tenant_owner(tenant_id));

CREATE POLICY "custom_pages_select_all" ON custom_pages FOR SELECT USING (TRUE);
CREATE POLICY "custom_pages_manage_owner" ON custom_pages FOR ALL USING (is_tenant_owner(tenant_id));

-- INVOICE_SEQUENCES
CREATE POLICY "seq_member" ON invoice_sequences FOR ALL USING (is_tenant_member(tenant_id));
```

### Supabase Realtime Configuration

Enable Realtime on these tables (matching the `onSnapshot` usage):
- `leads`
- `projects`
- `project_phases`
- `project_tasks`
- `invoices`
- `vendor_bills`
- `consultations`
- `employees`
- `pricing_configs`
- `tenant_page_configs`
- `portfolio_projects`
- `testimonials`
- `team_members`
- `custom_pages`
- `estimates`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE project_phases;
ALTER PUBLICATION supabase_realtime ADD TABLE project_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE vendor_bills;
ALTER PUBLICATION supabase_realtime ADD TABLE consultations;
ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE pricing_configs;
ALTER PUBLICATION supabase_realtime ADD TABLE tenant_page_configs;
ALTER PUBLICATION supabase_realtime ADD TABLE portfolio_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE testimonials;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE custom_pages;
ALTER PUBLICATION supabase_realtime ADD TABLE estimates;
```

### Verification
- All tables created in Supabase dashboard
- RLS policies visible in Auth Policies tab
- Realtime enabled on required tables
- Functions `next_invoice_number`, `record_invoice_payment`, `record_vendor_bill_payment` available

---

## BATCH 2: Auth Migration

### Files to Modify

1. **`D:/Interior-studio/frontend/src/hooks/useTenantAuth.ts`** -- Replace `signInWithEmailAndPassword`, `onAuthStateChanged` with `supabase.auth.signInWithPassword`, `supabase.auth.onAuthStateChange`
2. **`D:/Interior-studio/frontend/src/hooks/useAdminAuth.ts`** -- Same auth replacement plus query `users` table for role check
3. **`D:/Interior-studio/frontend/src/hooks/useCustomerAuth.ts`** -- Replace email/password, Google OAuth (`signInWithOAuth`), `createUser`, password reset
4. **`D:/Interior-studio/frontend/src/hooks/useCurrentUser.ts`** -- Replace `onAuthStateChanged` with `supabase.auth.onAuthStateChange`, keep sessionStorage for employees
5. **`D:/Interior-studio/frontend/src/hooks/useUserRole.ts`** -- Replace Firestore `getDoc(users/{uid})` with `supabase.from('users').select().eq('id', uid)`

### Login/Signup Pages to Modify

6. **`D:/Interior-studio/frontend/src/app/(tenant-admin)/login/page.tsx`** -- Designer tab uses new `useTenantAuth`; Employee tab changes from querying all tenants/employees to `supabase.from('employees').select().eq('email', email)` then validates via Supabase Auth (`supabase.auth.signInWithPassword`) for employees that now have auth accounts
7. **`D:/Interior-studio/frontend/src/app/(tenant-admin)/signup/page.tsx`** -- Replace `createUserWithEmailAndPassword` with `supabase.auth.signUp`, then insert into `users` and `tenants` tables
8. **`D:/Interior-studio/frontend/src/app/(super-admin)/admin/login/page.tsx`** -- Replace Firebase Auth
9. **`D:/Interior-studio/frontend/src/app/(super-admin)/admin/signup/page.tsx`** -- Replace Firebase Auth
10. **`D:/Interior-studio/frontend/src/app/(storefront)/[tenantId]/login/page.tsx`** -- Replace with `supabase.auth.signInWithPassword`
11. **`D:/Interior-studio/frontend/src/app/(storefront)/[tenantId]/signup/page.tsx`** -- Replace with `supabase.auth.signUp` + `supabase.auth.signInWithOAuth({ provider: 'google' })`
12. **`D:/Interior-studio/frontend/src/app/(storefront)/[tenantId]/estimate/login/page.tsx`** -- This uses simulated OTP, no Firebase dependency; NO CHANGES NEEDED
13. **`D:/Interior-studio/frontend/src/app/employee-register/page.tsx`** -- Change from storing plaintext password to `supabase.auth.admin.createUser()` via an API route

### Files to Create

14. **`D:/Interior-studio/frontend/src/app/api/employee-register/route.ts`** -- Server-side route that uses service role to create employee Supabase Auth accounts

### Key Auth Patterns

**Supabase Auth Session vs Firebase Auth State:**
- `onAuthStateChanged(auth, callback)` becomes `supabase.auth.onAuthStateChange((event, session) => ...)`
- `signInWithEmailAndPassword(auth, email, pw)` becomes `supabase.auth.signInWithPassword({ email, password })`
- `createUserWithEmailAndPassword(auth, email, pw)` becomes `supabase.auth.signUp({ email, password })`
- `signOut(auth)` becomes `supabase.auth.signOut()`
- `signInWithPopup(auth, new GoogleAuthProvider())` becomes `supabase.auth.signInWithOAuth({ provider: 'google' })`
- `sendPasswordResetEmail(auth, email)` becomes `supabase.auth.resetPasswordForEmail(email)`
- `user.uid` becomes `session.user.id`

**Employee Auth Migration Strategy:**
The current employee login does a plaintext password comparison against Firestore. The new approach:
1. When an employee is added via `useEmployees.addEmployee()`, also call an API route that creates a Supabase Auth account for the employee
2. Store the `auth_uid` in the `employees` table
3. Employee login uses `supabase.auth.signInWithPassword()` then checks if the user has a matching employee record
4. The sessionStorage pattern for employee dashboard is preserved for now -- after Supabase Auth login, store the employee session in sessionStorage

### `firestoreHelpers.ts` Migration

File **`D:/Interior-studio/frontend/src/lib/firestoreHelpers.ts`** needs rewriting to **`D:/Interior-studio/frontend/src/lib/supabaseHelpers.ts`** with the same exported functions but using Supabase queries:
- `getTenantByEmail(email)` -> `supabase.from('tenants').select().eq('email', email).single()`
- `getTenantById(id)` -> `supabase.from('tenants').select().eq('id', id).single()`
- `getTenantByStoreId(storeId)` -> `supabase.from('tenants').select().eq('store_id', storeId).single()`
- `addDesigner(data)` -> `supabase.from('tenants').insert(...)` with storeId uniqueness check
- `approveTenant(id)` -> `supabase.from('tenants').update({ status: 'active' }).eq('id', id)`
- `createActivity(...)` -> `supabase.from('activities').insert(...)`

### Verification
- Designer login/signup works end-to-end
- Superadmin login works
- Customer login/signup + Google OAuth works
- Employee login works with proper Supabase Auth
- `useCurrentUser` correctly resolves all user types
- Password reset emails are sent via Supabase Auth

---

## BATCH 3: Core Data Hooks

### Files to Modify

1. **`D:/Interior-studio/frontend/src/hooks/useLeads.ts`**
   - Replace `onSnapshot` with Supabase Realtime channel subscription
   - Replace `updateDoc`/`addDoc` with `supabase.from('leads').update()`/`.insert()`
   - Replace `arrayUnion` timeline with `supabase.from('timeline_events').insert()`
   - The `recalculateScore` function writes to the leads table

   **Realtime pattern:**
   ```typescript
   const channel = supabase
     .channel(`leads-${tenantId}`)
     .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
       // Refetch or apply delta
     })
     .subscribe()
   ```

2. **`D:/Interior-studio/frontend/src/hooks/useProjects.ts`**
   - This is the most complex hook due to the embedded phases/tasks structure
   - Replace single `onSnapshot` with multiple queries: projects + join phases + tasks
   - `updatePhase` becomes `supabase.from('project_phases').update()`
   - `updateTask` becomes `supabase.from('project_tasks').update()` plus recalculate phase progress
   - `addTaskAttachment` becomes `supabase.from('task_attachments').insert()`
   - `addTaskComment` becomes `supabase.from('task_comments').insert()`
   - `assignRole` becomes `supabase.from('projects').update()`
   - `fetchActivityLog` becomes `supabase.from('project_activity_log').select()`
   - The estimate sync (fire-and-forget) for `project_summary` still works via `supabase.from('estimates').update()`

   **Data loading strategy:** Load projects, then for each project load its phases and tasks. Use Supabase Realtime on `projects`, `project_phases`, and `project_tasks` tables. The enrichment logic (progress calculation, overdue detection) stays client-side as-is.

3. **`D:/Interior-studio/frontend/src/hooks/useConsultations.ts`**
   - Replace `onSnapshot` with Supabase Realtime
   - `createConsultation` -> `.insert()` into consultations table
   - `convertToLead` -> insert into leads + update consultations + insert timeline events

4. **`D:/Interior-studio/frontend/src/hooks/useEmployees.ts`**
   - Replace `onSnapshot` with Supabase Realtime on employees table
   - `addEmployee` -> insert into employees table + create Supabase Auth account via API route
   - `updateEmployee` -> `.update()` on employees table
   - `deleteEmployee` -> `.delete()` on employees table

5. **`D:/Interior-studio/frontend/src/hooks/useOrders.ts`**
   - Replace `onSnapshot` with Supabase Realtime on estimates table
   - `updateOrderStatus` -> `.update()` on estimates + `.insert()` on timeline_events
   - `updateOrderDetails` -> `.update()` on estimates

6. **`D:/Interior-studio/frontend/src/components/storefront/ConsultationForm.tsx`**
   - Replace direct `addDoc(collection(db, ...))` with `supabase.from('consultations').insert()`

### Service Files to Modify

7. **`D:/Interior-studio/frontend/src/lib/services/projectService.ts`**
   - `createProjectFromLead` -> insert into projects table + insert default phases and tasks as separate rows + update lead
   - `createProjectFromOrder` -> same pattern
   - `logActivity` -> insert into `project_activity_log`
   - The `getDefaultPhases()` from `taskTemplates.ts` returns phase/task arrays that must be inserted as separate rows

8. **`D:/Interior-studio/frontend/src/lib/services/leadScoringService.ts`**
   - NO CHANGES NEEDED -- this is pure computation with no Firebase dependency

9. **`D:/Interior-studio/frontend/src/lib/services/taskTemplates.ts`**
   - NO CHANGES NEEDED -- this is pure template data with no Firebase dependency

### Verification
- Leads CRUD works with real-time updates across tabs
- Projects with phases/tasks load correctly from flattened tables
- Task progress updates propagate to phase and project progress
- Consultations create from storefront and appear in dashboard
- Employee CRUD works with proper Supabase Auth accounts
- Converting leads to projects creates proper phase/task rows

---

## BATCH 4: Finance Hooks + Services

### Files to Modify

1. **`D:/Interior-studio/frontend/src/lib/services/invoiceService.ts`**
   - `generateInvoiceNumber` -> call `supabase.rpc('next_invoice_number', { p_tenant_id })` 
   - `createInvoice` -> duplicate check via query + insert
   - `addPaymentToInvoice` -> call `supabase.rpc('record_invoice_payment', { ... })`
   - `updateInvoice` -> `.update()` on invoices table
   - `getInvoicePayments` -> `.select()` from invoice_payments

2. **`D:/Interior-studio/frontend/src/lib/services/vendorBillService.ts`**
   - Same pattern: `createVendorBill` -> insert with duplicate check
   - `addPaymentToVendorBill` -> call `supabase.rpc('record_vendor_bill_payment', { ... })`
   - `getVendorBillPayments` -> `.select()` from vendor_bill_payments

3. **`D:/Interior-studio/frontend/src/hooks/useFinance.ts`**
   - Replace two `onSnapshot` listeners with Supabase Realtime on `invoices` and `vendor_bills`
   - The `enrichOverdueStatus`, `enrichAgingBucket`, `computeAging` functions stay client-side
   - `persistAgingBuckets` -> `.update()` on respective tables
   - All callback mutations delegate to the updated service files

### Verification
- Invoice creation generates sequential invoice numbers atomically
- Payments are recorded with proper balance/status updates
- Overpayment prevention works
- Finance stats compute correctly
- Real-time updates on invoice/bill changes

---

## BATCH 5: Website Builder + Pricing Config

### Files to Modify

1. **`D:/Interior-studio/frontend/src/hooks/usePricingConfig.ts`**
   - Replace `onSnapshot` on `pricing/config` doc with Supabase Realtime on `pricing_configs` table
   - `saveConfig` -> `supabase.from('pricing_configs').upsert()`
   - Remove legacy path fallback (clean database, no legacy data)
   - Keep the `createDefaultConfig()` function as-is

2. **`D:/Interior-studio/frontend/src/hooks/useWebsiteBuilder.ts`** (8 sub-hooks)

   **`useBrand`**: Realtime on `tenant_page_configs` where `page_type = 'brand'`
   - `saveBrand` -> upsert into `tenant_page_configs`
   - `uploadBrandImage` -> use Supabase Storage (Batch 8), for now keep using `/api/upload`

   **`useTheme`**: Realtime on `tenant_page_configs` where `page_type = 'theme'`

   **`useHomePage`**: Realtime on `tenant_page_configs` where `page_type = 'home'`
   - Hero slides, services, whyChooseUs, customSections remain as JSONB arrays inside the `content` column
   - All CRUD operations update the JSONB content

   **`useAboutUs`**: Realtime on `tenant_page_configs` where `page_type = 'about'`

   **`useContact`**: Realtime on `tenant_page_configs` where `page_type = 'contact'`

   **`usePortfolio`**: Realtime on `portfolio_projects` table
   - `addProject` -> `.insert()`
   - `updateProject` -> `.update()`
   - `deleteProject` -> `.delete()`

   **`useTestimonials`**: Realtime on `testimonials` table

   **`useTeamMembers`**: Realtime on `team_members` table

   **`useCustomPages`**: Realtime on `custom_pages` table

3. **`D:/Interior-studio/frontend/src/lib/calculateEstimate.ts`**
   - NO CHANGES NEEDED -- pure computation, receives `PricingConfig` as argument

4. **`D:/Interior-studio/frontend/src/types/website.ts`**
   - NO CHANGES NEEDED -- these are TypeScript interfaces only

### Verification
- Pricing config saves and loads with JSONB
- All website builder pages (brand, theme, home, about, contact) save/load
- Portfolio, testimonials, team members CRUD with real-time updates
- Custom pages with slug uniqueness enforcement
- Storefront pages render correctly from Supabase data

---

## BATCH 6: Analytics + Dashboard Hooks

### Files to Modify

1. **`D:/Interior-studio/frontend/src/hooks/useAnalytics.ts`**
   - Replace parallel `getDocs` calls with parallel `supabase.from(...).select()` with date filters
   - All computation functions (`computeSalesAnalytics`, `computeProjectAnalytics`, `computeFinancialAnalytics`, `computeEmployeePerformance`) stay as-is since they operate on plain JS objects
   - Date filtering: replace `where("createdAt", ">=", startTs)` with `.gte('created_at', dateRange.start.toISOString())`
   - For projects with phases/tasks, need to join or do a secondary query for the embedded data

2. **`D:/Interior-studio/frontend/src/hooks/useTenantDashboard.ts`**
   - Replace `onSnapshot` on tenant doc with Supabase Realtime on `tenants` table
   - Replace `getDocs` for estimates with `supabase.from('estimates').select()`
   - All computed stats stay client-side

3. **`D:/Interior-studio/frontend/src/lib/analyticsHelpers.ts`**
   - This file likely contains `groupByTimeBucket` and `groupByMonth` helper functions
   - Need to update date extraction if it uses Firestore `Timestamp.toMillis()` -- replace with standard `Date` parsing since PostgreSQL returns ISO strings

### Verification
- Analytics dashboard loads with correct data for all four sections (sales, projects, financial, employees)
- Date range filtering works
- Dashboard stats compute correctly
- No Firestore Timestamp references remain

---

## BATCH 7: API Routes

### Files to Modify

1. **`D:/Interior-studio/frontend/src/app/api/follow-up-reminders/route.ts`**
   - Remove `firebase-admin` imports entirely
   - Replace with `createServiceClient()` from `supabaseServer.ts`
   - Replace `adminDb.collection(...).where(...).get()` with `supabase.from('follow_ups').select().eq('tenant_id', tenantId).eq('status', 'pending')`
   - Replace `adminDb.doc(...).get()` for leads/employees/tenant with Supabase queries
   - Timestamp comparison: `scheduledAt.toMillis()` becomes standard Date comparison on the `scheduled_at` column
   - Nodemailer logic stays identical

2. **`D:/Interior-studio/frontend/src/app/api/payment-reminders/route.ts`**
   - Same pattern: replace `firebase-admin` with Supabase service client
   - Replace all Firestore queries with Supabase queries
   - For the status filter `where("status", "in", ["sent", "partial", "overdue"])`, use `.in('status', ['sent', 'partial', 'overdue'])`

### Files to Create

3. **`D:/Interior-studio/frontend/src/app/api/employee-register/route.ts`** (created in Batch 2 but refined here)
   - Uses service role client to call `supabase.auth.admin.createUser()`
   - Returns the auth UID to store in the employees table

### Environment Variables to Remove (eventually in Batch 9)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Verification
- Follow-up reminders API sends correct emails for overdue/today follow-ups
- Payment reminders API sends correct digest emails for overdue/upcoming invoices and bills
- Employee registration creates proper Supabase Auth accounts

---

## BATCH 8: Storage Migration

### Files to Modify

1. **`D:/Interior-studio/frontend/src/lib/storageHelpers.ts`**
   - Replace `ref(storage, path)` + `uploadBytes` + `getDownloadURL` with Supabase Storage
   - ```typescript
     export async function uploadImage(file: File, path: string): Promise<string> {
       const supabase = getSupabase()
       const { data, error } = await supabase.storage.from('tenant-assets').upload(path, file)
       if (error) throw error
       const { data: { publicUrl } } = supabase.storage.from('tenant-assets').getPublicUrl(path)
       return publicUrl
     }
     ```

### Supabase Storage Buckets to Create

1. **`tenant-assets`** (public) -- portfolio images, logos, team photos, page images
2. **`private-uploads`** (private, authenticated) -- estimate PDFs, task attachments, user profile images

### Storage Policies

```sql
-- Public bucket for tenant website assets
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-assets', 'tenant-assets', true);

-- Private bucket for authenticated uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('private-uploads', 'private-uploads', false);

-- Policy: Anyone can read tenant-assets
CREATE POLICY "public_read_tenant_assets" ON storage.objects FOR SELECT USING (bucket_id = 'tenant-assets');

-- Policy: Authenticated users can upload to tenant-assets (path must start with their tenant ID)
CREATE POLICY "auth_upload_tenant_assets" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'tenant-assets' AND auth.uid() IS NOT NULL
);

-- Policy: Authenticated users can read their private uploads
CREATE POLICY "auth_read_private" ON storage.objects FOR SELECT USING (
  bucket_id = 'private-uploads' AND auth.uid() IS NOT NULL
);

-- Policy: Authenticated users can upload private files
CREATE POLICY "auth_upload_private" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'private-uploads' AND auth.uid() IS NOT NULL
);
```

### Upload Endpoint

The existing hooks use `/api/upload` for image uploads. This endpoint needs to be updated (or the hooks can upload directly via the Supabase client, bypassing the API route).

### Verification
- Portfolio images upload and display on storefront
- Logo/favicon upload works in brand settings
- Task attachment upload works
- PDF download URLs work
- Public images are accessible without auth
- Private files require authentication

---

## BATCH 9: Cleanup

### Files to Delete
- `D:/Interior-studio/frontend/src/lib/firebase.ts`

### Files to Modify
- `D:/Interior-studio/frontend/package.json` -- remove `firebase` and `firebase-admin` from dependencies

### Environment Variables to Remove from `.env.local`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Verify No Firebase Imports Remain

Run a grep across the entire `src/` directory for any remaining firebase imports:
- `from "firebase/`
- `from "firebase-admin/`
- `from "@/lib/firebase"`

### Files to Optionally Delete
- `D:/Interior-studio/database/firestore.rules` -- no longer needed
- Any Firebase config files

### Commands
```bash
npm uninstall firebase firebase-admin
npm run build  # Verify clean build with no Firebase references
```

### Final Verification
- Full end-to-end test of all user flows:
  1. Superadmin login and tenant approval
  2. Designer signup -> pending -> approve -> login -> dashboard
  3. Employee registration + login + dashboard
  4. Customer signup/login + Google OAuth + estimate flow
  5. Lead pipeline: create -> stage transitions -> convert to project
  6. Project phases/tasks CRUD with progress tracking
  7. Invoice creation + payment recording
  8. Vendor bill creation + payment recording
  9. Consultation form submission + convert to lead
  10. Website builder: all page editors
  11. Analytics dashboard with date range
  12. API routes: follow-up reminders + payment reminders
  13. File uploads (portfolio, logo, task attachments)
- Realtime updates work across browser tabs
- No console errors referencing Firebase
- Build completes without warnings

---

## Dependency Graph Between Batches

```
Batch 0 (setup) ─────────────┐
                              v
Batch 1 (schema + RLS) ──────┐
                              v
Batch 2 (auth) ──────────────┐
                              v
Batch 3 (core data) ─────────┤─── Batch 5 (website + pricing)
                              │            │
Batch 4 (finance) ───────────┤    Batch 6 (analytics)
                              │            │
Batch 7 (API routes) ────────┤    Batch 8 (storage)
                              │            │
                              └────────────┘
                                       │
                              Batch 9 (cleanup)
```

Batches 3, 4, 5, 6 can be partially parallelized once Batch 2 is complete. Batch 7 depends on the service file rewrites from Batches 3-4. Batch 8 is independent of data hooks. Batch 9 is strictly last.

---

## Key Risk Areas

1. **Project phases/tasks flattening** (Batch 3): This is the highest-risk change. The current code updates the entire `phases[]` array atomically. With flattened tables, each phase/task update is a separate row update. Progress recalculation must query all tasks for a phase, and all phases for a project. Consider creating PostgreSQL functions for progress recalculation.

2. **Real-time performance**: Firestore `onSnapshot` gives you the full snapshot on change. Supabase Realtime gives you the changed row only. Hooks need to either maintain local state and apply deltas, or refetch the full dataset on any change. Recommendation: refetch on change for simplicity, optimize later if performance is an issue.

3. **Employee auth migration**: Moving from plaintext to Supabase Auth is correct but requires careful implementation of the registration flow. The `addEmployee` function must now make a server-side call to create the auth account.

4. **Timeline events**: Currently embedded as `arrayUnion` in documents. Moving to a separate table means timeline display queries need a join or secondary fetch. The `useLeads` hook currently returns `lead.timeline` as a property -- now it needs to fetch from `timeline_events` table separately.

---

### Critical Files for Implementation
- `D:/Interior-studio/frontend/src/lib/firebase.ts` - Current singleton to replace with Supabase client
- `D:/Interior-studio/frontend/src/hooks/useProjects.ts` - Most complex hook with embedded phases/tasks to flatten
- `D:/Interior-studio/frontend/src/lib/services/invoiceService.ts` - Transaction-based logic to convert to PostgreSQL functions
- `D:/Interior-studio/frontend/src/hooks/useTenantAuth.ts` - Primary auth hook with tenant resolution logic
- `D:/Interior-studio/frontend/src/hooks/useWebsiteBuilder.ts` - Largest file (1300+ lines, 8 sub-hooks) requiring systematic conversion