# EcoPaste 同步服务器

简单易部署的剪贴板同步服务器，为 EcoPaste 提供跨设备同步功能。

## 特性

- 🚀 **简单部署** - 基于 Node.js + SQLite，无需复杂配置
- 🔒 **安全可靠** - JWT 认证 + 密码加密 + 会话管理
- ⚡ **实时同步** - WebSocket 实时通信
- 📱 **多设备支持** - 支持多设备同时在线
- 🔍 **搜索功能** - 支持剪贴板内容搜索
- 📊 **统计分析** - 提供详细的同步统计
- 💾 **数据导出** - 支持 JSON/CSV 格式导出

## 快速开始

### 1. 环境要求

- Node.js >= 18.0.0
- npm 或 yarn

### 2. 安装依赖

```bash
cd server
npm install
```

### 3. 配置环境

```bash
# 复制环境配置文件
cp .env.example .env

# 编辑配置文件
nano .env
```

重要配置项：

```env
# 服务器端口
PORT=3001

# JWT 密钥（生产环境必须修改）
JWT_SECRET=your-super-secret-jwt-key

# 允许的客户端地址
ALLOWED_ORIGINS=http://localhost:1420

# 运行环境
NODE_ENV=production
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 5. 验证部署

访问 `http://localhost:3001/health` 检查服务状态。

## API 接口

### 认证接口

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/refresh` - 刷新 Token
- `POST /api/auth/logout` - 用户登出

### 设备管理

- `GET /api/device/list` - 获取设备列表
- `POST /api/device/register` - 注册新设备
- `PUT /api/device/:id` - 更新设备信息
- `DELETE /api/device/:id` - 删除设备

### 同步接口

- `GET /api/sync/data` - 获取同步数据
- `POST /api/sync/upload` - 上传剪贴板数据
- `DELETE /api/sync/items/:id` - 删除剪贴板项目
- `GET /api/sync/search` - 搜索剪贴板内容
- `GET /api/sync/stats` - 获取同步统计
- `GET /api/sync/export` - 导出数据

### WebSocket 接口

- `ws://localhost:3001/ws` - WebSocket 连接地址

## 部署方案

### 方案一：本地部署

适合个人使用或小团队：

```bash
# 克隆项目
git clone <repository>
cd EcoPaste/server

# 安装依赖
npm install

# 配置环境
cp .env.example .env
# 编辑 .env 文件

# 启动服务
npm start
```

### 方案二：Docker 部署

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

EXPOSE 3001

CMD ["npm", "start"]
```

构建和运行：

```bash
# 构建镜像
docker build -t ecopaste-server .

# 运行容器
docker run -d \
  --name ecopaste-server \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  ecopaste-server
```

### 方案三：云服务器部署

1. **准备服务器**
   - 购买云服务器（1核1G即可）
   - 安装 Node.js 18+
   - 配置防火墙开放 3001 端口

2. **部署代码**
   ```bash
   # 上传代码到服务器
   scp -r server/ user@your-server:/opt/ecopaste-server/
   
   # SSH 登录服务器
   ssh user@your-server
   
   # 安装依赖
   cd /opt/ecopaste-server
   npm install --production
   
   # 配置环境
   cp .env.example .env
   nano .env
   ```

3. **配置系统服务**
   
   创建 systemd 服务文件 `/etc/systemd/system/ecopaste-server.service`：
   
   ```ini
   [Unit]
   Description=EcoPaste Sync Server
   After=network.target
   
   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/ecopaste-server
   ExecStart=/usr/bin/node src/index.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production
   
   [Install]
   WantedBy=multi-user.target
   ```
   
   启动服务：
   
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable ecopaste-server
   sudo systemctl start ecopaste-server
   ```

4. **配置反向代理（可选）**
   
   使用 Nginx 配置 HTTPS：
   
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3001;
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

## 数据存储

- **数据库文件**: `./data/ecopaste.db`
- **日志文件**: `./logs/YYYY-MM-DD.log`

### 备份建议

```bash
# 备份数据库
cp data/ecopaste.db backup/ecopaste-$(date +%Y%m%d).db

# 定期清理日志
find logs/ -name "*.log" -mtime +30 -delete
```

## 监控和维护

### 健康检查

```bash
# 检查服务状态
curl http://localhost:3001/health

# 检查 WebSocket 连接
wscat -c ws://localhost:3001/ws
```

### 日志查看

```bash
# 查看实时日志
tail -f logs/$(date +%Y-%m-%d).log

# 查看服务日志
sudo journalctl -u ecopaste-server -f
```

### 性能优化

1. **数据库优化**
   - 定期清理过期会话
   - 删除软删除的剪贴板数据
   
2. **内存优化**
   - 限制 WebSocket 连接数
   - 设置合理的日志轮转

## 安全建议

1. **修改默认配置**
   - 更改 JWT_SECRET
   - 设置强密码策略
   
2. **网络安全**
   - 使用 HTTPS
   - 配置防火墙
   - 限制访问 IP
   
3. **数据安全**
   - 定期备份数据
   - 加密敏感数据

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   netstat -tlnp | grep 3001
   
   # 修改端口配置
   echo "PORT=3002" >> .env
   ```

2. **数据库权限问题**
   ```bash
   # 检查数据目录权限
   ls -la data/
   
   # 修复权限
   chmod 755 data/
   chmod 644 data/ecopaste.db
   ```

3. **WebSocket 连接失败**
   - 检查防火墙设置
   - 确认客户端配置正确
   - 查看服务器日志

### 获取帮助

- 查看日志文件获取详细错误信息
- 检查环境配置是否正确
- 确认网络连接正常

## 开发说明

### 项目结构

```
server/
├── src/
│   ├── database/          # 数据库相关
│   ├── routes/            # API 路由
│   ├── websocket/         # WebSocket 处理
│   ├── utils/             # 工具函数
│   └── index.js           # 入口文件
├── data/                  # 数据库文件
├── logs/                  # 日志文件
├── package.json
├── .env.example
└── README.md
```

### 开发模式

```bash
# 安装开发依赖
npm install

# 启动开发服务器（自动重启）
npm run dev

# 查看实时日志
npm run logs
```

## 许可证

MIT License