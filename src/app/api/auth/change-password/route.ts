import { supabase, supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/auth/change-password
// Authenticated endpoint for users to change their own password
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { old_password, new_password } = body;

    if (!old_password || !new_password) {
      return NextResponse.json(
        { error: 'Missing old_password or new_password' },
        { status: 400 }
      );
    }

    // Verify old password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: old_password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Incorrect current password' },
        { status: 401 }
      );
    }

    // Update password using admin client
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Admin operations not available' },
        { status: 503 }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: new_password }
    );

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update password: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Update password_changed_at timestamp
    await supabaseAdmin
      .from('user_profiles')
      .update({
        password_changed_at: new Date().toISOString(),
        requires_password_change: false,
      })
      .eq('id', user.id);

    // Log the action
    await supabaseAdmin
      .from('audit_trail')
      .insert({
        action: 'PASSWORD_CHANGED',
        entity_type: 'user',
        entity_id: user.id,
        entity_name: user.email,
        performed_by: user.id,
      });

    return NextResponse.json(
      { success: true, message: 'Password changed successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
