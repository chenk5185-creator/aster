# ASTER 现货网格交易工具 - 产品与技术架构

## 一、项目背景

### 1.1 ASTER 平台简介

ASTER 是一个下一代去中心化永续合约交易所（DEX），由 Astherus 与 APX Finance 于 2024 年末合并后推出。平台特点：

- **多链支持**：BNB Chain、Ethereum、Solana、Arbitrum
- **双模式交易**：
  - **Simple Mode (1001x)**：基于 AMM 的一键交易，最高 1001 倍杠杆
  - **Pro Mode**：完整的订单簿交易，支持网格交易、隐藏订单等高级功能
- **交易类型**：永续合约（Perpetuals）和现货（Spot）

### 1.2 现有网格交易功能

ASTER 官方的网格交易工具**仅支持永续合约市场**，位于 Pro Mode 下，具备以下特性：

| 功能 | 描述 |
|------|------|
| 三种策略模式 | Neutral（中性）、Long（做多）、Short（做空）|
| 价格区间设置 | 上限价格、下限价格 |
| 网格数量 | 可自定义网格数量 |
| 网格类型 | 等差（Arithmetic）/ 等比（Geometric）|
| 杠杆设置 | 支持杠杆倍数选择 |
| 触发条件 | 触发价格、止损价格 |
| 自动管理 | 停止时取消订单、停止时平仓 |

### 1.3 项目目标

**开发一个支持 ASTER 现货市场的网格交易工具**，在视觉和体验上与官方永续合约网格交易工具保持一致。

---

## 二、产品架构

### 2.1 功能需求对比

| 功能模块 | 永续合约网格（官方） | 现货网格（本项目） |
|---------|-------------------|------------------|
| 策略模式 | Neutral/Long/Short | Neutral（仅买卖，无持仓方向）|
| 价格区间 | ✅ | ✅ |
| 网格数量 | ✅ | ✅ |
| 网格类型 | 等差/等比 | 等差/等比 |
| 杠杆设置 | ✅ | ❌（现货无杠杆）|
| 保证金 | 初始保证金计算 | 投资金额（Quote Asset）|
| 止损设置 | ✅ | ✅（价格止损）|
| 触发价格 | ✅ | ✅ |
| 自动平仓 | ✅ | ❌（改为卖出所有持仓）|

### 2.2 用户界面设计

#### 2.2.1 主界面布局

```
┌─────────────────────────────────────────────────────────────┐
│                    网格交易 - 现货                           │
├─────────────────────────────────────────────────────────────┤
│  交易对选择: [BTC/USDT ▼]                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │   参数设置面板   │  │         价格图表区域              │   │
│  │                 │  │                                  │   │
│  │ 价格上限: [___] │  │    ════════════════════════     │   │
│  │ 价格下限: [___] │  │    ║  K线图 + 网格预览  ║        │   │
│  │ 网格数量: [___] │  │    ════════════════════════     │   │
│  │ 网格类型: [等差] │  │                                  │   │
│  │ 投资金额: [___] │  │                                  │   │
│  │                 │  │                                  │   │
│  │ [高级设置 ▼]    │  │                                  │   │
│  │                 │  └─────────────────────────────────┘   │
│  │ [创建网格]      │                                        │
│  └─────────────────┘                                        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    活跃网格策略列表                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 交易对 │ 状态 │ 收益 │ 网格数 │ 价格区间 │ 操作       │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ BTC/USDT │ 运行中 │ +2.5% │ 10 │ 40000-45000 │ [停止] │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2.2 参数设置详情

**基础参数：**
- **价格上限 (Upper Price)**：网格最高价格
- **价格下限 (Lower Price)**：网格最低价格
- **网格数量 (Grid Number)**：划分的网格数量（2-200）
- **网格类型 (Grid Type)**：
  - 等差（Arithmetic）：每格价差相等
  - 等比（Geometric）：每格价差比例相等
- **投资金额 (Investment Amount)**：用于网格交易的总金额（USDT 等计价货币）

**高级参数：**
- **触发价格 (Trigger Price)**：达到此价格后启动网格
- **止损上限 (Stop Upper Price)**：价格超过此值时停止网格
- **止损下限 (Stop Lower Price)**：价格低于此值时停止网格
- **停止时操作**：
  - 取消所有挂单
  - 卖出所有持仓

### 2.3 产品决策记录

> 以下决策已与产品负责人确认，作为开发实现的依据。

#### 2.3.1 核心交易逻辑决策

| 决策项 | 选择 | 说明 |
|--------|------|------|
| **初始持仓策略** | 纯买单启动 | 启动时只在当前价格以下放置买单，等待买入成交后再放置对应卖单。不进行初始建仓。 |
| **资金分配** | 仅分配给买单网格 | `每格投资金额 = 总投资金额 / 当前价格以下的网格数量`。上方网格暂不占用资金。 |
| **部分成交处理** | 等待完全成交 | 订单必须完全成交后，才在对应价格放置反向订单。部分成交时继续等待。 |
| **价格跳空处理** | 忽略跳过的格子 | 价格快速跨越多个网格时，不追溯补单，继续在当前价格正常运行网格。 |

#### 2.3.2 订单与风控决策

| 决策项 | 选择 | 说明 |
|--------|------|------|
| **最小金额校验** | 创建前拒绝 | 如果单格金额 < 交易所 minNotional，拒绝创建网格并提示用户减少网格数量或增加投资金额。 |
| **手续费计算** | 动态获取 | 调用 API 获取实际 maker/taker 费率，而非使用固定值。 |
| **多网格支持** | 允许 | 同一交易对可以运行多个网格策略（不同价格区间）。 |

#### 2.3.3 技术与平台决策

| 决策项 | 选择 | 说明 |
|--------|------|------|
| **运行架构** | 纯前端方案 | 无后端服务，所有逻辑在浏览器中运行。API 凭证加密存储在本地。 |
| **支持的链** | 仅 BSC | 初期只支持 BNB Smart Chain (chainId: 56)，不做多链切换。 |
| **收益展示** | Quote 币种 | 收益统一以计价货币（如 USDT）展示，便于用户理解。 |

---

### 2.4 核心业务逻辑

#### 2.4.1 网格计算算法

**等差网格 (Arithmetic Grid):**
```
每格价差 = (价格上限 - 价格下限) / 网格数量
网格价格[i] = 价格下限 + i × 每格价差
```

**等比网格 (Geometric Grid):**
```
价差比例 = (价格上限 / 价格下限) ^ (1 / 网格数量)
网格价格[i] = 价格下限 × 价差比例^i
```

#### 2.4.2 订单分配策略

现货网格交易的订单分配：

1. **初始化阶段**：
   - 计算当前价格位于哪个网格区间
   - 在当前价格以下放置买单
   - 在当前价格以上放置卖单（如有持仓）

2. **运行阶段**：
   - 买单成交 → 在上一格放置卖单
   - 卖单成交 → 在下一格放置买单

3. **资金分配**：
   ```
   每格投资金额 = 总投资金额 / (当前价格以下的网格数量)
   每格买入数量 = 每格投资金额 / 对应网格价格
   ```

#### 2.4.3 收益计算

```
单格收益 = 卖出价格 - 买入价格 - 手续费
总收益 = Σ(所有已完成的网格交易收益) + 浮动收益（持仓变化）
收益率 = 总收益 / 投资金额 × 100%
```

### 2.5 用户流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  连接钱包    │────▶│  选择交易对  │────▶│  设置参数   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  监控收益    │◀────│  网格运行中  │◀────│  确认创建   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│  手动停止    │     │  触发止损   │
└─────────────┘     └─────────────┘
       │                   │
       └───────┬───────────┘
               ▼
       ┌─────────────┐
       │  结算收益    │
       └─────────────┘
```

---

## 三、技术架构

### 3.1 技术栈选型

| 层级 | 技术选型 | 说明 |
|-----|---------|------|
| 前端框架 | React + TypeScript | 与 ASTER 官方保持一致 |
| 状态管理 | Zustand | 轻量级状态管理 |
| UI 组件 | TailwindCSS + Radix UI | 现代化 UI |
| 图表库 | TradingView Lightweight Charts | K线图展示 |
| Web3 | wagmi + viem | 多链钱包连接 |
| API 请求 | React Query + Axios | 数据获取与缓存 |
| WebSocket | Native WebSocket | 实时数据推送 |

### 3.2 系统架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                           前端应用层                              │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ 网格配置  │  │ 图表展示  │  │ 策略管理  │  │    钱包连接       │ │
│  │  组件    │  │   组件   │  │   组件   │  │     组件          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                          业务逻辑层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ 网格计算  │  │ 订单管理  │  │ 收益统计  │  │    风控管理       │ │
│  │  服务    │  │   服务   │  │   服务   │  │     服务          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                          数据访问层                               │
│  ┌────────────────────┐  ┌────────────────────────────────────┐ │
│  │   ASTER Spot API   │  │         WebSocket Streams          │ │
│  │   (REST)           │  │         (Real-time Data)           │ │
│  └────────────────────┘  └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                      ASTER DEX 后端服务                           │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │ REST API         │  │ WebSocket Server                     │ │
│  │ sapi.asterdex.com│  │ sstream.asterdex.com                 │ │
│  └──────────────────┘  └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 ASTER 现货 API 集成

#### 3.3.1 API 基础信息

| 项目 | 值 |
|-----|-----|
| REST Base URL | `https://sapi.asterdex.com` |
| WebSocket URL | `wss://sstream.asterdex.com` |
| 认证方式 | HMAC SHA256 签名 |
| 请求频率限制 | 1200 权重/分钟，100 订单/分钟 |

#### 3.3.2 核心 API 端点

**市场数据（无需认证）：**
```
GET /api/v1/exchangeInfo     # 交易规则和交易对信息
GET /api/v1/depth            # 订单簿深度
GET /api/v1/trades           # 最近成交
GET /api/v1/klines           # K线数据
GET /api/v1/ticker/price     # 最新价格
GET /api/v1/ticker/bookTicker # 最优买卖价
```

**交易操作（需要 TRADE 签名）：**
```
POST   /api/v1/order         # 下单
DELETE /api/v1/order         # 撤单
GET    /api/v1/order         # 查询订单
GET    /api/v1/openOrders    # 当前挂单
DELETE /api/v1/allOpenOrders # 撤销所有挂单
```

**账户信息（需要 USER_DATA 签名）：**
```
GET /api/v1/account          # 账户余额
GET /api/v1/userTrades       # 成交历史
```

#### 3.3.3 WebSocket 数据流

```
实时成交: <symbol>@aggTrade
K线数据: <symbol>@kline_<interval>
订单簿: <symbol>@depth
行情: <symbol>@ticker
```

#### 3.3.4 签名认证

```typescript
// 签名生成示例
import crypto from 'crypto';

function generateSignature(params: Record<string, any>, apiSecret: string): string {
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');
}

// 请求头
headers: {
  'X-MBX-APIKEY': apiKey,
  'Content-Type': 'application/x-www-form-urlencoded'
}
```

### 3.4 核心模块设计

#### 3.4.1 目录结构

```
src/
├── components/
│   ├── GridTrading/
│   │   ├── GridConfigPanel.tsx      # 参数配置面板
│   │   ├── GridPreview.tsx          # 网格预览图
│   │   ├── ActiveGridList.tsx       # 活跃策略列表
│   │   ├── GridDetailModal.tsx      # 策略详情弹窗
│   │   └── PriceChart.tsx           # 价格图表
│   ├── common/
│   │   ├── Input.tsx
│   │   ├── Button.tsx
│   │   ├── Select.tsx
│   │   └── Modal.tsx
│   └── WalletConnect/
│       └── WalletButton.tsx
├── services/
│   ├── api/
│   │   ├── client.ts                # API 客户端
│   │   ├── market.ts                # 市场数据 API
│   │   ├── trading.ts               # 交易 API
│   │   └── account.ts               # 账户 API
│   ├── websocket/
│   │   └── StreamManager.ts         # WebSocket 管理
│   └── grid/
│       ├── GridCalculator.ts        # 网格计算器
│       ├── OrderManager.ts          # 订单管理器
│       └── ProfitCalculator.ts      # 收益计算器
├── stores/
│   ├── gridStore.ts                 # 网格状态
│   ├── marketStore.ts               # 市场数据状态
│   └── walletStore.ts               # 钱包状态
├── hooks/
│   ├── useGridTrading.ts            # 网格交易 Hook
│   ├── useMarketData.ts             # 市场数据 Hook
│   └── useWebSocket.ts              # WebSocket Hook
├── types/
│   ├── grid.ts                      # 网格类型定义
│   ├── order.ts                     # 订单类型定义
│   └── market.ts                    # 市场类型定义
└── utils/
    ├── calculations.ts              # 计算工具
    ├── format.ts                    # 格式化工具
    └── validation.ts                # 验证工具
```

#### 3.4.2 核心类型定义

```typescript
// types/grid.ts

// 网格类型
export type GridType = 'ARITHMETIC' | 'GEOMETRIC';

// 网格状态
export type GridStatus = 'PENDING' | 'RUNNING' | 'STOPPED' | 'COMPLETED';

// 网格配置
export interface GridConfig {
  symbol: string;              // 交易对，如 "BTCUSDT"
  upperPrice: number;          // 价格上限
  lowerPrice: number;          // 价格下限
  gridCount: number;           // 网格数量
  gridType: GridType;          // 网格类型
  investmentAmount: number;    // 投资金额（Quote Asset）
  triggerPrice?: number;       // 触发价格（可选）
  stopUpperPrice?: number;     // 止损上限（可选）
  stopLowerPrice?: number;     // 止损下限（可选）
  cancelOrdersOnStop: boolean; // 停止时取消订单
  sellAllOnStop: boolean;      // 停止时卖出持仓
}

// 网格实例
export interface GridInstance {
  id: string;
  config: GridConfig;
  status: GridStatus;
  createdAt: number;
  startedAt?: number;
  stoppedAt?: number;
  gridLevels: GridLevel[];
  orders: GridOrder[];
  profit: GridProfit;
}

// 单个网格层级
export interface GridLevel {
  index: number;
  price: number;
  buyOrderId?: string;
  sellOrderId?: string;
  filled: boolean;
}

// 网格订单
export interface GridOrder {
  orderId: string;
  gridIndex: number;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  status: 'NEW' | 'FILLED' | 'CANCELED';
  filledAt?: number;
}

// 收益统计
export interface GridProfit {
  realizedProfit: number;      // 已实现收益
  unrealizedProfit: number;    // 未实现收益
  totalProfit: number;         // 总收益
  profitRate: number;          // 收益率
  tradingCount: number;        // 交易次数
  totalFees: number;           // 总手续费
}
```

#### 3.4.3 网格计算器

```typescript
// services/grid/GridCalculator.ts

export class GridCalculator {
  /**
   * 计算网格价格层级
   */
  static calculateGridLevels(config: GridConfig): number[] {
    const { upperPrice, lowerPrice, gridCount, gridType } = config;
    const levels: number[] = [];

    if (gridType === 'ARITHMETIC') {
      // 等差网格
      const step = (upperPrice - lowerPrice) / gridCount;
      for (let i = 0; i <= gridCount; i++) {
        levels.push(lowerPrice + step * i);
      }
    } else {
      // 等比网格
      const ratio = Math.pow(upperPrice / lowerPrice, 1 / gridCount);
      for (let i = 0; i <= gridCount; i++) {
        levels.push(lowerPrice * Math.pow(ratio, i));
      }
    }

    return levels;
  }

  /**
   * 计算每格预期收益
   * @param feeRate - 从 API 动态获取的手续费率
   */
  static calculateGridProfitPerLevel(
    levels: number[],
    gridType: GridType,
    feeRate: number // 动态获取，不使用默认值
  ): number[] {
    const profits: number[] = [];

    for (let i = 0; i < levels.length - 1; i++) {
      const buyPrice = levels[i];
      const sellPrice = levels[i + 1];
      const grossProfit = sellPrice - buyPrice;
      // 买入用 taker 费率，卖出用 maker 费率（限价单）
      const fees = (buyPrice + sellPrice) * feeRate;
      profits.push(grossProfit - fees);
    }

    return profits;
  }

  /**
   * 计算初始订单分配
   */
  static calculateInitialOrders(
    config: GridConfig,
    currentPrice: number
  ): { buyOrders: OrderParams[]; sellOrders: OrderParams[] } {
    const levels = this.calculateGridLevels(config);
    const buyOrders: OrderParams[] = [];
    const sellOrders: OrderParams[] = [];

    // 找到当前价格所在的网格位置
    const currentGridIndex = levels.findIndex(level => level > currentPrice);

    // 计算每格投资金额
    const buyGridCount = currentGridIndex > 0 ? currentGridIndex : 1;
    const amountPerGrid = config.investmentAmount / buyGridCount;

    // 当前价格以下放置买单
    for (let i = 0; i < currentGridIndex; i++) {
      const price = levels[i];
      const quantity = amountPerGrid / price;
      buyOrders.push({
        side: 'BUY',
        price,
        quantity,
        gridIndex: i,
      });
    }

    return { buyOrders, sellOrders };
  }
}
```

#### 3.4.4 订单管理器

```typescript
// services/grid/OrderManager.ts

export class OrderManager {
  private apiClient: TradingAPI;
  private gridInstance: GridInstance;

  constructor(apiClient: TradingAPI, gridInstance: GridInstance) {
    this.apiClient = apiClient;
    this.gridInstance = gridInstance;
  }

  /**
   * 初始化网格订单
   */
  async initializeOrders(): Promise<void> {
    const { buyOrders } = GridCalculator.calculateInitialOrders(
      this.gridInstance.config,
      await this.getCurrentPrice()
    );

    for (const order of buyOrders) {
      await this.placeOrder(order);
    }
  }

  /**
   * 处理订单成交
   */
  async handleOrderFilled(orderId: string): Promise<void> {
    const order = this.gridInstance.orders.find(o => o.orderId === orderId);
    if (!order) return;

    if (order.side === 'BUY') {
      // 买单成交，在上一格放置卖单
      const sellPrice = this.gridInstance.gridLevels[order.gridIndex + 1].price;
      await this.placeOrder({
        side: 'SELL',
        price: sellPrice,
        quantity: order.quantity,
        gridIndex: order.gridIndex,
      });
    } else {
      // 卖单成交，在下一格放置买单
      const buyPrice = this.gridInstance.gridLevels[order.gridIndex].price;
      const amountPerGrid = this.gridInstance.config.investmentAmount /
        this.gridInstance.gridLevels.length;
      await this.placeOrder({
        side: 'BUY',
        price: buyPrice,
        quantity: amountPerGrid / buyPrice,
        gridIndex: order.gridIndex,
      });
    }

    // 更新收益统计
    this.updateProfit(order);
  }

  /**
   * 停止网格
   */
  async stopGrid(): Promise<void> {
    // 取消所有挂单
    if (this.gridInstance.config.cancelOrdersOnStop) {
      await this.cancelAllOrders();
    }

    // 卖出所有持仓
    if (this.gridInstance.config.sellAllOnStop) {
      await this.sellAllHoldings();
    }

    this.gridInstance.status = 'STOPPED';
    this.gridInstance.stoppedAt = Date.now();
  }
}
```

### 3.5 状态管理

```typescript
// stores/gridStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GridStore {
  // 状态
  activeGrids: GridInstance[];
  currentConfig: Partial<GridConfig>;
  isCreating: boolean;

  // Actions
  setConfig: (config: Partial<GridConfig>) => void;
  createGrid: (config: GridConfig) => Promise<string>;
  stopGrid: (gridId: string) => Promise<void>;
  removeGrid: (gridId: string) => void;
  updateGridStatus: (gridId: string, status: GridStatus) => void;
  updateGridProfit: (gridId: string, profit: GridProfit) => void;
}

export const useGridStore = create<GridStore>()(
  persist(
    (set, get) => ({
      activeGrids: [],
      currentConfig: {},
      isCreating: false,

      setConfig: (config) => set((state) => ({
        currentConfig: { ...state.currentConfig, ...config }
      })),

      createGrid: async (config) => {
        set({ isCreating: true });
        try {
          const gridInstance = await GridService.createGrid(config);
          set((state) => ({
            activeGrids: [...state.activeGrids, gridInstance],
            currentConfig: {},
          }));
          return gridInstance.id;
        } finally {
          set({ isCreating: false });
        }
      },

      stopGrid: async (gridId) => {
        await GridService.stopGrid(gridId);
        set((state) => ({
          activeGrids: state.activeGrids.map(g =>
            g.id === gridId ? { ...g, status: 'STOPPED' as GridStatus } : g
          ),
        }));
      },

      // ... 其他 actions
    }),
    {
      name: 'aster-spot-grid-storage',
    }
  )
);
```

### 3.6 实时数据处理

```typescript
// services/websocket/StreamManager.ts

export class StreamManager {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private baseUrl: string = 'wss://sstream.asterdex.com') {}

  connect(): void {
    this.ws = new WebSocket(this.baseUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      this.handleReconnect();
    };
  }

  subscribe(stream: string, callback: (data: any) => void): () => void {
    if (!this.subscriptions.has(stream)) {
      this.subscriptions.set(stream, new Set());
      this.sendSubscribe(stream);
    }
    this.subscriptions.get(stream)!.add(callback);

    return () => {
      this.subscriptions.get(stream)?.delete(callback);
      if (this.subscriptions.get(stream)?.size === 0) {
        this.sendUnsubscribe(stream);
        this.subscriptions.delete(stream);
      }
    };
  }

  // 订阅价格变动
  subscribePrice(symbol: string, callback: (price: number) => void): () => void {
    return this.subscribe(`${symbol.toLowerCase()}@ticker`, (data) => {
      callback(parseFloat(data.c)); // 最新价格
    });
  }

  // 订阅订单簿
  subscribeOrderBook(symbol: string, callback: (data: OrderBook) => void): () => void {
    return this.subscribe(`${symbol.toLowerCase()}@depth`, callback);
  }
}
```

---

## 四、关键技术挑战与解决方案

### 4.1 订单同步问题

**挑战**：网格交易需要实时监控订单状态，确保买卖单的及时配对。

**解决方案**：
- 使用 WebSocket 订阅订单状态更新
- 本地维护订单状态缓存
- 定期通过 REST API 校验订单状态
- 实现幂等的订单处理逻辑

### 4.2 价格滑点处理

**挑战**：市场波动可能导致订单无法按预期价格成交。

**解决方案**：
- 使用限价单而非市价单
- 设置合理的价格精度（遵循 exchangeInfo 中的 tickSize）
- 实现价格偏离告警机制

### 4.3 资金管理

**挑战**：需要精确管理每个网格的资金分配。

**解决方案**：
- 预先计算并锁定所需资金
- 实时追踪可用余额
- 实现资金不足时的优雅降级

### 4.4 断线重连

**挑战**：WebSocket 断线后需要恢复状态。

**解决方案**：
- 实现指数退避重连机制
- 本地持久化网格状态
- 重连后同步服务器订单状态

---

## 五、API 认证与私钥管理（可行性分析）

> ⚠️ **重要说明**：本章节所有内容均基于 ASTER 官方文档和 GitHub 仓库，不包含任何编造内容。

### 5.1 ASTER 认证体系概述

根据 [ASTER 官方 API 文档](https://github.com/asterdex/api-docs)，ASTER 采用**混合认证体系**：

| 认证类型 | 要求 | 适用场景 |
|---------|------|---------|
| **NONE** | 无需认证 | 公开市场数据 |
| **MARKET_DATA** | 仅需 API-Key | 历史交易数据 |
| **USER_STREAM** | 仅需 API-Key | WebSocket 用户数据流 |
| **USER_DATA** | API-Key + HMAC 签名 | 账户信息查询 |
| **TRADE** | API-Key + HMAC 签名 | 下单、撤单等交易操作 |

**关键发现**：ASTER 虽然是去中心化交易所，但其 API 采用与 Binance 兼容的认证方式，使用传统的 API Key + Secret 模式，而非直接使用钱包私钥签名每笔交易。

### 5.2 API Key 创建流程（官方文档）

根据 [aster-api-key-registration.md](https://github.com/asterdex/api-docs/master/aster-api-key-registration.md)，创建 API Key 需要四个步骤：

#### Step 1: 获取 Nonce

```
POST https://www.asterdex.com/bapi/futures/v1/public/future/web3/get-nonce

参数:
- sourceAddr: 钱包地址
- type: "CREATE_API_KEY"

返回:
- nonce: 用于签名的随机数
```

#### Step 2: 钱包签名

使用钱包对消息进行签名：

```
签名消息格式: "You are signing into Astherus [nonce]"
签名方式: EVM 标准签名 (eth_sign / personal_sign)
```

#### Step 3: Web3 登录认证

```
POST https://www.asterdex.com/bapi/futures/v1/public/future/web3/ae/login

参数:
- signature: Step 2 生成的签名
- sourceAddr: 钱包地址
- chainId: 链 ID (如 56 代表 BSC)
- agentCode: 可选，推荐码

返回:
- 认证 token
- 用户 ID
```

#### Step 4: 创建 API Key

```
POST https://www.asterdex.com/bapi/futures/v1/public/future/web3/broker-create-api-key

参数:
- desc: API Key 描述（最多20字符，账户内唯一）
- network: 网络标识 (如 "56")
- signature: Step 2 的签名
- sourceAddr: 钱包地址
- type: "CREATE_API_KEY"
- ip: 可选，IP 白名单

返回:
- apiKey: API 密钥
- apiSecret: API 密钥（仅显示一次！）
```

### 5.3 API Wallet 机制（官方特性）

ASTER 提供了**专用 API 钱包**机制，用于隔离交易权限：

```
┌─────────────────────────────────────────────────────────────────┐
│                    ASTER 三地址认证体系                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐                                              │
│   │  主钱包地址   │  ← 用户真实钱包，持有资金                      │
│   │  (User)      │                                              │
│   └──────┬───────┘                                              │
│          │ 授权                                                  │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │ API 钱包地址  │  ← 专用于 API 交易，可随时撤销                 │
│   │  (Signer)    │                                              │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │ API 私钥     │  ← 用于签名 API 请求，独立于主钱包             │
│   │ (Private Key)│                                              │
│   └──────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**创建 API Wallet**：https://www.asterdex.com/en/api-wallet

**安全优势**：
- 主钱包私钥永不暴露
- API 钱包可随时从 ASTER 网页端撤销
- API 钱包资金有限，降低风险
- 支持多个 API 钱包用于不同应用

### 5.4 HMAC SHA256 签名机制

根据 [Spot API 文档](https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api.md)：

#### 签名流程

```
1. 拼接所有参数: queryString + requestBody = totalParams
2. 使用 apiSecret 作为密钥
3. 对 totalParams 进行 HMAC-SHA256 运算
4. 将签名附加到请求末尾
```

#### 签名示例（来自官方文档）

```typescript
// 参数示例
const params = {
  symbol: 'BNBUSDT',
  side: 'BUY',
  type: 'LIMIT',
  timeInForce: 'GTC',
  quantity: 5,
  price: 1.1,
  recvWindow: 5000,
  timestamp: 1756187806000
};

// 生成签名
const queryString = 'symbol=BNBUSDT&side=BUY&type=LIMIT&timeInForce=GTC&quantity=5&price=1.1&recvWindow=5000&timestamp=1756187806000';
const signature = HMAC_SHA256(queryString, apiSecret);

// 完整请求
curl -H "X-MBX-APIKEY: [apiKey]" \
  -X POST 'https://sapi.asterdex.com/api/v1/order' \
  -d 'symbol=BNBUSDT&side=BUY&type=LIMIT&timeInForce=GTC&quantity=5&price=1.1&recvWindow=5000&timestamp=1756187806000&signature=[signature]'
```

#### 时间戳验证

```
服务器验证逻辑:
if (timestamp < (serverTime + 1000) && (serverTime - timestamp) <= recvWindow) {
  // 请求有效
}

- recvWindow 默认值: 5000ms (5秒)
- recvWindow 最大值: 60000ms (60秒)
```

### 5.5 可行性分析

#### ✅ 技术可行性

| 方面 | 评估 | 说明 |
|------|------|------|
| API 完整性 | ✅ 完全支持 | 现货 API 提供完整的交易、查询、撤单功能 |
| 认证机制 | ✅ 标准化 | 使用 Binance 兼容的 HMAC-SHA256 签名 |
| WebSocket | ✅ 支持 | 提供实时数据流和账户更新推送 |
| 多链支持 | ✅ 支持 | 支持 BSC、Ethereum、Arbitrum 等 |

#### ✅ 安全可行性

| 方面 | 评估 | 说明 |
|------|------|------|
| 私钥隔离 | ✅ 支持 | API Wallet 机制隔离主钱包私钥 |
| 权限控制 | ✅ 支持 | 可限制 API Key 仅用于交易 |
| IP 白名单 | ✅ 支持 | 创建 API Key 时可指定 IP |
| 可撤销性 | ✅ 支持 | API Wallet 可随时从网页端撤销 |

#### ⚠️ 注意事项

| 风险点 | 说明 | 缓解措施 |
|--------|------|---------|
| API Secret 仅显示一次 | 创建后无法再次查看 | 立即安全存储 |
| API Key 无法用户删除 | 官方文档明确说明 | 使用 API Wallet 机制撤销权限 |
| 频率限制 | 1200 权重/分钟，100 订单/分钟 | 实现请求队列和限流 |
| IP 封禁 | 违规后 2 分钟至 3 天封禁 | 严格遵守频率限制 |

### 5.6 推荐实现方案

#### 方案 A: 纯前端方案（推荐用于个人使用）

```
┌──────────────────────────────────────────────────────────────┐
│                      用户浏览器                               │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │  网格交易 UI   │  │  API 凭证管理   │  │  本地存储     │  │
│  │               │  │  (加密存储)     │  │  (网格状态)   │  │
│  └───────┬───────┘  └───────┬────────┘  └───────────────┘  │
│          │                   │                               │
│          ▼                   ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   API 客户端层                           ││
│  │  - HMAC 签名生成                                        ││
│  │  - 请求频率控制                                         ││
│  │  - WebSocket 管理                                       ││
│  └─────────────────────────────────────────────────────────┘│
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTPS / WSS
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    ASTER DEX 服务器                          │
│  sapi.asterdex.com (REST)  |  sstream.asterdex.com (WS)     │
└──────────────────────────────────────────────────────────────┘
```

**优点**：
- 无需后端服务器
- 用户完全掌控私钥/API 凭证
- 部署简单，可托管在 IPFS 或静态服务器

**缺点**：
- API 凭证存储在浏览器，存在 XSS 风险
- 关闭浏览器后网格策略停止

**凭证存储方案**：
```typescript
// 使用 Web Crypto API 加密存储
async function encryptCredentials(credentials: Credentials, password: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(credentials));

  // 从密码派生密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );

  return { encrypted, salt, iv };
}
```

#### 方案 B: 前端 + 本地服务（推荐用于持续运行）

```
┌──────────────────────────────────────────────────────────────┐
│                      用户设备                                 │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌───────────────────────────┐   │
│  │    Web UI (前端)     │◄──►│    本地服务 (Node.js)     │   │
│  │  - 参数配置          │    │  - 网格执行引擎           │   │
│  │  - 状态展示          │    │  - API 凭证管理           │   │
│  │  - 收益统计          │    │  - 订单管理               │   │
│  └─────────────────────┘    └─────────────┬─────────────┘   │
│                                            │                 │
└────────────────────────────────────────────┼─────────────────┘
                                             │ HTTPS / WSS
                                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    ASTER DEX 服务器                          │
└──────────────────────────────────────────────────────────────┘
```

**优点**：
- 网格策略可 24/7 运行
- API 凭证存储在本地，更安全
- 支持更复杂的策略逻辑

**缺点**：
- 需要用户运行本地服务
- 部署复杂度较高

### 5.7 API 凭证获取指引

用户需要按以下步骤获取 API 凭证：

```
┌─────────────────────────────────────────────────────────────┐
│                    获取 API 凭证流程                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 访问 https://www.asterdex.com/en/api-wallet             │
│     └─► 连接钱包                                             │
│                                                              │
│  2. 创建 API Wallet                                         │
│     └─► 批准交易，获取:                                      │
│         • User (主钱包地址)                                  │
│         • Signer (API 钱包地址)                              │
│         • Private Key (API 私钥) ⚠️ 仅显示一次！             │
│                                                              │
│  3. 访问 https://www.asterdex.com/en/api-management         │
│     └─► 创建 API Key                                        │
│         • 输入描述名称                                       │
│         • 可选：设置 IP 白名单                               │
│         • 获取 API Key 和 API Secret ⚠️ 仅显示一次！         │
│                                                              │
│  4. 安全存储凭证                                             │
│     └─► 使用密码管理器保存:                                  │
│         • API Key                                            │
│         • API Secret                                         │
│         • API Wallet Private Key (如需要)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.8 结论

**可行性结论：✅ 完全可行**

基于 ASTER 官方文档的分析：

1. **API 完整性**：ASTER 现货 API 提供完整的交易功能，包括下单、撤单、查询等所有网格交易所需的接口。

2. **认证安全性**：采用标准的 HMAC-SHA256 签名机制，配合 API Wallet 隔离机制，可以在不暴露主钱包私钥的情况下进行交易。

3. **实时数据**：WebSocket 支持实时价格推送和订单状态更新，满足网格交易对实时性的要求。

4. **用户体验**：用户只需一次性配置 API 凭证，之后的交易操作完全自动化，与官方永续合约网格交易体验一致。

**主要限制**：
- 需要用户手动在 ASTER 官网创建 API Wallet 和 API Key
- API 凭证管理需要安全措施
- 受限于 API 频率限制（100 订单/分钟）

---

## 六、与官方界面保持一致

### 6.1 视觉一致性

- 使用相同的颜色方案（深色主题）
- 保持相同的组件间距和布局比例
- 使用相同的图标风格
- 保持相同的动画过渡效果

### 6.2 交互一致性

- 相同的参数输入方式
- 相同的确认/取消流程
- 相同的错误提示风格
- 相同的加载状态展示

### 6.3 功能映射

| 永续合约网格功能 | 现货网格对应功能 |
|----------------|----------------|
| 杠杆设置 | 移除（现货无杠杆）|
| 保证金类型（Cross/Isolated）| 移除 |
| 做多/做空/中性 | 仅中性模式（买低卖高）|
| 平仓 | 卖出持仓 |
| 初始保证金 | 投资金额 |

---

## 七、开发里程碑

### Phase 1: 基础框架
- 项目初始化和技术栈搭建
- API 客户端封装
- WebSocket 连接管理
- 基础 UI 组件

### Phase 2: 核心功能
- 网格计算逻辑
- 订单管理器
- 收益计算器
- 参数配置界面

### Phase 3: 完整体验
- 价格图表集成
- 网格预览可视化
- 活跃策略管理
- 历史记录

### Phase 4: 优化和测试
- 性能优化
- 错误处理完善
- 测试覆盖
- 文档完善

---

## 八、参考资源

- **ASTER 官方文档**: https://docs.asterdex.com/
- **网格交易文档**: https://docs.asterdex.com/product/aster-perpetual-pro/grid-trading
- **Long/Short 网格**: https://docs.asterdex.com/product/aster-perpetual-pro/grid-trading/long-short-grid-trading
- **API 文档 (GitHub)**: https://github.com/asterdex/api-docs
- **现货 API**: https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api.md
