'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Users, 
  Key, 
  Calendar, 
  Trash2, 
  Edit, 
  Plus, 
  Copy, 
  Check, 
  AlertCircle 
} from 'lucide-react';

interface User {
  id: number;
  name: string;
  api_key: string;
  usage_limit: number;
  usage_count: number;
  last_usage_date: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // 创建用户对话框
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    usageLimit: 10,
    expiresAt: '',
  });
  
  // 编辑用户对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // 验证管理员密钥
  const handleAuth = async () => {
    if (!adminKey.trim()) {
      alert('请输入管理员密钥');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'x-admin-key': adminKey,
        },
      });

      const data = await response.json();

      if (data.success) {
        setIsAuthenticated(true);
        setUsers(data.users);
      } else {
        alert(data.error || '验证失败');
      }
    } catch {
      alert('验证失败');
    } finally {
      setLoading(false);
    }
  };

  // 刷新用户列表
  const refreshUsers = async () => {
    const response = await fetch('/api/admin/users', {
      headers: {
        'x-admin-key': adminKey,
      },
    });

    const data = await response.json();
    if (data.success) {
      setUsers(data.users);
    }
  };

  // 创建用户
  const handleCreateUser = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          name: newUser.name || '新用户',
          usageLimit: newUser.usageLimit,
          expiresAt: newUser.expiresAt || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await refreshUsers();
        setCreateDialogOpen(false);
        setNewUser({ name: '', usageLimit: 10, expiresAt: '' });
      } else {
        alert(data.error || '创建失败');
      }
    } catch {
      alert('创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新用户
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({
          userId: editingUser.id,
          name: editingUser.name,
          usageLimit: editingUser.usage_limit,
          expiresAt: editingUser.expires_at,
          isActive: editingUser.is_active,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await refreshUsers();
        setEditDialogOpen(false);
        setEditingUser(null);
      } else {
        alert(data.error || '更新失败');
      }
    } catch {
      alert('更新失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: number) => {
    if (!confirm('确定要删除此用户吗？')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': adminKey,
        },
      });

      const data = await response.json();

      if (data.success) {
        await refreshUsers();
      } else {
        alert(data.error || '删除失败');
      }
    } catch {
      alert('删除失败');
    } finally {
      setLoading(false);
    }
  };

  // 复制 API Key
  const copyApiKey = async (apiKey: string) => {
    await navigator.clipboard.writeText(apiKey);
    setCopiedKey(apiKey);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">管理后台</CardTitle>
            <CardDescription>请输入管理员密钥以访问</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="管理员密钥"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleAuth}
                disabled={loading}
              >
                {loading ? '验证中...' : '登录'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-white">用户管理</h1>
              <p className="text-slate-400">管理访问密钥和使用限制</p>
            </div>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                创建用户
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新用户</DialogTitle>
                <DialogDescription>
                  为新用户生成访问密钥，设置使用限制
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">用户名称</Label>
                  <Input
                    id="name"
                    placeholder="新用户"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit">每日使用限制</Label>
                  <Input
                    id="limit"
                    type="number"
                    min="1"
                    value={newUser.usageLimit}
                    onChange={(e) => setNewUser({ ...newUser, usageLimit: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires">过期日期（可选）</Label>
                  <Input
                    id="expires"
                    type="date"
                    value={newUser.expiresAt}
                    onChange={(e) => setNewUser({ ...newUser, expiresAt: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateUser} disabled={loading}>
                  {loading ? '创建中...' : '创建'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总用户数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
              <Check className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日使用</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.reduce((sum, u) => sum + u.usage_count, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 用户列表 */}
        <Card>
          <CardHeader>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>
              管理所有用户的访问密钥和使用限制
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>访问密钥</TableHead>
                  <TableHead>使用情况</TableHead>
                  <TableHead>过期日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(user.created_at)} 创建
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                          {user.api_key.substring(0, 12)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyApiKey(user.api_key)}
                        >
                          {copiedKey === user.api_key ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.usage_count}</span>
                        <span className="text-muted-foreground">/</span>
                        <span>{user.usage_limit}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(user.expires_at)}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? '活跃' : '禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingUser(user);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 编辑用户对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑用户</DialogTitle>
              <DialogDescription>
                修改用户信息和访问限制
              </DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">用户名称</Label>
                  <Input
                    id="edit-name"
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-limit">每日使用限制</Label>
                  <Input
                    id="edit-limit"
                    type="number"
                    min="1"
                    value={editingUser.usage_limit}
                    onChange={(e) => setEditingUser({ ...editingUser, usage_limit: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-expires">过期日期</Label>
                  <Input
                    id="edit-expires"
                    type="date"
                    value={editingUser.expires_at?.split('T')[0] || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, expires_at: e.target.value || null })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>启用状态</Label>
                    <p className="text-sm text-muted-foreground">
                      禁用后用户将无法使用
                    </p>
                  </div>
                  <Switch
                    checked={editingUser.is_active}
                    onCheckedChange={(checked) => setEditingUser({ ...editingUser, is_active: checked })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdateUser} disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 提示信息 */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-yellow-800">安全提示</p>
                <p className="text-sm text-yellow-700">
                  请妥善保管管理员密钥，不要泄露给他人。用户创建后请将访问密钥通过安全渠道发送给用户。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
