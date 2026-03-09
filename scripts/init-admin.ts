import { getSupabaseClient } from '../src/storage/database/supabase-client';
import crypto from 'crypto';

// 生成随机 API Key
function generateApiKey(): string {
  return `pk_${crypto.randomBytes(16).toString('hex')}`;
}

// 生成管理员密钥
function generateAdminKey(): string {
  return `admin_${crypto.randomBytes(16).toString('hex')}`;
}

async function main() {
  const client = getSupabaseClient();

  // 检查是否已存在管理员
  const { data: existingAdmins } = await client
    .from('admins')
    .select('*')
    .limit(1);

  if (existingAdmins && existingAdmins.length > 0) {
    console.log('管理员已存在:');
    console.log(`管理员密钥: ${existingAdmins[0].admin_key}`);
    return;
  }

  // 创建管理员
  const adminKey = generateAdminKey();
  const { error: adminError } = await client
    .from('admins')
    .insert({
      name: 'System Admin',
      admin_key: adminKey,
    });

  if (adminError) {
    console.error('创建管理员失败:', adminError);
    return;
  }

  console.log('=== 管理员创建成功 ===');
  console.log(`管理员密钥: ${adminKey}`);
  console.log('');
  console.log('请妥善保管此密钥，用于访问管理后台：');
  console.log(`/admin 页面需要此密钥来管理用户`);
  console.log('');

  // 创建测试用户
  const testApiKey = generateApiKey();
  const { error: userError } = await client
    .from('users')
    .insert({
      name: '测试用户',
      api_key: testApiKey,
      usage_limit: 100,
    });

  if (userError) {
    console.error('创建测试用户失败:', userError);
    return;
  }

  console.log('=== 测试用户创建成功 ===');
  console.log(`用户 API Key: ${testApiKey}`);
  console.log(`每日限制: 100 次`);
  console.log('');
  console.log('您可以使用此 API Key 登录应用进行测试');
}

main().catch(console.error);
