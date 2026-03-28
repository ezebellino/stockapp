from pydantic import BaseModel, Field


class StockItemBase(BaseModel):
    code: str = Field(..., min_length=3, max_length=64)
    name: str = Field(..., min_length=2, max_length=120)
    category: str = Field(default="General", max_length=80)
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


class StockAdjustment(BaseModel):
    amount: int = Field(..., gt=0, le=9999)


class SaleCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=64)
    amount: int = Field(..., gt=0, le=9999)
    unit_price: float | None = Field(default=None, ge=0)
    payment_method: str = Field(default="Efectivo", min_length=3, max_length=40)

class SaleRecord(BaseModel):
    id: int
    item_id: int | None = None
    code: str
    item_name: str
    category: str
    quantity: int
    unit_price: float
    cost_price: float
    payment_method: str
    total_amount: float
    revenue: float
    profit: float
    created_at: str


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


class CashSessionOpen(BaseModel):
    opening_amount: float = Field(..., ge=0)
    notes: str = Field(default="", max_length=240)


class CashSessionClose(BaseModel):
    actual_cash_amount: float = Field(..., ge=0)
    notes: str = Field(default="", max_length=240)


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
    today_profit: float
    today_sales_count: int
    today_units_sold: int
    expected_cash_now: float
    recent_sessions: list[CashSession]







