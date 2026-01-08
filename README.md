# ASTER 现货网格交易工具

一个为 ASTER DEX 现货市场设计的自动化网格交易应用。

## 🎯 功能特性

- ✅ **现货网格交易** - 自动化高抛低吸策略
- ✅ **等差/等比网格** - 灵活的网格类型选择
- ✅ **实时监控** - 订单状态和收益实时更新
- ✅ **止损保护** - 价格上下限止损
- ✅ **安全加密** - PBKDF2 + AES-256-CBC 加密 API 凭证
- ✅ **纯前端应用** - 无需后端，数据本地存储

## 🚀 快速开始

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 访问应用
打开浏览器访问 http://localhost:5173
```

### 生产构建

```bash
# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 🌐 部署到 Railway

本项目已配置 Railway 自动部署。

### 自动部署流程

1. **推送代码到 GitHub**
   ```bash
   git push origin [your-branch]
   ```

2. **Railway 自动触发**
   - 检测到代码变更
   - 自动运行 `npm ci`
   - 自动运行 `npm run build`
   - 自动启动服务 `npm start`

3. **访问部署的应用**
   - Railway 会提供一个 URL（如 `https://your-app.railway.app`）

### Railway 配置说明

项目包含以下配置文件：

- **`nixpacks.toml`** - Railway 构建配置
- **`package.json`** - 包含 `start` 脚本用于生产环境
- **`.railwayignore`** - 排除不必要的文件

### 环境变量

Railway 会自动设置：
- `PORT` - 应用监听端口

## 🔐 安全性

- **API 凭证加密** - 使用 PBKDF2 (100,000 次迭代) + AES-256-CBC
- **本地存储** - API 密钥加密后存储在浏览器 LocalStorage
- **无后端** - 所有操作在浏览器中完成，无数据上传到服务器

详细安全说明请查看 [SECURITY.md](./SECURITY.md)

## 📖 文档

- **[PRD.md](./PRD.md)** - 产品需求文档
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 技术架构文档
- **[MVP_PLAN.md](./MVP_PLAN.md)** - MVP 开发计划
- **[SECURITY.md](./SECURITY.md)** - 安全说明
- **[DECISIONS_NEEDED.md](./DECISIONS_NEEDED.md)** - 产品决策记录

## ⚙️ 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 7
- **状态管理**: Zustand
- **UI 组件**: Radix UI + Tailwind CSS
- **图表**: Lightweight Charts
- **HTTP 客户端**: Axios + React Query
- **加密**: CryptoJS

## 🎓 使用指南

### 1. 配置 API 凭证

访问 [ASTER API 管理](https://www.asterdex.com/en/api-management) 创建 API Key：

1. 连接钱包
2. 创建 API Key + Secret
3. **⚠️ 立即保存 Secret（仅显示一次）**
4. 在应用中输入凭证并设置加密密码

### 2. 创建网格策略

推荐首次使用参数（小额测试）：

```
交易对: BTCUSDT
投资金额: 100 USDT
价格区间: 当前价格 ±2%
网格数量: 10
网格类型: 等差
止损: ±5%
```

### 3. 监控和管理

- 实时查看收益统计
- 观察订单执行情况
- 根据市场调整策略
- 随时停止网格

## ⚠️ 风险提示

- 网格交易存在市场风险，可能造成损失
- 单边行情下策略效果不佳
- 浏览器关闭后网格会停止（桌面版计划中）
- 本工具仅供学习和个人使用

## 📝 开发状态

- ✅ **Phase 1 (MVP)** - 核心功能已完成
- 🚧 **Phase 2** - 优化中（收益计算、状态恢复、图表）
- 📅 **Phase 3** - 计划中（桌面版、回测系统）

## 🤝 贡献

本项目为个人使用，暂不接受外部贡献。

## 📄 许可证

MIT License

---

**⚠️ 免责声明**: 本工具仅供学习和研究使用。使用本工具进行交易的一切风险由用户自行承担。
