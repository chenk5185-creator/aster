# ASTER 现货网格交易工具 - 产品需求文档 (PRD)

**版本**: v2.0
**文档日期**: 2026-01-08
**产品负责人**: [待定]
**技术负责人**: [待定]
**状态**: 需求评审中 ✏️

---

## 📑 文档修订历史

| 版本 | 日期 | 修订内容 | 修订人 |
|------|------|---------|--------|
| v1.0 | 2024-12-XX | 初始版本（ARCHITECTURE.md） | - |
| v2.0 | 2026-01-08 | 基于代码审计结果重构，新增安全和风控需求 | 技术团队 |

---

## 1. 产品概述

### 1.1 产品定位

**ASTER 现货网格交易工具**是一个基于浏览器的去中心化现货网格交易应用，为 ASTER DEX 用户提供自动化交易策略，通过在价格区间内高抛低吸赚取收益。

### 1.2 核心价值

- **自动化交易**: 无需盯盘，自动执行买卖策略
- **降低风险**: 分散投资，避免单点买入风险
- **提高收益**: 利用市场波动赚取价差
- **完全控制**: 用户保管 API 密钥，资金安全

### 1.3 目标用户

| 用户类型 | 特征 | 占比 |
|---------|------|------|
| **主力用户** | 有加密货币交易经验，了解网格策略，希望自动化交易 | 60% |
| **进阶用户** | 量化交易爱好者，需要更多自定义参数和回测功能 | 30% |
| **新手用户** | 首次使用网格交易，需要教育引导 | 10% |

### 1.4 成功指标 (KPI)

| 指标 | 目标 | 衡量方式 |
|------|------|---------|
| 日活用户 (DAU) | 500+ | 每日打开应用的独立用户数 |
| 创建网格数 | 200+/天 | 每日新创建的网格策略数 |
| 平均持续运行时间 | >24 小时 | 网格从启动到停止的平均时长 |
| 用户留存率 (7 天) | >40% | 创建首个网格后 7 天内再次使用的比例 |
| 严重错误率 | <0.1% | 导致资金损失或无法恢复的错误比例 |

---

## 2. 功能需求

### 2.1 功能优先级矩阵

| 功能模块 | P0 (MVP必须) | P1 (短期优化) | P2 (长期规划) |
|---------|-------------|--------------|--------------|
| **网格管理** | 创建、启动、停止网格 | 批量管理、模板保存 | 智能推荐参数 |
| **交易执行** | 限价单买卖、订单监控 | 部分成交处理、订单优化 | 市价单支持 |
| **风险控制** | 止损止盈、最大亏损保护 | 动态调整、预警通知 | 风险评分系统 |
| **数据展示** | 实时价格、收益统计 | K线图、深度图 | 高级图表分析 |
| **安全认证** | API 凭证加密、自动锁定 | 双因素认证 | 硬件钱包集成 |
| **用户体验** | 响应式布局、中英文 | 移动端优化、暗黑模式 | 自定义主题 |

---

## 2.2 核心功能详细需求

### 2.2.1 网格策略配置

#### 基础参数（P0）

| 参数 | 说明 | 验证规则 | 默认值 |
|------|------|---------|--------|
| **交易对** | 如 BTCUSDT | 仅支持 USDT 计价的交易对 | BTCUSDT |
| **价格上限** | 网格最高价格 | 必须 > 价格下限，符合交易所 PRICE_FILTER | - |
| **价格下限** | 网格最低价格 | 必须 > 0，符合交易所 PRICE_FILTER | - |
| **网格数量** | 划分的格子数 | 2 ≤ gridCount ≤ 200 | 10 |
| **网格类型** | 等差/等比 | ARITHMETIC \| GEOMETRIC | ARITHMETIC |
| **投资金额** | 总投资金额（USDT） | 必须 ≤ 可用余额，≥ 最小投资要求 | - |

**验证逻辑**:
```typescript
// 最小投资金额计算
const minInvestment = minNotional × buyGridCount;

// 单格金额验证
const amountPerGrid = investmentAmount / buyGridCount;
if (amountPerGrid < minNotional) {
  throw new Error(`单格金额不足，请减少网格数至 ${Math.floor(investmentAmount / minNotional)} 或增加投资金额至 ${minInvestment.toFixed(2)}`);
}
```

#### 高级参数（P0 - 风控必需）

| 参数 | 说明 | 验证规则 | 默认值 |
|------|------|---------|--------|
| **触发价格** | 达到此价格后启动 | 可选，在价格范围内 | 无 |
| **止损上限** | 价格超过此值时停止 | 可选，≥ 价格上限 | 无 |
| **止损下限** | 价格低于此值时停止 | 可选，≤ 价格下限 | 无 |
| **最大亏损** | 最大可接受亏损金额 | 可选，0 < maxLoss ≤ investmentAmount | 无 |
| **最大回撤** | 最大回撤百分比 | 可选，0 < maxDrawdown ≤ 100 | 无 |
| **停止时取消订单** | 停止时是否取消挂单 | boolean | true |
| **停止时卖出持仓** | 停止时是否市价卖出 | boolean | false |

#### 新增参数（P1）

| 参数 | 说明 | 默认值 |
|------|------|--------|
| **订单超时时间** | 挂单未成交超过此时间自动撤单 | 24 小时 |
| **价格偏离容忍度** | 当前价格偏离网格范围的容忍百分比 | 5% |
| **自动重启** | 触发止损后是否自动重新创建网格 | false |

---

### 2.2.2 网格创建流程

#### 用户流程图

```
┌─────────────────────────────────────────────────────────────┐
│                     网格创建流程                             │
└─────────────────────────────────────────────────────────────┘

1. 选择交易对
   ↓
2. 输入价格区间和网格数量
   ↓
3. 系统实时计算并展示：
   - 预计收益率
   - 单格利润
   - 所需最小投资金额
   - 当前价格位置
   ↓
4. 输入投资金额
   ↓
5. 【前端验证】检查参数合法性
   - 价格范围
   - 网格数量
   - 投资金额
   ↓ 通过
6. 【后端验证】调用 API 检查
   - 获取账户余额
   - 获取交易对规则 (exchangeInfo)
   - 获取手续费率
   - 验证 minNotional、lotSize 等
   ↓ 通过
7. 展示风险提示（P0 - 必需）
   ┌────────────────────────────────────────────┐
   │ ⚠️  风险提示                                │
   │                                            │
   │ 1. 单边行情可能导致亏损                     │
   │ 2. 预计手续费：XX USDT                      │
   │ 3. 价格跳空可能影响收益                     │
   │ 4. 浏览器关闭后策略将停止                   │
   │                                            │
   │ [ ] 我已阅读并理解风险                      │
   │                                            │
   │ [取消]  [确认创建]                          │
   └────────────────────────────────────────────┘
   ↓ 确认
8. 创建网格实例（状态: PENDING）
   ↓
9. 用户手动点击【启动】
   ↓
10. 计算初始订单
    ↓
11. 批量下单（限流保护）
    ↓ 成功
12. 网格状态变更为 RUNNING
    ↓
13. 开始监控订单状态
```

#### 参数验证详细规则（P0）

**前端验证**:
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];      // 阻塞性错误
  warnings: string[];    // 警告（不阻塞）
}

// 1. 价格范围验证
if (upperPrice <= lowerPrice) {
  errors.push('价格上限必须大于价格下限');
}

// 2. 当前价格位置警告
if (currentPrice < lowerPrice) {
  warnings.push('当前价格低于网格下限，初始时不会放置买单');
}
if (currentPrice > upperPrice) {
  warnings.push('当前价格高于网格上限，建议重新设置范围');
}

// 3. 网格数量验证
if (gridCount < 2 || gridCount > 200) {
  errors.push('网格数量必须在 2-200 之间');
}

// 4. 投资金额验证
if (investmentAmount <= 0) {
  errors.push('投资金额必须大于 0');
}
```

**后端验证（API 调用）**:
```typescript
// 1. 余额检查
const balance = await accountApi.getAvailableBalance('USDT');
if (investmentAmount > balance) {
  errors.push(`余额不足。可用: ${balance.toFixed(2)} USDT`);
}

// 2. 最小交易金额验证
const minNotional = getMinNotional(symbolInfo);
const buyGridCount = calculateBuyGridCount(levels, currentPrice);
const amountPerGrid = investmentAmount / buyGridCount;

if (amountPerGrid < minNotional) {
  const minRequired = minNotional * buyGridCount;
  errors.push(
    `单格金额 ${amountPerGrid.toFixed(2)} 低于最小限制 ${minNotional}。` +
    `建议：减少网格数至 ${Math.floor(investmentAmount / minNotional)} 或 ` +
    `增加投资金额至 ${minRequired.toFixed(2)}`
  );
}

// 3. 价格精度验证
const tickSize = getPriceFilter(symbolInfo).tickSize;
if (!isMultipleOf(upperPrice, tickSize) || !isMultipleOf(lowerPrice, tickSize)) {
  errors.push(`价格必须是 ${tickSize} 的倍数`);
}

// 4. 手续费影响警告
const profitStats = calculateProfitRate(levels, feeRate);
if (profitStats.minProfitRate <= 0) {
  warnings.push(
    `部分网格收益可能无法覆盖手续费（最低: ${profitStats.minProfitRate.toFixed(2)}%）`
  );
}
```

---

### 2.2.3 订单执行逻辑

#### 初始订单分配（P0）

**策略**: 纯买单启动
```typescript
// 1. 计算当前价格所在网格位置
const currentGridIndex = findGridIndex(levels, currentPrice);

// 2. 在当前价格以下放置买单
for (let i = 0; i < currentGridIndex; i++) {
  const price = adjustToTickSize(levels[i], tickSize);
  const amountForThisGrid = investmentAmount / currentGridIndex;
  const quantity = adjustToStepSize(amountForThisGrid / price, stepSize);

  // 验证订单是否满足最小要求
  if (quantity * price >= minNotional) {
    await placeLimitBuy(symbol, quantity, price);
  } else {
    warnings.push(`网格 ${i} 订单金额不足，已跳过`);
  }
}

// 3. 当前价格以上不放置任何订单（等待买入后再放卖单）
```

**边界情况处理**:

| 场景 | 处理方式 |
|------|---------|
| 当前价格 < 下限 | 不放置任何订单，提示用户"等待价格回到网格范围" |
| 当前价格 > 上限 | 提示用户"价格已超出上限，建议重新设置网格或等待回调" |
| 当前价格在网格内 | 正常放置买单 |

#### 订单成交处理（P0）

**买单成交**:
```typescript
async handleBuyOrderFilled(order: GridOrder) {
  // 1. 更新网格层级状态
  level.status = 'HOLDING';
  level.buyOrderId = undefined;

  // 2. 更新持仓
  gridInstance.baseAssetHolding += order.quantity;

  // 3. 计算卖出价格（上一个网格的价格）
  const sellGridIndex = order.gridIndex + 1;
  const sellPrice = adjustToTickSize(levels[sellGridIndex].price, tickSize);

  // 4. 放置卖单
  await placeLimitSell(symbol, order.quantity, sellPrice);

  // 5. 记录买入成本（用于后续收益计算）
  level.buyPrice = order.price;
  level.buyQuantity = order.quantity;
}
```

**卖单成交**:
```typescript
async handleSellOrderFilled(order: GridOrder) {
  // 1. 更新网格层级状态
  level.status = 'EMPTY';
  level.sellOrderId = undefined;

  // 2. 更新持仓
  gridInstance.baseAssetHolding -= order.quantity;

  // 3. 计算本次交易收益
  const matchingBuyOrder = findMatchingBuyOrder(order);
  if (matchingBuyOrder) {
    const grossProfit = (order.price - matchingBuyOrder.price) * order.quantity;
    const buyFee = matchingBuyOrder.price * order.quantity * takerFee;
    const sellFee = order.price * order.quantity * makerFee;
    const netProfit = grossProfit - buyFee - sellFee;

    // 4. 更新收益统计
    gridInstance.profit.realizedProfit += netProfit;
    gridInstance.profit.tradingCount += 1;
    gridInstance.profit.totalFees += buyFee + sellFee;

    // 5. 记录交易历史（P1 - 审计日志）
    auditLogger.log({
      type: 'GRID_TRADE_COMPLETED',
      gridId: gridInstance.id,
      gridIndex: order.gridIndex,
      buyPrice: matchingBuyOrder.price,
      sellPrice: order.price,
      quantity: order.quantity,
      profit: netProfit,
      timestamp: Date.now(),
    });
  }

  // 6. 在当前价格放置新的买单
  const buyPrice = adjustToTickSize(level.price, tickSize);
  const amountPerGrid = calculateDynamicAmount(investmentAmount, currentPrice, levels);
  const quantity = adjustToStepSize(amountPerGrid / buyPrice, stepSize);

  if (quantity * buyPrice >= minNotional) {
    await placeLimitBuy(symbol, quantity, buyPrice);
  }
}
```

#### 部分成交处理（P1 - 重要）

```typescript
async handlePartialFill(order: GridOrder, newExecutedQty: number) {
  const delta = newExecutedQty - order.executedQty;
  order.executedQty = newExecutedQty;

  if (order.side === 'BUY') {
    // 部分买入 → 放置对应数量的卖单
    gridInstance.baseAssetHolding += delta;

    // 检查是否已有卖单
    if (!level.sellOrderId) {
      const sellPrice = levels[order.gridIndex + 1].price;
      await placeLimitSell(symbol, delta, sellPrice);
    } else {
      // 已有卖单，修改数量（如果交易所支持）或撤单重新下单
      await modifyOrReplaceSellOrder(level.sellOrderId, newExecutedQty);
    }
  } else {
    // 部分卖出 → 按比例计算收益
    gridInstance.baseAssetHolding -= delta;
    // 收益计算逻辑同上
  }
}
```

---

### 2.2.4 收益计算（P0 - 修复审计问题）

#### 已实现收益（Realized Profit）

```typescript
// 每次卖单完全成交时计算
realizedProfit = Σ[(卖出价 - 买入价) × 数量 - 手续费]
```

#### 未实现收益（Unrealized Profit）- **新增**

```typescript
async calculateUnrealizedProfit(currentPrice: number): Promise<number> {
  const holding = gridInstance.baseAssetHolding;
  if (holding <= 0) return 0;

  // 1. 计算所有持仓的加权平均买入价
  const filledBuyOrders = gridInstance.orders.filter(
    o => o.side === 'BUY' &&
         o.status === 'FILLED' &&
         !hasMatchingSellOrder(o)  // 排除已卖出的
  );

  const totalCost = filledBuyOrders.reduce(
    (sum, o) => sum + o.price * o.executedQty,
    0
  );
  const totalQty = filledBuyOrders.reduce(
    (sum, o) => sum + o.executedQty,
    0
  );

  if (totalQty === 0) return 0;

  const avgBuyPrice = totalCost / totalQty;

  // 2. 浮动盈亏 = (当前价 - 平均买入价) × 持仓量
  return (currentPrice - avgBuyPrice) * holding;
}
```

#### 总收益和收益率

```typescript
totalProfit = realizedProfit + unrealizedProfit;
profitRate = (totalProfit / investmentAmount) × 100%;

// 更新频率：每次订单成交时 + 每 10 秒更新一次（基于最新价格）
```

---

### 2.2.5 风险控制（P0 - 关键新增）

#### 止损逻辑

**价格止损**（已实现）:
```typescript
// 每 3 秒检查一次（在订单轮询时）
if (config.stopUpperPrice && currentPrice >= config.stopUpperPrice) {
  await stopGrid('stop_upper_triggered');
  notifyUser('网格已停止：价格触及上限止损');
}

if (config.stopLowerPrice && currentPrice <= config.stopLowerPrice) {
  await stopGrid('stop_lower_triggered');
  notifyUser('网格已停止：价格触及下限止损');
}
```

**最大亏损止损**（新增 - P0）:
```typescript
interface GridConfig {
  maxLoss?: number;  // 最大亏损金额（USDT）
}

// 检查逻辑
async checkMaxLoss() {
  const currentPrice = await getPrice(symbol);
  const unrealizedProfit = await calculateUnrealizedProfit(currentPrice);
  const totalProfit = realizedProfit + unrealizedProfit;
  const currentLoss = -totalProfit;  // 负收益即亏损

  if (config.maxLoss && currentLoss >= config.maxLoss) {
    await emergencyStop('max_loss_reached');
    notifyUser(`⚠️ 网格已紧急停止：亏损达到上限 ${config.maxLoss} USDT`);

    // 如果配置了自动卖出，立即市价卖出所有持仓
    if (config.sellAllOnStop) {
      await sellAllHoldingsAtMarket();
    }
  }
}
```

**最大回撤止损**（新增 - P1）:
```typescript
interface GridConfig {
  maxDrawdown?: number;  // 最大回撤百分比
}

// 跟踪历史最高权益
let maxEquity = investmentAmount;

async checkMaxDrawdown() {
  const currentEquity = investmentAmount + totalProfit;

  // 更新历史最高
  if (currentEquity > maxEquity) {
    maxEquity = currentEquity;
  }

  // 计算回撤
  const drawdown = ((maxEquity - currentEquity) / maxEquity) * 100;

  if (config.maxDrawdown && drawdown >= config.maxDrawdown) {
    await emergencyStop('max_drawdown_reached');
    notifyUser(`⚠️ 网格已停止：回撤达到 ${drawdown.toFixed(2)}%`);
  }
}
```

---

### 2.2.6 订单监控与同步（P0/P1）

#### 当前实现（轮询模式）- P0

```typescript
// 每 3 秒轮询一次
setInterval(async () => {
  // 1. 获取所有挂单
  const openOrders = await getOpenOrders(symbol);

  // 2. 检查哪些订单已成交
  for (const localOrder of pendingOrders) {
    if (!openOrderIds.has(localOrder.orderId)) {
      const orderStatus = await getOrder(symbol, localOrder.orderId);
      if (orderStatus.status === 'FILLED') {
        await handleOrderFilled(localOrder);
      }
    }
  }
}, 3000);
```

**问题**:
- 延迟高（最多 3 秒）
- API 请求次数多
- 无法实时响应

#### 改进方案（WebSocket 模式）- P1

```typescript
// 使用 ASTER User Data Stream
async function initUserDataStream() {
  // 1. 创建 listenKey
  const listenKey = await createListenKey();

  // 2. 订阅 User Data Stream
  wsManager.subscribe(`user/${listenKey}`, (event) => {
    if (event.e === 'executionReport') {
      handleOrderUpdate(event);
    }
  });

  // 3. 每 30 分钟延长 listenKey
  setInterval(() => {
    keepAliveListenKey(listenKey);
  }, 30 * 60 * 1000);
}

function handleOrderUpdate(event: ExecutionReport) {
  const localOrder = findOrderByClientId(event.c);
  if (!localOrder) return;

  // 实时更新订单状态
  if (event.X === 'FILLED') {
    handleOrderFilled(localOrder);
  } else if (event.X === 'PARTIALLY_FILLED') {
    handlePartialFill(localOrder, parseFloat(event.z));
  } else if (event.X === 'CANCELED') {
    handleOrderCanceled(localOrder);
  }
}
```

**优点**:
- 延迟 <1 秒
- 减少 API 请求
- 实时响应

**实施建议**:
- **P0 阶段**: 保留轮询模式（稳定性优先）
- **P1 阶段**: 迁移到 WebSocket 模式
- **降级策略**: WebSocket 失败时自动切回轮询

---

### 2.2.7 网格状态管理

#### 状态流转图

```
        创建
         ↓
    ┌─────────┐
    │ PENDING │ ← 网格已创建，未启动
    └─────────┘
         │
         │ 用户点击【启动】
         ↓
    ┌─────────┐
    │ RUNNING │ ← 网格正在运行，监控订单
    └─────────┘
         │
         ├─→ 用户手动停止 ────────┐
         ├─→ 触发止损 ────────────┤
         ├─→ 触发最大亏损 ────────┤
         └─→ WebSocket 断线超限 ──┤
                                  ↓
                             ┌─────────┐
                             │ STOPPED │ ← 网格已停止
                             └─────────┘
                                  │
                                  ├─→ 所有订单已处理 ─→ COMPLETED
                                  └─→ 发生错误 ─────→ ERROR
```

#### 状态持久化（P0）

```typescript
// 使用 Zustand persist 中间件
persist(
  (set, get) => ({ ... }),
  {
    name: 'aster-grid-storage',
    storage: createJSONStorage(() => localStorage),  // P0: localStorage
    // P1: 迁移到 IndexedDB（容量更大，性能更好）

    partialize: (state) => ({
      activeGrids: state.activeGrids,
      // 不持久化：managers（运行时对象）
    }),
  }
)
```

#### 应用重启恢复（P1 - 重要）

```typescript
// 应用启动时调用
async function restoreGrids() {
  const { activeGrids } = useGridStore.getState();

  for (const grid of activeGrids) {
    if (grid.status === 'RUNNING') {
      try {
        // 1. 从交易所获取该交易对的所有挂单
        const openOrders = await tradingApi.getOpenOrders(grid.config.symbol);

        // 2. 筛选属于该网格的订单（通过 clientOrderId）
        const gridOrders = openOrders.filter(o =>
          o.clientOrderId?.startsWith(`GRID_${grid.id}_`)
        );

        if (gridOrders.length > 0) {
          // 有挂单 → 提示用户恢复
          showModal({
            title: '发现未完成的网格',
            message: `网格 ${grid.config.symbol} 仍有 ${gridOrders.length} 个挂单。`,
            actions: [
              {
                label: '恢复运行',
                onClick: () => resumeGrid(grid, gridOrders),
              },
              {
                label: '停止并撤单',
                onClick: () => stopAndCancelGrid(grid),
                variant: 'danger',
              },
            ],
          });
        } else {
          // 无挂单 → 标记为已完成
          updateGridStatus(grid.id, 'COMPLETED');
        }
      } catch (error) {
        // 无法连接交易所 → 标记为错误状态
        updateGridStatus(grid.id, 'ERROR');
        showNotification({
          type: 'error',
          message: `网格 ${grid.config.symbol} 恢复失败：${error.message}`,
        });
      }
    }
  }
}
```

---

## 3. 技术需求

### 3.1 性能要求

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| **首屏加载时间** | <3 秒 | Lighthouse 性能评分 >90 |
| **订单响应时间** | <1 秒 | 从点击到 API 返回 |
| **WebSocket 重连** | <5 秒 | 断线后自动重连时间 |
| **页面内存占用** | <100 MB | Chrome DevTools Memory Profiler |
| **网格数量上限** | 同时运行 5 个 | 不影响性能 |

### 3.2 浏览器兼容性

| 浏览器 | 最低版本 | 支持度 |
|--------|---------|--------|
| Chrome | 90+ | ✅ 完全支持 |
| Firefox | 88+ | ✅ 完全支持 |
| Safari | 14+ | ✅ 完全支持 |
| Edge | 90+ | ✅ 完全支持 |
| 移动端 Safari | 14+ | ⚠️ P1 阶段优化 |
| 移动端 Chrome | 90+ | ⚠️ P1 阶段优化 |

### 3.3 API 集成

#### ASTER Spot API 端点

| 端点 | 用途 | 频率 | 权重 |
|------|------|------|------|
| GET /api/v1/exchangeInfo | 获取交易规则 | 启动时一次 | 10 |
| GET /api/v1/account | 获取账户余额 | 创建网格时 | 10 |
| GET /api/v1/ticker/price | 获取最新价格 | 每 10 秒 | 1 |
| POST /api/v1/order | 下单 | 按需 | 1 |
| DELETE /api/v1/order | 撤单 | 按需 | 1 |
| GET /api/v1/openOrders | 查询挂单 | 每 3 秒（P0）/ WebSocket（P1） | 3 |
| GET /api/v1/order | 查询订单详情 | 按需 | 2 |

**频率限制**:
- 1200 权重/分钟
- 100 订单/分钟

**实施策略**:
```typescript
class RateLimiter {
  private weightUsed = 0;
  private orderCount = 0;
  private resetTime = Date.now() + 60000;

  async execute<T>(weight: number, fn: () => Promise<T>): Promise<T> {
    // 检查是否超限
    if (this.weightUsed + weight > 1200) {
      const waitTime = this.resetTime - Date.now();
      if (waitTime > 0) {
        await sleep(waitTime);
        this.reset();
      }
    }

    this.weightUsed += weight;
    return fn();
  }

  async executeOrder<T>(fn: () => Promise<T>): Promise<T> {
    if (this.orderCount >= 100) {
      const waitTime = this.resetTime - Date.now();
      if (waitTime > 0) {
        await sleep(waitTime);
        this.reset();
      }
    }

    this.orderCount++;
    return fn();
  }
}
```

---

## 4. 安全需求

### 4.1 API 凭证管理（P0 - 严重问题修复）

#### 加密方案（修复审计发现的漏洞）

```typescript
import CryptoJS from 'crypto-js';

interface EncryptedData {
  salt: string;       // Base64 编码的盐值
  iv: string;         // Base64 编码的初始化向量
  ciphertext: string; // Base64 编码的密文
  version: string;    // 加密版本号（用于未来升级）
}

/**
 * 安全加密方案 - 使用 PBKDF2 + AES-256-CBC
 */
function encryptCredentials(credentials: ApiCredentials, password: string): string {
  // 1. 生成随机盐值（128 位）
  const salt = CryptoJS.lib.WordArray.random(128 / 8);

  // 2. 使用 PBKDF2 从密码派生密钥
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,      // 256 位密钥
    iterations: 100000,     // 10 万次迭代（OWASP 推荐）
    hasher: CryptoJS.algo.SHA256,
  });

  // 3. 生成随机 IV（128 位）
  const iv = CryptoJS.lib.WordArray.random(128 / 8);

  // 4. AES-256-CBC 加密
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(credentials),
    key,
    {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  );

  // 5. 组合结果
  const result: EncryptedData = {
    salt: CryptoJS.enc.Base64.stringify(salt),
    iv: CryptoJS.enc.Base64.stringify(iv),
    ciphertext: encrypted.toString(),
    version: '2.0',
  };

  return JSON.stringify(result);
}

function decryptCredentials(encrypted: string, password: string): ApiCredentials | null {
  try {
    const data: EncryptedData = JSON.parse(encrypted);

    // 检查版本（未来升级时兼容旧版本）
    if (data.version !== '2.0') {
      throw new Error('Unsupported encryption version');
    }

    const salt = CryptoJS.enc.Base64.parse(data.salt);
    const iv = CryptoJS.enc.Base64.parse(data.iv);

    // 派生密钥（与加密时相同）
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256,
    });

    // 解密
    const decrypted = CryptoJS.AES.decrypt(
      data.ciphertext,
      key,
      { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plaintext) return null;

    return JSON.parse(plaintext);
  } catch {
    return null;
  }
}
```

#### 自动锁定机制（P0）

```typescript
interface CredentialsState {
  autoLockTimeout: number;  // 自动锁定时间（毫秒）
}

const AUTO_LOCK_OPTIONS = [
  { label: '5 分钟', value: 5 * 60 * 1000 },
  { label: '15 分钟', value: 15 * 60 * 1000 },
  { label: '30 分钟', value: 30 * 60 * 1000 },  // 默认
  { label: '1 小时', value: 60 * 60 * 1000 },
  { label: '从不', value: -1 },
];

let autoLockTimer: NodeJS.Timeout | null = null;

function unlockCredentials(password: string): boolean {
  // ...解锁逻辑

  // 启动自动锁定定时器
  const { autoLockTimeout } = useCredentialsStore.getState();
  if (autoLockTimeout > 0) {
    resetAutoLockTimer(autoLockTimeout);
  }

  return true;
}

function resetAutoLockTimer(timeout: number) {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
  }

  autoLockTimer = setTimeout(() => {
    useCredentialsStore.getState().lockCredentials();
    showNotification({
      type: 'info',
      message: '凭证已自动锁定，请重新输入密码',
    });
  }, timeout);
}

// 用户活动时重置计时器
window.addEventListener('mousemove', () => resetAutoLockTimer(autoLockTimeout));
window.addEventListener('keypress', () => resetAutoLockTimer(autoLockTimeout));
```

### 4.2 审计日志（P1 - 合规要求）

```typescript
interface AuditLog {
  id: string;
  timestamp: number;
  type: AuditLogType;
  gridId?: string;
  details: Record<string, unknown>;
  encrypted: boolean;
}

type AuditLogType =
  | 'CREDENTIALS_UNLOCKED'
  | 'CREDENTIALS_LOCKED'
  | 'GRID_CREATED'
  | 'GRID_STARTED'
  | 'GRID_STOPPED'
  | 'ORDER_PLACED'
  | 'ORDER_FILLED'
  | 'ORDER_CANCELED'
  | 'EMERGENCY_STOP'
  | 'ERROR_OCCURRED';

class AuditLogger {
  private db: IDBDatabase;

  async log(event: Omit<AuditLog, 'id' | 'timestamp' | 'encrypted'>) {
    const log: AuditLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      encrypted: true,
      ...event,
    };

    // 加密敏感信息
    const encryptedDetails = await this.encrypt(JSON.stringify(log.details));
    log.details = { encrypted: encryptedDetails };

    // 存储到 IndexedDB
    await this.db.transaction('logs', 'readwrite')
      .objectStore('logs')
      .add(log);
  }

  async exportLogs(password: string): Promise<Blob> {
    // 导出加密的日志文件
    const logs = await this.getAllLogs();
    const json = JSON.stringify(logs, null, 2);
    return new Blob([json], { type: 'application/json' });
  }
}
```

### 4.3 输入验证（P0 - XSS/注入防护）

```typescript
// 所有用户输入必须验证和清理
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>'"]/g, '')  // 移除潜在的 XSS 字符
    .slice(0, 100);          // 限制长度
}

// 数字输入验证
function validateNumber(value: unknown, min: number, max: number): number {
  const num = Number(value);
  if (isNaN(num) || num < min || num > max) {
    throw new ValidationError(`值必须在 ${min} 到 ${max} 之间`);
  }
  return num;
}
```

---

## 5. 用户体验需求

### 5.1 响应式设计（P0/P1）

| 设备 | 分辨率 | 布局 | 优先级 |
|------|--------|------|--------|
| 桌面端 | ≥1280px | 双栏布局（配置面板 + 网格列表） | P0 |
| 平板 | 768-1279px | 单栏布局（可折叠面板） | P1 |
| 手机 | <768px | 移动优化布局 | P1 |

### 5.2 国际化（P1）

| 语言 | 支持度 | 优先级 |
|------|--------|--------|
| 简体中文 | 完整支持 | P0 |
| English | 完整支持 | P1 |
| 繁体中文 | 待定 | P2 |

### 5.3 通知系统（P1）

```typescript
interface Notification {
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;  // 自动关闭时间（ms），-1 表示不自动关闭
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

// 关键事件通知
notificationEvents = [
  '订单成交',
  '网格停止',
  '触发止损',
  'WebSocket 断线',
  'API 错误',
  '余额不足',
];

// 浏览器通知（需用户授权）
if (Notification.permission === 'granted') {
  new Notification('ASTER 网格交易', {
    body: '您的 BTCUSDT 网格已触发止损',
    icon: '/logo.png',
  });
}
```

### 5.4 数据可视化（P1）

#### 必需图表

1. **实时价格折线图**
   - 显示当前价格
   - 标注网格上下限
   - 标注触发价格/止损价格

2. **网格分布图**
   - 每个网格的状态（空闲/买单/持仓/卖单）
   - 已成交次数

3. **收益曲线图**
   - 已实现收益
   - 未实现收益
   - 总收益

#### 可选图表（P2）

- K线图
- 深度图
- 成交历史

---

## 6. 测试需求

### 6.1 单元测试（P0 - 审计要求）

**目标覆盖率**: 核心模块 >90%

| 模块 | 测试重点 | 工具 |
|------|---------|------|
| GridCalculator | 网格价格计算、资金分配 | Jest |
| GridOrderManager | 订单生命周期管理 | Jest + Mock API |
| ApiClient | HMAC 签名生成、请求重试 | Jest |
| Encryption | 加密/解密正确性、边界情况 | Jest |

**测试用例示例**:
```typescript
describe('GridCalculator', () => {
  describe('calculateLevels', () => {
    it('等差网格：应正确计算价格层级', () => {
      const levels = GridCalculator.calculateLevels(
        45000, 40000, 10, 'ARITHMETIC'
      );
      expect(levels).toHaveLength(11);
      expect(levels[0]).toBe(40000);
      expect(levels[10]).toBe(45000);
      expect(levels[5]).toBe(42500);
    });

    it('等比网格：应正确计算价格层级', () => {
      const levels = GridCalculator.calculateLevels(
        50000, 40000, 10, 'GEOMETRIC'
      );
      expect(levels).toHaveLength(11);
      expect(levels[0]).toBeCloseTo(40000, 2);
      expect(levels[10]).toBeCloseTo(50000, 2);
    });
  });

  describe('validate', () => {
    it('投资金额不足时应返回错误', async () => {
      const result = GridCalculator.validate(
        { investmentAmount: 10, gridCount: 50, ... },
        symbolInfo,
        currentPrice,
        balance,
        feeRate
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(/单格金额不足/);
    });
  });
});
```

### 6.2 集成测试（P1）

| 场景 | 验证点 |
|------|--------|
| 创建并启动网格 | 订单正确下达到交易所 |
| 订单成交处理 | 持仓更新、反向订单下达 |
| 触发止损 | 所有订单取消、持仓卖出 |
| 应用重启 | 网格状态正确恢复 |
| WebSocket 断线 | 自动重连、订单同步 |

### 6.3 用户验收测试（P0）

**测试环境**: ASTER 测试网（如有）或主网小额资金

**测试场景**:
1. 新手用户首次创建网格
2. 网格在震荡行情中运行 24 小时
3. 网格在单边行情中运行（验证止损）
4. 浏览器刷新/崩溃后恢复
5. 同时运行 3 个网格

**验收标准**:
- 无资金损失
- 收益计算准确（误差 <0.1%）
- 无订单重复/遗漏
- UI 响应流畅

---

## 7. 部署需求

### 7.1 部署方式（P0）

**方式 1: 静态网站托管**（推荐）
- Vercel / Netlify / GitHub Pages
- 自动 HTTPS
- 全球 CDN
- 免费

**方式 2: IPFS（去中心化）**（P2）
- 真正的去中心化
- 抗审查
- 需要 IPFS 网关

### 7.2 环境配置

```bash
# .env.production
VITE_ASTER_API_URL=https://sapi.asterdex.com
VITE_ASTER_WS_URL=wss://sstream.asterdex.com/ws
VITE_APP_VERSION=2.0.0
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx  # P1: 错误监控
```

### 7.3 监控与告警（P1）

**错误监控**:
- 使用 Sentry 捕获运行时错误
- 记录用户操作路径（面包屑）
- 按严重程度分类

**性能监控**:
- Google Analytics / Umami
- 页面加载时间
- API 请求成功率
- WebSocket 连接稳定性

---

## 8. 里程碑与交付计划

### 8.1 阶段划分

#### Phase 1: MVP（P0 功能）- 3 周

**Week 1: 核心基础**
- [x] 项目架构搭建
- [ ] API 客户端实现（含安全加密）
- [ ] 网格计算器
- [ ] 单元测试框架

**Week 2: 交易逻辑**
- [ ] 网格创建流程
- [ ] 订单管理器（轮询模式）
- [ ] 收益计算（含未实现收益）
- [ ] 风险控制（止损、最大亏损）

**Week 3: UI + 测试**
- [ ] 参数配置界面
- [ ] 网格列表和详情
- [ ] 集成测试
- [ ] 用户验收测试

**交付物**:
- 可运行的 Beta 版本
- 单元测试覆盖率 >90%
- 部署到测试环境

---

#### Phase 2: 优化增强（P1 功能）- 2 周

**Week 4: 性能优化**
- [ ] WebSocket User Data Stream
- [ ] 应用重启恢复机制
- [ ] 审计日志系统
- [ ] 请求限流优化

**Week 5: 用户体验**
- [ ] 移动端适配
- [ ] 数据可视化（图表）
- [ ] 通知系统
- [ ] 国际化（英文）

**交付物**:
- 生产就绪版本
- 完整文档
- 部署到主网

---

#### Phase 3: 长期迭代（P2 功能）- 持续

- [ ] 回测系统
- [ ] 策略模板市场
- [ ] 社交功能（分享策略）
- [ ] 移动端 App（React Native）

---

## 9. 风险与限制

### 9.1 技术风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| ASTER API 变更 | 高 | 中 | 监控 API 更新、版本锁定、快速适配 |
| WebSocket 不稳定 | 中 | 高 | 实现降级策略（轮询） |
| 浏览器兼容性问题 | 低 | 低 | 充分测试、Polyfill |
| LocalStorage 容量限制 | 中 | 中 | 迁移到 IndexedDB（P1） |

### 9.2 业务风险

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 用户资金损失 | 极高 | 低 | 充分测试、风险提示、责任免除条款 |
| 单边行情亏损 | 高 | 中 | 教育用户、止损机制 |
| 交易所限制 API | 高 | 低 | 多交易所支持（长期） |
| 监管合规 | 中 | 低 | 法律咨询、用户协议 |

### 9.3 产品限制

**明确告知用户的限制**:

1. **浏览器依赖**: 关闭浏览器后网格停止（P0）
   - P2 解决方案：本地服务版本

2. **网络依赖**: 需要稳定的网络连接
   - 断网 >5 分钟可能导致订单同步失败

3. **单交易对限制**: 同一交易对建议最多运行 2 个网格

4. **价格跳空**: 快速波动时部分网格可能不成交

5. **手续费影响**: 高频交易会产生大量手续费，网格数量过多可能无利可图

---

## 10. 法律与合规

### 10.1 免责声明（必需）

**在创建首个网格前强制展示**:

```
⚠️  风险提示与免责声明

1. 网格交易存在风险，您可能损失全部投资金额
2. 本工具仅提供技术服务，不构成投资建议
3. 您应充分了解网格交易原理后再使用
4. API 密钥安全由您自行负责，请妥善保管
5. 我们不对交易所故障、网络中断等导致的损失负责
6. 加密货币交易在某些地区可能受法律限制，请遵守当地法规

[ ] 我已阅读、理解并同意以上条款

[拒绝] [同意并继续]
```

### 10.2 隐私政策

**数据收集**:
- ✅ 本地存储：网格配置、订单历史（加密）
- ❌ 不收集：API 密钥明文、交易数据
- ⚠️ 可选收集：匿名使用统计（需用户同意）

### 10.3 开源许可

**建议**: MIT License（最宽松）

**不开源部分**:
- 加密逻辑（安全考虑）
- API 密钥管理

---

## 11. 成本估算

### 11.1 开发成本

| 阶段 | 工时 | 人员配置 | 工期 |
|------|------|---------|------|
| Phase 1 (MVP) | 360 小时 | 1 全栈 + 1 前端 | 3 周 |
| Phase 2 (优化) | 240 小时 | 1 全栈 + 1 前端 | 2 周 |
| 测试与修复 | 120 小时 | 1 测试 + 1 开发 | 1 周 |
| **总计** | **720 小时** | **2-3 人** | **6 周** |

### 11.2 运营成本

| 项目 | 成本 | 周期 |
|------|------|------|
| 域名 | $10/年 | 年付 |
| Vercel Pro（可选） | $20/月 | 月付 |
| Sentry 监控 | 免费（<5K 事件/月） | - |
| **总计** | **~$10-250/年** | - |

---

## 12. 附录

### 12.1 术语表

| 术语 | 英文 | 解释 |
|------|------|------|
| 网格交易 | Grid Trading | 在价格区间内高抛低吸的量化策略 |
| 等差网格 | Arithmetic Grid | 每格价差相等 |
| 等比网格 | Geometric Grid | 每格价差比例相等 |
| 已实现收益 | Realized Profit | 已完成交易的利润 |
| 未实现收益 | Unrealized Profit | 持仓的浮动盈亏 |
| 回撤 | Drawdown | 从最高点下跌的幅度 |
| 最小交易金额 | Min Notional | 交易所规定的单笔订单最小金额 |

### 12.2 参考资料

- ASTER 官方文档: https://docs.asterdex.com/
- ASTER API 文档: https://github.com/asterdex/api-docs
- Binance API 文档: https://binance-docs.github.io/apidocs/spot/en/
- 网格交易策略: https://www.investopedia.com/terms/g/grid-trading.asp

---

## 13. 待确认问题（需用户反馈）

见文档末尾的「需用户确认的问题清单」

---

**文档状态**: ✅ 完成
**下一步**: 用户确认关键决策点 → 开始 Phase 1 开发
