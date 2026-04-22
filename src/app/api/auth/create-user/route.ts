import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/auth/create-user
// Admin-only endpoint to create new users
export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization' },
        { status: 401 }
      );
    }

    // If supabaseAdmin is not available, this route cannot work
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Admin operations not available' },
        { status: 503 }
      );
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin, role_id')
      .eq('id', user.id)
      .single();

    const isAdmin = 
      profile?.is_admin === true || 
      profile?.role_id?.toLowerCase() === 'r1' || 
      profile?.role_id?.toLowerCase() === 'r2';

    if (!isAdmin) {
      console.error('Forbidden: User is not an admin', { 
        userId: user.id, 
        profile 
      });
      return NextResponse.json(
        { error: 'Only admins can create users' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { full_name, email, temporary_password, role_id } = body;

    // Validation
    if (!full_name || !email || !temporary_password || !role_id) {
      return NextResponse.json(
        { error: 'Missing required fields: full_name, email, temporary_password, role_id' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Validate role exists
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id,name')
      .eq('id', role_id)
      .single();

    if (roleError || !roleRow) {
      return NextResponse.json(
        { error: 'Invalid role_id' },
        { status: 400 }
      );
    }

    // Create auth user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporary_password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (createError || !authData.user) {
      return NextResponse.json(
        { error: `Failed to create user: ${createError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Create user profile
    const { data: createdProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        full_name,
        email,
        role_id,
        status: 'ACTIVE',
        requires_password_change: true,
      })
      .select()
      .single();

    if (profileError) {
      // Delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Failed to create user profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    // Log the action
    await supabaseAdmin
      .from('audit_trail')
      .insert({
        action: 'USER_CREATED',
        entity_type: 'user',
        entity_id: authData.user.id,
        entity_name: email,
        performed_by: user.id,
        new_values: {
          full_name,
          email,
          role_id,
        },
      });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: createdProfile.id,
          full_name: createdProfile.full_name,
          email: createdProfile.email,
          role_id: createdProfile.role_id,
          role_name: roleRow.name,
          status: createdProfile.status,
          requires_password_change: createdProfile.requires_password_change,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
