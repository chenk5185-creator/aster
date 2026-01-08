# ASTER Grid Trading Backend

后端服务器，用于 24/7 运行网格交易机器人。

## 功能

- ✅ 24/7 持续运行网格交易
- ✅ 自动订单监控和执行
- ✅ SQLite 数据库存储
- ✅ 安全的凭证加密
- ✅ RESTful API

## 开发

### 安装依赖

```bash
cd server
npm install
```

### 本地运行

```bash
npm run dev
```

服务器将在 http://localhost:3001 启动

### 构建

```bash
npm run build
```

### 生产运行

```bash
npm start
```

## 环境变量

在 Railway 或本地创建 `.env` 文件：

```env
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/aster.db
FRONTEND_URL=https://your-frontend-url.railway.app
ENCRYPTION_KEY=your-32-character-encryption-key
```

## API 端点

### 创建网格

```
POST /api/grids/create
Authorization: Bearer userId:encryptedPassword
Body: GridConfig
```

### 启动网格

```
POST /api/grids/:gridId/start
Authorization: Bearer userId:encryptedPassword
```

### 停止网格

```
POST /api/grids/:gridId/stop
Authorization: Bearer userId:encryptedPassword
Body: { sellHoldings: boolean }
```

### 获取所有网格

```
GET /api/grids
Authorization: Bearer userId:encryptedPassword
```

### 获取网格详情

```
GET /api/grids/:gridId
Authorization: Bearer userId:encryptedPassword
```

### 删除网格

```
DELETE /api/grids/:gridId
Authorization: Bearer userId:encryptedPassword
```

## Railway 部署

1. 在 Railway 创建新项目
2. 连接 GitHub 仓库
3. 选择 `/server` 目录作为根目录
4. 设置环境变量
5. 部署

## 架构

```
server/
├── src/
│   ├── database/       # SQLite 数据库
│   ├── middleware/     # Express 中间件
│   ├── routes/         # API 路由
│   ├── services/       # 核心服务（网格引擎）
│   ├── types/          # TypeScript 类型
│   └── server.ts       # 主服务器文件
├── package.json
└── tsconfig.json
```

## 注意事项

- 网格管理器在服务器重启时会丢失，需要手动重启
- 数据库文件存储在 `data/` 目录
- 建议定期备份数据库
