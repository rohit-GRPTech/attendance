/**
 * Central branding configuration. Change the product identity here and it
 * propagates to the web app, API, emails and generated documents.
 */
export const branding = {
  productName: 'AppForge',
  tagline: 'Build business software in a day',
  description:
    'AppForge is a low-code SaaS platform where teams build and publish small business systems from reusable visual components.',
  companyName: 'AppForge Labs',
  supportEmail: 'support@appforge.dev',
  websiteUrl: 'https://appforge.dev',
  primaryColor: '#4f46e5',
  logoText: 'AppForge',
} as const;

export type Branding = typeof branding;
