export interface PlanFeatureRow {
  dimension: string;
  category?: string;
  free: string | boolean;
  team: string | boolean;
  enterprise: string | boolean;
  tooltip?: string;
}

export const COMPARISON_FEATURES: PlanFeatureRow[] = [
  {
    dimension: 'Monthly AI Draft Limit',
    free: '50 drafts / month',
    team: '1,000 drafts / seat / mo',
    enterprise: '5,000+ drafts / month',
    tooltip: 'Pooled draft volume available across team members each billing cycle',
  },
  {
    dimension: 'Custom Support Macros',
    free: 'Up to 5 personal macros',
    team: 'Unlimited shared team macros',
    enterprise: 'Unlimited team + admin macros',
    tooltip: 'Reusable response templates and dynamic snippet insertion',
  },
  {
    dimension: 'Knowledge Docs & Embeddings',
    free: '1 basic reference document',
    team: 'Unlimited docs (PDF, Docx, MD)',
    enterprise: 'Unlimited docs + continuous sync',
    tooltip: 'Team documentation used to ground AI drafts in your product context',
  },
  {
    dimension: 'Team Seats Included',
    free: '1 solo founder seat',
    team: 'Flexible seats ($19/mo or $15/yr)',
    enterprise: 'Unlimited seats with RBAC',
    tooltip: 'Seats with role-based access control and shared workspaces',
  },
  {
    dimension: 'Custom PII Redaction Rules',
    free: 'Standard built-in (8 rules)',
    team: 'Standard + Custom rules',
    enterprise: 'Custom rules + Audit vault',
    tooltip: 'Regex and keyword redaction to scrub confidential data before processing',
  },
  {
    dimension: 'Support SLA & Channels',
    free: 'Community & Email support',
    team: 'Priority email & Discord (<12h)',
    enterprise: '24/7 Dedicated Slack (<1h)',
    tooltip: 'Guaranteed response times and direct engineering escalation',
  },
];
