import { scrubPII } from '../lib/pii-scrubber.ts';

export interface DemoTicket {
  id: string;
  category: 'return_refund' | 'shipping_status' | 'password_reset' | 'billing_question';
  customerName: string;
  customerEmail: string;
  subject: string;
  thread: Array<{ sender: string; timestamp: string; body: string }>;
  unredactedPiiSnippet: string;
}

export interface DemoDraftResult {
  draft: string;
  redactedThread: string;
  scrubbedCount: number;
  generationTimeMs: number;
  appliedTone: 'empathetic' | 'concise' | 'formal' | 'urgent';
  appliedMacroId?: string;
}

export interface DemoMacro {
  id: string;
  name: string;
  category: string;
  content: string;
  tags: string[];
  usage_count: number;
}

export const DEMO_TICKETS: DemoTicket[] = [
  {
    id: 'ticket-refund',
    category: 'return_refund',
    customerName: 'Sarah Martinez',
    customerEmail: 'sarah.martinez@acmecorp.com',
    subject: 'Order #4892 — Damaged ceramic item & refund request',
    thread: [
      {
        sender: 'Sarah Martinez <sarah.martinez@acmecorp.com>',
        timestamp: '10:14 AM',
        body: `Hi support team,

I received order #4892 this morning, but unfortunately the handmade ceramic vase arrived completely shattered in transit. I have attached photos of the package and broken item.

Could you please process a full refund to my Visa card ending in 4444 (full card number: 4111-2222-3333-4444)? If you need to confirm my identity, you can reach me directly at sarah.martinez@acmecorp.com or call my cell at +1 (555) 439-8201.

Thank you,
Sarah Martinez`,
      },
    ],
    unredactedPiiSnippet: 'Visa card: 4111-2222-3333-4444, Email: sarah.martinez@acmecorp.com, Phone: +1 (555) 439-8201',
  },
  {
    id: 'ticket-shipping',
    category: 'shipping_status',
    customerName: 'Marcus Brody',
    customerEmail: 'marcus.brody@atlaslogistics.org',
    subject: 'Tracking inquiry: Package delayed in transit — Order #67142',
    thread: [
      {
        sender: 'Marcus Brody <marcus.brody@atlaslogistics.org>',
        timestamp: '11:05 AM',
        body: `Hello Support,

I placed order #67142 four days ago and selected 2-day priority delivery. The tracking link shows the package has been "stuck in sorting hub" for 48 hours without movement.

The shipment was destined for 742 Evergreen Terrace, Springfield, OR 97477. We urgently need these supplies for a client installation on Friday.

Can you please check with the carrier or expedite a replacement shipment? You can reach me at 555-832-1920 or marcus.brody@atlaslogistics.org.

Regards,
Marcus Brody`,
      },
    ],
    unredactedPiiSnippet: 'Address: 742 Evergreen Terrace, Springfield, OR 97477, Phone: 555-832-1920, Email: marcus.brody@atlaslogistics.org',
  },
  {
    id: 'ticket-password',
    category: 'password_reset',
    customerName: 'Elena Rostova',
    customerEmail: 'elena.rostova@cybernet.co',
    subject: 'Urgent: Locked out of account / 2FA device lost',
    thread: [
      {
        sender: 'Elena Rostova <elena.rostova@cybernet.co>',
        timestamp: '1:22 PM',
        body: `URGENT ASSISTANCE NEEDED:

I dropped my work phone in water yesterday and lost access to my authenticator app for DraftPilot. I am locked out of our workspace and our team has client deadlines today.

My account email is elena.rostova@cybernet.co. My temporary backup passcode was passcode: SecretReset2026! and my login was originating from IP 192.168.1.105.

Please reset my 2FA or generate a one-time emergency bypass login link. Reach me on my emergency backup number +1 (555) 382-9012.

Thanks,
Elena`,
      },
    ],
    unredactedPiiSnippet: 'Secret: passcode: SecretReset2026!, IP: 192.168.1.105, Phone: +1 (555) 382-9012, Email: elena.rostova@cybernet.co',
  },
  {
    id: 'ticket-billing',
    category: 'billing_question',
    customerName: 'David Chen',
    customerEmail: 'david.chen@fintechlabs.com',
    subject: 'Question regarding annual billing switch & prorated refund',
    thread: [
      {
        sender: 'David Chen <david.chen@fintechlabs.com>',
        timestamp: '2:45 PM',
        body: `Hi DraftPilot Billing Team,

We currently have 5 team members on the monthly plan. We just received our monthly receipt #INV-2026-908 for $249.00 billed to Mastercard 5412-7512-3412-9012.

We want to switch our entire team to the Annual billing plan to take advantage of the 20% team savings. How does the prorated switch work with the payment we just made today? Can you apply the discount retroactively to this cycle?

Best,
David Chen
VP Operations, FintechLabs (david.chen@fintechlabs.com)`,
      },
    ],
    unredactedPiiSnippet: 'Invoice: #INV-2026-908, Card: 5412-7512-3412-9012, Email: david.chen@fintechlabs.com',
  },
];

export const DEMO_MACROS: DemoMacro[] = [
  {
    id: 'demo-1',
    name: 'Refund Request',
    category: 'Billing',
    content: "I've reviewed your account and initiated a full refund back to your original payment method. The credit will reflect in 3-5 business days. No return is required for this item.",
    tags: ['refund', 'billing', 'money-back'],
    usage_count: 47,
  },
  {
    id: 'demo-2',
    name: 'Shipping Delay',
    category: 'Logistics',
    content: "I've escalated this with our priority carrier liaison and dispatched a complimentary priority replacement shipment. Here is your tracking link: [Carrier Tracking Link].",
    tags: ['shipping', 'delay', 'tracking'],
    usage_count: 32,
  },
  {
    id: 'demo-3',
    name: 'General Thank You',
    category: 'General',
    content: "Thank you so much for reaching out and for being a valued customer! We truly appreciate your partnership and feedback.",
    tags: ['thank-you', 'feedback', 'general'],
    usage_count: 65,
  },
  {
    id: 'demo-4',
    name: '2FA Security Bypass',
    category: 'Security',
    content: "I've generated a secure, one-time bypass link that expires in 15 minutes. Once logged in, please re-enroll your new authenticator device under Account > Security.",
    tags: ['password', '2fa', 'security'],
    usage_count: 28,
  },
  {
    id: 'demo-5',
    name: 'Annual Billing Switch',
    category: 'Billing',
    content: "We've applied the 20% annual discount to your account and prorated 100% of your recent payment as an instant credit toward the annual plan.",
    tags: ['annual', 'billing', 'discount'],
    usage_count: 53,
  },
];

export const DEMO_DRAFT_EXAMPLE = {
  customerEmail: {
    from: 'sarah.martinez@acmecorp.com',
    subject: 'Order #4892 — Wrong size received',
    body: `Hi there,

I received my order today but the t-shirt is a Medium instead of the Large I ordered. I've attached photos of the shipping label showing the correct order number.

Could you please send me the correct size? I need it for an event this weekend.

Thanks,
Sarah`,
    timestamp: '2 hours ago',
  },
  aiDraft: {
    body: `Hi Sarah,

Thank you for reaching out, and I'm sorry about the mix-up with your order! I can see order #4892 was indeed placed for a Large.

I've already initiated a replacement shipment with the correct size. You'll receive a tracking number within the next few hours. No need to return the Medium — please keep it or pass it along to someone who can use it.

Given your upcoming event, I've flagged this for priority shipping at no extra charge. You should have it by Thursday at the latest.

Is there anything else I can help with?

Best,
{Your Name}`,
    confidence: 94,
    macroUsed: 'Shipping & Size Exchange',
  },
};

export const DEMO_STATS = {
  draftsGenerated: 127,
  avgResponseTime: '1.8 min',
  customerSatisfaction: '94%',
  macrosActive: 12,
};

export function resolveDemoTicket(idOrCategory?: string): DemoTicket {
  if (!idOrCategory) return DEMO_TICKETS[0];
  const found = DEMO_TICKETS.find(
    (t) => t.id === idOrCategory || t.category === idOrCategory
  );
  return found || DEMO_TICKETS[0];
}

export function synthesizeDemoDraft(
  ticket: DemoTicket,
  tone: string,
  macroId?: string
): DemoDraftResult {
  const firstName = ticket.customerName.split(' ')[0] || 'there';
  const fullThread = ticket.thread.map((t) => t.body).join('\n\n');
  const redactedThread = scrubPII(fullThread);

  // Count scrubbed tokens
  const redactions = redactedThread.match(/\[(CARD|EMAIL|TOKEN|SECRET|SSN|IP|PHONE|ADDRESS|CUSTOM)_REDACTED\]/g);
  const scrubbedCount = redactions ? redactions.length : 0;

  // Normalize tone
  const normalizedTone = tone.toLowerCase().trim();
  const validTones: Array<DemoDraftResult['appliedTone']> = ['empathetic', 'concise', 'formal', 'urgent'];
  const appliedTone: DemoDraftResult['appliedTone'] = (validTones.includes(
    normalizedTone as DemoDraftResult['appliedTone']
  )
    ? normalizedTone
    : 'empathetic') as DemoDraftResult['appliedTone'];

  // Macro lookup
  const matchedMacro = macroId ? DEMO_MACROS.find((m) => m.id === macroId) : undefined;
  const macroContent = matchedMacro ? `\n\n${matchedMacro.content}` : '';

  let draft = '';

  switch (ticket.category) {
    case 'return_refund': {
      if (appliedTone === 'empathetic') {
        draft = `Hi ${firstName},

I am so terribly sorry to hear that your ceramic vase arrived damaged in transit! I completely understand how disappointing and frustrating that is after waiting for your package.

I have immediately authorized and initiated a full refund back to your original payment card. You should see the credit reflected on your statement within 3–5 business days. Please don't worry about returning the broken pieces—feel free to safely dispose of them.${macroContent}

If there is anything else I can do to make this right, please don't hesitate to let me know.

Warm regards,
DraftPilot Support Team`;
      } else if (appliedTone === 'concise') {
        draft = `Hi ${firstName},

Refund Processed:
• Full refund authorized for Order #4892 (3–5 business days back to original card).
• Return status: Waived. Please safely dispose of the broken item.${macroContent}

Let us know if you need anything else.

Best,
DraftPilot Support`;
      } else if (appliedTone === 'formal') {
        draft = `Dear Ms. ${ticket.customerName.split(' ').slice(-1)[0] || firstName},

Thank you for contacting customer support regarding Order #4892. We sincerely regret the transit damage sustained by your recent shipment.

Please be advised that a full refund has been authorized and issued to your payment account on file. Banking institutions typically post this credit within three to five business days. The requirement for physical return has been officially waived.${macroContent}

Should you require any further documentation or assistance, please inform us.

Sincerely,
Customer Operations
DraftPilot`;
      } else {
        // urgent
        draft = `Hi ${firstName} — Priority Refund Escalation for Order #4892:

1. Immediate Action: Full refund has been expedited and issued directly to your card.
2. Disposal: No return shipping necessary; item may be discarded safely immediately.${macroContent}

We have prioritized this resolution to prevent any further disruption.

Regards,
DraftPilot Priority Support`;
      }
      break;
    }

    case 'shipping_status': {
      if (appliedTone === 'empathetic') {
        draft = `Hi ${firstName},

Thank you for checking in with us, and I sincerely apologize for the delay in your shipment for Order #67142. I know how critical these supplies are for your upcoming Friday installation, and waiting without clear tracking updates is always stressful.

I have personally contacted our logistics liaison at the sorting hub to expedite this package. In addition, I have flagged your order for priority monitoring to ensure delivery reaches you before your deadline.${macroContent}

I will keep you updated every step of the way until it is safely in your hands.

Warm regards,
DraftPilot Support Team`;
      } else if (appliedTone === 'concise') {
        draft = `Hi ${firstName},

Order #67142 Shipping Status:
• Carrier status: Contacted hub for expedited dispatch.
• Target delivery: Tracking updated for delivery ahead of Friday installation.${macroContent}

We will send live tracking pings directly to your email as updates arrive.

Best,
DraftPilot Support`;
      } else if (appliedTone === 'formal') {
        draft = `Dear Mr. ${ticket.customerName.split(' ').slice(-1)[0] || firstName},

Thank you for bringing the transit status of Order #67142 to our attention. We apologize for the unforeseen delay encountered at the regional sorting facility.

Our logistics dispatch team has submitted an urgent escalation request with the carrier to expedite transport to your specified destination. Real-time telemetry monitoring has been activated for this consignment.${macroContent}

We remain at your service should you require additional tracking credentials.

Sincerely,
Logistics & Fulfillment
DraftPilot`;
      } else {
        // urgent
        draft = `Hi ${firstName} — Expedited Transit Escalation (Order #67142):

• URGENT CARRIER INTERVENTION: We have opened an escalated trace with hub dispatch.
• INSTALLATION GUARANTEE: If carrier transit does not show movement within 6 hours, a priority courier replacement will be automatically released.${macroContent}

We are actively watching this delivery.

Best,
DraftPilot Dispatch`;
      }
      break;
    }

    case 'password_reset': {
      if (appliedTone === 'empathetic') {
        draft = `Hi ${firstName},

I am so sorry to hear about your phone! Losing access to your authenticator app right when team deadlines are looming is incredibly stressful.

Please don't worry—I am here to help you get back into your workspace right away. For your security, I have verified your account and generated a secure, temporary authentication bypass.${macroContent}

Please check your inbox for the secure reset link. Once you log back in, you can easily pair your new device under Account > Security Settings.

Best regards,
DraftPilot Security & Support`;
      } else if (appliedTone === 'concise') {
        draft = `Hi ${firstName},

2FA Access Recovery:
• Security check: Account verified.
• One-time bypass link dispatched to your verified email (valid for 15 minutes).
• Next step: Log in and configure your new authenticator app under Settings > Security.${macroContent}

Regards,
DraftPilot Security`;
      } else if (appliedTone === 'formal') {
        draft = `Dear Ms. ${ticket.customerName.split(' ').slice(-1)[0] || firstName},

Thank you for contacting security operations regarding your account access credentials. We acknowledge the urgency regarding your lost two-factor authentication device.

Following internal security identity verification protocols, a temporary single-use access link has been generated and dispatched to your registered address.${macroContent}

Upon re-authenticating, please re-enroll your new hardware security token within account settings.

Sincerely,
Security & Identity Governance
DraftPilot`;
      } else {
        // urgent
        draft = `Hi ${firstName} — EMERGENCY ACCESS RESTORATION:

1. Immediate Bypass Issued: Single-use security token has been generated to bypass the lost 2FA device.
2. Link Expiry: 15-minute validity window. Check your email immediately.${macroContent}

Access has been restored as high priority.

Best,
DraftPilot Emergency Support`;
      }
      break;
    }

    case 'billing_question': {
      if (appliedTone === 'empathetic') {
        draft = `Hi ${firstName},

Thank you so much for reaching out and for your team's continued partnership with DraftPilot! We're thrilled to hear that your team wants to switch to our Annual plan.

You absolutely qualify for the 20% team discount! We will prorate 100% of the $249.00 payment you made today for Invoice #INV-2026-908, applying it immediately as credit toward the discounted annual rate so you don't pay a penny extra.${macroContent}

I can make this switch for you right now, or you can activate it under Settings > Billing with the discount automatically calculated. Let me know what you prefer!

Warm regards,
DraftPilot Billing Team`;
      } else if (appliedTone === 'concise') {
        draft = `Hi ${firstName},

Annual Plan Switch Summary:
• Discount: 20% annual savings applied.
• Proration: 100% of today's $249.00 payment (INV-2026-908) credited toward the annual term.
• Net cost: Difference calculated automatically with zero overlap fee.${macroContent}

Ready to proceed whenever you give the green light.

Best,
DraftPilot Billing`;
      } else if (appliedTone === 'formal') {
        draft = `Dear Mr. ${ticket.customerName.split(' ').slice(-1)[0] || firstName},

Thank you for your inquiry regarding enterprise subscription restructuring for your organization.

We confirm that your 5 team seats qualify for our 20% annual subscription rate. Full credit for Invoice #INV-2026-908 ($249.00) will be prorated against the annual billing cycle, ensuring seamless account continuity without redundant billing.${macroContent}

Please confirm your approval to execute this billing transition on your behalf.

Sincerely,
Client Finance & Billing
DraftPilot`;
      } else {
        // urgent
        draft = `Hi ${firstName} — Rapid Billing Update:

• 20% DISCOUNT APPROVED: Team annual rate unlocked immediately.
• PRORATED CREDIT: Full $249.00 from invoice #INV-2026-908 credited directly to the new cycle.${macroContent}

Reply "CONFIRM" and we will switch your workspace instantly.

Best,
DraftPilot Billing`;
      }
      break;
    }

    default: {
      draft = `Hi ${firstName},

Thank you for reaching out to DraftPilot Support. We have received your inquiry regarding "${ticket.subject}" and are reviewing the details.${macroContent}

Best regards,
DraftPilot Team`;
    }
  }

  // Realistic generation time simulation (~310ms)
  const simulatedTimeMs = Math.floor(Math.random() * 40) + 290;

  return {
    draft,
    redactedThread,
    scrubbedCount,
    generationTimeMs: simulatedTimeMs,
    appliedTone,
    appliedMacroId: macroId,
  };
}
