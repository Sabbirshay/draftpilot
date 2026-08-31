import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, verifySuperAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export interface GlobalMacro {
  id: string;
  name: string;
  category: string;
  tags: string[];
  content: string;
  adoptionCount: number;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_GLOBAL_MACROS: GlobalMacro[] = [
  {
    id: '1',
    name: 'Universal 30-Day Money Back Guarantee',
    category: 'Billing & Refunds',
    tags: ['refund', 'return', 'policy'],
    content: 'Hi {{name}},\n\nThank you for reaching out! You are fully covered by our 30-day money back guarantee. I have initiated your refund process.\n\nOnce processed, your funds will arrive in 3-5 business days on your original payment method.\n\nBest regards,\nSupport Team',
    adoptionCount: 1,
  },
  {
    id: '2',
    name: 'MFA & 2-Factor Authentication Unlock',
    category: 'Account & Security',
    tags: ['auth', 'security', 'login', '2fa'],
    content: 'Hi {{name}},\n\nI can certainly assist you with resetting your two-factor device. I have sent a secure temporary bypass link to your verified email.\n\nPlease follow the link within 15 minutes to confirm your identity.\n\nWarm regards,\nSecurity Support',
    adoptionCount: 1,
  },
  {
    id: '3',
    name: 'Carrier Delay & Package Tracking',
    category: 'Shipping & Logistics',
    tags: ['shipping', 'delay', 'tracking'],
    content: 'Hi {{name}},\n\nThanks for checking in on your order status! Your shipment is actively in transit with our carrier and tracking milestone updates indicate delivery within 2-3 business days.\n\nPlease let us know if you need any further assistance!\n\nBest,\nSupport Team',
    adoptionCount: 1,
  },
  {
    id: '4',
    name: 'Stripe Invoice & Official VAT Receipt',
    category: 'Billing & Invoices',
    tags: ['invoice', 'vat', 'tax', 'receipt'],
    content: 'Hi {{name}},\n\nHere is confirmation of your recent transaction. You can download an itemized PDF copy of all past invoices anytime directly from your billing portal.\n\nLet me know if you need any adjustments to your company billing details!\n\nCheers,\nBilling Team',
    adoptionCount: 1,
  },
];

// Persistent runtime global catalog
let globalMacrosCatalog: GlobalMacro[] = [...DEFAULT_GLOBAL_MACROS];

export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  return NextResponse.json({
    success: true,
    macros: globalMacrosCatalog,
  });
}

export async function POST(req: NextRequest) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await req.json();

    // 1. Broadcast action: distribute macro(s) across all workspaces bypassing client RLS
    if (body.action === 'broadcast') {
      const targetMacros: GlobalMacro[] = body.macro
        ? [body.macro]
        : body.macros && Array.isArray(body.macros)
        ? body.macros
        : globalMacrosCatalog;

      if (!targetMacros || targetMacros.length === 0) {
        return NextResponse.json({ error: 'No macros available to broadcast' }, { status: 400 });
      }

      // Fetch all customer teams with service-role admin client
      const { data: teams, error: teamErr } = await supabaseAdmin
        .from('teams')
        .select('id, name');

      if (teamErr) throw teamErr;

      let insertedCount = 0;
      let updatedCount = 0;

      if (teams && teams.length > 0) {
        for (const team of teams) {
          // Fetch existing macros for this team to avoid duplicate records
          const { data: existingMacros } = await supabaseAdmin
            .from('macros')
            .select('id, name')
            .eq('team_id', team.id);

          const existingNameMap = new Map<string, string>();
          (existingMacros || []).forEach((em) => {
            if (em.name) existingNameMap.set(em.name.toLowerCase().trim(), em.id);
          });

          for (const m of targetMacros) {
            const macroNameKey = m.name.toLowerCase().trim();
            const existingId = existingNameMap.get(macroNameKey);

            if (existingId) {
              // Update existing macro definition
              const { error: updateErr } = await supabaseAdmin
                .from('macros')
                .update({
                  category: m.category,
                  tags: Array.isArray(m.tags) ? m.tags : [],
                  content: m.content,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingId);

              if (!updateErr) updatedCount++;
            } else {
              // Insert new macro definition for the team
              const { error: insertErr } = await supabaseAdmin
                .from('macros')
                .insert({
                  team_id: team.id,
                  name: m.name.trim(),
                  category: m.category || 'General',
                  tags: Array.isArray(m.tags) ? m.tags : [],
                  content: m.content,
                  usage_count: 0,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });

              if (!insertErr) insertedCount++;
            }
          }
        }

        // Update adoption count in catalog
        const teamCount = teams.length;
        globalMacrosCatalog = globalMacrosCatalog.map((gm) => {
          const matched = targetMacros.some((tm) => tm.id === gm.id || tm.name === gm.name);
          return matched ? { ...gm, adoptionCount: teamCount } : gm;
        });
      }

      return NextResponse.json({
        success: true,
        teamsCount: teams?.length || 0,
        insertedCount,
        updatedCount,
        totalProcessed: insertedCount + updatedCount,
        message: `Successfully broadcasted to ${teams?.length || 0} workspaces (${insertedCount} new, ${updatedCount} updated)`,
      });
    }

    // 2. Create action: add a new global template
    const name = (body.name || '').trim();
    const content = (body.content || '').trim();
    if (!name || !content) {
      return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
    }

    const tags = Array.isArray(body.tags)
      ? body.tags
      : typeof body.tags === 'string'
      ? body.tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
      : [];

    const newMacro: GlobalMacro = {
      id: body.id || String(Date.now()),
      name,
      category: body.category || 'General',
      tags,
      content,
      adoptionCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    globalMacrosCatalog.push(newMacro);

    return NextResponse.json({
      success: true,
      macro: newMacro,
      macros: globalMacrosCatalog,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await req.json();
    const targetId = body.id;
    if (!targetId) {
      return NextResponse.json({ error: 'Missing macro id' }, { status: 400 });
    }

    const index = globalMacrosCatalog.findIndex((m) => m.id === targetId);
    if (index === -1) {
      return NextResponse.json({ error: 'Macro not found' }, { status: 404 });
    }

    const tags = body.tags !== undefined
      ? (Array.isArray(body.tags)
          ? body.tags
          : typeof body.tags === 'string'
          ? body.tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
          : [])
      : globalMacrosCatalog[index].tags;

    const updatedMacro: GlobalMacro = {
      ...globalMacrosCatalog[index],
      name: body.name !== undefined ? body.name.trim() : globalMacrosCatalog[index].name,
      category: body.category !== undefined ? body.category : globalMacrosCatalog[index].category,
      tags,
      content: body.content !== undefined ? body.content.trim() : globalMacrosCatalog[index].content,
      updatedAt: new Date().toISOString(),
    };

    globalMacrosCatalog[index] = updatedMacro;

    return NextResponse.json({
      success: true,
      macro: updatedMacro,
      macros: globalMacrosCatalog,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifySuperAdmin(req);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    let targetId = req.nextUrl.searchParams.get('id');
    if (!targetId) {
      try {
        const body = await req.json();
        targetId = body.id;
      } catch {
        // Body might be empty
      }
    }

    if (!targetId) {
      return NextResponse.json({ error: 'Missing macro id' }, { status: 400 });
    }

    const initialLength = globalMacrosCatalog.length;
    globalMacrosCatalog = globalMacrosCatalog.filter((m) => m.id !== targetId);

    if (globalMacrosCatalog.length === initialLength) {
      return NextResponse.json({ error: 'Macro not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: targetId,
      macros: globalMacrosCatalog,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
