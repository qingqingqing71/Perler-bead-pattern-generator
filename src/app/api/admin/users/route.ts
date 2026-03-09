import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import crypto from 'crypto';

// 生成随机 API Key
function generateApiKey(): string {
  return `pk_${crypto.randomBytes(16).toString('hex')}`;
}

// 验证管理员权限 - 使用环境变量
function verifyAdmin(adminKey: string): boolean {
  // 管理员密钥从环境变量获取，如果未设置则使用默认值
  const validAdminKey = process.env.ADMIN_KEY || 'admin_default_key_12345';
  return adminKey === validAdminKey;
}

// 获取用户列表
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key');

    if (!adminKey || !verifyAdmin(adminKey)) {
      return NextResponse.json(
        { success: false, error: '管理员密钥无效' },
        { status: 403 }
      );
    }

    const client = getSupabaseClient();

    // 获取所有用户
    const { data: users, error: usersError } = await client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Get users error:', usersError);
      return NextResponse.json(
        { success: false, error: '获取用户列表失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      users: users || [],
    });

  } catch (error) {
    console.error('Admin get users error:', error);
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    );
  }
}

// 创建新用户
export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    const { name, usageLimit, expiresAt } = await request.json();

    if (!adminKey || !verifyAdmin(adminKey)) {
      return NextResponse.json(
        { success: false, error: '管理员密钥无效' },
        { status: 403 }
      );
    }

    const client = getSupabaseClient();

    // 创建用户
    const apiKey = generateApiKey();
    const { data: user, error: createError } = await client
      .from('users')
      .insert({
        name: name || '新用户',
        api_key: apiKey,
        usage_limit: usageLimit || 10,
        expires_at: expiresAt || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('Create user error:', createError);
      return NextResponse.json(
        { success: false, error: '创建用户失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });

  } catch (error) {
    console.error('Admin create user error:', error);
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    );
  }
}

// 更新用户
export async function PUT(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    const { userId, name, usageLimit, expiresAt, isActive } = await request.json();

    if (!adminKey || !verifyAdmin(adminKey)) {
      return NextResponse.json(
        { success: false, error: '管理员密钥无效' },
        { status: 403 }
      );
    }

    const client = getSupabaseClient();

    // 更新用户
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (usageLimit !== undefined) updateData.usage_limit = usageLimit;
    if (expiresAt !== undefined) updateData.expires_at = expiresAt;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { error: updateError } = await client
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      console.error('Update user error:', updateError);
      return NextResponse.json(
        { success: false, error: '更新用户失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error('Admin update user error:', error);
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    );
  }
}

// 删除用户
export async function DELETE(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!adminKey || !verifyAdmin(adminKey)) {
      return NextResponse.json(
        { success: false, error: '管理员密钥无效' },
        { status: 403 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 删除用户
    const { error: deleteError } = await client
      .from('users')
      .delete()
      .eq('id', parseInt(userId));

    if (deleteError) {
      console.error('Delete user error:', deleteError);
      return NextResponse.json(
        { success: false, error: '删除用户失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error('Admin delete user error:', error);
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    );
  }
}
