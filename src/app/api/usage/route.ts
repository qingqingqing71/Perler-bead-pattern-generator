import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 记录使用次数
export async function POST(request: NextRequest) {
  try {
    const { userId, action, gridSize, upscaleFactor } = await request.json();

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 获取用户信息
    const { data: user, error: userError } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 检查并重置每日使用次数
    const today = new Date().toISOString().split('T')[0];
    const currentUsageCount = user.usage_count ?? 0;
    
    if (user.last_usage_date !== today) {
      await client
        .from('users')
        .update({ 
          usage_count: 0, 
          last_usage_date: today 
        })
        .eq('id', userId);
      user.usage_count = 0;
    }

    // 检查使用次数限制
    if (currentUsageCount >= user.usage_limit) {
      return NextResponse.json(
        { success: false, error: '今日使用次数已达上限' },
        { status: 429 }
      );
    }

    // 增加使用次数
    const { error: updateError } = await client
      .from('users')
      .update({ 
        usage_count: currentUsageCount + 1 
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { success: false, error: '更新使用次数失败' },
        { status: 500 }
      );
    }

    // 记录使用日志
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await client
      .from('usage_logs')
      .insert({
        user_id: userId,
        action,
        grid_size: gridSize,
        upscale_factor: upscaleFactor,
        ip_address: ip.substring(0, 45),
        user_agent: userAgent.substring(0, 500),
      });

    return NextResponse.json({
      success: true,
      usageCount: user.usage_count + 1,
      usageLimit: user.usage_limit,
    });

  } catch (error) {
    console.error('Usage error:', error);
    return NextResponse.json(
      { success: false, error: '记录使用失败' },
      { status: 500 }
    );
  }
}

// 获取使用统计
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 获取用户信息
    const { data: user, error } = await client
      .from('users')
      .select('usage_count, usage_limit, last_usage_date')
      .eq('id', parseInt(userId))
      .single();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 检查是否需要重置
    const today = new Date().toISOString().split('T')[0];
    if (user.last_usage_date !== today) {
      return NextResponse.json({
        success: true,
        usageCount: 0,
        usageLimit: user.usage_limit,
      });
    }

    return NextResponse.json({
      success: true,
      usageCount: user.usage_count,
      usageLimit: user.usage_limit,
    });

  } catch (error) {
    console.error('Get usage error:', error);
    return NextResponse.json(
      { success: false, error: '获取使用统计失败' },
      { status: 500 }
    );
  }
}
