# Returns Hub Innovation Roadmap

**Created**: 2025-12-29
**Status**: Active Development

---

## Executive Summary

Transform Returns Hub from a basic returns app into an **intelligent returns platform** that democratizes enterprise features for SMB merchants. Core differentiator: **Smart Disposition Routing** powered by our existing routing rules infrastructure.

---

## Phase 1: Competitive Parity + Foundation (Weeks 1-3)

Close critical gaps to compete with Loop, ReturnGO, Return Prime.

### 1.1 Shop Now Exchange Flow
**Priority**: HIGH | **Effort**: 2 weeks | **Impact**: Revenue recovery

Let customers browse the entire catalog during exchange instead of just swapping variants.

**User Story**: As a customer, I want to exchange my return for ANY product (not just the same item in different size), so I can find something I actually want.

**Technical Spec**:
```
Database Changes:
- Add to ReturnRequest:
  - exchangeType: ENUM('variant', 'product', 'shop_now') 
  - exchangeOrderId: String? (link to new order)
  - exchangeValueUsed: Float
  - exchangeBonusApplied: Float

New Routes:
- app.returns.$id.exchange.tsx - Exchange flow entry
- app.returns.$id.exchange.shop.tsx - Browse catalog
- app.returns.$id.exchange.cart.tsx - Exchange cart
- api.exchange.create.tsx - Create exchange order

Flow:
1. Customer initiates return
2. Selects "Exchange for something else"
3. Gets store credit value (original item price)
4. Browses catalog with credit balance shown
5. Adds items to exchange cart
6. If cart > credit: pays difference
7. If cart < credit: remainder as store credit
8. New order created, linked to return

GraphQL:
- Use draftOrderCreate for exchange order
- Apply automatic discount equal to return value
- Link via metafield to original return
```

**Acceptance Criteria**:
- [ ] Customer can browse full catalog during exchange
- [ ] Credit balance displays on all product pages
- [ ] Can add multiple items up to credit value
- [ ] Overage charged to customer payment method
- [ ] Underage converted to store credit
- [ ] Exchange order linked to return in admin

---

### 1.2 Store Credit with Bonus Incentive
**Priority**: HIGH | **Effort**: 1 week | **Impact**: Reduce refund rate 20-40%

Offer bonus credit to incentivize store credit over refunds.

**User Story**: As a merchant, I want to offer "Get 110% back as store credit" to reduce cash refunds.

**Technical Spec**:
```
Database Changes:
- Add to ShopSettings:
  - storeCreditEnabled: Boolean @default(true)
  - storeCreditBonusPercent: Int @default(10) // 10 = 110% credit
  - storeCreditExpiryDays: Int? // null = never expires

- Add to ReturnRequest:
  - resolutionType: ENUM('refund', 'store_credit', 'exchange')
  - storeCreditIssued: Float?
  - storeCreditCode: String? // Gift card code

New Routes:
- Settings page: Configure bonus percentage
- Return portal: Show both options with bonus highlighted

Implementation:
- Use Shopify Gift Card API to issue store credit
- giftCardCreate mutation with initialValue = returnValue * (1 + bonusPercent/100)

UI (Customer Portal):
┌─────────────────────────────────────────┐
│ How would you like your refund?         │
│                                         │
│ ○ Original payment method    $50.00     │
│                                         │
│ ◉ Store credit (RECOMMENDED) $55.00    │
│   Get 10% bonus! Shop anytime.         │
│                                         │
└─────────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] Merchant can configure bonus percentage (0-25%)
- [ ] Customer sees both options with bonus highlighted
- [ ] Gift card created automatically on approval
- [ ] Gift card code emailed to customer
- [ ] Analytics track refund vs store credit ratio

---

### 1.3 Analytics Dashboard
**Priority**: HIGH | **Effort**: 2 weeks | **Impact**: Merchant retention

Actionable insights, not just data.

**User Story**: As a merchant, I want to see return trends, reasons, and financial impact so I can reduce returns.

**Technical Spec**:
```
New Routes:
- app.analytics.tsx - Main dashboard
- app.analytics.products.tsx - Per-product return rates
- app.analytics.reasons.tsx - Return reason breakdown
- app.analytics.financial.tsx - Cost analysis

Metrics to Track:
1. Overview Cards:
   - Total returns (this month vs last)
   - Return rate (returns / orders %)
   - Revenue retained (exchanges + store credit)
   - Avg processing time

2. Return Reasons Chart (pie):
   - Size/fit issues
   - Quality/defect
   - Changed mind
   - Wrong item received
   - Other

3. Product Return Rates (table):
   - Product name
   - Units sold
   - Units returned
   - Return rate %
   - Top return reason
   - Flag: "High return rate" if > 15%

4. Financial Impact:
   - Total refunds issued
   - Store credit issued (+ bonus cost)
   - Shipping label costs
   - Net return cost

5. Trends (line chart):
   - Returns over time
   - Return rate over time
   - Resolution type breakdown over time

Database:
- All data derivable from existing ReturnRequest + ReturnItem
- Add indexes for date-range queries
- Consider materialized views for performance

UI Framework:
- Use Polaris DataTable, IndexTable
- Use lightweight chart library (Chart.js or Recharts)
```

**Acceptance Criteria**:
- [ ] Dashboard loads in < 2 seconds
- [ ] Date range filter (7d, 30d, 90d, custom)
- [ ] Export to CSV
- [ ] Product return rate flags high-risk items
- [ ] Mobile responsive

---

## Phase 2: Differentiation (Weeks 4-6)

Leverage routing rules infrastructure for unique capabilities.

### 2.1 Smart Disposition Routing
**Priority**: HIGH | **Effort**: 2 weeks | **Impact**: Unique differentiator

Automatically route returns to the right destination based on condition, value, and business rules.

**User Story**: As a merchant, I want returns automatically sorted to restock, outlet, donate, or returnless based on rules I define.

**Technical Spec**:
```
Database Changes:
- Extend RoutingRule conditionType ENUM:
  - 'product_type'      (existing)
  - 'product_tag'       (existing)
  - 'price_above'       (new)
  - 'price_below'       (new)
  - 'return_reason'     (new)
  - 'item_condition'    (new)
  - 'customer_lifetime_value' (new)

- Extend ReturnDestination with destinationType:
  - 'warehouse'         (existing - restock)
  - 'outlet'            (new - discount resale)
  - 'donation'          (new - charity partner)
  - 'manufacturer'      (new - warranty claim)
  - 'recycle'           (new - disposal)
  - 'returnless'        (new - customer keeps item)

- Add to ReturnItem:
  - condition: ENUM('new', 'like_new', 'good', 'fair', 'damaged', 'defective')
  - dispositionType: String (where it was routed)
  - dispositionReason: String (why)

New Routes:
- app.settings.disposition.tsx - Configure disposition rules
- app.returns.$id.inspect.tsx - Warehouse inspection UI

Disposition Flow:
1. Return arrives at warehouse
2. Staff inspects, selects condition
3. System evaluates rules in priority order:
   
   Rule examples:
   - IF condition = 'new' AND price > $50 → Restock
   - IF condition = 'like_new' → Outlet (20% discount)
   - IF condition = 'damaged' AND reason = 'defective' → Manufacturer
   - IF condition = 'fair' AND price < $20 → Donate
   - IF price < $15 → Returnless (don't ship back)

4. Item routed to appropriate destination
5. Destination-specific actions trigger:
   - Restock: Update inventory
   - Outlet: Create discounted variant/listing
   - Donate: Generate donation receipt
   - Manufacturer: Create warranty claim
   - Returnless: Auto-approve, no label generated

UI (Settings):
┌─────────────────────────────────────────────────────────┐
│ Disposition Rules                           [+ Add Rule]│
├─────────────────────────────────────────────────────────┤
│ Priority │ Condition              │ Route To   │ Actions│
├──────────┼────────────────────────┼────────────┼────────┤
│ 1        │ Price < $15            │ Returnless │ ✏️ 🗑️  │
│ 2        │ Condition = Defective  │ Manufacturer│ ✏️ 🗑️ │
│ 3        │ Condition = New        │ Main WH    │ ✏️ 🗑️  │
│ 4        │ Condition = Like New   │ Outlet     │ ✏️ 🗑️  │
│ 5        │ Default                │ Inspect    │        │
└─────────────────────────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] 6 disposition types supported
- [ ] Rules engine evaluates in priority order
- [ ] Warehouse inspection UI for condition grading
- [ ] Each disposition triggers appropriate action
- [ ] Analytics show disposition breakdown

---

### 2.2 Returnless Refund Rules
**Priority**: HIGH | **Effort**: 1 week | **Impact**: Cost savings

Auto-approve "keep it" refunds for low-value items where return shipping costs more than the item.

**User Story**: As a merchant, I want items under $15 to be auto-refunded without requiring return shipment.

**Technical Spec**:
```
Database Changes:
- Add to ShopSettings:
  - returnlessEnabled: Boolean @default(false)
  - returnlessThreshold: Float @default(15.00)
  - returnlessReasons: String[] // which reasons qualify
  - returnlessMaxPerCustomer: Int? // fraud prevention

- Add to ReturnRequest:
  - isReturnless: Boolean @default(false)
  - returnlessReason: String?

Logic:
1. Customer initiates return
2. System checks:
   - Item value < threshold? 
   - Return reason in allowed list?
   - Customer hasn't exceeded max returnless/month?
3. If all pass:
   - Mark as returnless
   - Skip label generation
   - Auto-approve
   - Issue refund immediately
   - Email: "Keep the item! Refund processed."
4. If any fail:
   - Normal return flow

Cost Savings Display:
"This month: 23 returnless refunds saved $187 in shipping costs"
```

**Acceptance Criteria**:
- [ ] Configurable threshold ($5-$50)
- [ ] Configurable allowed reasons
- [ ] Per-customer limit for fraud prevention
- [ ] Savings calculator in dashboard
- [ ] Customer email explains they can keep item

---

### 2.3 Sustainability Metrics
**Priority**: MEDIUM | **Effort**: 1 week | **Impact**: Marketing differentiator

Track and display environmental impact of return decisions.

**User Story**: As a merchant, I want to show customers the environmental impact of their return choices.

**Technical Spec**:
```
Database Changes:
- Add to ShopSettings:
  - sustainabilityEnabled: Boolean @default(false)
  - avgPackageWeightLbs: Float @default(1.0)
  - showSustainabilityToCustomers: Boolean @default(true)

- Create new model SustainabilityMetrics:
  - id
  - shop
  - month (YYYY-MM)
  - returnlessCount: Int
  - returnlessWeightLbs: Float
  - carbonSavedLbs: Float
  - landfillPreventedLbs: Float
  - donationCount: Int
  - donationValueUsd: Float

Calculations:
- Carbon per return shipment: ~2.5 lbs CO2 (industry average)
- Returnless savings: returnlessCount * avgPackageWeight * 2.5 (round trip)
- Landfill prevented: items donated or resold instead of destroyed

Dashboard Widget:
┌─────────────────────────────────────────┐
│ 🌱 Environmental Impact This Month      │
├─────────────────────────────────────────┤
│ 🚫 47 lbs CO2 prevented                 │
│    (23 returnless refunds)              │
│                                         │
│ ♻️  12 items donated                     │
│    ($340 retail value)                  │
│                                         │
│ 📦 89% of returns restocked or resold   │
└─────────────────────────────────────────┘

Customer-Facing (optional):
"By choosing store credit, you helped save 2.5 lbs of CO2! 🌱"
```

**Acceptance Criteria**:
- [ ] Dashboard shows sustainability metrics
- [ ] Optional customer-facing messaging
- [ ] Monthly/yearly aggregation
- [ ] Exportable for marketing use

---

## Phase 3: Innovation (Weeks 7-10)

Blue ocean features no competitor has.

### 3.1 Fraud Detection System
**Priority**: HIGH | **Effort**: 3 weeks | **Impact**: Loss prevention

Flag suspicious return patterns and serial returners.

**User Story**: As a merchant, I want to be alerted when a customer shows suspicious return behavior.

**Technical Spec**:
```
Database Changes:
- Create new model CustomerReturnProfile:
  - id
  - shop
  - customerId: String (Shopify customer ID)
  - customerEmail: String
  - totalOrders: Int
  - totalReturns: Int
  - returnRate: Float
  - totalRefunded: Float
  - lastReturnDate: DateTime
  - riskScore: Int (0-100)
  - riskFactors: JSON
  - isBlocked: Boolean @default(false)
  - blockedReason: String?
  - createdAt
  - updatedAt

- Add to ReturnRequest:
  - riskScore: Int?
  - riskFactors: JSON?
  - flaggedForReview: Boolean @default(false)

Risk Scoring Algorithm:
┌─────────────────────────────────────────────────────────┐
│ Factor                           │ Points (0-100 total) │
├──────────────────────────────────┼──────────────────────┤
│ Return rate > 30%                │ +25                  │
│ Return rate > 50%                │ +40                  │
│ > 3 returns in 30 days           │ +15                  │
│ > 5 returns in 90 days           │ +20                  │
│ High-value items only            │ +15                  │
│ Always "changed mind" reason     │ +10                  │
│ Multiple returns same product    │ +20                  │
│ New customer (< 30 days)         │ +10                  │
│ Mismatched shipping addresses    │ +15                  │
└──────────────────────────────────┴──────────────────────┘

Risk Levels:
- 0-30: Low risk → Auto-approve
- 31-60: Medium risk → Standard review
- 61-80: High risk → Manual review required
- 81-100: Very high → Block or flag for merchant

Features:
1. Risk score calculated on return submission
2. Dashboard shows flagged returns
3. Customer blocklist management
4. Risk factor explanations
5. Override capability for merchants

Alerts:
- Email merchant when high-risk return submitted
- Weekly digest of suspicious activity
- Real-time Slack/webhook integration (optional)
```

**Acceptance Criteria**:
- [ ] Risk score calculated for every return
- [ ] Dashboard shows high-risk returns prominently
- [ ] Merchant can block customers
- [ ] Risk factors are explainable
- [ ] False positive rate < 5%

---

### 3.2 Return Prevention Engine
**Priority**: MEDIUM | **Effort**: 3 weeks | **Impact**: Reduce returns at source

Intervene before returns happen with smart recommendations.

**User Story**: As a merchant, I want to reduce returns by helping customers choose the right product/size upfront.

**Technical Spec**:
```
Two Components:

A) Pre-Purchase Intervention (Theme Extension)
- Analyze cart for high-return-rate items
- Show sizing guidance, reviews mentioning fit
- "Customers who bought this often exchange for size up"

B) Post-Purchase / Pre-Return Intervention
- Customer clicks "Start Return"
- Before return portal, show:
  - Size exchange suggestion
  - Similar products they might prefer
  - Styling tips / how to use
  - "Still want to return?" → proceed to portal

Database:
- Track which interventions were shown
- Track conversion (did they NOT return after intervention?)

New Routes:
- api.prevention.check.tsx - Check if order has high-risk items
- app.returns.prevent.$orderId.tsx - Prevention flow

Theme Extension Addition:
- return-prevention block
- Shows on product pages for high-return items
- "ℹ️ This item runs small. Consider sizing up."

Intervention UI:
┌─────────────────────────────────────────────────────────┐
│ Before you return...                                    │
├─────────────────────────────────────────────────────────┤
│ We noticed you're returning the Blue Sweater (Size M)   │
│                                                         │
│ 💡 68% of customers who returned this item exchanged    │
│    for a different size.                                │
│                                                         │
│ Would you like to:                                      │
│ ┌─────────────────┐  ┌─────────────────┐               │
│ │ Exchange for    │  │ Continue with   │               │
│ │ Size L instead  │  │ Return          │               │
│ └─────────────────┘  └─────────────────┘               │
└─────────────────────────────────────────────────────────┘

Analytics:
- Returns prevented this month
- Prevention conversion rate
- Which interventions work best
```

**Acceptance Criteria**:
- [ ] High-return products flagged automatically
- [ ] Pre-return intervention flow
- [ ] Analytics on prevention effectiveness
- [ ] Theme extension for product pages
- [ ] A/B testing capability

---

### 3.3 Recommerce / Outlet Automation
**Priority**: MEDIUM | **Effort**: 2 weeks | **Impact**: Revenue recovery

Automatically create discounted listings for returned items.

**User Story**: As a merchant, I want returned items in good condition automatically listed at a discount.

**Technical Spec**:
```
Database Changes:
- Add to ShopSettings:
  - outletEnabled: Boolean @default(false)
  - outletCollectionId: String? (Shopify collection ID)
  - outletDiscountPercent: Int @default(20)
  - outletAutoList: Boolean @default(false)
  - outletConditionLabels: Boolean @default(true) // "Like New", etc.

- Add to ReturnItem:
  - listedAsOutlet: Boolean @default(false)
  - outletVariantId: String?
  - outletPrice: Float?
  - outletSoldAt: DateTime?

Flow:
1. Return inspected, condition = 'like_new' or 'good'
2. Disposition routes to 'outlet'
3. System creates new product variant OR updates inventory:
   
   Option A: Separate Outlet Products
   - Clone product as "[Product Name] - Open Box"
   - Apply discount
   - Add to Outlet collection
   - Set inventory = 1
   
   Option B: Same Product, Outlet Tag
   - Add "outlet" tag
   - Create discounted variant
   - Customer sees "Open Box - 20% off" option

4. When outlet item sells:
   - Mark returnItem.outletSoldAt
   - Track revenue recovered

GraphQL:
- productCreate / productVariantCreate for outlet listing
- collectionAddProducts to add to outlet collection

Outlet Collection Theme Section:
- "Shop Open Box Deals - Up to 30% Off"
- Condition badges: "Like New", "Good", "Minor Imperfection"

Analytics:
- Outlet items listed this month
- Outlet revenue recovered
- Avg discount given
- Days to sell
```

**Acceptance Criteria**:
- [ ] Auto-create outlet listings from returns
- [ ] Configurable discount percentage
- [ ] Condition labels on listings
- [ ] Outlet collection management
- [ ] Revenue recovery tracking

---

## Implementation Priority Matrix

```
                    IMPACT
                    HIGH                          LOW
            ┌───────────────────────┬───────────────────────┐
            │ 1.1 Shop Now Exchange │                       │
    HIGH    │ 1.2 Store Credit      │                       │
            │ 2.1 Smart Disposition │                       │
 EFFORT     │ 3.1 Fraud Detection   │                       │
            ├───────────────────────┼───────────────────────┤
            │ 1.3 Analytics         │ 2.3 Sustainability    │
    LOW     │ 2.2 Returnless Rules  │ 3.3 Recommerce        │
            │                       │                       │
            └───────────────────────┴───────────────────────┘
```

---

## Timeline

| Week | Phase | Features | Milestone |
|------|-------|----------|-----------|
| 1-2 | Phase 1 | Shop Now Exchange | Exchange flow live |
| 2-3 | Phase 1 | Store Credit + Analytics | Core features complete |
| 4-5 | Phase 2 | Smart Disposition | Routing v2 live |
| 5-6 | Phase 2 | Returnless + Sustainability | Differentiation complete |
| 7-8 | Phase 3 | Fraud Detection | Risk scoring live |
| 9-10 | Phase 3 | Prevention + Recommerce | Full innovation suite |

---

## Success Metrics

| Metric | Baseline | Target (90 days) |
|--------|----------|------------------|
| App installs | 0 | 500 |
| Monthly active | 0 | 200 |
| Return → Exchange rate | - | 35% |
| Return → Store Credit rate | - | 25% |
| Avg time to resolution | - | < 48 hours |
| Merchant NPS | - | > 50 |

---

## Technical Dependencies

- [ ] Shopify Gift Card API (store credit)
- [ ] Shopify Draft Orders API (exchanges)
- [ ] Chart library (analytics)
- [ ] Email service (notifications)
- [ ] Webhook system (fraud alerts)

---

## Next Steps

1. **Now**: Begin Phase 1.1 - Shop Now Exchange Flow
2. Create database migrations
3. Build exchange flow UI
4. Test with dev store
5. Move to 1.2 Store Credit
