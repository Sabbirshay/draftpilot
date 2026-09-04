export interface SupportTicketPayload {
  name?: string;
  email: string;
  category?: 'bug' | 'billing' | 'extension' | 'feature' | 'account' | 'other';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  message: string;
  systemInfo?: {
    userAgent?: string;
    version?: string;
    extensionInstalled?: boolean;
  };
}

export interface SupportTicketResponse {
  success: boolean;
  ticketId?: string;
  timestamp?: string;
  message: string;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limiter: max 10 requests per 5 minutes per IP
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.expiresAt) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + windowMs });
    return false;
  }

  if (entry.count >= 10) {
    return true;
  }

  entry.count += 1;
  return false;
}

export function validateTicketPayload(body: any): { valid: boolean; error?: string; data?: SupportTicketPayload } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object' };
  }

  const { email, subject, message, name, category, priority, systemInfo } = body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return { valid: false, error: 'A valid email address is required' };
  }

  if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
    return { valid: false, error: 'Subject is required and must be at least 3 characters' };
  }

  if (subject.trim().length > 200) {
    return { valid: false, error: 'Subject cannot exceed 200 characters' };
  }

  if (!message || typeof message !== 'string' || message.trim().length < 5) {
    return { valid: false, error: 'Message is required and must be at least 5 characters' };
  }

  if (message.trim().length > 5000) {
    return { valid: false, error: 'Message cannot exceed 5000 characters' };
  }

  const validCategories = ['bug', 'billing', 'extension', 'feature', 'account', 'other'];
  if (category && !validCategories.includes(category)) {
    return { valid: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` };
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (priority && !validPriorities.includes(priority)) {
    return { valid: false, error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` };
  }

  return {
    valid: true,
    data: {
      name: typeof name === 'string' ? name.trim() : undefined,
      email: email.trim(),
      category: category || 'other',
      priority: priority || 'medium',
      subject: subject.trim(),
      message: message.trim(),
      systemInfo: typeof systemInfo === 'object' ? systemInfo : undefined,
    },
  };
}

export function generateTicketId(): string {
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const timeSuffix = Date.now().toString(36).slice(-3).toUpperCase();
  return `DP-TK-${randomSuffix}${timeSuffix}`;
}
