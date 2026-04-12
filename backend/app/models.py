from pydantic import BaseModel, Field


class StockItemBase(BaseModel):
    code: str = Field(default="", max_length=64)
    name: str = Field(..., min_length=2, max_length=120)
    category: str = Field(default="General", max_length=80)
    subcategory: str = Field(default="", max_length=120)
    variant: str = Field(default="", max_length=120)
    provider: str = Field(default="", max_length=120)
    quantity: int = Field(default=0, ge=0)
    min_quantity: int = Field(default=0, ge=0)
    sale_price: float = Field(default=0, ge=0)
    cost_price: float = Field(default=0, ge=0)


class StockItem(StockItemBase):
    id: int


class StockItemCreate(StockItemBase):
    pass


class StockItemUpdate(StockItemBase):
    pass


class BulkProviderAssign(BaseModel):
    item_ids: list[int] = Field(..., min_length=1, max_length=1000)
    provider: str = Field(default="", max_length=120)


class StockAdjustment(BaseModel):
    amount: int = Field(..., gt=0, le=9999)


class SaleCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=64)
    amount: int = Field(..., gt=0, le=9999)
    unit_price: float | None = Field(default=None, ge=0)
    base_unit_price: float | None = Field(default=None, ge=0)
    payment_method: str = Field(default="Efectivo", min_length=3, max_length=40)
    credit_bank_name: str | None = Field(default=None, max_length=120)


class SaleLineCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=64)
    amount: int = Field(..., gt=0, le=9999)
    unit_price: float | None = Field(default=None, ge=0)
    base_unit_price: float | None = Field(default=None, ge=0)


class SaleCheckoutCreate(BaseModel):
    payment_method: str = Field(default="Efectivo", min_length=3, max_length=40)
    credit_bank_name: str | None = Field(default=None, max_length=120)
    items: list[SaleLineCreate] = Field(..., min_length=1, max_length=100)


class SaleRecord(BaseModel):
    id: int
    item_id: int | None = None
    order_number: str | None = None
    code: str
    item_name: str
    category: str
    quantity: int
    base_unit_price: float
    unit_price: float
    cost_price: float
    payment_method: str
    bank_name: str | None = None
    surcharge_percentage: float = 0
    total_amount: float
    revenue: float
    profit: float
    created_at: str


class SaleCheckoutResult(BaseModel):
    order_number: str
    payment_method: str
    bank_name: str | None = None
    created_at: str
    total_items: int
    total_units: int
    total_amount: float
    total_profit: float
    sales: list[SaleRecord]


class InventoryMovement(BaseModel):
    id: int
    item_id: int | None = None
    code: str
    item_name: str
    movement_type: str
    quantity_delta: int
    reference: str
    created_at: str


class Category(BaseModel):
    id: int
    name: str
    created_at: str


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)


class BankRate(BaseModel):
    id: int
    name: str
    rate_percentage: float
    created_at: str


class BankRateCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    rate_percentage: float = Field(..., ge=0, le=1000)


class BankRateUpdate(BankRateCreate):
    pass


class CashSessionOpen(BaseModel):
    opening_amount: float = Field(..., ge=0)
    notes: str = Field(default="", max_length=240)


class CashSessionClose(BaseModel):
    actual_cash_amount: float = Field(..., ge=0)
    notes: str = Field(default="", max_length=240)


class CashMovementCreate(BaseModel):
    movement_type: str = Field(..., pattern="^(INCOME|EXPENSE)$")
    amount: float = Field(..., gt=0)
    concept: str = Field(..., min_length=2, max_length=120)
    notes: str = Field(default="", max_length=240)


class CashMovement(BaseModel):
    id: int
    movement_type: str
    amount: float
    concept: str
    notes: str
    created_at: str


class CashSession(BaseModel):
    id: int
    opening_amount: float
    expected_cash_amount: float
    actual_cash_amount: float | None = None
    difference_amount: float | None = None
    status: str
    notes: str
    opened_at: str
    closed_at: str | None = None


class RankedProduct(BaseModel):
    name: str
    quantity: int
    revenue: float


class RankedCategory(BaseModel):
    category: str
    quantity: int
    revenue: float


class DailySalesPoint(BaseModel):
    date: str
    label: str
    sales_count: int
    units_sold: int
    revenue: float
    profit: float


class ReportSummary(BaseModel):
    total_products: int
    total_units: int
    low_stock_count: int
    inventory_cost_value: float
    inventory_sale_value: float
    total_revenue: float
    total_profit: float
    total_sales_count: int
    total_units_sold: int
    top_products: list[RankedProduct]
    top_categories: list[RankedCategory]
    recent_sales: list[SaleRecord]
    insights: list[str]


class DailyCashSummary(BaseModel):
    current_session: CashSession | None = None
    today_revenue: float
    cash_revenue: float
    non_cash_revenue: float
    manual_income: float
    manual_expense: float
    today_profit: float
    today_sales_count: int
    today_units_sold: int
    expected_cash_now: float
    recent_sessions: list[CashSession]
    recent_cash_movements: list[CashMovement]


class ScaleConfig(BaseModel):
    enabled: bool = False
    provider: str = Field(default="mock", pattern="^(mock|serial)$")
    connection_type: str = Field(default="manual", pattern="^(manual|serial|hid|tcp|bluetooth)$")
    port: str = Field(default="", max_length=80)
    baudrate: int = Field(default=9600, ge=1200, le=115200)
    host: str = Field(default="", max_length=120)
    tcp_port: int = Field(default=0, ge=0, le=65535)
    unit: str = Field(default="kg", pattern="^(kg|g)$")
    timeout_ms: int = Field(default=1200, ge=100, le=10000)
    stable_read_count: int = Field(default=2, ge=1, le=10)
    simulated_weight: float = Field(default=1.250, ge=0, le=9999)


class ScaleStatus(BaseModel):
    configured: bool
    enabled: bool
    provider: str
    connection_type: str
    ready: bool
    serial_supported: bool
    available_providers: list[str]
    detail: str


class ScaleReadRequest(BaseModel):
    simulated_weight: float | None = Field(default=None, ge=0, le=9999)


class ScaleReadResult(BaseModel):
    provider: str
    connection_type: str
    weight: float
    unit: str
    stable: bool
    raw_value: str
    measured_at: str


class SerialPortInfo(BaseModel):
    device: str
    description: str
    hwid: str

