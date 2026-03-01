// Role types
export type EmployeeRole =
  | "owner"
  | "sales"
  | "designer"
  | "project_manager"
  | "site_supervisor"
  | "accountant";

// Permission actions
export type PermissionAction =
  | "view_dashboard"
  | "view_leads"
  | "manage_leads"
  | "view_estimates"
  | "view_projects"
  | "manage_projects"
  | "assign_employees"
  | "view_invoices"
  | "manage_invoices"
  | "view_vendor_bills"
  | "manage_vendor_bills"
  | "view_analytics"
  | "manage_employees"
  | "manage_website"
  | "manage_pricing"
  | "manage_settings"
  | "upload_attachments"
  | "add_comments"
  | "assign_roles";

// Permission matrix
const PERMISSIONS: Record<EmployeeRole, PermissionAction[]> = {
  owner: [
    "view_dashboard",
    "view_leads",
    "manage_leads",
    "view_estimates",
    "view_projects",
    "manage_projects",
    "assign_employees",
    "view_invoices",
    "manage_invoices",
    "view_vendor_bills",
    "manage_vendor_bills",
    "view_analytics",
    "manage_employees",
    "manage_website",
    "manage_pricing",
    "manage_settings",
    "upload_attachments",
    "add_comments",
    "assign_roles",
  ],
  sales: [
    "view_dashboard",
    "view_leads",
    "manage_leads",
    "view_estimates",
    "view_projects",
  ],
  designer: [
    "view_dashboard",
    "view_leads",
    "view_estimates",
    "view_projects",
    "manage_projects",
    "upload_attachments",
    "add_comments",
  ],
  project_manager: [
    "view_dashboard",
    "view_leads",
    "view_estimates",
    "view_projects",
    "manage_projects",
    "assign_employees",
    "view_invoices",
    "view_vendor_bills",
    "view_analytics",
    "upload_attachments",
    "add_comments",
    "assign_roles",
  ],
  site_supervisor: [
    "view_dashboard",
    "view_projects",
    "manage_projects",
    "upload_attachments",
    "add_comments",
  ],
  accountant: [
    "view_dashboard",
    "view_invoices",
    "manage_invoices",
    "view_vendor_bills",
    "manage_vendor_bills",
    "view_analytics",
    "add_comments",
  ],
};

// Sidebar item definition
export interface SidebarPermission {
  href: string;
  requiredPermission: PermissionAction;
}

// Map sidebar items to required permissions
const SIDEBAR_PERMISSION_MAP: SidebarPermission[] = [
  { href: "/dashboard", requiredPermission: "view_dashboard" },
  { href: "/dashboard/orders", requiredPermission: "view_leads" },
  { href: "/dashboard/projects", requiredPermission: "view_projects" },
  { href: "/dashboard/finance", requiredPermission: "view_invoices" },
  { href: "/dashboard/customers", requiredPermission: "view_leads" },
  { href: "/dashboard/analytics", requiredPermission: "view_analytics" },
  { href: "/dashboard/consultation-requests", requiredPermission: "view_leads" },
  { href: "/dashboard/website-setup", requiredPermission: "manage_website" },
  { href: "/dashboard/employees", requiredPermission: "manage_employees" },
  { href: "/dashboard/settings", requiredPermission: "manage_settings" },
];

// Check if a user with given roles can perform an action
export function can(roles: string[], action: PermissionAction): boolean {
  return roles.some((role) => {
    const perms = PERMISSIONS[role as EmployeeRole];
    return perms?.includes(action) ?? false;
  });
}

// Check if user has any of the required roles
export function hasAnyRole(roles: string[], required: EmployeeRole[]): boolean {
  return roles.some((r) => required.includes(r as EmployeeRole));
}

// Filter sidebar items by user roles — returns allowed hrefs
export function getAllowedSidebarHrefs(roles: string[]): Set<string> {
  const allowed = new Set<string>();
  for (const mapping of SIDEBAR_PERMISSION_MAP) {
    if (can(roles, mapping.requiredPermission)) {
      allowed.add(mapping.href);
    }
  }
  return allowed;
}

// Determine dashboard view type based on roles
export function getDashboardView(
  roles: string[]
): "all" | "sales" | "projects" | "finance" {
  if (roles.includes("owner")) return "all";
  if (roles.includes("accountant")) return "finance";
  if (roles.includes("sales")) return "sales";
  if (
    roles.includes("project_manager") ||
    roles.includes("designer") ||
    roles.includes("site_supervisor")
  )
    return "projects";
  return "all";
}
