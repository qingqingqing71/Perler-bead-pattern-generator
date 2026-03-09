import { getSupabaseClient } from '../src/storage/database/supabase-client';

async function main() {
  const client = getSupabaseClient();

  // 尝试查看 admins 表的结构
  console.log('尝试查询 admins 表...');
  
  const { data, error } = await client
    .from('admins')
    .select('*')
    .limit(1);

  if (error) {
    console.log('查询错误:', error);
    console.log('');
    console.log('尝试创建新的 admins 表...');
    
    // 创建新表并插入数据
    const adminKey = `admin_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const { error: insertError } = await client
      .from('admins')
      .insert({
        id: 1,
        name: 'System Admin',
        admin_key: adminKey,
        is_active: true,
      } as Record<string, unknown>);
    
    if (insertError) {
      console.log('插入错误:', insertError);
    } else {
      console.log('管理员创建成功，密钥:', adminKey);
    }
  } else {
    console.log('admins 表数据:', data);
    
    if (!data || data.length === 0) {
      // 表存在但没有数据，插入新管理员
      const adminKey = `admin_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const { error: insertError } = await client
        .from('admins')
        .insert({
          name: 'System Admin',
          admin_key: adminKey,
        } as Record<string, unknown>);
      
      if (insertError) {
        console.log('插入错误:', insertError);
      } else {
        console.log('=== 管理员创建成功 ===');
        console.log(`管理员密钥: ${adminKey}`);
      }
    } else {
      console.log('管理员已存在');
    }
  }

  // 尝试查看 users 表
  console.log('');
  console.log('查询 users 表...');
  const { data: users, error: usersError } = await client
    .from('users')
    .select('*')
    .limit(1);

  if (usersError) {
    console.log('users 表错误:', usersError);
  } else if (!users || users.length === 0) {
    console.log('users 表为空，创建测试用户...');
    
    const apiKey = `pk_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const { error: insertError } = await client
      .from('users')
      .insert({
        name: '测试用户',
        api_key: apiKey,
        usage_limit: 100,
      } as Record<string, unknown>);
    
    if (insertError) {
      console.log('创建用户错误:', insertError);
    } else {
      console.log('=== 测试用户创建成功 ===');
      console.log(`API Key: ${apiKey}`);
    }
  } else {
    console.log('users 表数据:', users);
  }
}

main().catch(console.error);
