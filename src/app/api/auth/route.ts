import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 用户认证 - 验证 API Key
export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: '请输入访问密钥' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询用户
    const { data: user, error } = await client
      .from('users')
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: '访问密钥无效或已禁用' },
        { status: 401 }
      );
    }

    // 检查是否过期
    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: '访问密钥已过期' },
        { status: 401 }
      );
    }

    // 检查并重置每日使用次数
    const today = new Date().toISOString().split('T')[0];
    const currentUsageCount = user.usage_count ?? 0;
    
    if (user.last_usage_date !== today) {
      // 新的一天，重置使用次数
      await client
        .from('users')
        .update({ 
          usage_count: 0, 
          last_usage_date: today 
        })
        .eq('id', user.id);
      user.usage_count = 0;
    }

    // 检查使用次数限制
    if (currentUsageCount >= user.usage_limit) {
      return NextResponse.json(
        { success: false, error: '今日使用次数已达上限' },
        { status: 429 }
      );
    }

    // 返回用户信息（不包含敏感信息）
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        usageCount: user.usage_count ?? 0,
        usageLimit: user.usage_limit ?? 100,
      }
    });

  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { success: false, error: '认证失败' },
      { status: 500 }
    );
  }
}
