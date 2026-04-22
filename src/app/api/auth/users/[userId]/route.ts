import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/auth/users/[userId]
// Admin-only endpoint to update user status, role, permissions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Verify admin authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Admin operations not available' },
        { status: 503 }
      );
    }

    const token = authHeader.slice(7);
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if requester is admin
    const { data: adminProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin, role_id')
      .eq('id', adminUser.id)
      .single();

    const isAdmin = 
      adminProfile?.is_admin === true || 
      adminProfile?.role_id?.toLowerCase() === 'r1' || 
      adminProfile?.role_id?.toLowerCase() === 'r2';

    if (!isAdmin) {
      console.error('Forbidden: User is not an admin', { 
        adminId: adminUser.id, 
        adminProfile 
      });
      return NextResponse.json(
        { error: 'Only admins can update users' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      full_name,
      email,
      role_id,
      status,
      custom_permission_keys,
      revoked_permission_keys,
      password,
    } = body;

    // Validate status if provided
    if (status && !['ACTIVE', 'DISABLED', 'PENDING'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Get current user data
    const { data: currentUser, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (full_name) updateData.full_name = full_name;
    if (email) updateData.email = email;
    if (role_id) updateData.role_id = role_id;
    if (status) updateData.status = status;
    if (Array.isArray(custom_permission_keys)) updateData.custom_permission_keys = custom_permission_keys;
    if (Array.isArray(revoked_permission_keys)) updateData.revoked_permission_keys = revoked_permission_keys;

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Update Error:', updateError);
      return NextResponse.json(
        { error: `Failed to update profile: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Update Auth Email or Password if provided
    if ((email && email !== currentUser.email) || password) {
      const authUpdates: any = {};
      if (email && email !== currentUser.email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ...authUpdates,
        email_confirm: true
      });
      
      if (authUpdateError) {
        console.error('Auth Update Error:', authUpdateError);
        // If it was just a password update that failed, we should report it
        if (password && !email) {
           return NextResponse.json(
            { error: `Failed to update password: ${authUpdateError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // Log the action
    await supabaseAdmin
      .from('audit_trail')
      .insert({
        action: 'USER_UPDATED',
        entity_type: 'user',
        entity_id: userId,
        entity_name: currentUser.email,
        performed_by: adminUser.id,
        old_values: currentUser,
        new_values: updateData,
      });

    return NextResponse.json(
      {
        success: true,
        user: updatedUser,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/users/[userId]
// Admin-only endpoint to delete users
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Verify super admin authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Admin operations not available' },
        { status: 503 }
      );
    }

    const token = authHeader.slice(7);
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if requester is super admin
    const { data: adminProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin, role_id')
      .eq('id', adminUser.id)
      .single();

    const isSuperAdmin = adminProfile?.is_admin || adminProfile?.role_id === 'r1';

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only super admins can delete users' },
        { status: 403 }
      );
    }

    // Get user data before deletion
    const { data: userToDelete } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Delete auth user (this will cascade delete profile)
    await supabaseAdmin.auth.admin.deleteUser(userId);

    // Log the action
    await supabaseAdmin
      .from('audit_trail')
      .insert({
        action: 'USER_DELETED',
        entity_type: 'user',
        entity_id: userId,
        entity_name: userToDelete?.email || 'Unknown',
        performed_by: adminUser.id,
        old_values: userToDelete,
      });

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
