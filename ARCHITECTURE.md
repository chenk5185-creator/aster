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

### 2.3 核心业务逻辑

#### 2.3.1 网格计算算法

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

#### 2.3.2 订单分配策略

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

#### 2.3.3 收益计算

```
单格收益 = 卖出价格 - 买入价格 - 手续费
总收益 = Σ(所有已完成的网格交易收益) + 浮动收益（持仓变化）
收益率 = 总收益 / 投资金额 × 100%
```

### 2.4 用户流程

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
   */
  static calculateGridProfitPerLevel(
    levels: number[],
    gridType: GridType,
    feeRate: number = 0.001 // 0.1% 手续费
  ): number[] {
    const profits: number[] = [];

    for (let i = 0; i < levels.length - 1; i++) {
      const buyPrice = levels[i];
      const sellPrice = levels[i + 1];
      const grossProfit = sellPrice - buyPrice;
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

## 五、与官方界面保持一致

### 5.1 视觉一致性

- 使用相同的颜色方案（深色主题）
- 保持相同的组件间距和布局比例
- 使用相同的图标风格
- 保持相同的动画过渡效果

### 5.2 交互一致性

- 相同的参数输入方式
- 相同的确认/取消流程
- 相同的错误提示风格
- 相同的加载状态展示

### 5.3 功能映射

| 永续合约网格功能 | 现货网格对应功能 |
|----------------|----------------|
| 杠杆设置 | 移除（现货无杠杆）|
| 保证金类型（Cross/Isolated）| 移除 |
| 做多/做空/中性 | 仅中性模式（买低卖高）|
| 平仓 | 卖出持仓 |
| 初始保证金 | 投资金额 |

---

## 六、开发里程碑

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

## 七、参考资源

- **ASTER 官方文档**: https://docs.asterdex.com/
- **网格交易文档**: https://docs.asterdex.com/product/aster-perpetual-pro/grid-trading
- **Long/Short 网格**: https://docs.asterdex.com/product/aster-perpetual-pro/grid-trading/long-short-grid-trading
- **API 文档 (GitHub)**: https://github.com/asterdex/api-docs
- **现货 API**: https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api.md
