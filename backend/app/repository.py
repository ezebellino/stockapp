from __future__ import annotations

import sqlite3
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path

from .logging_config import get_logger
from .models import (
    CashSession,
    CashSessionClose,
    CashSessionOpen,
    Category,
    DailyCashSummary,
    DailySalesPoint,
    InventoryMovement,
    ReportSummary,
    RankedCategory,
    RankedProduct,
    SaleCreate,
    SaleRecord,
    StockItem,
    StockItemCreate,
    StockItemUpdate,
)


logger = get_logger('repository')


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
                CREATE TABLE IF NOT EXISTS categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
                    total_amount REAL NOT NULL DEFAULT 0,
                    cost_price REAL NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS movements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id INTEGER,
                    code TEXT NOT NULL,
                    item_name TEXT NOT NULL,
                    movement_type TEXT NOT NULL,
                    quantity_delta INTEGER NOT NULL,
                    reference TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS cash_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    opening_amount REAL NOT NULL,
                    actual_cash_amount REAL,
                    difference_amount REAL,
                    status TEXT NOT NULL DEFAULT 'OPEN',
                    notes TEXT NOT NULL DEFAULT '',
                    opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    closed_at TEXT
                )
                """
            )
            connection.commit()

        self._ensure_legacy_columns()
        self._normalize_existing_categories()
        self._seed_if_empty()
        self._seed_demo_activity_if_no_sales()

    def list_categories(self) -> list[Category]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, name, created_at
                FROM categories
                ORDER BY LOWER(name)
                """
            ).fetchall()
        return [Category(id=row["id"], name=row["name"], created_at=row["created_at"]) for row in rows]

    def create_category(self, name: str) -> Category:
        normalized_name = self._canonicalize_label(name)
        if not normalized_name:
            raise ValueError("La categoria no puede estar vacia.")

        with self._connect() as connection:
            existing_rows = connection.execute(
                "SELECT id, name, created_at FROM categories"
            ).fetchall()
            existing = next(
                (row for row in existing_rows if self._normalize_text_key(row["name"]) == self._normalize_text_key(normalized_name)),
                None,
            )
            if existing is not None:
                raise ValueError("La categoria ya existe.")

            cursor = connection.execute(
                "INSERT INTO categories (name) VALUES (?)",
                (normalized_name,),
            )
            connection.commit()
            row = connection.execute(
                "SELECT id, name, created_at FROM categories WHERE id = ?",
                (cursor.lastrowid,),
            ).fetchone()

        return Category(id=row["id"], name=row["name"], created_at=row["created_at"])

    def ensure_category(self, name: str) -> None:
        normalized_name = self._canonicalize_label(name)
        if not normalized_name:
            return
        with self._connect() as connection:
            rows = connection.execute("SELECT id, name FROM categories").fetchall()
            existing = next((row for row in rows if self._normalize_text_key(row["name"]) == self._normalize_text_key(normalized_name)), None)
            if existing is None:
                connection.execute("INSERT INTO categories (name) VALUES (?)", (normalized_name,))
                connection.commit()

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

    def list_movements(self, *, limit: int = 20, item_id: int | None = None) -> list[InventoryMovement]:
        with self._connect() as connection:
            if item_id is None:
                rows = connection.execute(
                    """
                    SELECT id, item_id, code, item_name, movement_type, quantity_delta, reference, created_at
                    FROM movements
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT id, item_id, code, item_name, movement_type, quantity_delta, reference, created_at
                    FROM movements
                    WHERE item_id = ?
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (item_id, limit),
                ).fetchall()
        return [self._to_movement(row) for row in rows]

    def create_item(self, payload: StockItemCreate) -> StockItem:
        category_name = self._canonicalize_label(payload.category)
        self.ensure_category(category_name)
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO items (code, name, category, quantity, min_quantity, sale_price, cost_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.code,
                    payload.name,
                    category_name,
                    payload.quantity,
                    payload.min_quantity,
                    payload.sale_price,
                    payload.cost_price,
                ),
            )
            item_id = cursor.lastrowid
            if payload.quantity > 0:
                self._record_movement(
                    connection,
                    item_id=item_id,
                    code=payload.code,
                    item_name=payload.name,
                    movement_type="CREATE",
                    quantity_delta=payload.quantity,
                    reference="Alta inicial",
                )
            connection.commit()

        item = self.get_item(item_id)
        if item is None:
            raise RuntimeError("No se pudo recuperar el producto creado.")
        return item

    def update_item(self, item_id: int, payload: StockItemUpdate) -> StockItem | None:
        current = self.get_item(item_id)
        if current is None:
            return None

        category_name = self._canonicalize_label(payload.category)
        self.ensure_category(category_name)
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
                    category_name,
                    payload.quantity,
                    payload.min_quantity,
                    payload.sale_price,
                    payload.cost_price,
                    item_id,
                ),
            )
            quantity_delta = payload.quantity - current.quantity
            if quantity_delta != 0:
                self._record_movement(
                    connection,
                    item_id=item_id,
                    code=payload.code,
                    item_name=payload.name,
                    movement_type="ADJUSTMENT",
                    quantity_delta=quantity_delta,
                    reference="Edicion manual",
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
                SELECT id, code, name, quantity
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
            self._record_movement(
                connection,
                item_id=row["id"],
                code=row["code"],
                item_name=row["name"],
                movement_type="ENTRY",
                quantity_delta=amount,
                reference="Ingreso por escaner",
            )
            connection.commit()

        return self.get_by_code(code)

    def record_sale(self, payload: SaleCreate) -> tuple[SaleRecord, StockItem]:
        if self.get_current_cash_session() is None:
            raise ValueError("Abri la caja del dia antes de registrar ventas.")

        with self._connect() as connection:
            item_row = connection.execute(
                """
                SELECT id, code, name, category, quantity, sale_price, cost_price
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
            total_amount = payload.amount * unit_price
            connection.execute(
                "UPDATE items SET quantity = ? WHERE id = ?",
                (item_row["quantity"] - payload.amount, item_row["id"]),
            )
            cursor = connection.execute(
                """
                INSERT INTO sales (item_id, code, item_name, category, quantity, unit_price, total_amount, cost_price)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item_row["id"],
                    item_row["code"],
                    item_row["name"],
                    item_row["category"],
                    payload.amount,
                    unit_price,
                    total_amount,
                    item_row["cost_price"],
                ),
            )
            self._record_movement(
                connection,
                item_id=item_row["id"],
                code=item_row["code"],
                item_name=item_row["name"],
                movement_type="SALE",
                quantity_delta=-payload.amount,
                reference="Venta registrada",
            )
            connection.commit()

            sale_row = connection.execute(
                """
                SELECT id, item_id, code, item_name, category, quantity, unit_price, total_amount, cost_price, created_at
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

    def get_report_summary(self, *, start_date: str | None = None, end_date: str | None = None) -> ReportSummary:
        sales_filter_sql, sales_filter_params = self._build_sales_period_filter(start_date=start_date, end_date=end_date)
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
                f"""
                SELECT
                    COUNT(*) AS total_sales_count,
                    COALESCE(SUM(quantity), 0) AS total_units_sold,
                    COALESCE(SUM(total_amount), 0) AS total_revenue,
                    COALESCE(SUM(quantity * (unit_price - cost_price)), 0) AS total_profit
                FROM sales
                {sales_filter_sql}
                """,
                sales_filter_params,
            ).fetchone()
            top_products_rows = connection.execute(
                f"""
                SELECT item_name AS name, SUM(quantity) AS quantity, SUM(total_amount) AS revenue
                FROM sales
                {sales_filter_sql}
                GROUP BY item_name
                ORDER BY quantity DESC, revenue DESC
                LIMIT 5
                """,
                sales_filter_params,
            ).fetchall()
            top_categories_rows = connection.execute(
                f"""
                SELECT category, SUM(quantity) AS quantity, SUM(total_amount) AS revenue
                FROM sales
                {sales_filter_sql}
                GROUP BY category
                ORDER BY quantity DESC, revenue DESC
                LIMIT 5
                """,
                sales_filter_params,
            ).fetchall()
            recent_sales_rows = connection.execute(
                f"""
                SELECT id, item_id, code, item_name, category, quantity, unit_price, total_amount, cost_price, created_at
                FROM sales
                {sales_filter_sql}
                ORDER BY id DESC
                LIMIT 8
                """,
                sales_filter_params,
            ).fetchall()

        top_products = [RankedProduct(name=row["name"], quantity=row["quantity"], revenue=row["revenue"]) for row in top_products_rows]
        top_categories = [RankedCategory(category=row["category"], quantity=row["quantity"], revenue=row["revenue"]) for row in top_categories_rows]
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

    def get_daily_cash_summary(self, *, start_date: str | None = None, end_date: str | None = None) -> DailyCashSummary:
        current_session = self.get_current_cash_session()
        with self._connect() as connection:
            if start_date or end_date:
                sales_filter_sql, sales_filter_params = self._build_sales_period_filter(start_date=start_date, end_date=end_date)
                today_row = connection.execute(
                    f"""
                    SELECT
                        COUNT(*) AS total_sales_count,
                        COALESCE(SUM(quantity), 0) AS total_units_sold,
                        COALESCE(SUM(total_amount), 0) AS total_revenue,
                        COALESCE(SUM(quantity * (unit_price - cost_price)), 0) AS total_profit
                    FROM sales
                    {sales_filter_sql}
                    """,
                    sales_filter_params,
                ).fetchone()
                expected_cash_now = today_row["total_revenue"]
                session_filter_sql, session_filter_params = self._build_session_period_filter(start_date=start_date, end_date=end_date)
                recent_rows = connection.execute(
                    f"""
                    SELECT id, opening_amount, actual_cash_amount, difference_amount, status, notes, opened_at, closed_at
                    FROM cash_sessions
                    {session_filter_sql}
                    ORDER BY id DESC
                    LIMIT 10
                    """,
                    session_filter_params,
                ).fetchall()
            elif current_session is None:
                today_row = connection.execute(
                    """
                    SELECT
                        COUNT(*) AS total_sales_count,
                        COALESCE(SUM(quantity), 0) AS total_units_sold,
                        COALESCE(SUM(total_amount), 0) AS total_revenue,
                        COALESCE(SUM(quantity * (unit_price - cost_price)), 0) AS total_profit
                    FROM sales
                    WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
                    """
                ).fetchone()
                expected_cash_now = today_row["total_revenue"]
                recent_rows = connection.execute(
                    """
                    SELECT id, opening_amount, actual_cash_amount, difference_amount, status, notes, opened_at, closed_at
                    FROM cash_sessions
                    ORDER BY id DESC
                    LIMIT 7
                    """
                ).fetchall()
            else:
                today_row = connection.execute(
                    """
                    SELECT
                        COUNT(*) AS total_sales_count,
                        COALESCE(SUM(quantity), 0) AS total_units_sold,
                        COALESCE(SUM(total_amount), 0) AS total_revenue,
                        COALESCE(SUM(quantity * (unit_price - cost_price)), 0) AS total_profit
                    FROM sales
                    WHERE created_at >= ?
                    """,
                    (current_session.opened_at,),
                ).fetchone()
                expected_cash_now = current_session.opening_amount + today_row["total_revenue"]
                recent_rows = connection.execute(
                    """
                    SELECT id, opening_amount, actual_cash_amount, difference_amount, status, notes, opened_at, closed_at
                    FROM cash_sessions
                    ORDER BY id DESC
                    LIMIT 7
                    """
                ).fetchall()

        return DailyCashSummary(
            current_session=None if (start_date or end_date) else current_session,
            today_revenue=today_row["total_revenue"],
            today_profit=today_row["total_profit"],
            today_sales_count=today_row["total_sales_count"],
            today_units_sold=today_row["total_units_sold"],
            expected_cash_now=expected_cash_now,
            recent_sessions=[self._to_cash_session(row) for row in recent_rows],
        )
    def get_current_cash_session(self) -> CashSession | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, opening_amount, actual_cash_amount, difference_amount, status, notes, opened_at, closed_at
                FROM cash_sessions
                WHERE status = 'OPEN'
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()
        if row is None:
            return None
        return self._with_expected_cash(row)

    def open_cash_session(self, payload: CashSessionOpen) -> CashSession:
        if self.get_current_cash_session() is not None:
            raise ValueError("Ya existe una caja abierta.")

        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO cash_sessions (opening_amount, notes, status)
                VALUES (?, ?, 'OPEN')
                """,
                (payload.opening_amount, payload.notes.strip()),
            )
            connection.commit()
            row = connection.execute(
                """
                SELECT id, opening_amount, actual_cash_amount, difference_amount, status, notes, opened_at, closed_at
                FROM cash_sessions
                WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()
        return self._with_expected_cash(row)

    def close_cash_session(self, payload: CashSessionClose) -> CashSession:
        current_session = self.get_current_cash_session()
        if current_session is None:
            raise ValueError("No hay una caja abierta para cerrar.")

        difference_amount = payload.actual_cash_amount - current_session.expected_cash_amount
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE cash_sessions
                SET actual_cash_amount = ?, difference_amount = ?, notes = ?, status = 'CLOSED', closed_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    payload.actual_cash_amount,
                    difference_amount,
                    payload.notes.strip(),
                    current_session.id,
                ),
            )
            connection.commit()
            row = connection.execute(
                """
                SELECT id, opening_amount, actual_cash_amount, difference_amount, status, notes, opened_at, closed_at
                FROM cash_sessions
                WHERE id = ?
                """,
                (current_session.id,),
            ).fetchone()
        return self._with_expected_cash(row)

    def _seed_if_empty(self) -> None:
        with self._connect() as connection:
            category_count = connection.execute("SELECT COUNT(*) AS total FROM categories").fetchone()
            if category_count["total"] == 0:
                connection.executemany(
                    "INSERT INTO categories (name) VALUES (?)",
                    [("General",), ("Almacen",), ("Snacks",), ("Limpieza",), ("Bebidas",)],
                )

            row = connection.execute("SELECT COUNT(*) AS total FROM items").fetchone()
            if row["total"] == 0:
                connection.executemany(
                    """
                    INSERT INTO items (code, name, category, quantity, min_quantity, sale_price, cost_price)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        ("7791234567890", "Yerba Tradicional 1kg", "Almacen", 18, 5, 4890, 3200),
                        ("7501000123456", "Galletitas de avena", "Snacks", 30, 6, 2150, 1200),
                        ("0001122233334", "Detergente citrico", "Limpieza", 22, 8, 3400, 2100),
                        ("7798123400011", "Cafe molido clasico 500g", "Almacen", 16, 4, 4250, 2800),
                        ("7790987654321", "Gaseosa cola 2.25L", "Bebidas", 26, 8, 3100, 1800),
                    ],
                )
            connection.commit()

    def _seed_demo_activity_if_no_sales(self) -> None:
        demo_catalog = [
            {"code": "7791234567890", "name": "Yerba Tradicional 1kg", "category": "Almacen", "quantity": 18, "min_quantity": 5, "sale_price": 4890, "cost_price": 3200},
            {"code": "7501000123456", "name": "Galletitas de avena", "category": "Snacks", "quantity": 30, "min_quantity": 6, "sale_price": 2150, "cost_price": 1200},
            {"code": "0001122233334", "name": "Detergente citrico", "category": "Limpieza", "quantity": 22, "min_quantity": 8, "sale_price": 3400, "cost_price": 2100},
            {"code": "7798123400011", "name": "Cafe molido clasico 500g", "category": "Almacen", "quantity": 16, "min_quantity": 4, "sale_price": 4250, "cost_price": 2800},
            {"code": "7790987654321", "name": "Gaseosa cola 2.25L", "category": "Bebidas", "quantity": 26, "min_quantity": 8, "sale_price": 3100, "cost_price": 1800},
        ]
        demo_sales = [
            {"code": "7791234567890", "amount": 2, "days_ago": 6, "hour": 10, "minute": 15},
            {"code": "7501000123456", "amount": 3, "days_ago": 6, "hour": 18, "minute": 40},
            {"code": "0001122233334", "amount": 1, "days_ago": 5, "hour": 11, "minute": 5},
            {"code": "7798123400011", "amount": 2, "days_ago": 4, "hour": 17, "minute": 20},
            {"code": "7790987654321", "amount": 4, "days_ago": 4, "hour": 20, "minute": 10},
            {"code": "7791234567890", "amount": 1, "days_ago": 3, "hour": 9, "minute": 50},
            {"code": "7501000123456", "amount": 2, "days_ago": 2, "hour": 13, "minute": 30},
            {"code": "7790987654321", "amount": 5, "days_ago": 2, "hour": 19, "minute": 15},
            {"code": "0001122233334", "amount": 2, "days_ago": 1, "hour": 12, "minute": 10},
            {"code": "7798123400011", "amount": 1, "days_ago": 1, "hour": 17, "minute": 45},
            {"code": "7791234567890", "amount": 2, "days_ago": 0, "hour": 10, "minute": 5},
            {"code": "7790987654321", "amount": 3, "days_ago": 0, "hour": 21, "minute": 0},
        ]
        required_units = {}
        for sale in demo_sales:
            required_units[sale["code"]] = required_units.get(sale["code"], 0) + sale["amount"]

        with self._connect() as connection:
            sales_count = connection.execute("SELECT COUNT(*) AS total FROM sales").fetchone()
            if sales_count["total"] > 0:
                return

            category_rows = connection.execute("SELECT id, name FROM categories").fetchall()
            for product in demo_catalog:
                category_name = self._canonicalize_label(product["category"])
                category_exists = next((row for row in category_rows if self._normalize_text_key(row["name"]) == self._normalize_text_key(category_name)), None)
                if category_exists is None:
                    connection.execute("INSERT INTO categories (name) VALUES (?)", (category_name,))
                    category_rows = connection.execute("SELECT id, name FROM categories").fetchall()

            existing_rows = connection.execute(
                "SELECT id, code, name, category, quantity, min_quantity, sale_price, cost_price FROM items"
            ).fetchall()
            existing_by_code = {row["code"]: row for row in existing_rows}
            for product in demo_catalog:
                if product["code"] in existing_by_code:
                    continue
                connection.execute(
                    """
                    INSERT INTO items (code, name, category, quantity, min_quantity, sale_price, cost_price)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        product["code"],
                        product["name"],
                        self._canonicalize_label(product["category"]),
                        product["quantity"],
                        product["min_quantity"],
                        product["sale_price"],
                        product["cost_price"],
                    ),
                )

            existing_rows = connection.execute(
                "SELECT id, code, name, category, quantity, min_quantity, sale_price, cost_price FROM items"
            ).fetchall()
            existing_by_code = {row["code"]: row for row in existing_rows}
            for code, units_needed in required_units.items():
                row = existing_by_code.get(code)
                if row is None:
                    continue
                desired_quantity = max(row["quantity"], units_needed + row["min_quantity"] + 4)
                if desired_quantity != row["quantity"]:
                    connection.execute("UPDATE items SET quantity = ? WHERE id = ?", (desired_quantity, row["id"]))

            existing_rows = connection.execute(
                "SELECT id, code, name, category, quantity, min_quantity, sale_price, cost_price FROM items"
            ).fetchall()
            existing_by_code = {row["code"]: row for row in existing_rows}
            now = datetime.now().replace(second=0, microsecond=0)
            for sale in demo_sales:
                row = existing_by_code.get(sale["code"])
                if row is None:
                    continue
                created_at = (now - timedelta(days=sale["days_ago"])) .replace(hour=sale["hour"], minute=sale["minute"])
                created_at_value = created_at.strftime("%Y-%m-%d %H:%M:%S")
                connection.execute("UPDATE items SET quantity = quantity - ? WHERE id = ?", (sale["amount"], row["id"]))
                connection.execute(
                    """
                    INSERT INTO sales (item_id, code, item_name, category, quantity, unit_price, total_amount, cost_price, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row["id"],
                        row["code"],
                        row["name"],
                        row["category"],
                        sale["amount"],
                        row["sale_price"],
                        sale["amount"] * row["sale_price"],
                        row["cost_price"],
                        created_at_value,
                    ),
                )
                self._record_movement(
                    connection,
                    item_id=row["id"],
                    code=row["code"],
                    item_name=row["name"],
                    movement_type="SALE",
                    quantity_delta=-sale["amount"],
                    reference="Venta demo",
                    created_at=created_at_value,
                )
            connection.commit()
    def _ensure_legacy_columns(self) -> None:
        with self._connect() as connection:
            item_columns = {row["name"] for row in connection.execute("PRAGMA table_info(items)").fetchall()}
            if "sale_price" not in item_columns:
                connection.execute("ALTER TABLE items ADD COLUMN sale_price REAL NOT NULL DEFAULT 0")
                logger.info("Se agrego la columna sale_price a items.")
            if "cost_price" not in item_columns:
                connection.execute("ALTER TABLE items ADD COLUMN cost_price REAL NOT NULL DEFAULT 0")
                logger.info("Se agrego la columna cost_price a items.")
            if "price" in item_columns:
                connection.execute(
                    """
                    UPDATE items
                    SET sale_price = CASE WHEN sale_price = 0 THEN price ELSE sale_price END
                    """
                )

            sales_columns = {row["name"] for row in connection.execute("PRAGMA table_info(sales)").fetchall()}
            if "total_amount" not in sales_columns:
                connection.execute("ALTER TABLE sales ADD COLUMN total_amount REAL NOT NULL DEFAULT 0")
                logger.info("Se agrego la columna total_amount a sales.")
            connection.execute(
                """
                UPDATE sales
                SET total_amount = quantity * unit_price
                WHERE total_amount = 0
                """
            )

            categories = connection.execute("SELECT DISTINCT category FROM items WHERE TRIM(category) <> ''").fetchall()
            for category in categories:
                canonical_name = self._canonicalize_label(category["category"])
                rows = connection.execute("SELECT id, name FROM categories").fetchall()
                exists = next((row for row in rows if self._normalize_text_key(row["name"]) == self._normalize_text_key(canonical_name)), None)
                if exists is None:
                    connection.execute("INSERT INTO categories (name) VALUES (?)", (canonical_name,))
            connection.commit()

    def _normalize_existing_categories(self) -> None:
        with self._connect() as connection:
            item_rows = connection.execute("SELECT DISTINCT category FROM items WHERE TRIM(category) <> ''").fetchall()
            for item_row in item_rows:
                original_name = item_row["category"]
                canonical_name = self._canonicalize_label(original_name)
                if canonical_name and canonical_name != original_name:
                    connection.execute("UPDATE items SET category = ? WHERE category = ?", (canonical_name, original_name))

            category_rows = connection.execute("SELECT id, name FROM categories ORDER BY id ASC").fetchall()
            grouped = {}
            for row in category_rows:
                canonical_name = self._canonicalize_label(row["name"])
                key = self._normalize_text_key(canonical_name)
                grouped.setdefault(key, []).append((row["id"], row["name"], canonical_name))

            for rows in grouped.values():
                keep_id, _original_name, canonical_name = rows[0]
                for category_id, original_name, _canonical_name in rows:
                    if canonical_name and original_name != canonical_name:
                        connection.execute("UPDATE items SET category = ? WHERE category = ?", (canonical_name, original_name))
                for category_id, _original_name, _canonical_name in rows[1:]:
                    connection.execute("DELETE FROM categories WHERE id = ?", (category_id,))
                connection.execute("UPDATE categories SET name = ? WHERE id = ?", (canonical_name, keep_id))
            connection.commit()

    def _record_movement(
        self,
        connection: sqlite3.Connection,
        *,
        item_id: int | None,
        code: str,
        item_name: str,
        movement_type: str,
        quantity_delta: int,
        reference: str,
        created_at: str | None = None,
    ) -> None:
        if created_at is None:
            connection.execute(
                """
                INSERT INTO movements (item_id, code, item_name, movement_type, quantity_delta, reference)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (item_id, code, item_name, movement_type, quantity_delta, reference),
            )
            return

        connection.execute(
            """
            INSERT INTO movements (item_id, code, item_name, movement_type, quantity_delta, reference, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (item_id, code, item_name, movement_type, quantity_delta, reference, created_at),
        )
    def list_sales_for_period(self, *, start_date: str | None = None, end_date: str | None = None) -> list[SaleRecord]:
        sales_filter_sql, sales_filter_params = self._build_sales_period_filter(start_date=start_date, end_date=end_date)
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT id, item_id, code, item_name, category, quantity, unit_price, total_amount, cost_price, created_at
                FROM sales
                {sales_filter_sql}
                ORDER BY datetime(created_at) DESC, id DESC
                """,
                sales_filter_params,
            ).fetchall()
        return [self._to_sale(row) for row in rows]

    def list_cash_sessions_for_period(self, *, start_date: str | None = None, end_date: str | None = None) -> list[CashSession]:
        session_filter_sql, session_filter_params = self._build_session_period_filter(start_date=start_date, end_date=end_date)
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT id, opening_amount, actual_cash_amount, difference_amount, status, notes, opened_at, closed_at
                FROM cash_sessions
                {session_filter_sql}
                ORDER BY id DESC
                """,
                session_filter_params,
            ).fetchall()
        return [self._with_expected_cash(row) for row in rows]
    def get_daily_sales_series(self, *, start_date: str | None = None, end_date: str | None = None, limit: int = 14) -> list[DailySalesPoint]:
        sales_filter_sql, sales_filter_params = self._build_sales_period_filter(start_date=start_date, end_date=end_date)
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT
                    DATE(created_at, 'localtime') AS sale_date,
                    COUNT(*) AS sales_count,
                    COALESCE(SUM(quantity), 0) AS units_sold,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COALESCE(SUM(quantity * (unit_price - cost_price)), 0) AS profit
                FROM sales
                {sales_filter_sql}
                GROUP BY DATE(created_at, 'localtime')
                ORDER BY sale_date DESC
                LIMIT ?
                """,
                sales_filter_params + (limit,),
            ).fetchall()

        ordered_rows = list(reversed(rows))
        return [
            DailySalesPoint(
                date=row["sale_date"],
                label=self._format_daily_label(row["sale_date"]),
                sales_count=row["sales_count"],
                units_sold=row["units_sold"],
                revenue=row["revenue"],
                profit=row["profit"],
            )
            for row in ordered_rows
        ]

    def _with_expected_cash(self, row: sqlite3.Row) -> CashSession:
        with self._connect() as connection:
            revenue_row = connection.execute(
                """
                SELECT COALESCE(SUM(total_amount), 0) AS total_revenue
                FROM sales
                WHERE created_at >= ?
                AND (? IS NULL OR created_at <= ?)
                """,
                (row["opened_at"], row["closed_at"], row["closed_at"]),
            ).fetchone()
        expected_cash_amount = row["opening_amount"] + revenue_row["total_revenue"]
        return CashSession(
            id=row["id"],
            opening_amount=row["opening_amount"],
            expected_cash_amount=expected_cash_amount,
            actual_cash_amount=row["actual_cash_amount"],
            difference_amount=row["difference_amount"],
            status=row["status"],
            notes=row["notes"],
            opened_at=row["opened_at"],
            closed_at=row["closed_at"],
        )

    @staticmethod
    def _format_daily_label(value: str) -> str:
        year, month, day = value.split("-")
        return f"{day}/{month}"

    @staticmethod
    def _normalize_text_key(value: str) -> str:
        normalized = unicodedata.normalize("NFD", value or "")
        without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
        return " ".join(without_marks.casefold().split())

    @staticmethod
    def _repair_text(value: str) -> str:
        repaired = str(value or "")
        replacements = {
            "??": "?",
            "??": "?",
            "??": "?",
            "??": "?",
            "??": "?",
            "??": "?",
            "??": "?",
            "??": "?",
            "??": "?",
            "??": "?",
            "??": "?",
            "??": "?",
        }
        for source, target in replacements.items():
            repaired = repaired.replace(source, target)
        return repaired

    @classmethod
    def _clean_label(cls, value: str) -> str:
        repaired = cls._repair_text(value)
        return " ".join(repaired.strip().split())

    @classmethod
    def _canonicalize_label(cls, value: str) -> str:
        cleaned = cls._clean_label(value)
        return " ".join(word[:1].upper() + word[1:].lower() for word in cleaned.split())

    @staticmethod
    def _build_sales_period_filter(*, start_date: str | None = None, end_date: str | None = None) -> tuple[str, tuple[str, ...]]:
        clauses: list[str] = []
        params: list[str] = []
        if start_date:
            clauses.append("DATE(created_at, 'localtime') >= DATE(?)")
            params.append(start_date)
        if end_date:
            clauses.append("DATE(created_at, 'localtime') <= DATE(?)")
            params.append(end_date)
        sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        return sql, tuple(params)

    @staticmethod
    def _build_session_period_filter(*, start_date: str | None = None, end_date: str | None = None) -> tuple[str, tuple[str, ...]]:
        clauses: list[str] = []
        params: list[str] = []
        if start_date:
            clauses.append("DATE(opened_at, 'localtime') >= DATE(?)")
            params.append(start_date)
        if end_date:
            clauses.append("DATE(opened_at, 'localtime') <= DATE(?)")
            params.append(end_date)
        sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        return sql, tuple(params)
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
        total_amount = row["total_amount"] if "total_amount" in row.keys() else row["quantity"] * row["unit_price"]
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
            total_amount=total_amount,
            revenue=total_amount,
            profit=profit,
            created_at=row["created_at"],
        )

    @staticmethod
    def _to_movement(row: sqlite3.Row) -> InventoryMovement:
        return InventoryMovement(
            id=row["id"],
            item_id=row["item_id"],
            code=row["code"],
            item_name=row["item_name"],
            movement_type=row["movement_type"],
            quantity_delta=row["quantity_delta"],
            reference=row["reference"],
            created_at=row["created_at"],
        )

    @staticmethod
    def _to_cash_session(row: sqlite3.Row) -> CashSession:
        return CashSession(
            id=row["id"],
            opening_amount=row["opening_amount"],
            expected_cash_amount=row["opening_amount"],
            actual_cash_amount=row["actual_cash_amount"],
            difference_amount=row["difference_amount"],
            status=row["status"],
            notes=row["notes"],
            opened_at=row["opened_at"],
            closed_at=row["closed_at"],
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
            insights.append(f"Hay {low_stock_count} productos en zona de reposicion. Conviene revisar compras.")
        if total_profit > 0:
            insights.append("Las ventas actuales ya generan margen positivo estimado.")
        return insights


repository = SQLiteStockRepository()






