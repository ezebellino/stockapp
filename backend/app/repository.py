from __future__ import annotations

import sqlite3
from pathlib import Path

from .models import (
    ReportSummary,
    RankedCategory,
    RankedProduct,
    SaleCreate,
    SaleRecord,
    StockItem,
    StockItemCreate,
    StockItemUpdate,
)


class SQLiteStockRepository:
    def __init__(self) -> None:
        self._db_path = Path(__file__).resolve().parent.parent / "data" / "appstock.db"

    def initialize(self) -> None:
        self._db_path.parent.mkdir(parents=True, exist_ok=True)

        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'General',
                    quantity INTEGER NOT NULL DEFAULT 0,
                    min_quantity INTEGER NOT NULL DEFAULT 0,
                    sale_price REAL NOT NULL DEFAULT 0,
                    cost_price REAL NOT NULL DEFAULT 0
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id INTEGER,
                    code TEXT NOT NULL,
                    item_name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    unit_price REAL NOT NULL,
                    cost_price REAL NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.commit()

        self._ensure_legacy_columns()
        self._seed_if_empty()

    def list_items(self) -> list[StockItem]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, code, name, category, quantity, min_quantity, sale_price, cost_price
                FROM items
                ORDER BY LOWER(name)
                """
            ).fetchall()

        return [self._to_item(row) for row in rows]

    def get_item(self, item_id: int) -> StockItem | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, code, name, category, quantity, min_quantity, sale_price, cost_price
                FROM items
                WHERE id = ?
                """,
                (item_id,),
            ).fetchone()

        return self._to_item(row) if row else None

    def get_by_code(self, code: str) -> StockItem | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, code, name, category, quantity, min_quantity, sale_price, cost_price
                FROM items
                WHERE code = ?
                """,
                (code,),
            ).fetchone()

        return self._to_item(row) if row else None

    def create_item(self, payload: StockItemCreate) -> StockItem:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO items (code, name, category, quantity, min_quantity, sale_price, cost_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.code,
                    payload.name,
                    payload.category,
                    payload.quantity,
                    payload.min_quantity,
                    payload.sale_price,
                    payload.cost_price,
                ),
            )
            connection.commit()

        item = self.get_item(cursor.lastrowid)
        if item is None:
            raise RuntimeError("No se pudo recuperar el producto creado.")
        return item

    def update_item(self, item_id: int, payload: StockItemUpdate) -> StockItem | None:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE items
                SET code = ?, name = ?, category = ?, quantity = ?, min_quantity = ?, sale_price = ?, cost_price = ?
                WHERE id = ?
                """,
                (
                    payload.code,
                    payload.name,
                    payload.category,
                    payload.quantity,
                    payload.min_quantity,
                    payload.sale_price,
                    payload.cost_price,
                    item_id,
                ),
            )
            connection.commit()

        if cursor.rowcount == 0:
            return None
        return self.get_item(item_id)

    def delete_item(self, item_id: int) -> bool:
        with self._connect() as connection:
            cursor = connection.execute("DELETE FROM items WHERE id = ?", (item_id,))
            connection.commit()
        return cursor.rowcount > 0

    def increase_stock(self, code: str, amount: int) -> StockItem | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, quantity
                FROM items
                WHERE code = ?
                """,
                (code,),
            ).fetchone()
            if row is None:
                return None

            connection.execute(
                "UPDATE items SET quantity = ? WHERE id = ?",
                (row["quantity"] + amount, row["id"]),
            )
            connection.commit()

        return self.get_by_code(code)

    def record_sale(self, payload: SaleCreate) -> tuple[SaleRecord, StockItem]:
        with self._connect() as connection:
            item_row = connection.execute(
                """
                SELECT id, code, name, category, quantity, min_quantity, sale_price, cost_price
                FROM items
                WHERE code = ?
                """,
                (payload.code,),
            ).fetchone()
            if item_row is None:
                raise ValueError("Producto no encontrado para registrar la venta.")
            if item_row["quantity"] < payload.amount:
                raise ValueError("Stock insuficiente para registrar la venta.")

            unit_price = payload.unit_price if payload.unit_price is not None else item_row["sale_price"]
            connection.execute(
                "UPDATE items SET quantity = ? WHERE id = ?",
                (item_row["quantity"] - payload.amount, item_row["id"]),
            )
            cursor = connection.execute(
                """
                INSERT INTO sales (item_id, code, item_name, category, quantity, unit_price, cost_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item_row["id"],
                    item_row["code"],
                    item_row["name"],
                    item_row["category"],
                    payload.amount,
                    unit_price,
                    item_row["cost_price"],
                ),
            )
            connection.commit()

            sale_row = connection.execute(
                """
                SELECT id, item_id, code, item_name, category, quantity, unit_price, cost_price, created_at
                FROM sales
                WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()

        sale = self._to_sale(sale_row)
        item = self.get_item(item_row["id"])
        if item is None:
            raise RuntimeError("No se pudo recuperar el producto luego de la venta.")
        return sale, item

    def get_report_summary(self) -> ReportSummary:
        with self._connect() as connection:
            inventory_row = connection.execute(
                """
                SELECT
                    COUNT(*) AS total_products,
                    COALESCE(SUM(quantity), 0) AS total_units,
                    COALESCE(SUM(CASE WHEN quantity <= min_quantity THEN 1 ELSE 0 END), 0) AS low_stock_count,
                    COALESCE(SUM(quantity * cost_price), 0) AS inventory_cost_value,
                    COALESCE(SUM(quantity * sale_price), 0) AS inventory_sale_value
                FROM items
                """
            ).fetchone()

            sales_row = connection.execute(
                """
                SELECT
                    COUNT(*) AS total_sales_count,
                    COALESCE(SUM(quantity), 0) AS total_units_sold,
                    COALESCE(SUM(quantity * unit_price), 0) AS total_revenue,
                    COALESCE(SUM(quantity * (unit_price - cost_price)), 0) AS total_profit
                FROM sales
                """
            ).fetchone()

            top_products_rows = connection.execute(
                """
                SELECT
                    item_name AS name,
                    SUM(quantity) AS quantity,
                    SUM(quantity * unit_price) AS revenue
                FROM sales
                GROUP BY item_name
                ORDER BY quantity DESC, revenue DESC
                LIMIT 5
                """
            ).fetchall()

            top_categories_rows = connection.execute(
                """
                SELECT
                    category,
                    SUM(quantity) AS quantity,
                    SUM(quantity * unit_price) AS revenue
                FROM sales
                GROUP BY category
                ORDER BY quantity DESC, revenue DESC
                LIMIT 5
                """
            ).fetchall()

            recent_sales_rows = connection.execute(
                """
                SELECT id, item_id, code, item_name, category, quantity, unit_price, cost_price, created_at
                FROM sales
                ORDER BY id DESC
                LIMIT 8
                """
            ).fetchall()

        top_products = [
            RankedProduct(name=row["name"], quantity=row["quantity"], revenue=row["revenue"])
            for row in top_products_rows
        ]
        top_categories = [
            RankedCategory(category=row["category"], quantity=row["quantity"], revenue=row["revenue"])
            for row in top_categories_rows
        ]
        recent_sales = [self._to_sale(row) for row in recent_sales_rows]

        return ReportSummary(
            total_products=inventory_row["total_products"],
            total_units=inventory_row["total_units"],
            low_stock_count=inventory_row["low_stock_count"],
            inventory_cost_value=inventory_row["inventory_cost_value"],
            inventory_sale_value=inventory_row["inventory_sale_value"],
            total_revenue=sales_row["total_revenue"],
            total_profit=sales_row["total_profit"],
            total_sales_count=sales_row["total_sales_count"],
            total_units_sold=sales_row["total_units_sold"],
            top_products=top_products,
            top_categories=top_categories,
            recent_sales=recent_sales,
            insights=self._build_insights(
                low_stock_count=inventory_row["low_stock_count"],
                total_profit=sales_row["total_profit"],
                top_products=top_products,
                top_categories=top_categories,
            ),
        )

    def _seed_if_empty(self) -> None:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS total FROM items").fetchone()
            if row["total"] > 0:
                return

            connection.executemany(
                """
                INSERT INTO items (code, name, category, quantity, min_quantity, sale_price, cost_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    ("7791234567890", "Yerba Tradicional 1kg", "Almacen", 12, 5, 4890, 3200),
                    ("7501000123456", "Galletitas de avena", "Snacks", 24, 6, 2150, 1200),
                    ("0001122233334", "Detergente citrico", "Limpieza", 18, 8, 3400, 2100),
                ],
            )
            connection.commit()

    def _ensure_legacy_columns(self) -> None:
        with self._connect() as connection:
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(items)").fetchall()}
            if "sale_price" not in columns:
                connection.execute("ALTER TABLE items ADD COLUMN sale_price REAL NOT NULL DEFAULT 0")
            if "cost_price" not in columns:
                connection.execute("ALTER TABLE items ADD COLUMN cost_price REAL NOT NULL DEFAULT 0")
            if "price" in columns:
                connection.execute(
                    """
                    UPDATE items
                    SET sale_price = CASE WHEN sale_price = 0 THEN price ELSE sale_price END
                    """
                )
            connection.commit()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        return connection

    @staticmethod
    def _to_item(row: sqlite3.Row) -> StockItem:
        return StockItem(
            id=row["id"],
            code=row["code"],
            name=row["name"],
            category=row["category"],
            quantity=row["quantity"],
            min_quantity=row["min_quantity"],
            sale_price=row["sale_price"],
            cost_price=row["cost_price"],
        )

    @staticmethod
    def _to_sale(row: sqlite3.Row) -> SaleRecord:
        revenue = row["quantity"] * row["unit_price"]
        profit = row["quantity"] * (row["unit_price"] - row["cost_price"])
        return SaleRecord(
            id=row["id"],
            item_id=row["item_id"],
            code=row["code"],
            item_name=row["item_name"],
            category=row["category"],
            quantity=row["quantity"],
            unit_price=row["unit_price"],
            cost_price=row["cost_price"],
            revenue=revenue,
            profit=profit,
            created_at=row["created_at"],
        )

    @staticmethod
    def _build_insights(
        *,
        low_stock_count: int,
        total_profit: float,
        top_products: list[RankedProduct],
        top_categories: list[RankedCategory],
    ) -> list[str]:
        insights: list[str] = []

        if top_products:
            winner = top_products[0]
            insights.append(f"El producto mas vendido es {winner.name} con {winner.quantity} unidades.")
        else:
            insights.append("Todavia no hay ventas registradas para generar tendencias.")

        if top_categories:
            winner_category = top_categories[0]
            insights.append(f"La categoria con mejor rotacion es {winner_category.category}.")

        if low_stock_count > 0:
            insights.append(
                f"Hay {low_stock_count} productos en zona de reposicion. Conviene revisar compras."
            )

        if total_profit > 0:
            insights.append("Las ventas actuales ya generan margen positivo estimado.")

        return insights


repository = SQLiteStockRepository()
