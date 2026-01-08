# ASTER 网格交易 Railway 部署指南

## 🎯 部署概览

这个指南将帮助你在 Railway 上部署后端服务，实现 24/7 运行网格交易机器人。

## 📋 前置要求

- ✅ Railway 账户（已绑定信用卡）
- ✅ GitHub 账户
- ✅ ASTER API 密钥

## 🚀 部署步骤

### 步骤 1：推送代码到 GitHub

```bash
# 如果还没有提交代码
git add .
git commit -m "feat: add backend server for 24/7 grid trading"
git push
```

### 步骤 2：在 Railway 创建新项目

1. 访问 https://railway.app/
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 选择你的 `aster` 仓库
5. Railway 会自动检测到两个服务：
   - **前端**（根目录）
   - **后端**（server 目录）

### 步骤 3：配置后端服务

#### 3.1 设置根目录

Railway 应该自动检测到 `server/` 目录。如果没有：

1. 在项目设置中，点击后端服务
2. Settings → Service Settings
3. Root Directory: 设置为 `server`

#### 3.2 配置环境变量

在后端服务的 Variables 标签中添加：

```env
NODE_ENV=production
PORT=3001
ENCRYPTION_KEY=<生成一个32字符的随机密钥>
DATABASE_PATH=/app/data/aster.db
FRONTEND_URL=<你的前端URL，稍后填写>
```

**生成加密密钥**：
```bash
# 使用这个命令生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 3.3 配置持久化存储（重要！）

**Railway 服务器重启时会丢失文件，所以需要添加持久化卷：**

1. 在后端服务页面，点击 "Volumes"
2. 点击 "+ New Volume"
3. 设置：
   - Mount Path: `/app/data`
   - Size: 1 GB（足够）

这样数据库文件会被持久化保存。

### 步骤 4：配置前端服务

#### 4.1 设置环境变量

在前端服务的 Variables 标签中添加：

```env
VITE_API_URL=<后端服务的URL>
```

**获取后端 URL**：
1. 进入后端服务
2. Settings → Domains
3. 复制生成的 URL（类似 `https://xxx.railway.app`）
4. 在前端环境变量中设置为 `VITE_API_URL`

#### 4.2 更新后端 FRONTEND_URL

1. 回到后端服务的 Variables
2. 将 `FRONTEND_URL` 设置为前端的 URL

### 步骤 5：部署

两个服务会自动部署。等待完成（约 2-5 分钟）。

### 步骤 6：验证部署

#### 6.1 检查后端健康状态

访问：`https://your-backend-url.railway.app/health`

应该看到：
```json
{
  "status": "ok",
  "timestamp": 1704812400000
}
```

#### 6.2 检查前端

访问你的前端 URL，应该可以正常打开界面。

#### 6.3 检查日志

在 Railway 控制台查看后端日志，应该看到：
```
╔══════════════════════════════════════════╗
║   ASTER Grid Trading Backend Server     ║
╠══════════════════════════════════════════╣
║  Port: 3001                              ║
║  Environment: production                 ║
╚══════════════════════════════════════════╝
[Server] Started at 2024-01-09T...
[DB] Database initialized successfully
```

## 🔧 高级配置

### 自定义域名

1. 在服务设置中，点击 "Domains"
2. 点击 "Custom Domain"
3. 输入你的域名并按照指引配置 DNS

### 扩展资源

如果需要更多资源（内存/CPU）：

1. Settings → Resources
2. 选择合适的配置
3. 注意：会增加费用

### 监控和告警

Railway 提供基本监控：

1. 点击服务名称
2. Metrics 标签
3. 查看 CPU/内存/网络使用情况

## 💰 费用估算

**免费额度**：$5/月

**预计费用**（两个服务）：
- 后端服务：~$5-7/月
- 前端服务：~$2-3/月
- **总计：~$7-10/月**

如果只运行后端，不使用前端静态托管，可以只部署后端到 Railway，前端部署到 Vercel（免费）来降低成本。

## 🐛 常见问题

### 1. 后端启动失败

**检查**：
- 环境变量是否正确设置
- Root Directory 是否设置为 `server`
- 查看部署日志中的错误信息

### 2. 数据库文件丢失

**确保**：
- Volume 已正确挂载到 `/app/data`
- `DATABASE_PATH` 环境变量指向 volume 路径

### 3. 前后端无法通信

**检查**：
- CORS 配置：后端 `FRONTEND_URL` 必须匹配前端 URL
- 前端 `VITE_API_URL` 必须指向后端 URL
- 两个服务都在运行

### 4. 网格在服务器重启后停止

**这是正常的**。当前版本中，网格管理器在内存中运行，服务器重启会丢失。数据库中的网格状态会保存，但需要手动重新启动。

**未来改进**：添加自动恢复功能。

## 📊 监控网格运行

### 查看日志

在 Railway 控制台：
1. 点击后端服务
2. Deployments → 最新部署 → View Logs

你会看到网格运行日志：
```
[Grid abc123] Starting...
[Grid abc123] Placing 10 buy orders
[Grid abc123] Buy order placed at 95234.56 for 0.001
[Grid abc123] Started successfully
[Grid abc123] Order polling started
```

### 监控订单

日志会显示：
- 订单下单
- 订单成交
- 利润计算
- 止损触发

## 🎉 完成！

现在你的网格交易机器人已经在 Railway 上 24/7 运行了！

**关键优势**：
✅ 电脑关机/休眠也能运行
✅ 任何设备都可以访问
✅ 数据持久化保存
✅ 自动重启（如果崩溃）

## 🔒 安全提示

1. **不要泄露环境变量**，尤其是 `ENCRYPTION_KEY`
2. **定期备份数据库**（下载 volume 中的 `aster.db` 文件）
3. **监控费用**，避免意外账单
4. **使用强密码**保护 API 密钥加密

## 📞 需要帮助？

如果遇到问题：
1. 查看 Railway 部署日志
2. 检查本指南的常见问题部分
3. 确保所有环境变量正确设置
