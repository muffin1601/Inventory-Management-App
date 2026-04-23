import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server audit client is not configured.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, entity_type, entity_id, entity_name, reason, performed_by, performed_by_name, details, old_values, new_values } = body;

    // Use admin client to bypass RLS for audit logging
    const { data, error } = await supabaseAdmin
      .from('audit_trail')
      .insert({
        action,
        entity_type,
        entity_id,
        entity_name,
        reason: reason || 'No reason provided',
        performed_by,
        performed_by_name,
        details,
        old_values,
        new_values
      })
      .select()
      .single();

    if (error) {
      console.error('Audit API Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Audit API Catch:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
