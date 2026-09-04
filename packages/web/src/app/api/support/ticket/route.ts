export const dynamic = 'force-dynamic';

import {
  validateTicketPayload,
  generateTicketId,
  isRateLimited,
  type SupportTicketPayload,
  type SupportTicketResponse,
} from '../../../../lib/support-ticket.ts';

export type { SupportTicketPayload, SupportTicketResponse };

export async function POST(req: Request): Promise<Response> {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    if (isRateLimited(ip)) {
      return Response.json(
        {
          success: false,
          message: 'Rate limit exceeded. Please wait a few minutes before submitting another ticket.',
          error: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      );
    }

    const json = await req.json().catch(() => null);
    const validation = validateTicketPayload(json);

    if (!validation.valid || !validation.data) {
      return Response.json(
        {
          success: false,
          message: validation.error || 'Invalid ticket submission',
          error: validation.error,
        },
        { status: 400 }
      );
    }

    const ticketId = generateTicketId();
    const timestamp = new Date().toISOString();

    return Response.json(
      {
        success: true,
        ticketId,
        timestamp,
        message: `Your support ticket (${ticketId}) has been successfully created. Our engineering team will follow up at ${validation.data.email}.`,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return Response.json(
      {
        success: false,
        message: 'An unexpected error occurred while submitting your ticket.',
        error: err?.message || 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
