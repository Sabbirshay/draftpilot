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

export const DEMO_MACROS = [
  {
    id: 'demo-1',
    name: 'Refund Request',
    category: 'Billing',
    content: 'Thank you for contacting us about a refund. I\'ve reviewed your account and can confirm [refund details]. The refund of [amount] will be processed within 3-5 business days...',
    tags: ['refund', 'billing', 'money-back'],
    usage_count: 47,
  },
  {
    id: 'demo-2',
    name: 'Shipping Delay',
    category: 'Logistics',
    content: 'I understand the wait can be frustrating, and I appreciate your patience. I\'ve checked the tracking for your order and here\'s the latest update: [tracking info]...',
    tags: ['shipping', 'delay', 'tracking'],
    usage_count: 32,
  },
  {
    id: 'demo-3',
    name: 'General Thank You',
    category: 'General',
    content: 'Thank you so much for reaching out and for being a valued customer! We truly appreciate your feedback about [topic]. We\'re always working to improve...',
    tags: ['thank-you', 'feedback', 'general'],
    usage_count: 65,
  },
];

export const DEMO_STATS = {
  draftsGenerated: 127,
  avgResponseTime: '1.8 min',
  customerSatisfaction: '94%',
  macrosActive: 12,
};
