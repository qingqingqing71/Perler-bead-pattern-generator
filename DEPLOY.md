# 部署指南

## 环境变量配置

在部署前，需要配置以下环境变量：

```env
# Supabase 数据库配置（必需）
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# 管理员密钥（可选，默认为 admin_default_key_12345）
ADMIN_KEY=your_secure_admin_key

# 图像生成 API 配置（如需动漫转换功能）
COZE_API_KEY=your_coze_api_key
```

### 获取 Supabase 配置

1. 访问 [https://supabase.com](https://supabase.com) 并注册账号
2. 创建新项目
3. 在项目设置中找到：
   - `URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`

---

## 方案一：Vercel 部署（推荐）

### 步骤 1：推送代码到 Git 仓库

```bash
# 初始化 git（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 推送到 GitHub
git remote add origin https://github.com/你的用户名/你的仓库名.git
git branch -M main
git push -u origin main
```

### 步骤 2：在 Vercel 部署

1. 访问 [https://vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录
3. 点击 "Add New" → "Project"
4. 选择你刚才推送的仓库
5. 点击 "Import"
6. **在 "Environment Variables" 中添加环境变量**
7. 点击 "Deploy"
8. 等待部署完成，获得 `https://你的项目名.vercel.app` 链接

### 优点
- 免费额度充足
- 自动 HTTPS
- 自动 CI/CD（推送代码自动部署）
- 全球 CDN 加速

---

## 方案二：Docker 部署（自托管）

### 前置条件
- 服务器已安装 Docker 和 Docker Compose
- 服务器端口 5000 已开放

### 步骤 1：上传代码到服务器

```bash
# 方式1：使用 scp
scp -r ./你的项目目录 user@your-server-ip:/home/user/

# 方式2：使用 git clone
ssh user@your-server-ip
git clone https://github.com/你的用户名/你的仓库名.git
```

### 步骤 2：配置环境变量

```bash
cd /home/user/你的项目目录

# 创建 .env.local 文件
cat > .env.local << EOF
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
ADMIN_KEY=your_secure_admin_key
COZE_API_KEY=your_coze_api_key
EOF
```

### 步骤 3：构建并运行

```bash
# 使用 docker-compose 构建并运行
docker-compose up -d --build
```

### 步骤 4：访问应用

打开浏览器访问：`http://你的服务器IP:5000`

### 常用命令

```bash
# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```

---

## 方案三：使用 Nginx 反向代理（生产环境推荐）

如果你有自己的域名，建议使用 Nginx 配置 HTTPS：

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL 证书配置（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 获取免费 SSL 证书

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com
```

---

## 用户认证系统

### 管理员后台

部署后访问 `/admin` 页面进入管理后台：

1. 输入管理员密钥（环境变量 `ADMIN_KEY`）
2. 创建用户并生成 API Key
3. 将 API Key 发送给用户

### 用户使用流程

1. 访问主页
2. 输入 API Key 登录
3. 开始使用抠图功能

### 使用限制

- 每个用户有每日使用次数限制
- 使用次数每天自动重置
- 管理员可以设置用户过期时间

---

## 注意事项

1. **数据库配置**：必须配置 Supabase 才能使用用户认证功能
2. **管理员密钥**：请修改默认的管理员密钥以确保安全
3. **TensorFlow.js**：模型在浏览器端运行，不需要服务器端配置
4. **内存占用**：建议服务器至少 2GB 内存
5. **图片生成 API**：动漫转换功能需要配置 COZE_API_KEY

---

## 常见问题

### Q: Vercel 部署失败怎么办？
A: 检查 `package.json` 中的依赖版本，确保 Node.js 版本兼容。检查环境变量是否配置正确。

### Q: Docker 容器无法访问？
A: 检查防火墙是否开放端口：
```bash
# Ubuntu/Debian
sudo ufw allow 5000

# CentOS/RHEL
sudo firewall-cmd --add-port=5000/tcp --permanent
sudo firewall-cmd --reload
```

### Q: 如何创建新用户？
A: 访问 `/admin` 页面，使用管理员密钥登录后创建用户。

### Q: 如何更新部署？
A: 
- Vercel：推送新代码自动部署
- Docker：重新执行 `docker-compose up -d --build`

### Q: 数据库连接失败怎么办？
A: 检查 Supabase 配置是否正确，确保 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 配置正确。
