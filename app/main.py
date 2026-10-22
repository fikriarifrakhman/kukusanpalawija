from fastapi.staticfiles import StaticFiles
from datetime import datetime, date, timezone, timedelta
from typing import List, Optional

try:
    from zoneinfo import ZoneInfo
    JAKARTA_TZ = ZoneInfo("Asia/Jakarta")
except Exception:
    JAKARTA_TZ = timezone(timedelta(hours=7), name="Asia/Jakarta")

def get_now() -> datetime:
    """Mengembalikan waktu saat ini dalam zona waktu Asia/Jakarta (WIB)."""
    return datetime.now(JAKARTA_TZ)

def get_today() -> date:
    """Mengembalikan tanggal hari ini dalam zona waktu Asia/Jakarta (WIB)."""
    return datetime.now(JAKARTA_TZ).date()

def ensure_wib(dt: Optional[datetime]) -> datetime:
    """Memastikan objek datetime selalu mengacu ke zona waktu Asia/Jakarta (WIB / UTC+7)."""
    if dt is None:
        return datetime.now(JAKARTA_TZ)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=JAKARTA_TZ)
    return dt.astimezone(JAKARTA_TZ)

from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from .database import get_connection

app = FastAPI(
    title="Kukusan Palawija API",
    description="Backend API untuk sistem manajemen Kukusan Palawija",
    version="1.0.0"
)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return FileResponse("static/index.html")


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.on_event("startup")
def init_db_schema():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SET TIME ZONE 'Asia/Jakarta';")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS daily_modal (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                entry_date DATE NOT NULL,
                production_cost NUMERIC(15,2) DEFAULT 0,
                operational_cost NUMERIC(15,2) DEFAULT 0,
                total_modal NUMERIC(15,2) NOT NULL,
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS daily_finance (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                entry_date DATE NOT NULL,
                modal NUMERIC(15,2) DEFAULT 0,
                omset NUMERIC(15,2) NOT NULL,
                profit NUMERIC(15,2) NOT NULL,
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            ALTER TABLE waste ALTER COLUMN product_id DROP NOT NULL;
            ALTER TABLE waste ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL;
            ALTER TABLE waste ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'PRODUCT';
            INSERT INTO stock_balances (id, ingredient_id, quantity, stock_value, average_cost)
            SELECT gen_random_uuid(), i.id, 0, 0, 0
            FROM ingredients i
            LEFT JOIN stock_balances sb ON i.id = sb.ingredient_id
            WHERE sb.id IS NULL
            ON CONFLICT (ingredient_id) DO NOTHING;
            INSERT INTO finished_goods_stock (id, product_id, quantity, stock_value, average_cost)
            SELECT gen_random_uuid(), p.id, 0, 0, 0
            FROM products p
            LEFT JOIN finished_goods_stock fgs ON p.id = fgs.product_id
            WHERE fgs.id IS NULL
            ON CONFLICT (product_id) DO NOTHING;

            -- Migrasi otomatis satuan baku Telur Ayam dan Kentang menjadi biji
            UPDATE ingredients 
            SET stock_unit_id = (SELECT id FROM units WHERE LOWER(symbol) = 'biji' LIMIT 1)
            WHERE LOWER(TRIM(name)) IN ('telur ayam', 'kentang')
              AND EXISTS (SELECT 1 FROM units WHERE LOWER(symbol) = 'biji');
        """)
        conn.commit()
        cur.close()
    except Exception as e:
        conn.rollback()
        print(f"Schema startup note: {e}")
    finally:
        conn.close()



@app.get("/api/products")
def get_products():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                id,
                name,
                selling_unit_id,
                selling_price,
                category,
                active,
                seasonal,
                notes
            FROM products
            WHERE active IS TRUE
            ORDER BY name;
        """)

        rows = cursor.fetchall()

        products = []

        for row in rows:
            products.append({
                "id": str(row[0]),
                "name": row[1],
                "selling_unit_id": str(row[2]),
                "selling_price": float(row[3]),
                "category": row[4],
                "active": row[5],
                "seasonal": row[6],
                "notes": row[7]
            })

        return products

    finally:
        cursor.close()
        connection.close()

        connection.close()


@app.get("/api/ingredients")
def get_ingredients():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                id,
                name,
                stock_unit_id,
                minimum_stock,
                active,
                seasonal,
                notes
            FROM ingredients
            WHERE active IS TRUE
            ORDER BY name;
        """)

        rows = cursor.fetchall()

        ingredients = []

        for row in rows:
            ingredients.append({
                "id": str(row[0]),
                "name": row[1],
                "stock_unit_id": str(row[2]),
                "minimum_stock": float(row[3]),
                "active": row[4],
                "seasonal": row[5],
                "notes": row[6]
            })

        return ingredients

    finally:
        cursor.close()
        connection.close()


class IngredientCreate(BaseModel):
    name: str
    stock_unit: str  # unit id, symbol ('kg', 'biji', 'porsi'), or new unit name
    selling_unit: str  # unit id, symbol, or new unit name
    selling_price: float
    minimum_stock: float = 0.0
    notes: Optional[str] = None


@app.post("/api/ingredients")
def create_ingredient(data: IngredientCreate):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama bahan / komoditas wajib diisi.")

    if data.selling_price < 0:
        raise HTTPException(status_code=400, detail="Harga jual standar tidak boleh negatif.")

    conn = get_connection()
    cur = conn.cursor()
    try:
        # 1. Cek apakah komoditas/bahan dengan nama yang sama sudah ada (case-insensitive)
        cur.execute("SELECT id, name, active FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))", (name,))
        existing_ing = cur.fetchone()
        if existing_ing and existing_ing[2] is True:
            raise HTTPException(
                status_code=400,
                detail=f"Bahan baku '{existing_ing[1]}' sudah terdaftar dan masih aktif."
            )

        # 2. Cari unit untuk stock_unit (Satuan Mentah)
        raw_unit_input = data.stock_unit.strip()
        cur.execute("""
            SELECT id, name, symbol FROM units
            WHERE id::text = %s OR LOWER(TRIM(symbol)) = LOWER(TRIM(%s)) OR LOWER(TRIM(name)) = LOWER(TRIM(%s))
            LIMIT 1
        """, (raw_unit_input, raw_unit_input, raw_unit_input))
        raw_unit_row = cur.fetchone()
        if not raw_unit_row:
            # Jika belum ada di tabel units, buat unit baru otomatis
            cur.execute("""
                INSERT INTO units (id, name, symbol, type)
                VALUES (gen_random_uuid(), %s, %s, 'quantity')
                RETURNING id, name, symbol
            """, (raw_unit_input.capitalize(), raw_unit_input.lower()))
            raw_unit_row = cur.fetchone()
        raw_unit_id, raw_unit_name, raw_unit_symbol = raw_unit_row

        # 3. Cari unit untuk selling_unit (Satuan Matang / Jual)
        cooked_unit_input = data.selling_unit.strip()
        cur.execute("""
            SELECT id, name, symbol FROM units
            WHERE id::text = %s OR LOWER(TRIM(symbol)) = LOWER(TRIM(%s)) OR LOWER(TRIM(name)) = LOWER(TRIM(%s))
            LIMIT 1
        """, (cooked_unit_input, cooked_unit_input, cooked_unit_input))
        cooked_unit_row = cur.fetchone()
        if not cooked_unit_row:
            cur.execute("""
                INSERT INTO units (id, name, symbol, type)
                VALUES (gen_random_uuid(), %s, %s, 'quantity')
                RETURNING id, name, symbol
            """, (cooked_unit_input.capitalize(), cooked_unit_input.lower()))
            cooked_unit_row = cur.fetchone()
        cooked_unit_id, cooked_unit_name, cooked_unit_symbol = cooked_unit_row

        ing_notes = data.notes.strip() if data.notes else f"Dibeli per {raw_unit_symbol}, hasil produksi per {cooked_unit_symbol}"

        # JIKA SUDAH ADA TAPI NONAKTIF: REAKTIFKAN KEMBALI
        if existing_ing and existing_ing[2] is False:
            ingredient_id = str(existing_ing[0])
            cur.execute("""
                UPDATE ingredients
                SET stock_unit_id = %s, minimum_stock = %s, active = true, notes = %s, updated_at = NOW()
                WHERE id = %s
            """, (raw_unit_id, data.minimum_stock, ing_notes, ingredient_id))

            cur.execute("SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))", (name,))
            existing_prod = cur.fetchone()
            if existing_prod:
                product_id = str(existing_prod[0])
                cur.execute("""
                    UPDATE products
                    SET selling_unit_id = %s, selling_price = %s, active = true, updated_at = NOW()
                    WHERE id = %s
                """, (cooked_unit_id, data.selling_price, product_id))
            else:
                cur.execute("""
                    INSERT INTO products (
                        id, name, selling_unit_id, selling_price, category, active, seasonal, notes
                    ) VALUES (
                        gen_random_uuid(), %s, %s, %s, 'Produk Kukusan', true, false, %s
                    ) RETURNING id;
                """, (name, cooked_unit_id, data.selling_price, f"Produk matang {name}"))
                product_id = str(cur.fetchone()[0])

            cur.execute("""
                INSERT INTO stock_balances (id, ingredient_id, quantity, stock_value, average_cost)
                VALUES (gen_random_uuid(), %s, 0, 0, 0)
                ON CONFLICT (ingredient_id) DO UPDATE SET updated_at = NOW();
            """, (ingredient_id,))

            cur.execute("""
                INSERT INTO finished_goods_stock (id, product_id, quantity, stock_value, average_cost)
                VALUES (gen_random_uuid(), %s, 0, 0, 0)
                ON CONFLICT (product_id) DO UPDATE SET updated_at = NOW();
            """, (product_id,))

            conn.commit()

            return {
                "status": "success",
                "message": f"Bahan baku '{name}' berhasil diaktifkan kembali dan langsung aktif di seluruh menu.",
                "data": {
                    "ingredient_id": ingredient_id,
                    "product_id": product_id,
                    "name": name,
                    "stock_unit": raw_unit_symbol,
                    "stock_unit_name": raw_unit_name,
                    "selling_unit": cooked_unit_symbol,
                    "selling_unit_name": cooked_unit_name,
                    "selling_price": data.selling_price
                }
            }

        # JIKA BARU: INSERT KE INGREDIENTS & PRODUCTS
        cur.execute("""
            INSERT INTO ingredients (
                id, name, stock_unit_id, minimum_stock, active, seasonal, notes
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, true, false, %s
            ) RETURNING id, name, stock_unit_id;
        """, (name, raw_unit_id, data.minimum_stock, ing_notes))
        new_ing = cur.fetchone()
        ingredient_id = str(new_ing[0])

        cur.execute("SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))", (name,))
        existing_prod = cur.fetchone()
        if existing_prod:
            product_id = str(existing_prod[0])
            cur.execute("""
                UPDATE products
                SET selling_unit_id = %s, selling_price = %s, active = true, updated_at = NOW()
                WHERE id = %s
            """, (cooked_unit_id, data.selling_price, product_id))
        else:
            cur.execute("""
                INSERT INTO products (
                    id, name, selling_unit_id, selling_price, category, active, seasonal, notes
                ) VALUES (
                    gen_random_uuid(), %s, %s, %s, 'Produk Kukusan', true, false, %s
                ) RETURNING id;
            """, (name, cooked_unit_id, data.selling_price, f"Produk matang {name}"))
            product_id = str(cur.fetchone()[0])

        # Inisialisasi stok awal 0 di stock_balances (mentah)
        cur.execute("""
            INSERT INTO stock_balances (
                id, ingredient_id, quantity, stock_value, average_cost
            ) VALUES (
                gen_random_uuid(), %s, 0, 0, 0
            ) ON CONFLICT (ingredient_id) DO UPDATE SET updated_at = NOW();
        """, (ingredient_id,))

        # Inisialisasi stok awal 0 di finished_goods_stock (matang)
        cur.execute("""
            INSERT INTO finished_goods_stock (
                id, product_id, quantity, stock_value, average_cost
            ) VALUES (
                gen_random_uuid(), %s, 0, 0, 0
            ) ON CONFLICT (product_id) DO UPDATE SET updated_at = NOW();
        """, (product_id,))

        conn.commit()

        return {
            "status": "success",
            "message": f"Bahan baku '{name}' berhasil disimpan dan aktif di seluruh menu.",
            "data": {
                "ingredient_id": ingredient_id,
                "product_id": product_id,
                "name": name,
                "stock_unit": raw_unit_symbol,
                "stock_unit_name": raw_unit_name,
                "selling_unit": cooked_unit_symbol,
                "selling_unit_name": cooked_unit_name,
                "selling_price": data.selling_price
            }
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menambahkan bahan baku: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/ingredients/{ingredient_id}")
def delete_ingredient(ingredient_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        # 1. Cek keberadaan bahan baku
        cur.execute("SELECT id, name FROM ingredients WHERE id = %s", (ingredient_id,))
        ing_row = cur.fetchone()
        if not ing_row:
            raise HTTPException(status_code=404, detail="Bahan baku tidak ditemukan.")
        name = ing_row[1]

        # 2. Soft-delete bahan mentah (active = false)
        cur.execute("""
            UPDATE ingredients
            SET active = false, updated_at = NOW()
            WHERE id = %s
        """, (ingredient_id,))

        # 3. Soft-delete produk matang terkait dengan nama yang sama (active = false)
        cur.execute("""
            UPDATE products
            SET active = false, updated_at = NOW()
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))
        """, (name,))

        conn.commit()

        return {
            "status": "success",
            "message": f"Bahan baku '{name}' berhasil dinonaktifkan."
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menonaktifkan bahan baku: {str(e)}")
    finally:
        cur.close()
        conn.close()

@app.get("/api/packaging")
def get_packaging():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                id,
                name,
                stock_unit_id,
                minimum_stock,
                active,
                notes
            FROM packaging_items
            ORDER BY name;
        """)

        rows = cursor.fetchall()

        packaging = []

        for row in rows:
            packaging.append({
                "id": str(row[0]),
                "name": row[1],
                "stock_unit_id": str(row[2]),
                "minimum_stock": float(row[3]),
                "active": row[4],
                "notes": row[5]
            })

        return packaging

    finally:
        cursor.close()
        connection.close()

@app.get("/api/units")
def get_units():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                id,
                name,
                symbol,
                type
            FROM units
            ORDER BY name;
        """)

        rows = cursor.fetchall()

        units = []

        for row in rows:
            units.append({
                "id": str(row[0]),
                "name": row[1],
                "symbol": row[2],
                "type": row[3]
            })

        return units

    finally:
        cursor.close()
        connection.close()

@app.get("/api/sales-channels")
def get_sales_channels():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                id,
                name,
                active
            FROM sales_channels
            ORDER BY name;
        """)

        rows = cursor.fetchall()

        channels = []

        for row in rows:
            channels.append({
                "id": str(row[0]),
                "name": row[1],
                "active": row[2]
            })

        return channels

    finally:
        cursor.close()
        connection.close()

class PurchaseItem(BaseModel):
    ingredient_id: str
    unit_id: str
    quantity: float
    unit_price: float


class PurchaseCreate(BaseModel):
    purchase_date: datetime
    supplier_name: Optional[str] = None
    payment_method: str
    notes: Optional[str] = None
    items: List[PurchaseItem]

class ProductionInput(BaseModel):
    ingredient_id: str
    unit_id: str
    quantity: float


class ProductionOutput(BaseModel):
    product_id: str
    unit_id: str
    quantity: float
    allocation_percentage: float = 100


class ProductionCreate(BaseModel):
    production_date: datetime
    notes: Optional[str] = None
    additional_cost: float = 0
    inputs: List[ProductionInput]
    outputs: List[ProductionOutput]

class SaleItemCreate(BaseModel):
    product_id: str
    quantity: float
    selling_price: float

class SaleLapakCreate(BaseModel):
    sale_date: datetime
    payment_method: str
    notes: Optional[str] = None
    items: List[SaleItemCreate]

class SaleGoFoodCreate(BaseModel):
    sale_date: datetime
    gross_amount: float
    platform_fee: float
    payment_method: str
    notes: Optional[str] = None

class WasteCreate(BaseModel):
    date: datetime
    product_id: str
    quantity: float
    reason: str
    notes: Optional[str] = None    

class PackagingStockOpnameItemCreate(BaseModel):
    packaging_item_id: str
    physical_quantity: float
    notes: Optional[str] = None

class PackagingStockOpnameCreate(BaseModel):
    opname_date: datetime
    notes: Optional[str] = None
    items: List[PackagingStockOpnameItemCreate]

class ExpenseCreate(BaseModel):
    expense_date: date
    category_id: str
    amount: float
    payment_method: Optional[str] = None
    is_business: bool = True
    allocation_percentage: float = 100
    description: Optional[str] = None
    expense_location: Optional[str] = None

class PackagingPurchaseItem(BaseModel):
    packaging_item_id: str
    unit_id: str
    quantity: float
    unit_price: float

class PackagingPurchaseCreate(BaseModel):
    purchase_date: datetime
    supplier_name: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    items: List[PackagingPurchaseItem]

class ModalCreate(BaseModel):
    entry_date: date
    production_cost: float = 0.0
    operational_cost: float = 0.0
    total_modal: float
    notes: Optional[str] = None

class FinanceCreate(BaseModel):
    entry_date: date
    modal: float = 0.0
    omset: float = 0.0
    profit: float = 0.0
    notes: Optional[str] = None

class StockWasteCreate(BaseModel):
    date: Optional[datetime] = None
    item_type: str  # RAW or COOKED
    item_id: str
    quantity: float
    reason: str
    notes: Optional[str] = None

@app.post("/api/productions")
def create_production(data: ProductionCreate):
    conn = get_connection()
    cur = conn.cursor()
    production_date = ensure_wib(data.production_date)

    try:
        if not data.inputs:
            raise HTTPException(
                status_code=400,
                detail="Minimal harus ada 1 bahan baku."
            )

        if not data.outputs:
            raise HTTPException(
                status_code=400,
                detail="Minimal harus ada 1 hasil produksi."
            )

        if data.additional_cost < 0:
            raise HTTPException(
                status_code=400,
                detail="Biaya tambahan tidak boleh negatif."
            )

        # Validasi output
        product_ids = set()
        total_allocation = 0

        for output in data.outputs:
            if output.quantity <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Jumlah hasil produksi harus lebih dari 0."
                )

            if output.allocation_percentage <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Allocation percentage harus lebih dari 0."
                )

            if output.product_id in product_ids:
                raise HTTPException(
                    status_code=400,
                    detail="Produk hasil produksi tidak boleh sama."
                )

            product_ids.add(output.product_id)
            total_allocation += output.allocation_percentage

        # Total alokasi wajib 100%
        if abs(total_allocation - 100) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Total allocation harus 100%. Saat ini {total_allocation}%."
            )

        # ==========================================
        # 1. Ambil dan kunci stok bahan baku
        # ==========================================

        material_cost = 0
        ingredient_stock_data = []

        for item in data.inputs:
            cur.execute(
                """
                SELECT quantity, stock_value, average_cost
                FROM stock_balances
                WHERE ingredient_id = %s
                FOR UPDATE
                """,
                (item.ingredient_id,)
            )

            stock = cur.fetchone()

            if not stock:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stok bahan dengan ID {item.ingredient_id} belum tersedia."
                )

            current_quantity = float(stock[0])
            current_average_cost = float(stock[2])

            if item.quantity <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Jumlah bahan baku harus lebih dari 0."
                )

            if item.quantity > current_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Stok tidak cukup untuk bahan {item.ingredient_id}. "
                        f"Stok tersedia: {current_quantity}, "
                        f"dibutuhkan: {item.quantity}."
                    )
                )

            item_cost = item.quantity * current_average_cost
            material_cost += item_cost

            ingredient_stock_data.append({
                "ingredient_id": item.ingredient_id,
                "unit_id": item.unit_id,
                "quantity": item.quantity,
                "average_cost": current_average_cost,
                "current_quantity": current_quantity,
            })

        total_production_cost = material_cost + data.additional_cost

        # ==========================================
        # 2. Buat production header
        # ==========================================

        cur.execute(
            """
            INSERT INTO production (
                production_date,
                notes,
                total_material_cost,
                additional_cost,
                total_cost
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                production_date,
                data.notes,
                material_cost,
                data.additional_cost,
                total_production_cost,
            )
        )

        production_id = cur.fetchone()[0]

        # ==========================================
        # 3. Simpan bahan yang digunakan
        #    dan kurangi stok bahan baku
        # ==========================================

        for item in ingredient_stock_data:

            item_cost = item["quantity"] * item["average_cost"]

            cur.execute(
                """
                INSERT INTO production_inputs (
                    production_id,
                    ingredient_id,
                    quantity,
                    unit_id,
                    unit_cost,
                    total_cost
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    production_id,
                    item["ingredient_id"],
                    item["quantity"],
                    item["unit_id"],
                    item["average_cost"],
                    item_cost,
                )
            )

            new_quantity = (
                item["current_quantity"]
                - item["quantity"]
            )

            new_stock_value = (
                new_quantity * item["average_cost"]
            )

            cur.execute(
                """
                UPDATE stock_balances
                SET
                    quantity = %s,
                    stock_value = %s,
                    average_cost = %s,
                    updated_at = NOW()
                WHERE ingredient_id = %s
                """,
                (
                    new_quantity,
                    new_stock_value,
                    item["average_cost"],
                    item["ingredient_id"],
                )
            )

            # Stock movement bahan baku
            cur.execute(
                """
                INSERT INTO stock_movements (
                    ingredient_id,
                    movement_type,
                    quantity,
                    unit_id,
                    unit_cost,
                    total_value,
                    reference_type,
                    reference_id,
                    movement_date,
                    notes
                )
                VALUES (
                    %s,
                    'PRODUCTION_USE',
                    %s,
                    %s,
                    %s,
                    %s,
                    'PRODUCTION',
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    item["ingredient_id"],
                    item["quantity"],
                    item["unit_id"],
                    item["average_cost"],
                    item_cost,
                    production_id,
                    production_date,
                    "Penggunaan bahan untuk produksi",
                )
            )

        # ==========================================
        # 4. Simpan hasil produksi
        #    dan alokasi biaya
        # ==========================================

        output_results = []

        for output in data.outputs:

            allocated_cost = (
                total_production_cost
                * output.allocation_percentage
                / 100
            )

            cost_per_unit = (
                allocated_cost / output.quantity
            )

            # production_outputs
            cur.execute(
                """
                INSERT INTO production_outputs (
                    production_id,
                    product_id,
                    quantity,
                    unit_id,
                    cost_per_unit,
                    total_cost
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    production_id,
                    output.product_id,
                    output.quantity,
                    output.unit_id,
                    cost_per_unit,
                    allocated_cost,
                )
            )

            # ======================================
            # Finished goods stock
            # ======================================

            cur.execute(
                """
                SELECT quantity, stock_value, average_cost
                FROM finished_goods_stock
                WHERE product_id = %s
                FOR UPDATE
                """,
                (output.product_id,)
            )

            fg_stock = cur.fetchone()

            if fg_stock:

                old_quantity = float(fg_stock[0])
                old_stock_value = float(fg_stock[1])

                new_quantity = (
                    old_quantity + output.quantity
                )

                new_stock_value = (
                    old_stock_value + allocated_cost
                )

                new_average_cost = (
                    new_stock_value / new_quantity
                    if new_quantity > 0
                    else 0
                )

                cur.execute(
                    """
                    UPDATE finished_goods_stock
                    SET
                        quantity = %s,
                        stock_value = %s,
                        average_cost = %s,
                        updated_at = NOW()
                    WHERE product_id = %s
                    """,
                    (
                        new_quantity,
                        new_stock_value,
                        new_average_cost,
                        output.product_id,
                    )
                )

            else:

                new_average_cost = cost_per_unit

                cur.execute(
                    """
                    INSERT INTO finished_goods_stock (
                        product_id,
                        quantity,
                        stock_value,
                        average_cost,
                        updated_at
                    )
                    VALUES (%s, %s, %s, %s, NOW())
                    """,
                    (
                        output.product_id,
                        output.quantity,
                        allocated_cost,
                        new_average_cost,
                    )
                )

            # ======================================
            # Finished goods movement
            # ======================================

            cur.execute(
                """
                INSERT INTO finished_goods_movements (
                    product_id,
                    movement_type,
                    quantity,
                    unit_id,
                    unit_cost,
                    total_value,
                    reference_type,
                    reference_id,
                    movement_date,
                    notes
                )
                VALUES (
                    %s,
                    'PRODUCTION_IN',
                    %s,
                    %s,
                    %s,
                    %s,
                    'PRODUCTION',
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    output.product_id,
                    output.quantity,
                    output.unit_id,
                    cost_per_unit,
                    allocated_cost,
                    production_id,
                    production_date,
                    "Hasil produksi",
                )
            )

            output_results.append({
                "product_id": output.product_id,
                "quantity": output.quantity,
                "allocation_percentage": output.allocation_percentage,
                "allocated_cost": allocated_cost,
                "cost_per_unit": cost_per_unit,
            })

        # ==========================================
        # 5. Commit seluruh transaksi
        # ==========================================

        conn.commit()

        return {
            "status": "success",
            "message": "Produksi berhasil disimpan.",
            "production_id": str(production_id),
            "total_material_cost": material_cost,
            "additional_cost": data.additional_cost,
            "total_production_cost": total_production_cost,
            "outputs": output_results,
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Gagal menyimpan produksi: {str(e)}"
        )

    finally:
        cur.close()
        conn.close()

@app.get("/api/productions")
def get_productions():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT 
                p.id, 
                p.production_date, 
                p.total_material_cost, 
                p.additional_cost, 
                p.total_cost, 
                p.notes,
                (
                    SELECT json_agg(json_build_object(
                        'id', pi.id,
                        'ingredient_id', pi.ingredient_id,
                        'ingredient_name', i.name,
                        'quantity', pi.quantity,
                        'unit_id', pi.unit_id,
                        'unit_name', u.name,
                        'unit_symbol', u.symbol,
                        'unit_cost', pi.unit_cost,
                        'total_cost', pi.total_cost
                    ))
                    FROM production_inputs pi
                    JOIN ingredients i ON pi.ingredient_id = i.id
                    JOIN units u ON pi.unit_id = u.id
                    WHERE pi.production_id = p.id
                ) AS inputs,
                (
                    SELECT json_agg(json_build_object(
                        'id', po.id,
                        'product_id', po.product_id,
                        'product_name', pr.name,
                        'quantity', po.quantity,
                        'unit_id', po.unit_id,
                        'unit_name', u.name,
                        'unit_symbol', u.symbol,
                        'cost_per_unit', po.cost_per_unit,
                        'total_cost', po.total_cost,
                        'allocation_percentage', CASE 
                            WHEN p.total_cost > 0 THEN ROUND((po.total_cost / p.total_cost * 100)::numeric, 2)
                            ELSE 100 
                        END
                    ))
                    FROM production_outputs po
                    JOIN products pr ON po.product_id = pr.id
                    JOIN units u ON po.unit_id = u.id
                    WHERE po.production_id = p.id
                ) AS outputs
            FROM production p
            ORDER BY p.production_date DESC
        """)
        rows = cur.fetchall()
        productions = []
        for row in rows:
            productions.append({
                "id": str(row[0]),
                "production_date": row[1].isoformat() if row[1] else None,
                "total_material_cost": float(row[2]) if row[2] is not None else 0.0,
                "additional_cost": float(row[3]) if row[3] is not None else 0.0,
                "total_cost": float(row[4]) if row[4] is not None else 0.0,
                "notes": row[5] or "",
                "inputs": row[6] or [],
                "outputs": row[7] or []
            })
        return productions
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil riwayat produksi: {str(e)}"
        )
    finally:
        cur.close()
        conn.close()

@app.get("/api/production/recipe-items")
def get_production_recipe_items():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT 
                i.id AS ingredient_id,
                i.name AS ingredient_name,
                i.stock_unit_id,
                ui.name AS ingredient_unit,
                ui.symbol AS ingredient_symbol,
                COALESCE(sb.quantity, 0) AS current_stock,
                COALESCE(sb.average_cost, 0) AS average_cost,
                p.id AS product_id,
                p.name AS product_name,
                p.selling_unit_id,
                up.name AS product_unit,
                up.symbol AS product_symbol,
                COALESCE(p.selling_price, 0) AS selling_price,
                COALESCE(fgs.quantity, 0) AS cooked_stock,
                COALESCE(fgs.average_cost, 0) AS cooked_average_cost
            FROM ingredients i
            JOIN units ui ON i.stock_unit_id = ui.id
            LEFT JOIN stock_balances sb ON i.id = sb.ingredient_id
            LEFT JOIN products p ON LOWER(TRIM(i.name)) = LOWER(TRIM(p.name))
            LEFT JOIN units up ON p.selling_unit_id = up.id
            LEFT JOIN finished_goods_stock fgs ON p.id = fgs.product_id
            WHERE i.active IS TRUE
            ORDER BY i.name
        """)
        rows = cur.fetchall()
        items = []
        for r in rows:
            items.append({
                "ingredient_id": str(r[0]),
                "ingredient_name": r[1],
                "stock_unit_id": str(r[2]),
                "ingredient_unit": r[3],
                "ingredient_symbol": r[4],
                "current_stock": float(r[5]),
                "average_cost": float(r[6]),
                "product_id": str(r[7]) if r[7] else None,
                "product_name": r[8] if r[8] else r[1],
                "selling_unit_id": str(r[9]) if r[9] else str(r[2]),
                "product_unit": r[10] if r[10] else r[3],
                "product_symbol": r[11] if r[11] else r[4],
                "selling_price": float(r[12]),
                "cooked_stock": float(r[13]),
                "cooked_average_cost": float(r[14])
            })
        return items
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil master resep: {str(e)}"
        )
    finally:
        cur.close()
        conn.close()

@app.get("/api/productions/cost-by-date")
def get_production_cost_by_date(date: date):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT COALESCE(SUM(total_cost), 0), COUNT(*)
            FROM production
            WHERE (production_date AT TIME ZONE 'Asia/Jakarta')::date = %s
        """, (date,))
        row = cur.fetchone()
        return {
            "date": date.isoformat(),
            "production_cost": float(row[0]) if row else 0.0,
            "batch_count": int(row[1]) if row else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil biaya produksi: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.get("/api/productions/{production_id}")
def get_production_detail(production_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT 
                p.id, 
                p.production_date, 
                p.total_material_cost, 
                p.additional_cost, 
                p.total_cost, 
                p.notes,
                (
                    SELECT json_agg(json_build_object(
                        'id', pi.id,
                        'ingredient_id', pi.ingredient_id,
                        'ingredient_name', i.name,
                        'quantity', pi.quantity,
                        'unit_id', pi.unit_id,
                        'unit_name', u.name,
                        'unit_symbol', u.symbol,
                        'unit_cost', pi.unit_cost,
                        'total_cost', pi.total_cost
                    ))
                    FROM production_inputs pi
                    JOIN ingredients i ON pi.ingredient_id = i.id
                    JOIN units u ON pi.unit_id = u.id
                    WHERE pi.production_id = p.id
                ) AS inputs,
                (
                    SELECT json_agg(json_build_object(
                        'id', po.id,
                        'product_id', po.product_id,
                        'product_name', pr.name,
                        'quantity', po.quantity,
                        'unit_id', po.unit_id,
                        'unit_name', u.name,
                        'unit_symbol', u.symbol,
                        'cost_per_unit', po.cost_per_unit,
                        'total_cost', po.total_cost,
                        'allocation_percentage', CASE 
                            WHEN p.total_cost > 0 THEN ROUND((po.total_cost / p.total_cost * 100)::numeric, 2)
                            ELSE 100 
                        END
                    ))
                    FROM production_outputs po
                    JOIN products pr ON po.product_id = pr.id
                    JOIN units u ON po.unit_id = u.id
                    WHERE po.production_id = p.id
                ) AS outputs
            FROM production p
            WHERE p.id = %s
        """, (production_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Data produksi tidak ditemukan")
        return {
            "id": str(row[0]),
            "production_date": row[1].isoformat() if row[1] else None,
            "total_material_cost": float(row[2]) if row[2] is not None else 0.0,
            "additional_cost": float(row[3]) if row[3] is not None else 0.0,
            "total_cost": float(row[4]) if row[4] is not None else 0.0,
            "notes": row[5] or "",
            "inputs": row[6] or [],
            "outputs": row[7] or []
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengambil detail produksi: {str(e)}"
        )
    finally:
        cur.close()
        conn.close()


@app.delete("/api/productions/reset")
def reset_all_productions():
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Hapus inputs & outputs via CASCADE, lalu header produksi
        cur.execute("DELETE FROM production_inputs")
        cur.execute("DELETE FROM production_outputs")
        cur.execute("DELETE FROM production")
        conn.commit()
        return {
            "status": "success",
            "message": "Seluruh data riwayat produksi berhasil dihapus."
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menghapus data produksi: {str(e)}"
        )
    finally:
        cur.close()
        conn.close()


@app.delete("/api/productions/by-date")
def delete_production_by_date(date: date):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            DELETE FROM production_inputs WHERE production_id IN (
                SELECT id FROM production WHERE (production_date AT TIME ZONE 'Asia/Jakarta')::date = %s
            )
        """, (date,))
        cur.execute("""
            DELETE FROM production_outputs WHERE production_id IN (
                SELECT id FROM production WHERE (production_date AT TIME ZONE 'Asia/Jakarta')::date = %s
            )
        """, (date,))
        cur.execute("DELETE FROM production WHERE (production_date AT TIME ZONE 'Asia/Jakarta')::date = %s", (date,))
        conn.commit()
        return {
            "status": "success",
            "message": f"Seluruh data produksi pada tanggal {date} berhasil dihapus."
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus produksi per tanggal: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/production/{production_id}")
@app.delete("/api/productions/{production_id}")
def delete_production_by_id(production_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM stock_movements WHERE reference_type = 'PRODUCTION' AND reference_id = %s", (production_id,))
        cur.execute("DELETE FROM finished_goods_movements WHERE reference_type = 'PRODUCTION' AND reference_id = %s", (production_id,))
        cur.execute("DELETE FROM production_inputs WHERE production_id = %s", (production_id,))
        cur.execute("DELETE FROM production_outputs WHERE production_id = %s", (production_id,))
        cur.execute("DELETE FROM production WHERE id = %s", (production_id,))
        conn.commit()
        return {
            "status": "success",
            "message": "Data batch produksi berhasil dihapus."
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus batch produksi: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.put("/api/production/{production_id}")
@app.put("/api/productions/{production_id}")
def update_production(production_id: str, data: ProductionCreate):
    conn = get_connection()
    cur = conn.cursor()
    production_date = ensure_wib(data.production_date)

    try:
        if not data.inputs:
            raise HTTPException(status_code=400, detail="Minimal harus ada 1 bahan baku.")
        if not data.outputs:
            raise HTTPException(status_code=400, detail="Minimal harus ada 1 hasil produksi.")
        if data.additional_cost < 0:
            raise HTTPException(status_code=400, detail="Biaya tambahan tidak boleh negatif.")

        # Validasi output
        product_ids = set()
        total_allocation = 0
        for output in data.outputs:
            if output.quantity <= 0:
                raise HTTPException(status_code=400, detail="Jumlah hasil produksi harus lebih dari 0.")
            if output.allocation_percentage <= 0:
                raise HTTPException(status_code=400, detail="Allocation percentage harus lebih dari 0.")
            if output.product_id in product_ids:
                raise HTTPException(status_code=400, detail="Produk hasil produksi tidak boleh sama.")
            product_ids.add(output.product_id)
            total_allocation += output.allocation_percentage

        if abs(total_allocation - 100) > 0.05:
            raise HTTPException(status_code=400, detail=f"Total allocation harus 100%. Saat ini {total_allocation}%.")

        # 1. Kunci dan periksa batch produksi lama
        cur.execute("""
            SELECT id, production_date, total_material_cost, additional_cost, total_cost, notes
            FROM production
            WHERE id = %s
            FOR UPDATE;
        """, (production_id,))
        old_prod = cur.fetchone()
        if not old_prod:
            raise HTTPException(status_code=404, detail="Data produksi tidak ditemukan.")

        # 2. Ambil inputs & outputs lama
        cur.execute("""
            SELECT ingredient_id, unit_id, quantity, unit_cost, total_cost
            FROM production_inputs
            WHERE production_id = %s;
        """, (production_id,))
        old_inputs = cur.fetchall()

        cur.execute("""
            SELECT product_id, unit_id, quantity, cost_per_unit, total_cost
            FROM production_outputs
            WHERE production_id = %s;
        """, (production_id,))
        old_outputs = cur.fetchall()

        # 3. Kembalikan stok bahan mentah lama (Revert old inputs)
        for row in old_inputs:
            old_ing_id = str(row[0])
            old_qty = float(row[2])

            cur.execute("""
                SELECT quantity, stock_value, average_cost
                FROM stock_balances
                WHERE ingredient_id = %s
                FOR UPDATE;
            """, (old_ing_id,))
            stock = cur.fetchone()
            if stock:
                curr_q = float(stock[0])
                curr_avg = float(stock[2])

                rev_q = curr_q + old_qty
                rev_v = rev_q * curr_avg
                cur.execute("""
                    UPDATE stock_balances
                    SET quantity = %s, stock_value = %s, updated_at = NOW()
                    WHERE ingredient_id = %s;
                """, (rev_q, rev_v, old_ing_id))

        # 4. Kembalikan/kurangi stok produk matang lama (Revert old outputs)
        for row in old_outputs:
            old_pid = str(row[0])
            old_out_qty = float(row[2])
            old_out_val = float(row[4])

            cur.execute("""
                SELECT quantity, stock_value, average_cost
                FROM finished_goods_stock
                WHERE product_id = %s
                FOR UPDATE;
            """, (old_pid,))
            fg_stock = cur.fetchone()
            if fg_stock:
                curr_fg_q = float(fg_stock[0])
                curr_fg_v = float(fg_stock[1])

                rev_fg_q = max(0.0, curr_fg_q - old_out_qty)
                rev_fg_v = max(0.0, curr_fg_v - old_out_val)
                rev_fg_avg = (rev_fg_v / rev_fg_q) if rev_fg_q > 0 else 0.0

                cur.execute("""
                    UPDATE finished_goods_stock
                    SET quantity = %s, stock_value = %s, average_cost = %s, updated_at = NOW()
                    WHERE product_id = %s;
                """, (rev_fg_q, rev_fg_v, rev_fg_avg, old_pid))

        # 5. Kurangi stok bahan mentah sesuai data baru (Apply new inputs)
        material_cost = 0.0
        ingredient_stock_data = []

        for item in data.inputs:
            if item.quantity <= 0:
                raise HTTPException(status_code=400, detail="Jumlah bahan baku harus lebih dari 0.")

            cur.execute("""
                SELECT quantity, stock_value, average_cost
                FROM stock_balances
                WHERE ingredient_id = %s
                FOR UPDATE;
            """, (item.ingredient_id,))
            stock = cur.fetchone()
            if not stock:
                raise HTTPException(status_code=400, detail=f"Stok bahan dengan ID {item.ingredient_id} belum tersedia.")

            current_quantity = float(stock[0])
            current_average_cost = float(stock[2])

            if item.quantity > current_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stok tidak cukup untuk bahan baku. Tersedia: {current_quantity}, dibutuhkan: {item.quantity}."
                )

            item_cost = item.quantity * current_average_cost
            material_cost += item_cost

            new_quantity = current_quantity - item.quantity
            new_stock_value = new_quantity * current_average_cost

            cur.execute("""
                UPDATE stock_balances
                SET quantity = %s, stock_value = %s, average_cost = %s, updated_at = NOW()
                WHERE ingredient_id = %s;
            """, (new_quantity, new_stock_value, current_average_cost, item.ingredient_id))

            ingredient_stock_data.append({
                "ingredient_id": item.ingredient_id,
                "unit_id": item.unit_id,
                "quantity": item.quantity,
                "average_cost": current_average_cost,
                "total_cost": item_cost
            })

        total_production_cost = material_cost + data.additional_cost

        # 6. Tambahkan stok produk matang sesuai data baru (Apply new outputs)
        output_results = []
        for output in data.outputs:
            allocated_cost = total_production_cost * (output.allocation_percentage / 100.0)
            cost_per_unit = (allocated_cost / output.quantity) if output.quantity > 0 else 0.0

            cur.execute("""
                SELECT quantity, stock_value, average_cost
                FROM finished_goods_stock
                WHERE product_id = %s
                FOR UPDATE;
            """, (output.product_id,))
            fg_stock = cur.fetchone()

            if fg_stock:
                curr_fg_q = float(fg_stock[0])
                curr_fg_v = float(fg_stock[1])

                new_fg_q = curr_fg_q + output.quantity
                new_fg_v = curr_fg_v + allocated_cost
                new_fg_avg = (new_fg_v / new_fg_q) if new_fg_q > 0 else 0.0

                cur.execute("""
                    UPDATE finished_goods_stock
                    SET quantity = %s, stock_value = %s, average_cost = %s, updated_at = NOW()
                    WHERE product_id = %s;
                """, (new_fg_q, new_fg_v, new_fg_avg, output.product_id))
            else:
                cur.execute("""
                    INSERT INTO finished_goods_stock (product_id, quantity, stock_value, average_cost, updated_at)
                    VALUES (%s, %s, %s, %s, NOW());
                """, (output.product_id, output.quantity, allocated_cost, cost_per_unit))

            output_results.append({
                "product_id": output.product_id,
                "unit_id": output.unit_id,
                "quantity": output.quantity,
                "cost_per_unit": cost_per_unit,
                "total_cost": allocated_cost
            })

        # 7. Update header production
        cur.execute("""
            UPDATE production
            SET production_date = %s,
                notes = %s,
                total_material_cost = %s,
                additional_cost = %s,
                total_cost = %s
            WHERE id = %s;
        """, (
            production_date,
            data.notes,
            material_cost,
            data.additional_cost,
            total_production_cost,
            production_id
        ))

        # 8. Replace production_inputs
        cur.execute("DELETE FROM production_inputs WHERE production_id = %s;", (production_id,))
        for item in ingredient_stock_data:
            cur.execute("""
                INSERT INTO production_inputs (
                    production_id, ingredient_id, quantity, unit_id, unit_cost, total_cost
                ) VALUES (%s, %s, %s, %s, %s, %s);
            """, (
                production_id,
                item["ingredient_id"],
                item["quantity"],
                item["unit_id"],
                item["average_cost"],
                item["total_cost"]
            ))

        # 9. Replace production_outputs
        cur.execute("DELETE FROM production_outputs WHERE production_id = %s;", (production_id,))
        for out in output_results:
            cur.execute("""
                INSERT INTO production_outputs (
                    production_id, product_id, quantity, unit_id, cost_per_unit, total_cost
                ) VALUES (%s, %s, %s, %s, %s, %s);
            """, (
                production_id,
                out["product_id"],
                out["quantity"],
                out["unit_id"],
                out["cost_per_unit"],
                out["total_cost"]
            ))

        # 10. Replace stock_movements
        cur.execute("""
            DELETE FROM stock_movements
            WHERE reference_type = 'PRODUCTION' AND reference_id = %s;
        """, (production_id,))
        for item in ingredient_stock_data:
            cur.execute("""
                INSERT INTO stock_movements (
                    ingredient_id, movement_type, quantity, unit_id, unit_cost, total_value,
                    reference_type, reference_id, movement_date, notes
                ) VALUES (
                    %s, 'PRODUCTION_USE', %s, %s, %s, %s,
                    'PRODUCTION', %s, %s, %s
                );
            """, (
                item["ingredient_id"],
                item["quantity"],
                item["unit_id"],
                item["average_cost"],
                item["total_cost"],
                production_id,
                production_date,
                "Penggunaan bahan untuk produksi (diperbarui)"
            ))

        # 11. Replace finished_goods_movements
        cur.execute("""
            DELETE FROM finished_goods_movements
            WHERE reference_type = 'PRODUCTION' AND reference_id = %s;
        """, (production_id,))
        for out in output_results:
            cur.execute("""
                INSERT INTO finished_goods_movements (
                    product_id, movement_type, quantity, unit_id, unit_cost, total_value,
                    reference_type, reference_id, movement_date, notes
                ) VALUES (
                    %s, 'PRODUCTION_IN', %s, %s, %s, %s,
                    'PRODUCTION', %s, %s, %s
                );
            """, (
                out["product_id"],
                out["quantity"],
                out["unit_id"],
                out["cost_per_unit"],
                out["total_cost"],
                production_id,
                production_date,
                "Hasil produksi (diperbarui)"
            ))

        conn.commit()
        return {
            "status": "success",
            "message": "Data produksi berhasil diperbarui",
            "production_id": str(production_id),
            "total_cost": total_production_cost
        }

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal memperbarui produksi: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.post("/api/purchases")
def create_purchase(purchase: PurchaseCreate):
    connection = get_connection()
    purchase_date = ensure_wib(purchase.purchase_date)

    try:
        cursor = connection.cursor()

        if not purchase.items:
            raise ValueError("Minimal harus ada satu item pembelian.")

        total_amount = sum(
            item.quantity * item.unit_price
            for item in purchase.items
        )

        # 1. Simpan header pembelian
        cursor.execute("""
            INSERT INTO purchases (
                purchase_date,
                supplier_name,
                total_amount,
                payment_method,
                notes
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
        """, (
            purchase_date,
            purchase.supplier_name,
            total_amount,
            purchase.payment_method,
            purchase.notes
        ))

        purchase_id = cursor.fetchone()[0]

        # 2. Proses setiap item
        for item in purchase.items:

            subtotal = item.quantity * item.unit_price

            # Simpan purchase_items
            cursor.execute("""
                INSERT INTO purchase_items (
                    purchase_id,
                    ingredient_id,
                    unit_id,
                    quantity,
                    unit_price,
                    subtotal
                )
                VALUES (%s, %s, %s, %s, %s, %s);
            """, (
                purchase_id,
                item.ingredient_id,
                item.unit_id,
                item.quantity,
                item.unit_price,
                subtotal
            ))

            # Ambil stock balance dan kunci barisnya
            cursor.execute("""
                SELECT
                    quantity,
                    stock_value,
                    average_cost
                FROM stock_balances
                WHERE ingredient_id = %s
                FOR UPDATE;
            """, (item.ingredient_id,))

            stock = cursor.fetchone()

            if stock:
                old_quantity = float(stock[0])
                old_value = float(stock[1])

                new_quantity = old_quantity + item.quantity
                new_value = old_value + subtotal
                new_average = new_value / new_quantity

                cursor.execute("""
                    UPDATE stock_balances
                    SET
                        quantity = %s,
                        stock_value = %s,
                        average_cost = %s,
                        updated_at = NOW()
                    WHERE ingredient_id = %s;
                """, (
                    new_quantity,
                    new_value,
                    new_average,
                    item.ingredient_id
                ))

            else:
                new_average = item.unit_price

                cursor.execute("""
                    INSERT INTO stock_balances (
                        ingredient_id,
                        quantity,
                        stock_value,
                        average_cost
                    )
                    VALUES (%s, %s, %s, %s);
                """, (
                    item.ingredient_id,
                    item.quantity,
                    subtotal,
                    new_average
                ))

            # Simpan stock movement
            cursor.execute("""
                INSERT INTO stock_movements (
                    ingredient_id,
                    movement_type,
                    quantity,
                    unit_id,
                    unit_cost,
                    total_value,
                    reference_type,
                    reference_id,
                    movement_date,
                    notes
                )
                VALUES (
                    %s,
                    'PURCHASE',
                    %s,
                    %s,
                    %s,
                    %s,
                    'PURCHASE',
                    %s,
                    %s,
                    %s
                );
            """, (
                item.ingredient_id,
                item.quantity,
                item.unit_id,
                item.unit_price,
                subtotal,
                purchase_id,
                purchase_date,
                purchase.notes
            ))

        # 3. Catat uang keluar
        cursor.execute("""
            INSERT INTO cash_transactions (
                transaction_date,
                type,
                category,
                amount,
                reference_type,
                reference_id,
                payment_method,
                description
            )
            VALUES (
                %s,
                'OUT',
                'PEMBELIAN',
                %s,
                'PURCHASE',
                %s,
                %s,
                %s
            );
        """, (
            purchase_date,
            total_amount,
            purchase_id,
            purchase.payment_method,
            'Pembelian bahan baku'
        ))

        # Semua berhasil
        connection.commit()

        return {
            "status": "success",
            "message": "Pembelian berhasil disimpan",
            "purchase_id": str(purchase_id),
            "total_amount": total_amount
        }

    except Exception as e:
        connection.rollback()

        return {
            "status": "error",
            "message": str(e)
        }

    finally:
        cursor.close()
        connection.close()

@app.get("/api/purchases")
def get_purchases():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT 
                p.id, 
                p.purchase_date, 
                p.supplier_name, 
                p.total_amount, 
                p.payment_method, 
                p.notes,
                (
                    SELECT json_agg(json_build_object(
                        'ingredient_id', pi.ingredient_id,
                        'ingredient_name', i.name,
                        'unit_id', pi.unit_id,
                        'quantity', pi.quantity,
                        'unit_symbol', u.symbol,
                        'unit_price', pi.unit_price,
                        'subtotal', pi.subtotal
                    ))
                    FROM purchase_items pi
                    JOIN ingredients i ON pi.ingredient_id = i.id
                    JOIN units u ON pi.unit_id = u.id
                    WHERE pi.purchase_id = p.id
                ) AS items
            FROM purchases p
            ORDER BY p.purchase_date DESC
            LIMIT 100
        """)
        rows = cur.fetchall()
        purchases = []
        for r in rows:
            purchases.append({
                "id": str(r[0]),
                "purchase_date": r[1].isoformat() if r[1] else None,
                "supplier_name": r[2] or "",
                "total_amount": float(r[3]) if r[3] is not None else 0.0,
                "payment_method": r[4] or "CASH",
                "notes": r[5] or "",
                "items": r[6] or []
            })
        return purchases
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil riwayat pembelian: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.get("/api/purchases/{purchase_id}")
def get_purchase_detail(purchase_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT 
                p.id, 
                p.purchase_date, 
                p.supplier_name, 
                p.total_amount, 
                p.payment_method, 
                p.notes,
                (
                    SELECT json_agg(json_build_object(
                        'ingredient_id', pi.ingredient_id,
                        'ingredient_name', i.name,
                        'unit_id', pi.unit_id,
                        'quantity', pi.quantity,
                        'unit_symbol', u.symbol,
                        'unit_price', pi.unit_price,
                        'subtotal', pi.subtotal
                    ))
                    FROM purchase_items pi
                    JOIN ingredients i ON pi.ingredient_id = i.id
                    JOIN units u ON pi.unit_id = u.id
                    WHERE pi.purchase_id = p.id
                ) AS items
            FROM purchases p
            WHERE p.id = %s
        """, (purchase_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Data pembelian tidak ditemukan")
        return {
            "id": str(row[0]),
            "purchase_date": row[1].isoformat() if row[1] else None,
            "supplier_name": row[2] or "",
            "total_amount": float(row[3]) if row[3] is not None else 0.0,
            "payment_method": row[4] or "CASH",
            "notes": row[5] or "",
            "items": row[6] or []
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data pembelian: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/purchases/by-date")
def delete_purchases_by_date(date: date):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            DELETE FROM cash_transactions WHERE reference_type = 'PURCHASE' AND reference_id IN (
                SELECT id FROM purchases WHERE (purchase_date AT TIME ZONE 'Asia/Jakarta')::date = %s
            )
        """, (date,))
        cur.execute("""
            DELETE FROM stock_movements WHERE reference_type = 'PURCHASE' AND reference_id IN (
                SELECT id FROM purchases WHERE (purchase_date AT TIME ZONE 'Asia/Jakarta')::date = %s
            )
        """, (date,))
        cur.execute("""
            DELETE FROM purchase_items WHERE purchase_id IN (
                SELECT id FROM purchases WHERE (purchase_date AT TIME ZONE 'Asia/Jakarta')::date = %s
            )
        """, (date,))
        cur.execute("DELETE FROM purchases WHERE (purchase_date AT TIME ZONE 'Asia/Jakarta')::date = %s", (date,))
        conn.commit()
        return {
            "status": "success",
            "message": f"Seluruh data pembelian pada tanggal {date} berhasil dihapus."
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus pembelian per tanggal: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/purchases/reset")
def reset_all_purchases():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM purchase_items")
        cur.execute("DELETE FROM cash_transactions WHERE reference_type = 'PURCHASE'")
        cur.execute("DELETE FROM stock_movements WHERE reference_type = 'PURCHASE'")
        cur.execute("DELETE FROM purchases")
        conn.commit()
        return {
            "status": "success",
            "message": "Seluruh riwayat pembelian bahan mentah berhasil dikosongkan."
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mengosongkan riwayat pembelian: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/purchases/{purchase_id}")
def delete_purchase_by_id(purchase_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM purchase_items WHERE purchase_id = %s", (purchase_id,))
        cur.execute("DELETE FROM cash_transactions WHERE reference_type = 'PURCHASE' AND reference_id = %s", (purchase_id,))
        cur.execute("DELETE FROM stock_movements WHERE reference_type = 'PURCHASE' AND reference_id = %s", (purchase_id,))
        cur.execute("DELETE FROM purchases WHERE id = %s", (purchase_id,))
        conn.commit()
        return {
            "status": "success",
            "message": "Data pembelian berhasil dihapus."
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus data pembelian: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.put("/api/purchases/{purchase_id}")
def update_purchase(purchase_id: str, purchase: PurchaseCreate):
    connection = get_connection()
    purchase_date = ensure_wib(purchase.purchase_date)

    try:
        cursor = connection.cursor()

        if not purchase.items:
            raise HTTPException(status_code=400, detail="Minimal harus ada satu item pembelian.")

        for item in purchase.items:
            if item.quantity <= 0:
                raise HTTPException(status_code=400, detail="Kuantitas bahan harus lebih dari 0.")
            if item.unit_price <= 0:
                raise HTTPException(status_code=400, detail="Harga satuan bahan harus lebih dari 0.")

        # 1. Kunci dan periksa header pembelian lama
        cursor.execute("""
            SELECT id, purchase_date, supplier_name, total_amount, payment_method, notes
            FROM purchases
            WHERE id = %s
            FOR UPDATE;
        """, (purchase_id,))
        old_purchase = cursor.fetchone()
        if not old_purchase:
            raise HTTPException(status_code=404, detail="Data pembelian tidak ditemukan.")

        # 2. Ambil data item pembelian lama
        cursor.execute("""
            SELECT ingredient_id, unit_id, quantity, unit_price, subtotal
            FROM purchase_items
            WHERE purchase_id = %s;
        """, (purchase_id,))
        old_item_rows = cursor.fetchall()
        old_items_map = {}
        for row in old_item_rows:
            old_items_map[str(row[0])] = {
                "unit_id": str(row[1]),
                "quantity": float(row[2]),
                "unit_price": float(row[3]),
                "subtotal": float(row[4])
            }

        # 3. Bentuk peta item baru
        new_items_map = {}
        total_amount = 0.0
        for item in purchase.items:
            ing_id = str(item.ingredient_id)
            subtotal = float(item.quantity) * float(item.unit_price)
            total_amount += subtotal
            new_items_map[ing_id] = {
                "unit_id": str(item.unit_id),
                "quantity": float(item.quantity),
                "unit_price": float(item.unit_price),
                "subtotal": subtotal
            }

        # 4. Kumpulkan seluruh ingredient_id yang terdampak (lama & baru)
        all_ing_ids = set(old_items_map.keys()) | set(new_items_map.keys())

        # 5. Sesuaikan stock_balances dan kalkulasi ulang MWA untuk masing-masing bahan
        for ing_id in all_ing_ids:
            cursor.execute("""
                SELECT quantity, stock_value, average_cost
                FROM stock_balances
                WHERE ingredient_id = %s
                FOR UPDATE;
            """, (ing_id,))
            stock = cursor.fetchone()

            old_qty = old_items_map[ing_id]["quantity"] if ing_id in old_items_map else 0.0
            old_sub = old_items_map[ing_id]["subtotal"] if ing_id in old_items_map else 0.0
            new_qty = new_items_map[ing_id]["quantity"] if ing_id in new_items_map else 0.0
            new_sub = new_items_map[ing_id]["subtotal"] if ing_id in new_items_map else 0.0

            delta_qty = new_qty - old_qty
            delta_val = new_sub - old_sub

            if stock:
                curr_qty = float(stock[0])
                curr_val = float(stock[1])

                updated_qty = curr_qty + delta_qty
                if updated_qty < -0.0001:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Perubahan kuantitas menyebabkan stok bahan baku menjadi negatif (stok berjalan: {curr_qty}, selisih: {delta_qty})."
                    )
                updated_qty = max(0.0, updated_qty)
                updated_val = max(0.0, curr_val + delta_val)
                updated_avg = (updated_val / updated_qty) if updated_qty > 0 else 0.0

                cursor.execute("""
                    UPDATE stock_balances
                    SET quantity = %s,
                        stock_value = %s,
                        average_cost = %s,
                        updated_at = NOW()
                    WHERE ingredient_id = %s;
                """, (updated_qty, updated_val, updated_avg, ing_id))
            else:
                if new_qty > 0:
                    cursor.execute("""
                        INSERT INTO stock_balances (ingredient_id, quantity, stock_value, average_cost)
                        VALUES (%s, %s, %s, %s);
                    """, (ing_id, new_qty, new_sub, new_sub / new_qty))

        # 6. Perbarui header purchases
        cursor.execute("""
            UPDATE purchases
            SET purchase_date = %s,
                supplier_name = %s,
                total_amount = %s,
                payment_method = %s,
                notes = %s
            WHERE id = %s;
        """, (
            purchase_date,
            purchase.supplier_name,
            total_amount,
            purchase.payment_method,
            purchase.notes,
            purchase_id
        ))

        # 7. Ganti purchase_items
        cursor.execute("DELETE FROM purchase_items WHERE purchase_id = %s;", (purchase_id,))
        for ing_id, it in new_items_map.items():
            cursor.execute("""
                INSERT INTO purchase_items (
                    purchase_id,
                    ingredient_id,
                    unit_id,
                    quantity,
                    unit_price,
                    subtotal
                )
                VALUES (%s, %s, %s, %s, %s, %s);
            """, (
                purchase_id,
                ing_id,
                it["unit_id"],
                it["quantity"],
                it["unit_price"],
                it["subtotal"]
            ))

        # 8. Ganti stock_movements
        cursor.execute("""
            DELETE FROM stock_movements
            WHERE reference_type = 'PURCHASE' AND reference_id = %s;
        """, (purchase_id,))
        for ing_id, it in new_items_map.items():
            cursor.execute("""
                INSERT INTO stock_movements (
                    ingredient_id,
                    movement_type,
                    quantity,
                    unit_id,
                    unit_cost,
                    total_value,
                    reference_type,
                    reference_id,
                    movement_date,
                    notes
                )
                VALUES (
                    %s,
                    'PURCHASE',
                    %s,
                    %s,
                    %s,
                    %s,
                    'PURCHASE',
                    %s,
                    %s,
                    %s
                );
            """, (
                ing_id,
                it["quantity"],
                it["unit_id"],
                it["unit_price"],
                it["subtotal"],
                purchase_id,
                purchase_date,
                purchase.notes
            ))

        # 9. Perbarui cash_transactions (menyesuaikan saldo kas secara akurat)
        cursor.execute("""
            UPDATE cash_transactions
            SET transaction_date = %s,
                amount = %s,
                payment_method = %s,
                description = %s
            WHERE reference_type = 'PURCHASE' AND reference_id = %s;
        """, (
            purchase_date,
            total_amount,
            purchase.payment_method,
            'Pembelian bahan baku (diperbarui)',
            purchase_id
        ))
        if cursor.rowcount == 0:
            cursor.execute("""
                INSERT INTO cash_transactions (
                    transaction_date,
                    type,
                    category,
                    amount,
                    reference_type,
                    reference_id,
                    payment_method,
                    description
                )
                VALUES (%s, 'OUT', 'PEMBELIAN', %s, 'PURCHASE', %s, %s, %s);
            """, (
                purchase_date,
                total_amount,
                purchase_id,
                purchase.payment_method,
                'Pembelian bahan baku'
            ))

        connection.commit()
        return {
            "status": "success",
            "message": "Pembelian berhasil diperbarui",
            "purchase_id": str(purchase_id),
            "total_amount": total_amount
        }

    except HTTPException:
        connection.rollback()
        raise
    except Exception as e:
        connection.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal memperbarui pembelian: {str(e)}")
    finally:
        cursor.close()
        connection.close()


@app.get("/api/stock/raw-materials")
def get_raw_material_stock():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                i.id AS ingredient_id,
                i.name AS ingredient,
                COALESCE(sb.quantity, 0) AS quantity,
                u.name AS unit,
                u.symbol,
                COALESCE(sb.average_cost, 0) AS average_cost,
                COALESCE(sb.stock_value, 0) AS stock_value,
                i.minimum_stock,
                i.active
            FROM ingredients i
            LEFT JOIN stock_balances sb
                ON i.id = sb.ingredient_id
            JOIN units u
                ON u.id = i.stock_unit_id
            WHERE i.active IS TRUE
            ORDER BY i.name;
        """)

        rows = cursor.fetchall()

        stock = []

        for row in rows:
            stock.append({
                "ingredient_id": str(row[0]),
                "ingredient": row[1],
                "quantity": float(row[2]),
                "unit": row[3],
                "symbol": row[4],
                "average_cost": float(row[5]),
                "stock_value": float(row[6]),
                "minimum_stock": float(row[7]),
                "active": row[8]
            })

        return stock

    finally:
        cursor.close()
        connection.close()

@app.get("/api/stock/finished-goods")
def get_finished_goods_stock():
    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                p.id AS product_id,
                p.name AS product,
                COALESCE(fgs.quantity, 0) AS quantity,
                u.name AS unit,
                u.symbol,
                COALESCE(fgs.average_cost, 0) AS average_cost,
                COALESCE(fgs.stock_value, 0) AS stock_value,
                p.selling_price,
                p.active
            FROM products p
            LEFT JOIN finished_goods_stock fgs
                ON p.id = fgs.product_id
            JOIN units u
                ON u.id = p.selling_unit_id
            WHERE p.active IS TRUE
            ORDER BY p.name;
        """)

        rows = cursor.fetchall()

        stock = []

        for row in rows:
            stock.append({
                "product_id": str(row[0]),
                "product": row[1],
                "quantity": float(row[2]),
                "unit": row[3],
                "symbol": row[4],
                "average_cost": float(row[5]),
                "stock_value": float(row[6]),
                "selling_price": float(row[7]),
                "active": row[8]
            })

        return stock

    finally:
        cursor.close()
        connection.close()

@app.post("/api/sales/lapak")
def create_sale_lapak(data: SaleLapakCreate):
    sale_date = ensure_wib(data.sale_date)

    if not data.items:
        raise HTTPException(
            status_code=400,
            detail="Minimal harus ada satu produk dalam penjualan."
        )

    conn = get_connection()

    try:
        cur = conn.cursor()

        # =========================================================
        # 1. Validasi item dan hitung total
        # =========================================================

        subtotal = 0
        sale_items_data = []

        for item in data.items:

            if item.quantity <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Quantity harus lebih dari 0."
                )

            if item.selling_price < 0:
                raise HTTPException(
                    status_code=400,
                    detail="Harga jual tidak boleh negatif."
                )

            # Ambil stok barang jadi dan HPP rata-rata
            cur.execute(
                """
                SELECT
                    fgs.quantity,
                    fgs.average_cost,
                    p.name
                FROM finished_goods_stock fgs
                JOIN products p
                    ON p.id = fgs.product_id
                WHERE fgs.product_id = %s
                FOR UPDATE
                """,
                (item.product_id,)
            )

            stock = cur.fetchone()

            if not stock:
                raise HTTPException(
                    status_code=400,
                    detail=f"Produk {item.product_id} belum memiliki stok barang jadi."
                )

            current_stock = float(stock[0])
            cost_per_unit = float(stock[1])
            product_name = stock[2]

            # Cek stok cukup
            if current_stock < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Stok {product_name} tidak cukup. "
                        f"Stok tersedia: {current_stock}, "
                        f"permintaan: {item.quantity}."
                    )
                )

            item_subtotal = item.quantity * item.selling_price
            item_total_cost = item.quantity * cost_per_unit
            item_gross_profit = item_subtotal - item_total_cost

            subtotal += item_subtotal

            sale_items_data.append({
                "product_id": item.product_id,
                "product_name": product_name,
                "quantity": item.quantity,
                "selling_price": item.selling_price,
                "subtotal": item_subtotal,
                "cost_per_unit": cost_per_unit,
                "total_cost": item_total_cost,
                "gross_profit": item_gross_profit
            })

        # =========================================================
        # 2. Hitung total transaksi
        # =========================================================

        discount = 0
        platform_fee = 0

        total_gross = subtotal - discount
        total_net = total_gross - platform_fee

        # =========================================================
        # 3. Simpan sales
        # =========================================================

        cur.execute(
            """
            INSERT INTO sales (
                sale_date,
                channel_id,
                subtotal,
                discount,
                platform_fee,
                total_gross,
                total_net,
                payment_method,
                payment_status,
                notes
            )
            SELECT
                %s,
                id,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'PAID',
                %s
            FROM sales_channels
            WHERE name = 'Lapak'
            RETURNING id
            """,
            (
                sale_date,
                subtotal,
                discount,
                platform_fee,
                total_gross,
                total_net,
                data.payment_method,
                data.notes
            )
        )

        sale_result = cur.fetchone()

        if not sale_result:
            raise HTTPException(
                status_code=400,
                detail="Sales channel 'Lapak' tidak ditemukan."
            )

        sale_id = sale_result[0]

        # =========================================================
        # 4. Simpan sale_items dan kurangi stok barang jadi
        # =========================================================

        for item in sale_items_data:

            # Simpan detail penjualan
            cur.execute(
                """
                INSERT INTO sale_items (
                    sale_id,
                    product_id,
                    quantity,
                    selling_price,
                    subtotal,
                    cost_per_unit,
                    total_cost,
                    gross_profit
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    sale_id,
                    item["product_id"],
                    item["quantity"],
                    item["selling_price"],
                    item["subtotal"],
                    item["cost_per_unit"],
                    item["total_cost"],
                    item["gross_profit"]
                )
            )

            # Kurangi finished goods stock
            cur.execute(
                """
                UPDATE finished_goods_stock
                SET
                    quantity = quantity - %s,
                    stock_value = stock_value - %s,
                    updated_at = now()
                WHERE product_id = %s
                """,
                (
                    item["quantity"],
                    item["total_cost"],
                    item["product_id"]
                )
            )

            # Catat movement stok
            cur.execute(
                """
                INSERT INTO finished_goods_movements (
                    product_id,
                    movement_type,
                    quantity,
                    unit_id,
                    unit_cost,
                    total_value,
                    reference_type,
                    reference_id,
                    movement_date,
                    notes
                )
                VALUES (
                    %s,
                    'SALE_OUT',
                    %s,
                    (SELECT selling_unit_id FROM products WHERE id = %s),
                    %s,
                    %s,
                    'SALE',
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    item["product_id"],
                    item["quantity"],
                    item["product_id"],
                    item["cost_per_unit"],
                    item["total_cost"],
                    sale_id,
                    sale_date,
                    "Penjualan Lapak"
                )
            )
            
            
        # =========================================================
        # 5. Catat uang masuk
        # =========================================================

        cur.execute(
            """
            INSERT INTO cash_transactions (
                transaction_date,
                type,
                category,
                amount,
                reference_type,
                reference_id,
                payment_method,
                description
            )
            VALUES (
                %s,
                'IN',
                'PENJUALAN_LAPAK',
                %s,
                'SALE',
                %s,
                %s,
                %s
            )
            """,
            (
                sale_date,
                total_net,
                sale_id,
                data.payment_method,
                "Penerimaan penjualan Lapak"
            )
        )

        # =========================================================
        # 6. Commit
        # =========================================================

        conn.commit()

        return {
            "status": "success",
            "message": "Penjualan Lapak berhasil disimpan.",
            "sale_id": str(sale_id),
            "subtotal": subtotal,
            "total_gross": total_gross,
            "total_net": total_net,
            "items": sale_items_data
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )

    finally:
        conn.close()

@app.get("/api/sales")
def get_sales():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT 
                s.id, 
                s.sale_date, 
                s.total_gross, 
                s.payment_method, 
                s.notes,
                sc.name AS channel_name,
                (
                    SELECT json_agg(json_build_object(
                        'product_id', si.product_id,
                        'product_name', p.name,
                        'quantity', si.quantity,
                        'unit_symbol', u.symbol,
                        'selling_price', si.selling_price,
                        'subtotal', si.subtotal,
                        'cost_per_unit', si.cost_per_unit,
                        'gross_profit', si.gross_profit
                    ))
                    FROM sale_items si
                    JOIN products p ON si.product_id = p.id
                    JOIN units u ON p.selling_unit_id = u.id
                    WHERE si.sale_id = s.id
                ) AS items
            FROM sales s
            LEFT JOIN sales_channels sc ON s.channel_id = sc.id
            ORDER BY s.sale_date DESC
            LIMIT 100
        """)
        rows = cur.fetchall()
        sales_list = []
        for r in rows:
            sales_list.append({
                "id": str(r[0]),
                "sale_date": r[1].isoformat() if r[1] else None,
                "total_amount": float(r[2]) if r[2] is not None else 0.0,
                "payment_method": r[3] or "CASH",
                "notes": r[4] or "",
                "channel_name": r[5] or "Lapak",
                "items": r[6] or []
            })
        return sales_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil riwayat penjualan: {str(e)}")
    finally:
        cur.close()
        conn.close()

@app.post("/api/sales/gofood")
def create_sale_gofood(data: SaleGoFoodCreate):
    sale_date = ensure_wib(data.sale_date)

    if data.gross_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Gross amount harus lebih dari 0."
        )

    if data.platform_fee < 0:
        raise HTTPException(
            status_code=400,
            detail="Platform fee tidak boleh negatif."
        )

    if data.platform_fee > data.gross_amount:
        raise HTTPException(
            status_code=400,
            detail="Platform fee tidak boleh lebih besar dari gross amount."
        )

    # Hitung nilai transaksi
    subtotal = data.gross_amount
    discount = 0
    platform_fee = data.platform_fee

    total_gross = data.gross_amount
    total_net = total_gross - platform_fee

    conn = get_connection()

    try:
        cur = conn.cursor()

        # =========================================================
        # 1. Simpan transaksi GoFood
        # =========================================================

        cur.execute(
            """
            INSERT INTO sales (
                sale_date,
                channel_id,
                subtotal,
                discount,
                platform_fee,
                total_gross,
                total_net,
                payment_method,
                payment_status,
                notes
            )
            SELECT
                %s,
                id,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'PAID',
                %s
            FROM sales_channels
            WHERE name = 'GoFood'
            RETURNING id
            """,
            (
                sale_date,
                subtotal,
                discount,
                platform_fee,
                total_gross,
                total_net,
                data.payment_method,
                data.notes
            )
        )

        sale_result = cur.fetchone()

        if not sale_result:
            raise HTTPException(
                status_code=400,
                detail="Sales channel 'GoFood' tidak ditemukan."
            )

        sale_id = sale_result[0]

        # =========================================================
        # 2. Catat uang masuk
        # =========================================================

        cur.execute(
            """
            INSERT INTO cash_transactions (
                transaction_date,
                type,
                category,
                amount,
                reference_type,
                reference_id,
                payment_method,
                description
            )
            VALUES (
                %s,
                'IN',
                'PENJUALAN_GOFOOD',
                %s,
                'SALE',
                %s,
                %s,
                %s
            )
            """,
            (
                sale_date,
                total_net,
                sale_id,
                data.payment_method,
                "Penerimaan penjualan GoFood"
            )
        )

        # =========================================================
        # 3. Commit
        # =========================================================

        conn.commit()

        return {
            "status": "success",
            "message": "Penjualan GoFood berhasil disimpan.",
            "sale_id": str(sale_id),
            "gross_amount": data.gross_amount,
            "platform_fee": platform_fee,
            "total_net": total_net
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )

    finally:
        conn.close()

@app.post("/api/waste")
def create_waste(data: WasteCreate):
    waste_date = ensure_wib(data.date)

    if data.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity waste harus lebih dari 0."
        )

    if not data.reason.strip():
        raise HTTPException(
            status_code=400,
            detail="Reason wajib diisi."
        )

    conn = get_connection()

    try:
        cur = conn.cursor()

        # =========================================================
        # 1. Ambil stok barang jadi + HPP + unit produk
        # =========================================================

        cur.execute(
            """
            SELECT
                fgs.quantity,
                fgs.average_cost,
                p.name,
                p.selling_unit_id
            FROM finished_goods_stock fgs
            JOIN products p
                ON p.id = fgs.product_id
            WHERE fgs.product_id = %s
            FOR UPDATE
            """,
            (data.product_id,)
        )

        stock = cur.fetchone()

        if not stock:
            raise HTTPException(
                status_code=400,
                detail="Produk belum memiliki stok barang jadi."
            )

        current_stock = float(stock[0])
        cost_per_unit = float(stock[1])
        product_name = stock[2]
        unit_id = stock[3]

        # =========================================================
        # 2. Validasi stok
        # =========================================================

        if current_stock < data.quantity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Stok {product_name} tidak cukup. "
                    f"Stok tersedia: {current_stock}, "
                    f"waste: {data.quantity}."
                )
            )

        # =========================================================
        # 3. Hitung nilai kerugian
        # =========================================================

        total_loss = data.quantity * cost_per_unit

        # =========================================================
        # 4. Simpan waste
        # =========================================================

        cur.execute(
            """
            INSERT INTO waste (
                date,
                product_id,
                quantity,
                unit_id,
                cost_per_unit,
                total_loss,
                reason,
                notes
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            RETURNING id
            """,
            (
                waste_date,
                data.product_id,
                data.quantity,
                unit_id,
                cost_per_unit,
                total_loss,
                data.reason,
                data.notes
            )
        )

        waste_id = cur.fetchone()[0]

        # =========================================================
        # 5. Kurangi finished goods stock
        # =========================================================

        cur.execute(
            """
            UPDATE finished_goods_stock
            SET
                quantity = quantity - %s,
                stock_value = stock_value - %s,
                updated_at = now()
            WHERE product_id = %s
            """,
            (
                data.quantity,
                total_loss,
                data.product_id
            )
        )

        # =========================================================
        # 6. Catat movement WASTE_OUT
        # =========================================================

        cur.execute(
            """
            INSERT INTO finished_goods_movements (
                product_id,
                movement_type,
                quantity,
                unit_id,
                unit_cost,
                total_value,
                reference_type,
                reference_id,
                movement_date,
                notes
            )
            VALUES (
                %s,
                'WASTE_OUT',
                %s,
                %s,
                %s,
                %s,
                'WASTE',
                %s,
                %s,
                %s
            )
            """,
            (
                data.product_id,
                data.quantity,
                unit_id,
                cost_per_unit,
                total_loss,
                waste_id,
                waste_date,
                data.reason
            )
        )

        # =========================================================
        # 7. Commit
        # =========================================================

        conn.commit()

        return {
            "status": "success",
            "message": "Waste berhasil dicatat.",
            "waste_id": str(waste_id),
            "product_id": data.product_id,
            "product_name": product_name,
            "quantity": data.quantity,
            "cost_per_unit": cost_per_unit,
            "total_loss": total_loss,
            "unit_id": str(unit_id)
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )

    finally:
        conn.close()

@app.post("/api/packaging/stock-opname")
def create_packaging_stock_opname(data: PackagingStockOpnameCreate):
    opname_date = ensure_wib(data.opname_date)

    if not data.items:
        raise HTTPException(
            status_code=400,
            detail="Minimal harus ada satu item kemasan."
        )

    conn = get_connection()

    try:
        cur = conn.cursor()

        # =========================================================
        # 1. Buat header stock opname
        # =========================================================

        cur.execute(
            """
            INSERT INTO packaging_stock_opnames (
                opname_date,
                notes
            )
            VALUES (%s, %s)
            RETURNING id
            """,
            (
                opname_date.date(),
                data.notes
            )
        )

        opname_id = cur.fetchone()[0]

        opname_items_result = []

        # =========================================================
        # 2. Proses setiap item kemasan
        # =========================================================

        for item in data.items:

            if item.physical_quantity < 0:
                raise HTTPException(
                    status_code=400,
                    detail="Physical quantity tidak boleh negatif."
                )

            # -----------------------------------------------------
            # Ambil stok sistem + average cost + unit
            # -----------------------------------------------------

            cur.execute(
                """
                SELECT
                    psb.quantity,
                    psb.stock_value,
                    psb.average_cost,
                    pi.name,
                    pi.stock_unit_id
                FROM packaging_stock_balance psb
                JOIN packaging_items pi
                    ON pi.id = psb.packaging_item_id
                WHERE psb.packaging_item_id = %s
                FOR UPDATE
                """,
                (item.packaging_item_id,)
            )

            stock = cur.fetchone()

            if not stock:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Stok kemasan untuk ID "
                        f"{item.packaging_item_id} belum tersedia."
                    )
                )

            system_quantity = float(stock[0])
            average_cost = float(stock[2])
            packaging_name = stock[3]
            unit_id = stock[4]

            # -----------------------------------------------------
            # Hitung selisih
            # -----------------------------------------------------

            physical_quantity = item.physical_quantity

            difference_quantity = (
                physical_quantity - system_quantity
            )

            difference_value = (
                difference_quantity * average_cost
            )

            # -----------------------------------------------------
            # Simpan detail opname
            # -----------------------------------------------------

            cur.execute(
                """
                INSERT INTO packaging_stock_opname_items (
                    opname_id,
                    packaging_item_id,
                    system_quantity,
                    physical_quantity,
                    difference_quantity,
                    unit_cost,
                    difference_value,
                    notes
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    opname_id,
                    item.packaging_item_id,
                    system_quantity,
                    physical_quantity,
                    difference_quantity,
                    average_cost,
                    difference_value,
                    item.notes
                )
            )

            # -----------------------------------------------------
            # Tidak ada perubahan stok jika selisih = 0
            # -----------------------------------------------------

            if difference_quantity == 0:
                opname_items_result.append({
                    "packaging_item_id": item.packaging_item_id,
                    "packaging_name": packaging_name,
                    "system_quantity": system_quantity,
                    "physical_quantity": physical_quantity,
                    "difference_quantity": difference_quantity,
                    "unit_cost": average_cost,
                    "difference_value": difference_value
                })

                continue

            # -----------------------------------------------------
            # Update packaging stock balance
            # -----------------------------------------------------

            new_quantity = physical_quantity
            new_stock_value = physical_quantity * average_cost

            cur.execute(
                """
                UPDATE packaging_stock_balance
                SET
                    quantity = %s,
                    stock_value = %s,
                    updated_at = now()
                WHERE packaging_item_id = %s
                """,
                (
                    new_quantity,
                    new_stock_value,
                    item.packaging_item_id
                )
            )

            # -----------------------------------------------------
            # Tentukan movement type
            # -----------------------------------------------------

            if difference_quantity > 0:
                movement_type = "STOCKTAKE_IN"
                movement_quantity = difference_quantity
            else:
                movement_type = "STOCKTAKE_OUT"
                movement_quantity = abs(difference_quantity)

            # -----------------------------------------------------
            # Catat packaging movement
            # -----------------------------------------------------

            cur.execute(
                """
                INSERT INTO packaging_movements (
                    packaging_item_id,
                    movement_type,
                    quantity,
                    unit_id,
                    unit_cost,
                    total_value,
                    reference_type,
                    reference_id,
                    movement_date,
                    notes
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    'STOCKTAKE',
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    item.packaging_item_id,
                    movement_type,
                    movement_quantity,
                    unit_id,
                    average_cost,
                    abs(difference_value),
                    opname_id,
                    opname_date,
                    item.notes
                )
            )

            opname_items_result.append({
                "packaging_item_id": item.packaging_item_id,
                "packaging_name": packaging_name,
                "system_quantity": system_quantity,
                "physical_quantity": physical_quantity,
                "difference_quantity": difference_quantity,
                "unit_cost": average_cost,
                "difference_value": difference_value,
                "movement_type": movement_type
            })

        # =========================================================
        # 3. Commit
        # =========================================================

        conn.commit()

        return {
            "status": "success",
            "message": "Stock opname kemasan berhasil disimpan.",
            "opname_id": str(opname_id),
            "opname_date": data.opname_date,
            "items": opname_items_result
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )

    finally:
        conn.close()

@app.post("/api/expenses")
def create_expense(data: ExpenseCreate):

    # =========================================================
    # 1. Validasi input
    # =========================================================

    if data.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Amount harus lebih dari 0."
        )

    if data.allocation_percentage < 0 or data.allocation_percentage > 100:
        raise HTTPException(
            status_code=400,
            detail="Allocation percentage harus antara 0 sampai 100."
        )

    conn = get_connection()

    try:
        cur = conn.cursor()

        # =========================================================
        # 2. Pastikan kategori expense tersedia
        # =========================================================

        cur.execute(
            """
            SELECT id, name
            FROM expense_categories
            WHERE id = %s
            """,
            (data.category_id,)
        )

        category = cur.fetchone()

        if not category:
            raise HTTPException(
                status_code=400,
                detail="Kategori expense tidak ditemukan."
            )

        category_id = category[0]
        category_name = category[1]

        # =========================================================
        # 3. Hitung business amount
        # =========================================================

        if data.is_business:
            business_amount = (
                data.amount *
                data.allocation_percentage /
                100
            )
        else:
            business_amount = 0

        # =========================================================
        # 4. Simpan ke expenses
        # =========================================================

        cur.execute(
            """
            INSERT INTO expenses (
                expense_date,
                category_id,
                amount,
                payment_method,
                is_business,
                allocation_percentage,
                business_amount,
                description,
                expense_location
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            RETURNING id
            """,
            (
                data.expense_date,
                category_id,
                data.amount,
                data.payment_method,
                data.is_business,
                data.allocation_percentage,
                business_amount,
                data.description,
                data.expense_location
            )
        )

        expense_id = cur.fetchone()[0]

        # =========================================================
        # 5. Catat cash out
        # =========================================================
        tx_date = get_now() if data.expense_date == get_today() else datetime.combine(data.expense_date, datetime.min.time()).replace(tzinfo=JAKARTA_TZ)

        cur.execute(
            """
            INSERT INTO cash_transactions (
                transaction_date,
                type,
                category,
                amount,
                reference_type,
                reference_id,
                payment_method,
                description
            )
            VALUES (
                %s,
                'OUT',
                'PENGELUARAN',
                %s,
                'EXPENSE',
                %s,
                %s,
                %s
            )
            """,
            (
                tx_date,
                data.amount,
                expense_id,
                data.payment_method,
                data.description
            )
        )

        # =========================================================
        # 6. Commit
        # =========================================================

        conn.commit()

        return {
            "status": "success",
            "message": "Pengeluaran berhasil dicatat.",
            "expense_id": str(expense_id),
            "category": category_name,
            "amount": data.amount,
            "is_business": data.is_business,
            "allocation_percentage": data.allocation_percentage,
            "business_amount": business_amount,
            "payment_method": data.payment_method,
            "expense_location": data.expense_location
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        print("====================================")
        print("ERROR POST /api/expenses")
        print(repr(e))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )

    finally:
        conn.close()

@app.post("/api/packaging/purchases")
def create_packaging_purchase(data: PackagingPurchaseCreate):
    purchase_date = ensure_wib(data.purchase_date)

    # =========================================================
    # 1. Validasi input
    # =========================================================

    if not data.items:
        raise HTTPException(
            status_code=400,
            detail="Minimal harus ada 1 item kemasan."
        )

    for item in data.items:
        if item.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Quantity harus lebih dari 0."
            )

        if item.unit_price < 0:
            raise HTTPException(
                status_code=400,
                detail="Unit price tidak boleh negatif."
            )

    conn = get_connection()

    try:
        cur = conn.cursor()

        # =========================================================
        # 2. Hitung total pembelian
        # =========================================================

        total_amount = 0

        for item in data.items:
            subtotal = item.quantity * item.unit_price
            total_amount += subtotal

        # =========================================================
        # 3. Simpan header pembelian
        # =========================================================

        cur.execute(
            """
            INSERT INTO packaging_purchases (
                purchase_date,
                supplier_name,
                total_amount,
                payment_method,
                notes
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s
            )
            RETURNING id
            """,
            (
                purchase_date,
                data.supplier_name,
                total_amount,
                data.payment_method,
                data.notes
            )
        )

        purchase_id = cur.fetchone()[0]

        result_items = []

        # =========================================================
        # 4. Proses setiap item
        # =========================================================

        for item in data.items:

            subtotal = item.quantity * item.unit_price

            # -----------------------------------------------------
            # Validasi packaging item
            # -----------------------------------------------------

            cur.execute(
                """
                SELECT id, name
                FROM packaging_items
                WHERE id = %s
                """,
                (item.packaging_item_id,)
            )

            packaging = cur.fetchone()

            if not packaging:
                raise HTTPException(
                    status_code=400,
                    detail=f"Packaging item tidak ditemukan: {item.packaging_item_id}"
                )

            packaging_id = packaging[0]
            packaging_name = packaging[1]

            # -----------------------------------------------------
            # Validasi unit
            # -----------------------------------------------------

            cur.execute(
                """
                SELECT id, name
                FROM units
                WHERE id = %s
                """,
                (item.unit_id,)
            )

            unit = cur.fetchone()

            if not unit:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unit tidak ditemukan: {item.unit_id}"
                )

            unit_id = unit[0]
            unit_name = unit[1]

            # -----------------------------------------------------
            # Simpan purchase item
            # -----------------------------------------------------

            cur.execute(
                """
                INSERT INTO packaging_purchase_items (
                    purchase_id,
                    packaging_item_id,
                    unit_id,
                    quantity,
                    unit_price,
                    subtotal
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    purchase_id,
                    packaging_id,
                    unit_id,
                    item.quantity,
                    item.unit_price,
                    subtotal
                )
            )

            # -----------------------------------------------------
            # Ambil stok lama dan lock row
            # -----------------------------------------------------

            cur.execute(
                """
                SELECT
                    quantity,
                    stock_value,
                    average_cost
                FROM packaging_stock_balance
                WHERE packaging_item_id = %s
                FOR UPDATE
                """,
                (packaging_id,)
            )

            old_stock = cur.fetchone()

            # -----------------------------------------------------
            # Hitung moving weighted average
            # -----------------------------------------------------

            if old_stock:
                old_quantity = float(old_stock[0])
                old_stock_value = float(old_stock[1])

                new_quantity = old_quantity + item.quantity
                new_stock_value = old_stock_value + subtotal

                if new_quantity > 0:
                    new_average_cost = (
                        new_stock_value / new_quantity
                    )
                else:
                    new_average_cost = 0

                # Update stock
                cur.execute(
                    """
                    UPDATE packaging_stock_balance
                    SET
                        quantity = %s,
                        stock_value = %s,
                        average_cost = %s,
                        updated_at = now()
                    WHERE packaging_item_id = %s
                    """,
                    (
                        new_quantity,
                        new_stock_value,
                        new_average_cost,
                        packaging_id
                    )
                )

            else:
                new_quantity = item.quantity
                new_stock_value = subtotal

                if item.quantity > 0:
                    new_average_cost = (
                        subtotal / item.quantity
                    )
                else:
                    new_average_cost = 0

                # Insert stock baru
                cur.execute(
                    """
                    INSERT INTO packaging_stock_balance (
                        packaging_item_id,
                        quantity,
                        stock_value,
                        average_cost
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s
                    )
                    """,
                    (
                        packaging_id,
                        new_quantity,
                        new_stock_value,
                        new_average_cost
                    )
                )

            # -----------------------------------------------------
            # Simpan movement PURCHASE
            # -----------------------------------------------------

            cur.execute(
                """
                INSERT INTO packaging_movements (
                    packaging_item_id,
                    movement_type,
                    quantity,
                    unit_id,
                    unit_cost,
                    total_value,
                    reference_type,
                    reference_id,
                    movement_date,
                    notes
                )
                VALUES (
                    %s,
                    'PURCHASE',
                    %s,
                    %s,
                    %s,
                    %s,
                    'PACKAGING_PURCHASE',
                    %s,
                    %s,
                    %s
                )
                """,
                (
                    packaging_id,
                    item.quantity,
                    unit_id,
                    item.unit_price,
                    subtotal,
                    purchase_id,
                    purchase_date,
                    data.notes
                )
            )

            result_items.append({
                "packaging_item_id": str(packaging_id),
                "packaging_name": packaging_name,
                "unit_id": str(unit_id),
                "unit_name": unit_name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "subtotal": subtotal,
                "average_cost_after_purchase": new_average_cost
            })

        # =========================================================
        # 5. Catat cash OUT
        # =========================================================

        cur.execute(
            """
            INSERT INTO cash_transactions (
                transaction_date,
                type,
                category,
                amount,
                reference_type,
                reference_id,
                payment_method,
                description
            )
            VALUES (
                %s,
                'OUT',
                'PEMBELIAN_KEMASAN',
                %s,
                'PACKAGING_PURCHASE',
                %s,
                %s,
                %s
            )
            """,
            (
                purchase_date,
                total_amount,
                purchase_id,
                data.payment_method,
                data.notes
            )
        )

        # =========================================================
        # 6. Commit
        # =========================================================

        conn.commit()

        return {
            "status": "success",
            "message": "Pembelian kemasan berhasil dicatat.",
            "purchase_id": str(purchase_id),
            "purchase_date": data.purchase_date,
            "supplier_name": data.supplier_name,
            "total_amount": total_amount,
            "payment_method": data.payment_method,
            "items": result_items
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as e:
        conn.rollback()

        print("====================================")
        print("ERROR POST /api/packaging/purchases")
        print(repr(e))
        print("====================================")

        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )

    finally:
        conn.close()

@app.get("/api/dashboard/summary")
def get_dashboard_summary(
    start_date: date,
    end_date: date
):
    conn = get_connection()
    cur = conn.cursor()

    try:
        # =========================
        # 1. SALES SUMMARY
        # =========================
        cur.execute("""
            SELECT
                COUNT(*) AS transaction_count,
                COALESCE(SUM(total_gross), 0) AS total_gross,
                COALESCE(SUM(platform_fee), 0) AS total_platform_fee,
                COALESCE(SUM(total_net), 0) AS total_net
            FROM sales
            WHERE (sale_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s
        """, (start_date, end_date))

        sales = cur.fetchone()

        transaction_count = sales[0]
        total_gross = float(sales[1])
        total_platform_fee = float(sales[2])
        total_net = float(sales[3])

        # =========================
        # 2. HPP LAPAK
        # =========================
        cur.execute("""
            SELECT
                COALESCE(SUM(si.total_cost), 0)
            FROM sales s
            JOIN sale_items si
                ON si.sale_id = s.id
            WHERE (s.sale_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s
        """, (start_date, end_date))

        total_hpp_lapak = float(cur.fetchone()[0])

        # =========================
        # 3. OPERATIONAL EXPENSE
        # =========================
        cur.execute("""
            SELECT
                COALESCE(SUM(business_amount), 0)
            FROM expenses
            WHERE expense_date BETWEEN %s AND %s
              AND is_business = TRUE
        """, (start_date, end_date))

        total_operational_expense = float(cur.fetchone()[0])

        # =========================
        # 4. WASTE
        # =========================
        cur.execute("""
            SELECT
                COALESCE(SUM(total_loss), 0)
            FROM waste
            WHERE (date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s
        """, (start_date, end_date))

        total_waste_loss = float(cur.fetchone()[0])

        # =========================
        # 5. CASH FLOW
        # =========================
        cur.execute("""
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'IN' THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS cash_in,

                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'OUT' THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS cash_out

            FROM cash_transactions
            WHERE (transaction_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s
        """, (start_date, end_date))

        cash = cur.fetchone()

        cash_in = float(cash[0])
        cash_out = float(cash[1])

        # =========================
        # 6. RESPONSE
        # =========================
        return {
            "status": "success",
            "period": {
                "start_date": str(start_date),
                "end_date": str(end_date)
            },

            "sales": {
                "transaction_count": transaction_count,
                "total_gross": total_gross,
                "total_platform_fee": total_platform_fee,
                "total_net": total_net,
                "total_hpp_lapak": total_hpp_lapak
            },

            "expenses": {
                "operational": total_operational_expense,
                "waste": total_waste_loss
            },

            "cash_flow": {
                "cash_in": cash_in,
                "cash_out": cash_out,
                "cash_net": cash_in - cash_out
            }
        }

    except Exception as e:
        print("================================")
        print("ERROR GET /api/dashboard/summary")
        print(repr(e))
        print("================================")

        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )

    finally:
        cur.close()
        conn.close()

@app.get("/api/reports/sales")
def sales_report(
    start_date: date,
    end_date: date
):
    conn = get_connection()

    try:
        cur = conn.cursor()

        # ==============================
        # RINGKASAN PENJUALAN PER CHANNEL
        # ==============================
        cur.execute(
            """
            WITH sales_summary AS (
                SELECT
                    sc.id AS channel_id,
                    sc.name AS channel_name,
                    COUNT(s.id) AS transaction_count,
                    COALESCE(SUM(s.total_gross), 0) AS total_gross,
                    COALESCE(SUM(s.platform_fee), 0) AS total_platform_fee,
                    COALESCE(SUM(s.total_net), 0) AS total_net
                FROM sales s
                JOIN sales_channels sc
                    ON sc.id = s.channel_id
                WHERE (s.sale_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s
                GROUP BY sc.id, sc.name
            ),

            hpp_summary AS (
                SELECT
                    s.channel_id,
                    COALESCE(SUM(si.total_cost), 0) AS total_hpp
                FROM sales s
                LEFT JOIN sale_items si
                    ON si.sale_id = s.id
                WHERE (s.sale_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s
                GROUP BY s.channel_id
            )

            SELECT
                ss.channel_name,
                ss.transaction_count,
                ss.total_gross,
                ss.total_platform_fee,
                ss.total_net,
                COALESCE(hs.total_hpp, 0) AS total_hpp
            FROM sales_summary ss
            LEFT JOIN hpp_summary hs
                ON hs.channel_id = ss.channel_id
            ORDER BY ss.channel_name;
            """,
            (start_date, end_date, start_date, end_date)
        )

        rows = cur.fetchall()

        channels = []

        total_transactions = 0
        total_gross = 0
        total_platform_fee = 0
        total_net = 0
        total_hpp = 0

        for row in rows:
            channel = {
                "channel_name": row[0],
                "transaction_count": row[1],
                "total_gross": float(row[2]),
                "total_platform_fee": float(row[3]),
                "total_net": float(row[4]),
                "total_hpp": float(row[5])
            }

            channels.append(channel)

            total_transactions += row[1]
            total_gross += float(row[2])
            total_platform_fee += float(row[3])
            total_net += float(row[4])
            total_hpp += float(row[5])

        return {
            "status": "success",
            "period": {
                "start_date": str(start_date),
                "end_date": str(end_date)
            },
            "summary": {
                "transaction_count": total_transactions,
                "total_gross": total_gross,
                "total_platform_fee": total_platform_fee,
                "total_net": total_net,
                "total_hpp": total_hpp
            },
            "channels": channels
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )

    finally:
        conn.close()

@app.get("/api/reports/profit-loss")
def profit_loss_report(
    start_date: date,
    end_date: date
):
    conn = get_connection()

    try:
        cur = conn.cursor()

        # ==========================================
        # PENJUALAN
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE(SUM(s.total_gross), 0) AS total_gross,
                COALESCE(SUM(s.platform_fee), 0) AS total_platform_fee,
                COALESCE(SUM(s.total_net), 0) AS total_net
            FROM sales s
            WHERE (s.sale_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s;
            """,
            (start_date, end_date)
        )

        sales_row = cur.fetchone()

        total_gross = float(sales_row[0])
        total_platform_fee = float(sales_row[1])
        total_net = float(sales_row[2])

        # ==========================================
        # HPP LAPAK
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE(SUM(si.total_cost), 0)
            FROM sale_items si
            JOIN sales s
                ON s.id = si.sale_id
            JOIN sales_channels sc
                ON sc.id = s.channel_id
            WHERE (s.sale_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s
              AND sc.name = 'Lapak';
            """,
            (start_date, end_date)
        )

        hpp_lapak = float(cur.fetchone()[0])

        # ==========================================
        # BIAYA OPERASIONAL
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE(SUM(e.business_amount), 0)
            FROM expenses e
            WHERE e.expense_date BETWEEN %s AND %s
              AND e.is_business = TRUE;
            """,
            (start_date, end_date)
        )

        operational_expense = float(cur.fetchone()[0])

        # ==========================================
        # WASTE / KERUGIAN PRODUK
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE(SUM(w.total_loss), 0)
            FROM waste w
            WHERE (w.date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s;
            """,
            (start_date, end_date)
        )

        waste_loss = float(cur.fetchone()[0])

        # ==========================================
        # PERHITUNGAN
        # ==========================================

        # Laba kotor yang dapat dihitung
        gross_profit_known = total_net - hpp_lapak

        # Hasil setelah biaya operasional dan waste
        result_known = (
            gross_profit_known
            - operational_expense
            - waste_loss
        )

        return {
            "status": "success",

            "period": {
                "start_date": str(start_date),
                "end_date": str(end_date)
            },

            "revenue": {
                "total_gross": total_gross,
                "total_platform_fee": total_platform_fee,
                "total_net": total_net
            },

            "cost_of_goods_sold": {
                "hpp_lapak": hpp_lapak,
                "hpp_gofood": None,
                "hpp_gofood_status": "Belum dihitung karena GoFood dicatat secara agregat"
            },

            "gross_profit": {
                "known_gross_profit": gross_profit_known
            },

            "expenses": {
                "operational_expense": operational_expense,
                "waste_loss": waste_loss
            },

            "result": {
                "known_result": result_known,
                "note": "Hasil ini belum memperhitungkan HPP GoFood karena transaksi GoFood tidak memiliki detail produk."
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )

    finally:
        conn.close()

@app.get("/api/dashboard")
def dashboard():
    conn = get_connection()

    try:
        cur = conn.cursor()

        # ==========================================
        # TANGGAL
        # ==========================================
        today = get_today()
        first_day_of_month = today.replace(day=1)

        # ==========================================
        # PENJUALAN HARI INI
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE(SUM(s.total_gross), 0) + COALESCE((SELECT SUM(df.omset) FROM daily_finance df WHERE df.entry_date = %s), 0),
                COALESCE(SUM(s.platform_fee), 0),
                COALESCE(SUM(s.total_net), 0) + COALESCE((SELECT SUM(df.omset) FROM daily_finance df WHERE df.entry_date = %s), 0),
                COUNT(s.id) + COALESCE((SELECT COUNT(df.id) FROM daily_finance df WHERE df.entry_date = %s AND df.omset > 0), 0)
            FROM sales s
            WHERE (s.sale_date AT TIME ZONE 'Asia/Jakarta')::date = %s;
            """,
            (today, today, today, today)
        )

        sales_today = cur.fetchone()

        # ==========================================
        # PENJUALAN BULAN INI
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE(SUM(s.total_gross), 0) + COALESCE((SELECT SUM(df.omset) FROM daily_finance df WHERE df.entry_date BETWEEN %s AND %s), 0),
                COALESCE(SUM(s.platform_fee), 0),
                COALESCE(SUM(s.total_net), 0) + COALESCE((SELECT SUM(df.omset) FROM daily_finance df WHERE df.entry_date BETWEEN %s AND %s), 0),
                COUNT(s.id) + COALESCE((SELECT COUNT(df.id) FROM daily_finance df WHERE df.entry_date BETWEEN %s AND %s AND df.omset > 0), 0)
            FROM sales s
            WHERE (s.sale_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s;
            """,
            (first_day_of_month, today, first_day_of_month, today, first_day_of_month, today, first_day_of_month, today)
        )

        sales_month = cur.fetchone()

        # ==========================================
        # PENGELUARAN HARI INI
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE((SELECT SUM(business_amount) FROM expenses WHERE expense_date = %s AND is_business = TRUE), 0) +
                COALESCE((SELECT SUM(total_amount) FROM purchases WHERE (purchase_date AT TIME ZONE 'Asia/Jakarta')::date = %s), 0) +
                COALESCE((SELECT SUM(total_amount) FROM packaging_purchases WHERE (purchase_date AT TIME ZONE 'Asia/Jakarta')::date = %s), 0);
            """,
            (today, today, today)
        )

        expense_today = float(cur.fetchone()[0])

        # ==========================================
        # PENGELUARAN BULAN INI
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE((SELECT SUM(business_amount) FROM expenses WHERE expense_date BETWEEN %s AND %s AND is_business = TRUE), 0) +
                COALESCE((SELECT SUM(total_amount) FROM purchases WHERE (purchase_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s), 0) +
                COALESCE((SELECT SUM(total_amount) FROM packaging_purchases WHERE (purchase_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s), 0);
            """,
            (first_day_of_month, today, first_day_of_month, today, first_day_of_month, today)
        )

        expense_month = float(cur.fetchone()[0])

        # ==========================================
        # WASTE BULAN INI
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE(SUM(total_loss), 0)
            FROM waste
            WHERE (date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s;
            """,
            (first_day_of_month, today)
        )

        waste_month = float(cur.fetchone()[0])

        # ==========================================
        # CASH FLOW HARI INI
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'IN' THEN amount
                            ELSE 0
                        END
                    ), 0
                ) AS cash_in,

                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'OUT' THEN amount
                            ELSE 0
                        END
                    ), 0
                ) AS cash_out
            FROM cash_transactions
            WHERE (transaction_date AT TIME ZONE 'Asia/Jakarta')::date = %s;
            """,
            (today,)
        )

        cash_today = cur.fetchone()

        # ==========================================
        # CASH FLOW BULAN INI
        # ==========================================
        cur.execute(
            """
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'IN' THEN amount
                            ELSE 0
                        END
                    ), 0
                ) AS cash_in,

                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'OUT' THEN amount
                            ELSE 0
                        END
                    ), 0
                ) AS cash_out
            FROM cash_transactions
            WHERE (transaction_date AT TIME ZONE 'Asia/Jakarta')::date BETWEEN %s AND %s;
            """,
            (first_day_of_month, today)
        )

        cash_month = cur.fetchone()

        # ==========================================
        # SALDO KAS KESELURUHAN (MURNI DINAMIS)
        # ==========================================
        # Dihitung murni berdasarkan (Total Penjualan aktual - Total Pengeluaran/Pembelian aktual).
        # Jika belum ada transaksi sama sekali, saldo kas bernilai 0.0.
        cur.execute(
            """
            SELECT
                -- Total Penjualan Aktual (sales.total_net + daily_finance.omset)
                (
                    COALESCE((SELECT SUM(total_net) FROM sales), 0) +
                    COALESCE((SELECT SUM(omset) FROM daily_finance), 0)
                ) AS total_actual_sales,
                -- Total Pengeluaran & Pembelian Aktual (purchases + expenses + packaging_purchases)
                (
                    COALESCE((SELECT SUM(total_amount) FROM purchases), 0) +
                    COALESCE((SELECT SUM(business_amount) FROM expenses WHERE is_business = TRUE), 0) +
                    COALESCE((SELECT SUM(total_amount) FROM packaging_purchases), 0)
                ) AS total_actual_expenses;
            """
        )

        cash_summary = cur.fetchone()
        total_actual_sales = float(cash_summary[0]) if cash_summary else 0.0
        total_actual_expenses = float(cash_summary[1]) if cash_summary else 0.0

        cash_balance = float(total_actual_sales - total_actual_expenses)

        # ==========================================
        # STOK BAHAN BAKU
        # ==========================================
        cur.execute(
            """
            SELECT
                i.id,
                i.name,
                sb.quantity,
                sb.stock_value,
                sb.average_cost
            FROM stock_balances sb
            JOIN ingredients i
                ON i.id = sb.ingredient_id
            ORDER BY i.name;
            """
        )

        raw_stock_rows = cur.fetchall()

        raw_stock = []

        for row in raw_stock_rows:
            raw_stock.append({
                "ingredient_id": str(row[0]),
                "ingredient_name": row[1],
                "quantity": float(row[2]),
                "stock_value": float(row[3]),
                "average_cost": float(row[4])
            })

        # ==========================================
        # STOK PRODUK JADI
        # ==========================================
        cur.execute(
            """
            SELECT
                p.id,
                p.name,
                fgs.quantity,
                fgs.stock_value,
                fgs.average_cost
            FROM finished_goods_stock fgs
            JOIN products p
                ON p.id = fgs.product_id
            ORDER BY p.name;
            """
        )

        finished_stock_rows = cur.fetchall()

        finished_stock = []

        for row in finished_stock_rows:
            finished_stock.append({
                "product_id": str(row[0]),
                "product_name": row[1],
                "quantity": float(row[2]),
                "stock_value": float(row[3]),
                "average_cost": float(row[4])
            })

        # ==========================================
        # HASIL CASH FLOW
        # ==========================================
        cash_today_in = float(cash_today[0])
        cash_today_out = float(cash_today[1])

        cash_month_in = float(cash_month[0])
        cash_month_out = float(cash_month[1])

        return {
            "status": "success",

            "date": str(today),

            "today": {
                "sales": {
                    "transaction_count": sales_today[3],
                    "total_gross": float(sales_today[0]),
                    "total_platform_fee": float(sales_today[1]),
                    "total_net": float(sales_today[2])
                },

                "expenses": {
                    "total": expense_today
                },

                "cash_flow": {
                    "cash_in": cash_today_in,
                    "cash_out": cash_today_out,
                    "cash_net": cash_today_in - cash_today_out
                }
            },

            "current_month": {
                "start_date": str(first_day_of_month),
                "end_date": str(today),

                "sales": {
                    "transaction_count": sales_month[3],
                    "total_gross": float(sales_month[0]),
                    "total_platform_fee": float(sales_month[1]),
                    "total_net": float(sales_month[2])
                },

                "expenses": {
                    "total": expense_month
                },

                "waste": {
                    "total_loss": waste_month
                },

                "cash_flow": {
                    "cash_in": cash_month_in,
                    "cash_out": cash_month_out,
                    "cash_net": cash_month_in - cash_month_out
                }
            },

            "cash_balance": cash_balance,

            "stock": {
                "raw_materials": raw_stock,
                "finished_goods": finished_stock
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )

    finally:
        conn.close()


# =====================================================================
# MODAL (CAPITAL) ENDPOINTS
# =====================================================================
@app.post("/api/modal")
def create_modal_entry(data: ModalCreate):
    conn = get_connection()
    cur = conn.cursor()
    try:
        # Cek apakah sudah ada modal untuk entry_date ini
        cur.execute("SELECT id FROM daily_modal WHERE entry_date = %s", (data.entry_date,))
        existing = cur.fetchone()
        if existing:
            cur.execute("""
                UPDATE daily_modal
                SET production_cost = %s,
                    operational_cost = %s,
                    total_modal = %s,
                    notes = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING id, entry_date, production_cost, operational_cost, total_modal, notes, created_at;
            """, (data.production_cost, data.operational_cost, data.total_modal, data.notes, existing[0]))
        else:
            cur.execute("""
                INSERT INTO daily_modal (
                    entry_date, production_cost, operational_cost, total_modal, notes
                ) VALUES (%s, %s, %s, %s, %s)
                RETURNING id, entry_date, production_cost, operational_cost, total_modal, notes, created_at;
            """, (data.entry_date, data.production_cost, data.operational_cost, data.total_modal, data.notes))

        row = cur.fetchone()
        conn.commit()
        return {
            "id": str(row[0]),
            "entry_date": row[1].isoformat(),
            "production_cost": float(row[2]),
            "operational_cost": float(row[3]),
            "total_modal": float(row[4]),
            "notes": row[5] or "",
            "created_at": row[6].isoformat() if row[6] else None
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan data modal: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.get("/api/modal")
def get_modal_entries(start_date: Optional[date] = None, end_date: Optional[date] = None):
    conn = get_connection()
    cur = conn.cursor()
    try:
        query = "SELECT id, entry_date, production_cost, operational_cost, total_modal, notes, created_at FROM daily_modal"
        params = []
        conditions = []
        if start_date:
            conditions.append("entry_date >= %s")
            params.append(start_date)
        if end_date:
            conditions.append("entry_date <= %s")
            params.append(end_date)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY entry_date DESC, created_at DESC"
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": str(r[0]),
                "entry_date": r[1].isoformat(),
                "production_cost": float(r[2]),
                "operational_cost": float(r[3]),
                "total_modal": float(r[4]),
                "notes": r[5] or "",
                "created_at": r[6].isoformat() if r[6] else None
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil riwayat modal: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.get("/api/modal/by-date")
def get_modal_by_date(date: date):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT COALESCE(SUM(total_modal), 0), COALESCE(SUM(production_cost), 0), COALESCE(SUM(operational_cost), 0), COUNT(*)
            FROM daily_modal
            WHERE entry_date = %s
        """, (date,))
        row = cur.fetchone()
        return {
            "date": date.isoformat(),
            "total_modal": float(row[0]) if row else 0.0,
            "production_cost": float(row[1]) if row else 0.0,
            "operational_cost": float(row[2]) if row else 0.0,
            "count": int(row[3]) if row else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data modal tanggal {date}: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/modal/reset")
def reset_all_modal():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM daily_modal")
        conn.commit()
        return {"status": "success", "message": "Seluruh data modal berhasil dikosongkan."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mengosongkan data modal: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/modal/by-date")
def delete_modal_by_date(date: date):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM daily_modal WHERE entry_date = %s", (date,))
        conn.commit()
        return {"status": "success", "message": f"Data modal pada tanggal {date} berhasil dihapus."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus modal per tanggal: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/modal/{modal_id}")
def delete_modal_by_id(modal_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM daily_modal WHERE id = %s", (modal_id,))
        conn.commit()
        return {"status": "success", "message": "Data modal berhasil dihapus."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus data modal: {str(e)}")
    finally:
        cur.close()
        conn.close()


# =====================================================================
# KEUANGAN (DAILY FINANCE) ENDPOINTS
# =====================================================================
@app.post("/api/finance")
def create_finance_entry(data: FinanceCreate):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM daily_finance WHERE entry_date = %s", (data.entry_date,))
        existing = cur.fetchone()
        if existing:
            cur.execute("""
                UPDATE daily_finance
                SET modal = %s,
                    omset = %s,
                    profit = %s,
                    notes = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING id, entry_date, modal, omset, profit, notes, created_at;
            """, (data.modal, data.omset, data.profit, data.notes, existing[0]))
        else:
            cur.execute("""
                INSERT INTO daily_finance (
                    entry_date, modal, omset, profit, notes
                ) VALUES (%s, %s, %s, %s, %s)
                RETURNING id, entry_date, modal, omset, profit, notes, created_at;
            """, (data.entry_date, data.modal, data.omset, data.profit, data.notes))
        row = cur.fetchone()
        conn.commit()
        return {
            "id": str(row[0]),
            "entry_date": row[1].isoformat(),
            "modal": float(row[2]),
            "omset": float(row[3]),
            "profit": float(row[4]),
            "notes": row[5] or "",
            "created_at": row[6].isoformat() if row[6] else None
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan data keuangan: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.get("/api/finance/by-date")
def get_finance_by_date(date: date):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, entry_date, modal, omset, profit, notes, created_at
            FROM daily_finance
            WHERE entry_date = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (date,))
        row = cur.fetchone()
        if not row:
            return {
                "date": date.isoformat(),
                "exists": False,
                "modal": 0.0,
                "omset": 0.0,
                "profit": 0.0,
                "notes": ""
            }
        return {
            "id": str(row[0]),
            "date": row[1].isoformat(),
            "exists": True,
            "modal": float(row[2]),
            "omset": float(row[3]),
            "profit": float(row[4]),
            "notes": row[5] or "",
            "created_at": row[6].isoformat() if row[6] else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil data keuangan tanggal {date}: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.get("/api/finance")
def get_finance_entries(start_date: Optional[date] = None, end_date: Optional[date] = None):
    conn = get_connection()
    cur = conn.cursor()
    try:
        query = "SELECT id, entry_date, modal, omset, profit, notes, created_at FROM daily_finance"
        params = []
        conditions = []
        if start_date:
            conditions.append("entry_date >= %s")
            params.append(start_date)
        if end_date:
            conditions.append("entry_date <= %s")
            params.append(end_date)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY entry_date DESC, created_at DESC"
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        records = []
        total_modal = 0.0
        total_omset = 0.0
        total_profit = 0.0
        for r in rows:
            m = float(r[2])
            o = float(r[3])
            p = float(r[4])
            total_modal += m
            total_omset += o
            total_profit += p
            records.append({
                "id": str(r[0]),
                "entry_date": r[1].isoformat(),
                "modal": m,
                "omset": o,
                "profit": p,
                "notes": r[5] or "",
                "created_at": r[6].isoformat() if r[6] else None
            })
        return {
            "records": records,
            "total_modal": total_modal,
            "total_omset": total_omset,
            "total_profit": total_profit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil riwayat keuangan: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/finance/reset")
def reset_all_finance():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM daily_finance")
        conn.commit()
        return {"status": "success", "message": "Seluruh data keuangan berhasil dikosongkan."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mengosongkan data keuangan: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/finance/by-date")
def delete_finance_by_date(date: date):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM daily_finance WHERE entry_date = %s", (date,))
        conn.commit()
        return {"status": "success", "message": f"Data keuangan pada tanggal {date} berhasil dihapus."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus keuangan per tanggal: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/finance/{finance_id}")
def delete_finance_by_id(finance_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM daily_finance WHERE id = %s", (finance_id,))
        conn.commit()
        return {"status": "success", "message": "Data keuangan berhasil dihapus."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus data keuangan: {str(e)}")
    finally:
        cur.close()
        conn.close()


# =====================================================================
# STOK & BAHAN TERBUANG (WASTE) ENDPOINTS
# =====================================================================
@app.post("/api/waste/stock")
@app.post("/api/stock/waste")
def create_stock_waste_item(data: StockWasteCreate):
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Jumlah bahan terbuang harus lebih dari 0.")
    if not data.reason or not data.reason.strip():
        raise HTTPException(status_code=400, detail="Alasan bahan terbuang wajib diisi.")

    conn = get_connection()
    cur = conn.cursor()
    waste_date = ensure_wib(data.date)
    try:
        if data.item_type.upper() == "RAW":
            cur.execute("""
                SELECT i.name, i.stock_unit_id, u.symbol
                FROM ingredients i
                LEFT JOIN units u ON i.stock_unit_id = u.id
                WHERE i.id = %s
            """, (data.item_id,))
            ing_row = cur.fetchone()
            if not ing_row:
                raise HTTPException(status_code=404, detail="Bahan mentah tidak ditemukan.")
            name, unit_id, unit_sym = ing_row[0], ing_row[1], ing_row[2]

            cur.execute("""
                SELECT COALESCE(quantity, 0), COALESCE(average_cost, 0)
                FROM stock_balances
                WHERE ingredient_id = %s
                FOR UPDATE
            """, (data.item_id,))
            sb_row = cur.fetchone()
            curr_stock = float(sb_row[0]) if sb_row else 0.0
            avg_cost = float(sb_row[1]) if sb_row else 0.0

            new_stock = max(0.0, curr_stock - data.quantity)
            total_loss = data.quantity * avg_cost

            cur.execute("""
                UPDATE stock_balances
                SET quantity = %s,
                    stock_value = %s * average_cost,
                    updated_at = NOW()
                WHERE ingredient_id = %s
            """, (new_stock, new_stock, data.item_id))

            cur.execute("""
                INSERT INTO stock_movements (
                    ingredient_id, movement_type, quantity, unit_id, unit_cost, total_value,
                    reference_type, movement_date, notes
                ) VALUES (%s, 'WASTE', %s, %s, %s, %s, 'WASTE', %s, %s)
            """, (data.item_id, data.quantity, unit_id, avg_cost, total_loss, waste_date, f"{data.reason}: {data.notes or ''}"))

            cur.execute("""
                INSERT INTO waste (
                    date, ingredient_id, product_id, quantity, unit_id, cost_per_unit, total_loss, reason, notes, item_type
                ) VALUES (%s, %s, NULL, %s, %s, %s, %s, %s, %s, 'RAW')
            """, (waste_date, data.item_id, data.quantity, unit_id, avg_cost, total_loss, data.reason, data.notes))

        else: # COOKED
            cur.execute("""
                SELECT p.name, p.selling_unit_id, u.symbol
                FROM products p
                LEFT JOIN units u ON p.selling_unit_id = u.id
                WHERE p.id = %s
            """, (data.item_id,))
            prod_row = cur.fetchone()
            if not prod_row:
                raise HTTPException(status_code=404, detail="Produk matang tidak ditemukan.")
            name, unit_id, unit_sym = prod_row[0], prod_row[1], prod_row[2]

            cur.execute("""
                SELECT COALESCE(quantity, 0), COALESCE(average_cost, 0)
                FROM finished_goods_stock
                WHERE product_id = %s
                FOR UPDATE
            """, (data.item_id,))
            fgs_row = cur.fetchone()
            curr_stock = float(fgs_row[0]) if fgs_row else 0.0
            avg_cost = float(fgs_row[1]) if fgs_row else 0.0

            new_stock = max(0.0, curr_stock - data.quantity)
            total_loss = data.quantity * avg_cost

            cur.execute("""
                UPDATE finished_goods_stock
                SET quantity = %s,
                    stock_value = %s * average_cost,
                    updated_at = NOW()
                WHERE product_id = %s
            """, (new_stock, new_stock, data.item_id))

            cur.execute("""
                INSERT INTO finished_goods_movements (
                    product_id, movement_type, quantity, unit_id, unit_cost, total_value,
                    reference_type, movement_date, notes
                ) VALUES (%s, 'WASTE_OUT', %s, %s, %s, %s, 'WASTE', %s, %s)
            """, (data.item_id, data.quantity, unit_id, avg_cost, total_loss, waste_date, f"{data.reason}: {data.notes or ''}"))

            cur.execute("""
                INSERT INTO waste (
                    date, ingredient_id, product_id, quantity, unit_id, cost_per_unit, total_loss, reason, notes, item_type
                ) VALUES (%s, NULL, %s, %s, %s, %s, %s, %s, %s, 'COOKED')
            """, (waste_date, data.item_id, data.quantity, unit_id, avg_cost, total_loss, data.reason, data.notes))

        conn.commit()
        return {
            "status": "success",
            "message": f"Bahan terbuang {name} ({data.quantity} {unit_sym}) berhasil dicatat dan stok dikurangi."
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mencatat bahan terbuang: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.get("/api/stock/waste")
def get_stock_waste_list(start_date: Optional[date] = None, end_date: Optional[date] = None):
    conn = get_connection()
    cur = conn.cursor()
    try:
        query = """
            SELECT 
                w.id,
                w.date,
                COALESCE(w.item_type, 'COOKED') AS item_type,
                COALESCE(i.name, p.name, 'Item') AS item_name,
                w.quantity,
                COALESCE(u.symbol, '') AS unit_symbol,
                w.cost_per_unit,
                w.total_loss,
                w.reason,
                w.notes
            FROM waste w
            LEFT JOIN ingredients i ON w.ingredient_id = i.id
            LEFT JOIN products p ON w.product_id = p.id
            LEFT JOIN units u ON w.unit_id = u.id
        """
        params = []
        conditions = []
        if start_date:
            conditions.append("(w.date AT TIME ZONE 'Asia/Jakarta')::date >= %s")
            params.append(start_date)
        if end_date:
            conditions.append("(w.date AT TIME ZONE 'Asia/Jakarta')::date <= %s")
            params.append(end_date)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY w.date DESC LIMIT 150"
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        results = []
        for r in rows:
            results.append({
                "id": str(r[0]),
                "date": r[1].isoformat() if r[1] else None,
                "item_type": r[2],
                "item_name": r[3] or "-",
                "quantity": float(r[4]),
                "unit_symbol": r[5] or "",
                "cost_per_unit": float(r[6]),
                "total_loss": float(r[7]),
                "reason": r[8] or "",
                "notes": r[9] or ""
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengambil riwayat waste: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/waste/by-date")
def delete_waste_by_date(date: date):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM waste WHERE (date AT TIME ZONE 'Asia/Jakarta')::date = %s", (date,))
        conn.commit()
        return {"status": "success", "message": f"Data bahan terbuang pada tanggal {date} berhasil dihapus."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus waste per tanggal: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/waste/{waste_id}")
def delete_waste_by_id(waste_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM waste WHERE id = %s", (waste_id,))
        conn.commit()
        return {"status": "success", "message": "Data bahan terbuang berhasil dihapus."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus data waste: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/waste/reset")
def reset_all_waste():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM waste")
        conn.commit()
        return {"status": "success", "message": "Seluruh riwayat bahan terbuang berhasil dikosongkan."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mengosongkan riwayat waste: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.post("/api/stock/clear-all")
@app.post("/api/stock/waste-all")
def clear_all_stock_to_waste():
    conn = get_connection()
    cur = conn.cursor()
    now = get_now()
    try:
        # 1. Ambil sisa stok mentah yang > 0
        cur.execute("""
            SELECT sb.ingredient_id, sb.quantity, COALESCE(sb.average_cost, 0), i.stock_unit_id, i.name
            FROM stock_balances sb
            JOIN ingredients i ON sb.ingredient_id = i.id
            WHERE sb.quantity > 0
            FOR UPDATE
        """)
        raw_items = cur.fetchall()

        # 2. Ambil sisa stok matang yang > 0
        cur.execute("""
            SELECT fgs.product_id, fgs.quantity, COALESCE(fgs.average_cost, 0), p.selling_unit_id, p.name
            FROM finished_goods_stock fgs
            JOIN products p ON fgs.product_id = p.id
            WHERE fgs.quantity > 0
            FOR UPDATE
        """)
        cooked_items = cur.fetchall()

        total_raw_count = len(raw_items)
        total_cooked_count = len(cooked_items)

        # Proses stok mentah -> Waste
        for item in raw_items:
            ing_id, qty, avg_cost, unit_id, name = item[0], float(item[1]), float(item[2]), item[3], item[4]
            total_loss = qty * avg_cost

            # Movement
            cur.execute("""
                INSERT INTO stock_movements (
                    ingredient_id, movement_type, quantity, unit_id, unit_cost, total_value,
                    reference_type, movement_date, notes
                ) VALUES (%s, 'WASTE', %s, %s, %s, %s, 'WASTE', %s, %s)
            """, (ing_id, qty, unit_id, avg_cost, total_loss, now, f"Pengosongan sisa stok mentah {name}"))

            # Waste record
            cur.execute("""
                INSERT INTO waste (
                    date, ingredient_id, product_id, quantity, unit_id, cost_per_unit, total_loss,
                    reason, notes, item_type
                ) VALUES (%s, %s, NULL, %s, %s, %s, %s, 'PENGOSONGAN_STOK', %s, 'RAW')
            """, (now, ing_id, qty, unit_id, avg_cost, total_loss, f"Pengosongan sisa stok mentah {name}"))

        # Update semua stock_balances ke 0
        cur.execute("UPDATE stock_balances SET quantity = 0, stock_value = 0, updated_at = NOW()")

        # Proses stok matang -> Waste
        for item in cooked_items:
            prod_id, qty, avg_cost, unit_id, name = item[0], float(item[1]), float(item[2]), item[3], item[4]
            total_loss = qty * avg_cost

            # Movement
            cur.execute("""
                INSERT INTO finished_goods_movements (
                    product_id, movement_type, quantity, unit_id, unit_cost, total_value,
                    reference_type, movement_date, notes
                ) VALUES (%s, 'WASTE_OUT', %s, %s, %s, %s, 'WASTE', %s, %s)
            """, (prod_id, qty, unit_id, avg_cost, total_loss, now, f"Pengosongan sisa stok matang {name}"))

            # Waste record
            cur.execute("""
                INSERT INTO waste (
                    date, ingredient_id, product_id, quantity, unit_id, cost_per_unit, total_loss,
                    reason, notes, item_type
                ) VALUES (%s, NULL, %s, %s, %s, %s, %s, 'PENGOSONGAN_STOK', %s, 'COOKED')
            """, (now, prod_id, qty, unit_id, avg_cost, total_loss, f"Pengosongan sisa stok matang {name}"))

        # Update semua finished_goods_stock ke 0
        cur.execute("UPDATE finished_goods_stock SET quantity = 0, stock_value = 0, updated_at = NOW()")

        conn.commit()
        return {
            "status": "success",
            "message": f"Seluruh sisa stok berhasil dikosongkan dan dicatat sebagai terbuang/rusak ({total_raw_count} bahan mentah, {total_cooked_count} produk matang).",
            "raw_count": total_raw_count,
            "cooked_count": total_cooked_count
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mengosongkan stok: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.delete("/api/stock/reset")
def reset_all_stock():
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE stock_balances SET quantity = 0, stock_value = 0, updated_at = NOW()")
        cur.execute("UPDATE finished_goods_stock SET quantity = 0, stock_value = 0, updated_at = NOW()")
        cur.execute("DELETE FROM stock_movements")
        cur.execute("DELETE FROM finished_goods_movements")
        cur.execute("DELETE FROM waste")
        conn.commit()
        return {"status": "success", "message": "Seluruh stok mentah, stok matang, dan riwayat waste berhasil di-reset ke 0."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal me-reset stok: {str(e)}")
    finally:
        cur.close()
        conn.close()


@app.post("/api/reset-data")
def reset_all_data():
    conn = get_connection()
    try:
        cur = conn.cursor()

        tables = [
            "production_inputs",
            "production_outputs",
            "production",
            "finished_goods_movements",
            "finished_goods_stock",
            "sale_items",
            "sale_packaging_items",
            "sales",
            "purchase_items",
            "purchases",
            "packaging_movements",
            "packaging_purchase_items",
            "packaging_purchases",
            "packaging_stock_balance",
            "packaging_stock_opname_items",
            "packaging_stock_opnames",
            "stock_movements",
            "stock_balances",
            "expenses",
            "waste",
            "cash_transactions",
            "daily_modal",
            "daily_finance"
        ]

        truncate_query = f"TRUNCATE TABLE {', '.join(tables)} CASCADE;"
        cur.execute(truncate_query)
        conn.commit()

        return {
            "status": "success",
            "message": "Seluruh data transaksi dan stok berhasil dikosongkan."
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Gagal mengosongkan data: {str(e)}"
        )
    finally:
        conn.close()
