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


class SaleRecord(BaseModel):
    id: int
    item_id: int | None = None
    code: str
    item_name: str
    category: str
    quantity: int
    unit_price: float
    cost_price: float
    revenue: float
    profit: float
    created_at: str


class RankedProduct(BaseModel):
    name: str
    quantity: int
    revenue: float


class RankedCategory(BaseModel):
    category: str
    quantity: int
    revenue: float


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
