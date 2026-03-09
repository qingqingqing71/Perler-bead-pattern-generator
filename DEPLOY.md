# 部署指南

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
6. Vercel 会自动检测 Next.js 项目，直接点击 "Deploy"
7. 等待部署完成，获得 `https://你的项目名.vercel.app` 链接

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

### 步骤 2：构建并运行

```bash
cd /home/user/你的项目目录

# 使用 docker-compose 构建并运行
docker-compose up -d --build
```

### 步骤 3：访问应用

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

## 环境变量配置（如需要）

如果项目需要环境变量，创建 `.env.local` 文件：

```env
# 示例配置
NEXT_PUBLIC_API_URL=https://api.example.com
```

在 Vercel 中，可以在项目设置的 "Environment Variables" 中添加。

---

## 注意事项

1. **图片生成 API**：本项目使用了图片生成功能，部署时需要确保 API 配置正确
2. **TensorFlow.js**：模型在浏览器端运行，不需要服务器端配置
3. **内存占用**：建议服务器至少 2GB 内存

---

## 常见问题

### Q: Vercel 部署失败怎么办？
A: 检查 `package.json` 中的依赖版本，确保 Node.js 版本兼容。

### Q: Docker 容器无法访问？
A: 检查防火墙是否开放端口：
```bash
# Ubuntu/Debian
sudo ufw allow 5000

# CentOS/RHEL
sudo firewall-cmd --add-port=5000/tcp --permanent
sudo firewall-cmd --reload
```

### Q: 如何更新部署？
A: 
- Vercel：推送新代码自动部署
- Docker：重新执行 `docker-compose up -d --build`
