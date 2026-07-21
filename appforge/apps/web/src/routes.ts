/** Central route configuration — every navigation item maps to one of these. */
export const routes = {
  // Auth
  signIn: '/auth/sign-in',
  register: '/auth/register',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  verifyEmail: '/auth/verify-email',
  invitation: '/auth/invitation',
  accessDenied: '/auth/access-denied',
  suspended: '/auth/suspended',
  sessionExpired: '/auth/session-expired',

  // Workspace
  selectWorkspace: '/workspaces',

  // Dashboard shell
  dashboard: '/',
  applications: '/applications',
  newApplication: '/applications/new',
  aiGenerator: '/applications/generate',
  builder: (appId = ':appId') => `/builder/${appId}`,
  builderWorkflow: (appId = ':appId', workflowId = ':workflowId') => `/builder/${appId}/workflows/${workflowId}`,
  preview: (appId = ':appId') => `/preview/${appId}`,
  data: '/data',
  appData: (appId = ':appId') => `/data/${appId}`,
  workflows: '/workflows',
  users: '/users',
  marketplace: '/marketplace',
  template: (templateId = ':templateId') => `/marketplace/templates/${templateId}`,
  purchases: '/purchases',
  seller: '/seller',
  notifications: '/notifications',
  auditLogs: '/audit-logs',
  settings: '/settings',
  billing: '/settings/billing',

  // Runtime portal
  portal: (tenantSlug = ':tenantSlug') => `/portal/${tenantSlug}`,
  portalApp: (tenantSlug = ':tenantSlug', appSlug = ':appSlug') => `/portal/${tenantSlug}/${appSlug}`,
  portalPage: (tenantSlug = ':tenantSlug', appSlug = ':appSlug', pageSlug = ':pageSlug') =>
    `/portal/${tenantSlug}/${appSlug}/${pageSlug}`,
} as const;
