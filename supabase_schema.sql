--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cash_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_date timestamp with time zone DEFAULT now() NOT NULL,
    type character varying(10) NOT NULL,
    category character varying(50) NOT NULL,
    amount numeric(12,2) NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    payment_method character varying(30),
    description text,
    CONSTRAINT chk_cash_transaction_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT chk_cash_transaction_type CHECK (((type)::text = ANY ((ARRAY['IN'::character varying, 'OUT'::character varying])::text[])))
);


--
-- Name: daily_finance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_finance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date NOT NULL,
    modal numeric(15,2) DEFAULT 0,
    omset numeric(15,2) NOT NULL,
    profit numeric(15,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: daily_modal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_modal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date NOT NULL,
    production_cost numeric(15,2) DEFAULT 0,
    operational_cost numeric(15,2) DEFAULT 0,
    total_modal numeric(15,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    category_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_method character varying(30),
    is_business boolean DEFAULT true NOT NULL,
    allocation_percentage numeric(5,2) DEFAULT 100 NOT NULL,
    business_amount numeric(12,2) DEFAULT 0 NOT NULL,
    description text,
    expense_location character varying(50),
    CONSTRAINT chk_expense_allocation CHECK (((allocation_percentage >= (0)::numeric) AND (allocation_percentage <= (100)::numeric))),
    CONSTRAINT chk_expense_amount CHECK ((amount >= (0)::numeric)),
    CONSTRAINT chk_expense_business_amount CHECK (((business_amount >= (0)::numeric) AND (business_amount <= amount))),
    CONSTRAINT chk_expense_location CHECK (((expense_location IS NULL) OR ((expense_location)::text = ANY ((ARRAY['Dalam Rumah'::character varying, 'Teras'::character varying, 'Lapak'::character varying])::text[]))))
);


--
-- Name: finished_goods_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finished_goods_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    movement_type character varying(30) NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_id uuid NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_value numeric(12,2) DEFAULT 0 NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    movement_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    CONSTRAINT chk_finished_movement_cost CHECK ((unit_cost >= (0)::numeric)),
    CONSTRAINT chk_finished_movement_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_finished_movement_type CHECK (((movement_type)::text = ANY ((ARRAY['PRODUCTION_IN'::character varying, 'SALE_OUT'::character varying, 'WASTE_OUT'::character varying, 'ADJUSTMENT'::character varying])::text[]))),
    CONSTRAINT chk_finished_movement_value CHECK ((total_value >= (0)::numeric))
);


--
-- Name: finished_goods_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finished_goods_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    stock_value numeric(12,2) DEFAULT 0 NOT NULL,
    average_cost numeric(12,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_finished_stock_average_cost CHECK ((average_cost >= (0)::numeric)),
    CONSTRAINT chk_finished_stock_quantity CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT chk_finished_stock_value CHECK ((stock_value >= (0)::numeric))
);


--
-- Name: ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    stock_unit_id uuid NOT NULL,
    minimum_stock numeric(12,3) DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    seasonal boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_ingredients_minimum_stock CHECK ((minimum_stock >= (0)::numeric))
);


--
-- Name: packaging_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packaging_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    stock_unit_id uuid NOT NULL,
    minimum_stock numeric(12,3) DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_packaging_minimum_stock CHECK ((minimum_stock >= (0)::numeric))
);


--
-- Name: packaging_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packaging_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    packaging_item_id uuid NOT NULL,
    movement_type character varying(30) NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_id uuid NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_value numeric(12,2) DEFAULT 0 NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    movement_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    CONSTRAINT chk_packaging_movement_cost CHECK ((unit_cost >= (0)::numeric)),
    CONSTRAINT chk_packaging_movement_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_packaging_movement_type CHECK (((movement_type)::text = ANY ((ARRAY['PURCHASE'::character varying, 'SALE_USE'::character varying, 'WASTE'::character varying, 'ADJUSTMENT'::character varying, 'STOCKTAKE_IN'::character varying, 'STOCKTAKE_OUT'::character varying])::text[]))),
    CONSTRAINT chk_packaging_movement_value CHECK ((total_value >= (0)::numeric))
);


--
-- Name: packaging_purchase_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packaging_purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid NOT NULL,
    packaging_item_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    CONSTRAINT chk_packaging_purchase_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_packaging_purchase_subtotal CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT chk_packaging_purchase_unit_price CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: packaging_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packaging_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_date timestamp with time zone DEFAULT now() NOT NULL,
    supplier_name character varying(150),
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    payment_method character varying(30),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_packaging_purchase_total CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: packaging_stock_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packaging_stock_balance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    packaging_item_id uuid NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    stock_value numeric(12,2) DEFAULT 0 NOT NULL,
    average_cost numeric(12,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_packaging_stock_average_cost CHECK ((average_cost >= (0)::numeric)),
    CONSTRAINT chk_packaging_stock_quantity CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT chk_packaging_stock_value CHECK ((stock_value >= (0)::numeric))
);


--
-- Name: packaging_stock_opname_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packaging_stock_opname_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    opname_id uuid NOT NULL,
    packaging_item_id uuid NOT NULL,
    system_quantity numeric NOT NULL,
    physical_quantity numeric NOT NULL,
    difference_quantity numeric NOT NULL,
    unit_cost numeric DEFAULT 0 NOT NULL,
    difference_value numeric DEFAULT 0 NOT NULL,
    notes text,
    CONSTRAINT chk_packaging_opname_physical_quantity CHECK ((physical_quantity >= (0)::numeric)),
    CONSTRAINT chk_packaging_opname_system_quantity CHECK ((system_quantity >= (0)::numeric)),
    CONSTRAINT chk_packaging_opname_unit_cost CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: packaging_stock_opnames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packaging_stock_opnames (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    opname_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: production; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    production_date timestamp with time zone DEFAULT now() NOT NULL,
    total_material_cost numeric(12,2) DEFAULT 0 NOT NULL,
    additional_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_cost numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    CONSTRAINT chk_production_additional_cost CHECK ((additional_cost >= (0)::numeric)),
    CONSTRAINT chk_production_material_cost CHECK ((total_material_cost >= (0)::numeric)),
    CONSTRAINT chk_production_total_cost CHECK ((total_cost >= (0)::numeric))
);


--
-- Name: production_inputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_inputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    production_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_cost numeric(12,2) NOT NULL,
    total_cost numeric(12,2) NOT NULL,
    CONSTRAINT chk_production_input_cost CHECK ((unit_cost >= (0)::numeric)),
    CONSTRAINT chk_production_input_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_production_input_total CHECK ((total_cost >= (0)::numeric))
);


--
-- Name: production_outputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_outputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    production_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_id uuid NOT NULL,
    cost_per_unit numeric(12,2) NOT NULL,
    total_cost numeric(12,2) NOT NULL,
    CONSTRAINT chk_production_output_cost CHECK ((cost_per_unit >= (0)::numeric)),
    CONSTRAINT chk_production_output_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_production_output_total CHECK ((total_cost >= (0)::numeric))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    selling_unit_id uuid NOT NULL,
    selling_price numeric(12,2) DEFAULT 0 NOT NULL,
    category character varying(50),
    active boolean DEFAULT true NOT NULL,
    seasonal boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_products_price CHECK ((selling_price >= (0)::numeric))
);


--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    CONSTRAINT chk_purchase_items_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_purchase_items_subtotal CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT chk_purchase_items_unit_price CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_date timestamp with time zone DEFAULT now() NOT NULL,
    supplier_name character varying(150),
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    payment_method character varying(30),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_purchases_total CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric(12,3) NOT NULL,
    selling_price numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    cost_per_unit numeric(12,2) NOT NULL,
    total_cost numeric(12,2) NOT NULL,
    gross_profit numeric(12,2) NOT NULL,
    CONSTRAINT chk_sale_item_cost CHECK ((cost_per_unit >= (0)::numeric)),
    CONSTRAINT chk_sale_item_price CHECK ((selling_price >= (0)::numeric)),
    CONSTRAINT chk_sale_item_profit CHECK (((gross_profit >= (0)::numeric) OR (gross_profit < (0)::numeric))),
    CONSTRAINT chk_sale_item_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_sale_item_subtotal CHECK ((subtotal >= (0)::numeric)),
    CONSTRAINT chk_sale_item_total_cost CHECK ((total_cost >= (0)::numeric))
);


--
-- Name: sale_packaging_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_packaging_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    packaging_item_id uuid NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_cost numeric(12,2) NOT NULL,
    total_cost numeric(12,2) NOT NULL,
    CONSTRAINT chk_sale_packaging_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_sale_packaging_total CHECK ((total_cost >= (0)::numeric)),
    CONSTRAINT chk_sale_packaging_unit_cost CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_date timestamp with time zone DEFAULT now() NOT NULL,
    channel_id uuid NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    platform_fee numeric(12,2) DEFAULT 0 NOT NULL,
    total_gross numeric(12,2) DEFAULT 0 NOT NULL,
    total_net numeric(12,2) DEFAULT 0 NOT NULL,
    payment_method character varying(30),
    payment_status character varying(30) DEFAULT 'PAID'::character varying NOT NULL,
    notes text,
    CONSTRAINT chk_sales_discount CHECK ((discount >= (0)::numeric)),
    CONSTRAINT chk_sales_gross CHECK ((total_gross >= (0)::numeric)),
    CONSTRAINT chk_sales_net CHECK ((total_net >= (0)::numeric)),
    CONSTRAINT chk_sales_payment_status CHECK (((payment_status)::text = ANY ((ARRAY['PENDING'::character varying, 'PAID'::character varying, 'SETTLED'::character varying])::text[]))),
    CONSTRAINT chk_sales_platform_fee CHECK ((platform_fee >= (0)::numeric)),
    CONSTRAINT chk_sales_subtotal CHECK ((subtotal >= (0)::numeric))
);


--
-- Name: sales_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: stock_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    stock_value numeric(12,2) DEFAULT 0 NOT NULL,
    average_cost numeric(12,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_stock_balances_average_cost CHECK ((average_cost >= (0)::numeric)),
    CONSTRAINT chk_stock_balances_quantity CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT chk_stock_balances_value CHECK ((stock_value >= (0)::numeric))
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ingredient_id uuid NOT NULL,
    movement_type character varying(30) NOT NULL,
    quantity numeric(12,3) NOT NULL,
    unit_id uuid NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_value numeric(12,2) DEFAULT 0 NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    movement_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    CONSTRAINT chk_stock_movement_cost CHECK ((unit_cost >= (0)::numeric)),
    CONSTRAINT chk_stock_movement_quantity CHECK ((quantity > (0)::numeric)),
    CONSTRAINT chk_stock_movement_type CHECK (((movement_type)::text = ANY ((ARRAY['PURCHASE'::character varying, 'PRODUCTION_USE'::character varying, 'WASTE'::character varying, 'ADJUSTMENT'::character varying])::text[]))),
    CONSTRAINT chk_stock_movement_value CHECK ((total_value >= (0)::numeric))
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    symbol character varying(20) NOT NULL,
    type character varying(30) NOT NULL,
    CONSTRAINT chk_units_type CHECK (((type)::text = ANY ((ARRAY['weight'::character varying, 'quantity'::character varying, 'serving'::character varying, 'package'::character varying])::text[])))
);


--
-- Name: waste; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waste (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date timestamp with time zone DEFAULT now() NOT NULL,
    product_id uuid,
    quantity numeric(12,3) NOT NULL,
    unit_id uuid NOT NULL,
    cost_per_unit numeric(12,2) NOT NULL,
    total_loss numeric(12,2) NOT NULL,
    reason character varying(100) NOT NULL,
    notes text,
    ingredient_id uuid,
    item_type character varying(20) DEFAULT 'PRODUCT'::character varying,
    CONSTRAINT chk_waste_cost CHECK ((cost_per_unit >= (0)::numeric)),
    CONSTRAINT chk_waste_loss CHECK ((total_loss >= (0)::numeric)),
    CONSTRAINT chk_waste_quantity CHECK ((quantity > (0)::numeric))
);


--
-- Data for Name: cash_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.cash_transactions VALUES ('05ef6bf1-3197-4be0-a194-60a83e6f5b32', '2026-09-24 19:10:47.298211+07', 'IN', 'Penjualan Lapak', 35000.00, 'SALE', 'c1234567-1111-4444-8888-123456789001', 'CASH', 'Penerimaan penjualan Lapak');
INSERT INTO public.cash_transactions VALUES ('bd323ad6-5c01-4306-9f96-8f5cb0cc181e', '2026-09-24 20:00:27.831724+07', 'OUT', 'Biaya Operasional', 20000.00, 'EXPENSE', '33bd6b9c-54d3-4998-9314-d38518158f3a', 'CASH', 'Penggantian gas - Dalam Rumah');
INSERT INTO public.cash_transactions VALUES ('05484651-6ba7-4bca-a784-94b579ea2afe', '2026-09-24 20:01:55.967038+07', 'OUT', 'Biaya Operasional', 20000.00, 'EXPENSE', '4d947305-f988-4947-980d-ba4c9207741e', 'CASH', 'Penggantian gas - Teras');
INSERT INTO public.cash_transactions VALUES ('95940527-8de9-432c-b00c-ca0b682aa218', '2026-09-24 20:03:05.935149+07', 'OUT', 'Biaya Operasional', 20000.00, 'EXPENSE', '6f4289d1-6a48-4fe8-b3ba-6778834217b8', 'CASH', 'Penggantian gas - Lapak');
INSERT INTO public.cash_transactions VALUES ('755706f4-b908-44bf-94e2-241abd8cb811', '2026-09-19 00:00:00+07', 'OUT', 'Biaya Operasional', 1000000.00, 'EXPENSE', 'f03882f9-87d5-428b-be51-f76232dbc5f0', 'CASH', 'Pembayaran gaji bulanan');
INSERT INTO public.cash_transactions VALUES ('387fc9f3-4f54-46ea-9955-c68a1b105cee', '2026-09-16 00:00:00+07', 'OUT', 'Biaya Operasional', 150000.00, 'EXPENSE', 'dbf1972d-e5d6-4ad0-9f09-60063a0ef002', 'CASH', 'Pembayaran sewa lapak');
INSERT INTO public.cash_transactions VALUES ('7fa47659-b6cf-4949-b754-7ecfa08c61c8', '2026-09-24 19:26:58.396551+07', 'OUT', 'Pembelian Packaging', 10000.00, 'PACKAGING_PURCHASE', 'e1234567-2222-4444-8888-123456789002', 'CASH', 'Pembelian packaging - Mika');
INSERT INTO public.cash_transactions VALUES ('e61f9ffe-e054-4b59-930c-888aaba31e3c', '2026-09-25 17:00:00+07', 'IN', 'PENJUALAN_GOFOOD', 80000.00, 'SALE', '3d4518aa-8679-4d5d-976e-ca7e4645cda5', 'BANK', 'Penerimaan bersih GoFood');
INSERT INTO public.cash_transactions VALUES ('86812f9c-4750-4664-8102-2d46b7cc2df1', '2026-09-25 18:00:00+07', 'IN', 'PENJUALAN_LAPAK', 6000.00, 'SALE', '22731498-0c02-4aa6-943b-a338eb82bada', 'CASH', 'Penerimaan penjualan Lapak');
INSERT INTO public.cash_transactions VALUES ('93670807-23f0-430a-836c-0c61bd5d59fa', '2026-09-28 19:00:00+07', 'IN', 'PENJUALAN_GOFOOD', 80000.00, 'SALE', '1f80d55a-c4eb-4bfe-9d35-206451bcb9a6', 'BANK', 'Penerimaan penjualan GoFood');
INSERT INTO public.cash_transactions VALUES ('cccca1f2-7551-4e5e-9ff7-7e71b10e5d25', '2026-09-28 00:00:00+07', 'OUT', 'PENGELUARAN', 20000.00, 'EXPENSE', 'f055bad8-328a-4f50-ad55-887674fb561d', 'CASH', 'Tes API pembayaran gas');
INSERT INTO public.cash_transactions VALUES ('55f27548-582c-40f7-83a5-ecfb1ebadcf2', '2026-09-29 15:00:00+07', 'OUT', 'PEMBELIAN_KEMASAN', 5000.00, 'PACKAGING_PURCHASE', '8bcf9827-a398-46a1-9111-16a3d4c9c542', 'CASH', 'Tes API pembelian Mika');
INSERT INTO public.cash_transactions VALUES ('eb2ca918-1b83-4ddb-b3c6-7ba5fa3e180d', '2026-10-12 21:20:00+07', 'IN', 'PENJUALAN_LAPAK', 12000.00, 'SALE', 'd8995295-ebda-4c31-a431-e3dd3be2e5a3', 'CASH', 'Penerimaan penjualan Lapak');


--
-- Data for Name: daily_finance; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: daily_modal; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.expense_categories VALUES ('7c87f0a5-59df-4440-b6bc-b3ef0b570742', 'Gaji');
INSERT INTO public.expense_categories VALUES ('2f8e94bb-0ad2-4668-9736-012e34d41dc4', 'Sewa');
INSERT INTO public.expense_categories VALUES ('8537ba21-e9eb-4c6b-9422-caadf8ace326', 'Gas');
INSERT INTO public.expense_categories VALUES ('9480f6c8-387f-4d4c-af46-dca4859a0f00', 'Listrik');
INSERT INTO public.expense_categories VALUES ('fb627394-5604-468e-a9d4-42c0d09558a4', 'Kemasan');
INSERT INTO public.expense_categories VALUES ('69ca1166-44e5-4fb9-bbdb-92e57e2e5b05', 'Transportasi');
INSERT INTO public.expense_categories VALUES ('836db8f0-ab45-4aa8-b030-f9b3bd7ba0dc', 'Peralatan');
INSERT INTO public.expense_categories VALUES ('4de9e09b-dd4e-41c1-8f9a-48a2ce0e2e4a', 'Lainnya');


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.expenses VALUES ('33bd6b9c-54d3-4998-9314-d38518158f3a', '2026-09-24', '8537ba21-e9eb-4c6b-9422-caadf8ace326', 20000.00, 'CASH', true, 60.00, 12000.00, 'Penggantian gas untuk memasak bahan baku', 'Dalam Rumah');
INSERT INTO public.expenses VALUES ('4d947305-f988-4947-980d-ba4c9207741e', '2026-09-24', '8537ba21-e9eb-4c6b-9422-caadf8ace326', 20000.00, 'CASH', true, 100.00, 20000.00, 'Penggantian gas untuk memasak bahan baku', 'Teras');
INSERT INTO public.expenses VALUES ('6f4289d1-6a48-4fe8-b3ba-6778834217b8', '2026-09-24', '8537ba21-e9eb-4c6b-9422-caadf8ace326', 20000.00, 'CASH', true, 100.00, 20000.00, 'Penggantian gas untuk menghangatkan dagangan', 'Lapak');
INSERT INTO public.expenses VALUES ('f03882f9-87d5-428b-be51-f76232dbc5f0', '2026-09-19', '7c87f0a5-59df-4440-b6bc-b3ef0b570742', 1000000.00, 'CASH', true, 100.00, 1000000.00, 'Pembayaran gaji bulanan', NULL);
INSERT INTO public.expenses VALUES ('dbf1972d-e5d6-4ad0-9f09-60063a0ef002', '2026-09-16', '2f8e94bb-0ad2-4668-9736-012e34d41dc4', 150000.00, 'CASH', true, 100.00, 150000.00, 'Pembayaran sewa lapak', NULL);
INSERT INTO public.expenses VALUES ('f055bad8-328a-4f50-ad55-887674fb561d', '2026-09-28', '8537ba21-e9eb-4c6b-9422-caadf8ace326', 20000.00, 'CASH', true, 60.00, 12000.00, 'Tes API pembayaran gas', 'Dalam Rumah');


--
-- Data for Name: finished_goods_movements; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.finished_goods_movements VALUES ('300d6f81-716b-4d0e-a222-10bd3ea42fde', '95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 'PRODUCTION_IN', 20.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3300.00, 66000.00, 'PRODUCTION', 'b1234567-1111-4444-8888-123456789001', '2026-09-24 18:18:49.319678+07', 'Hasil produksi 20 biji Telur Ayam');
INSERT INTO public.finished_goods_movements VALUES ('0191d32c-f296-4a38-89ee-3f8afe655398', '2291a87a-7497-4730-906b-8a67221aaf7e', 'PRODUCTION_IN', 20.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 2080.00, 41600.00, 'PRODUCTION', 'b1234567-2222-4444-8888-123456789002', '2026-09-24 18:47:36.193311+07', 'Hasil produksi 20 porsi Kacang');
INSERT INTO public.finished_goods_movements VALUES ('546e52bc-d09a-42cc-8cc0-b02b6af9bc96', '0b75e976-e2f2-4234-8816-351eb9877c68', 'PRODUCTION_IN', 24.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1571.43, 37714.29, 'PRODUCTION', 'b1234567-3333-4444-8888-123456789003', '2026-09-24 18:53:03.283629+07', 'Hasil produksi 24 biji Ubi Madu');
INSERT INTO public.finished_goods_movements VALUES ('0dc01771-87a6-467a-99b5-e3f2d97af80a', '0b75e976-e2f2-4234-8816-351eb9877c68', 'SALE_OUT', 5.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1571.43, 7857.15, 'SALE', 'c1234567-1111-4444-8888-123456789001', '2026-09-24 19:10:47.298211+07', 'Penjualan Lapak');
INSERT INTO public.finished_goods_movements VALUES ('d7da15e6-0863-4cf3-8063-c2848187949a', '95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 'SALE_OUT', 5.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3300.00, 16500.00, 'SALE', 'c1234567-1111-4444-8888-123456789001', '2026-09-24 19:10:47.298211+07', 'Penjualan Lapak');
INSERT INTO public.finished_goods_movements VALUES ('68ecd8a1-28ef-404f-a839-554849a2927a', '2291a87a-7497-4730-906b-8a67221aaf7e', 'SALE_OUT', 5.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 2080.00, 10400.00, 'SALE', 'c1234567-1111-4444-8888-123456789001', '2026-09-24 19:10:47.298211+07', 'Penjualan Lapak');
INSERT INTO public.finished_goods_movements VALUES ('3295a936-cc34-4141-a710-2086f5383c7d', '0b75e976-e2f2-4234-8816-351eb9877c68', 'WASTE_OUT', 2.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1571.43, 3142.86, 'WASTE', 'd1234567-1111-4444-8888-123456789001', '2026-09-24 19:16:31.797954+07', 'Waste 2 biji Ubi Madu');
INSERT INTO public.finished_goods_movements VALUES ('92e9c496-801b-4a2d-a40f-0e020ab9c827', '95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 'PRODUCTION_IN', 10.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3350.00, 33500.00, 'PRODUCTION', 'd78c2404-d27f-4efd-8a73-220892e601ed', '2026-09-25 15:30:00+07', 'Tes API produksi Telur Ayam');
INSERT INTO public.finished_goods_movements VALUES ('2fa98b90-41fe-4646-b5de-11283e37365d', '95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 'SALE_OUT', 2.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3320.00, 6640.00, 'SALE', '22731498-0c02-4aa6-943b-a338eb82bada', '2026-09-25 18:00:00+07', 'Penjualan Lapak');
INSERT INTO public.finished_goods_movements VALUES ('811f1bca-af84-4c00-9c37-b5bd1f53e557', '2291a87a-7497-4730-906b-8a67221aaf7e', 'WASTE_OUT', 2.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 2080.00, 4160.00, 'WASTE', '14de6fb3-fd92-4a7c-953d-788a30916d4c', '2026-09-28 19:00:00+07', 'Rusak');
INSERT INTO public.finished_goods_movements VALUES ('b080b4dc-ff3b-4f8c-b8e4-0ac30b0e7f87', '0b75e976-e2f2-4234-8816-351eb9877c68', 'WASTE_OUT', 2.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1571.43, 3142.86, 'WASTE', '294adc03-b135-4d50-a7a1-5eb0342258b0', '2026-09-28 19:00:00+07', 'Rusak');
INSERT INTO public.finished_goods_movements VALUES ('4593a174-28e3-4bc3-89a6-e139d7a7c762', 'e6aeda67-01ea-4510-8130-4bfa08f06308', 'PRODUCTION_IN', 1.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 2866.67, 2866.67, 'PRODUCTION', '8ebe6bfe-116c-48ab-b7aa-d57b1b5f14f0', '2026-10-06 13:40:00+07', 'Hasil produksi');
INSERT INTO public.finished_goods_movements VALUES ('4c5a869c-0fbc-4c52-b757-59b179e53063', 'e6aeda67-01ea-4510-8130-4bfa08f06308', 'PRODUCTION_IN', 1.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 2968.00, 2968.00, 'PRODUCTION', '44bd7206-14ac-49d9-a316-25ee3b3e837c', '2026-10-06 15:45:00+07', 'Hasil produksi');
INSERT INTO public.finished_goods_movements VALUES ('5f3425b1-e617-46b1-be0a-65747dcb3f1c', '2291a87a-7497-4730-906b-8a67221aaf7e', 'PRODUCTION_IN', 1.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 1978.67, 1978.67, 'PRODUCTION', '44bd7206-14ac-49d9-a316-25ee3b3e837c', '2026-10-06 15:45:00+07', 'Hasil produksi');
INSERT INTO public.finished_goods_movements VALUES ('796bca42-ab97-40a3-9005-0cb25dfd995b', '95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 'PRODUCTION_IN', 10.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3387.50, 33875.00, 'PRODUCTION', '92120489-17dd-4ba7-adf3-940679927bf8', '2026-10-12 20:30:00+07', 'Hasil produksi');
INSERT INTO public.finished_goods_movements VALUES ('50aede25-aaf5-4cd0-aba8-3df53a626abc', '07389f47-0645-42ed-ba92-f1be5c5cd557', 'PRODUCTION_IN', 16.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1000.00, 16000.00, 'PRODUCTION', 'd6defa3f-4709-4af8-8366-39c6e9ffdc8d', '2026-10-12 21:15:00+07', 'Hasil produksi');
INSERT INTO public.finished_goods_movements VALUES ('94dde1fd-98c6-40be-a3ee-8ab1da5bab0b', '07389f47-0645-42ed-ba92-f1be5c5cd557', 'PRODUCTION_IN', 16.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1000.00, 16000.00, 'PRODUCTION', '29efb550-6608-416c-9863-aeeb27dbd16d', '2026-10-12 21:15:00+07', 'Hasil produksi');
INSERT INTO public.finished_goods_movements VALUES ('c7a46ad3-0f06-4961-885c-792fc65a10bf', '07389f47-0645-42ed-ba92-f1be5c5cd557', 'SALE_OUT', 6.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1000.00, 6000.00, 'SALE', 'd8995295-ebda-4c31-a431-e3dd3be2e5a3', '2026-10-12 21:20:00+07', 'Penjualan Lapak');
INSERT INTO public.finished_goods_movements VALUES ('ddcff72a-e28a-41b2-88cb-49f04284b666', 'b66e9cf0-07bb-4e7f-903b-5dc87737e1bc', 'PRODUCTION_IN', 3000.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 4.00, 12000.00, 'PRODUCTION', '60deda28-f9d1-44d2-83de-cbd03de40073', '2026-10-12 21:45:00+07', 'Hasil produksi');
INSERT INTO public.finished_goods_movements VALUES ('dd305805-c740-4699-aa99-7b43154d8740', 'b66e9cf0-07bb-4e7f-903b-5dc87737e1bc', 'PRODUCTION_IN', 12.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 750.00, 9000.00, 'PRODUCTION', '279c793e-7c8a-40d0-98cd-d8f0d2547846', '2026-10-12 21:45:00+07', 'Hasil produksi');
INSERT INTO public.finished_goods_movements VALUES ('2bd599f6-1f66-4f4b-a44d-45c4b6fdf6f3', '0b75e976-e2f2-4234-8816-351eb9877c68', 'WASTE_OUT', 15.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1571.43, 23571.45, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok matang Ubi Madu');
INSERT INTO public.finished_goods_movements VALUES ('ee423c6b-6c59-4d5c-80f2-214eb60bfb57', 'e6aeda67-01ea-4510-8130-4bfa08f06308', 'WASTE_OUT', 2.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 2917.34, 5834.68, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok matang Edamame');
INSERT INTO public.finished_goods_movements VALUES ('8e63459f-e705-4292-b880-891e6dbc1b0a', '2291a87a-7497-4730-906b-8a67221aaf7e', 'WASTE_OUT', 16.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 2073.67, 33178.72, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok matang Kacang');
INSERT INTO public.finished_goods_movements VALUES ('2155a7c0-f6a5-453a-8f60-a6863f65f322', '95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 'WASTE_OUT', 33.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3340.45, 110234.85, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok matang Telur Ayam');
INSERT INTO public.finished_goods_movements VALUES ('ea48f52d-634a-484e-bace-a970893b4d8d', '07389f47-0645-42ed-ba92-f1be5c5cd557', 'WASTE_OUT', 26.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1000.00, 26000.00, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok matang Singkong');
INSERT INTO public.finished_goods_movements VALUES ('c612fcbd-282b-4e79-ae01-e580f8eb7e5b', 'b66e9cf0-07bb-4e7f-903b-5dc87737e1bc', 'WASTE_OUT', 3012.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 6.97, 20993.64, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok matang Jagung Manis');
INSERT INTO public.finished_goods_movements VALUES ('ceeb2247-90c0-404c-aa0c-e0cdbd846f71', 'e6aeda67-01ea-4510-8130-4bfa08f06308', 'WASTE_OUT', 3.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 3000.00, 9000.00, 'WASTE', NULL, '2026-10-14 11:21:06.789432+07', 'WASTE: Tes terbuang 3 porsi matang');
INSERT INTO public.finished_goods_movements VALUES ('548eff9a-29c4-463d-b685-54dbefb477a2', 'e6aeda67-01ea-4510-8130-4bfa08f06308', 'WASTE_OUT', 2.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 3000.00, 6000.00, 'WASTE', NULL, '2026-10-14 11:21:06.891242+07', 'Pengosongan sisa stok matang Edamame');


--
-- Data for Name: finished_goods_stock; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.finished_goods_stock VALUES ('5aa799ca-1a9d-4d0e-90fc-d6b43c924692', '0b75e976-e2f2-4234-8816-351eb9877c68', 0.000, 0.00, 1571.43, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.finished_goods_stock VALUES ('cda91610-81f8-4f32-95c9-e21ee1cac511', '2291a87a-7497-4730-906b-8a67221aaf7e', 0.000, 0.00, 2073.67, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.finished_goods_stock VALUES ('2d078a2b-3f9a-4bab-88bc-d11e0c4b6eba', '95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 0.000, 0.00, 3340.45, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.finished_goods_stock VALUES ('d6fbb377-1f75-493b-b776-c324c63ece5a', '07389f47-0645-42ed-ba92-f1be5c5cd557', 0.000, 0.00, 1000.00, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.finished_goods_stock VALUES ('3a8635c9-961a-4f69-b4ab-0fa05151689f', 'b66e9cf0-07bb-4e7f-903b-5dc87737e1bc', 0.000, 0.00, 6.97, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.finished_goods_stock VALUES ('fa0b9262-93cf-4c1f-9f13-4c813307f952', 'e6aeda67-01ea-4510-8130-4bfa08f06308', 0.000, 0.00, 3000.00, '2026-10-14 11:21:06.900222+07');


--
-- Data for Name: ingredients; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ingredients VALUES ('d5870015-2136-484a-8dbc-096cc7c84fc3', 'Gembili', 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 1.000, true, false, 'Dibeli per kg, hasil produksi menjadi biji aktual', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('2cb055e6-90b7-4a24-aa4d-5c5be9e458cb', 'Ubi Oren', 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 1.000, true, false, 'Dibeli per kg, hasil produksi menjadi biji aktual', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('d7193424-e8a0-4d4b-a764-94000e079433', 'Ubi Ungu', 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 1.000, true, false, 'Dibeli per kg, hasil produksi menjadi biji aktual', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('8e19cc3a-e08e-4342-9c35-42c4df08a7a4', 'Ubi Madu', 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 1.000, true, false, 'Dibeli per kg, hasil produksi menjadi biji aktual', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('fcc1bad3-7c49-4169-9185-2516e9733550', 'Labu', 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 1.000, true, false, 'Dibeli per kg, hasil produksi menjadi biji aktual', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('1a47ad2d-4713-4e79-80c4-bf4e04171f2e', 'Singkong', 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 1.000, true, false, 'Dibeli per kg, hasil produksi menjadi biji aktual', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('1c5f26fc-437c-4789-a939-155c22204fd1', 'Edamame', 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 1.000, true, false, 'Dibeli per kg, hasil produksi menjadi porsi', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('7a616096-9651-414e-bcf1-13e6ecf9769a', 'Kacang', 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 1.000, true, false, 'Dibeli per kg, hasil produksi menjadi porsi', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('67f126a4-847d-4199-937d-199273ed81d6', 'Telur Ayam', 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 1.000, true, false, 'Dibeli per kg, hasil produksi menjadi biji', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('92a2ae01-912f-48d9-a503-0314338ef8f1', 'Jagung Ungu', 'ea984a71-fdfe-474a-92f5-662871d36272', 5.000, true, false, 'Dibeli berdasarkan jumlah biji', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('eaf117a0-e315-4209-80a6-a3a9afc18320', 'Sukun', 'ea984a71-fdfe-474a-92f5-662871d36272', 2.000, true, false, 'Dibeli dan digunakan per biji', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('6af4047e-4bdb-4742-a261-2e2e987ab3d0', 'Pisang', 'ea984a71-fdfe-474a-92f5-662871d36272', 5.000, true, false, 'Dibeli dan digunakan per biji', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');
INSERT INTO public.ingredients VALUES ('1e4c2ec4-1f55-47b3-877c-c14d226dc472', 'Jagung Manis', 'ea984a71-fdfe-474a-92f5-662871d36272', 5.000, true, false, 'Dibeli berdasarkan jumlah biji', '2026-09-24 17:07:34.526984+07', '2026-09-24 17:07:34.526984+07');


--
-- Data for Name: packaging_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.packaging_items VALUES ('e1234567-1111-4444-8888-123456789001', 'Mika', '967cbbc8-36ad-47ec-acc3-bb3067dd4375', 10.000, true, 'Kemasan mika untuk produk kukusan', '2026-09-24 19:25:14.242743+07', '2026-09-24 19:25:14.242743+07');


--
-- Data for Name: packaging_movements; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.packaging_movements VALUES ('e1234567-5555-4444-8888-123456789005', 'e1234567-1111-4444-8888-123456789001', 'PURCHASE', 20.000, '967cbbc8-36ad-47ec-acc3-bb3067dd4375', 500.00, 10000.00, 'PACKAGING_PURCHASE', 'e1234567-2222-4444-8888-123456789002', '2026-09-24 19:26:58.396551+07', 'Pembelian 20 pcs Mika');
INSERT INTO public.packaging_movements VALUES ('e1234567-7777-4444-8888-123456789007', 'e1234567-1111-4444-8888-123456789001', 'SALE_USE', 5.000, '967cbbc8-36ad-47ec-acc3-bb3067dd4375', 500.00, 2500.00, 'SALE', 'c1234567-1111-4444-8888-123456789001', '2026-09-24 19:28:09.108692+07', 'Pemakaian 5 pcs Mika untuk penjualan Lapak');
INSERT INTO public.packaging_movements VALUES ('c67f0622-0ae8-4dd9-88b8-290f095dad21', 'e1234567-1111-4444-8888-123456789001', 'STOCKTAKE_OUT', 3.000, '967cbbc8-36ad-47ec-acc3-bb3067dd4375', 500.00, 1500.00, 'PACKAGING_STOCKTAKE', '6fd35616-a985-4d17-9d92-f6109817cddd', '2026-09-25 09:10:06.6526+07', 'Selisih stock opname: stok fisik lebih sedikit dari stok sistem');
INSERT INTO public.packaging_movements VALUES ('2b88aa09-2936-4948-910b-a7cf68d04460', 'e1234567-1111-4444-8888-123456789001', 'STOCKTAKE_IN', 2.000, '967cbbc8-36ad-47ec-acc3-bb3067dd4375', 500.00, 1000.00, 'PACKAGING_STOCKTAKE', '05ea09de-e605-4a05-9a58-ae8914a36e75', '2026-09-25 09:11:36.406437+07', 'Selisih stock opname: stok fisik lebih banyak dari stok sistem');
INSERT INTO public.packaging_movements VALUES ('49ea30e1-67af-44ca-92c7-3e90e609558e', 'e1234567-1111-4444-8888-123456789001', 'STOCKTAKE_OUT', 2.000, '967cbbc8-36ad-47ec-acc3-bb3067dd4375', 500.00, 1000.00, 'STOCKTAKE', '531326fa-ea51-46ad-9c3a-f6e21c5c1bac', '2026-09-28 00:00:00+07', 'Hasil hitung fisik');
INSERT INTO public.packaging_movements VALUES ('2b68e993-779d-4601-946e-4f0128358ed3', 'e1234567-1111-4444-8888-123456789001', 'PURCHASE', 10.000, '967cbbc8-36ad-47ec-acc3-bb3067dd4375', 500.00, 5000.00, 'PACKAGING_PURCHASE', '8bcf9827-a398-46a1-9111-16a3d4c9c542', '2026-09-29 15:00:00+07', 'Tes API pembelian Mika');


--
-- Data for Name: packaging_purchase_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.packaging_purchase_items VALUES ('e1234567-3333-4444-8888-123456789003', 'e1234567-2222-4444-8888-123456789002', 'e1234567-1111-4444-8888-123456789001', '967cbbc8-36ad-47ec-acc3-bb3067dd4375', 20.000, 500.00, 10000.00);
INSERT INTO public.packaging_purchase_items VALUES ('f5a82374-ba5f-40c1-8618-97f2324729b6', '8bcf9827-a398-46a1-9111-16a3d4c9c542', 'e1234567-1111-4444-8888-123456789001', '967cbbc8-36ad-47ec-acc3-bb3067dd4375', 10.000, 500.00, 5000.00);


--
-- Data for Name: packaging_purchases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.packaging_purchases VALUES ('e1234567-2222-4444-8888-123456789002', '2026-09-24 19:26:58.396551+07', 'Supplier Kemasan', 10000.00, 'CASH', 'Pengujian pembelian Mika', '2026-09-24 19:26:58.396551+07');
INSERT INTO public.packaging_purchases VALUES ('8bcf9827-a398-46a1-9111-16a3d4c9c542', '2026-09-29 15:00:00+07', 'Toko Kemasan', 5000.00, 'CASH', 'Tes API pembelian Mika', '2026-09-29 15:04:24.050481+07');


--
-- Data for Name: packaging_stock_balance; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.packaging_stock_balance VALUES ('e1234567-4444-4444-8888-123456789004', 'e1234567-1111-4444-8888-123456789001', 22.000, 11000.00, 500.00, '2026-09-29 15:04:24.050481+07');


--
-- Data for Name: packaging_stock_opname_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.packaging_stock_opname_items VALUES ('ab54ae38-f101-44b0-af0e-e07d885780b9', '6fd35616-a985-4d17-9d92-f6109817cddd', 'e1234567-1111-4444-8888-123456789001', 15.000, 12, -3.000, 500.00, -1500.00000, 'Simulasi fisik Mika = 12 pcs');
INSERT INTO public.packaging_stock_opname_items VALUES ('ffe45790-4237-4a40-9a4c-5cc8ec491cbd', '05ea09de-e605-4a05-9a58-ae8914a36e75', 'e1234567-1111-4444-8888-123456789001', 12.000, 14, 2.000, 500.00, 1000.00000, 'Simulasi fisik Mika = 14 pcs');
INSERT INTO public.packaging_stock_opname_items VALUES ('016671f4-7fcb-457d-9963-3fac5d38775c', '531326fa-ea51-46ad-9c3a-f6e21c5c1bac', 'e1234567-1111-4444-8888-123456789001', 14.0, 12.0, -2.0, 500.0, -1000.0, 'Hasil hitung fisik');


--
-- Data for Name: packaging_stock_opnames; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.packaging_stock_opnames VALUES ('6fd35616-a985-4d17-9d92-f6109817cddd', '2026-09-25', 'Simulasi stock opname Mika', '2026-09-25 09:10:06.6526+07');
INSERT INTO public.packaging_stock_opnames VALUES ('05ea09de-e605-4a05-9a58-ae8914a36e75', '2026-09-25', 'Simulasi stock opname kedua Mika - fisik lebih banyak', '2026-09-25 09:11:36.406437+07');
INSERT INTO public.packaging_stock_opnames VALUES ('531326fa-ea51-46ad-9c3a-f6e21c5c1bac', '2026-09-28', 'Tes stock opname Mika', '2026-09-28 21:07:58.314331+07');


--
-- Data for Name: production; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: production_inputs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: production_outputs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.products VALUES ('66ededbf-4587-4980-836f-c26225c317e9', 'Jagung Ungu', 'ea984a71-fdfe-474a-92f5-662871d36272', 2000.00, 'Produk Kukusan', true, false, 'Dijual per biji', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('3ed6644f-1835-485e-9cc2-f92fae4d4c59', 'Sukun', 'ea984a71-fdfe-474a-92f5-662871d36272', 2000.00, 'Produk Kukusan', true, false, 'Dijual per biji', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('909c684e-cddd-4448-a7d3-8e2cd7613c4a', 'Gembili', 'ea984a71-fdfe-474a-92f5-662871d36272', 2000.00, 'Produk Kukusan', true, false, 'Hasil produksi aktual dari bahan kg', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('e6b3378f-c9c2-4e08-88ac-319b346262ef', 'Ubi Oren', 'ea984a71-fdfe-474a-92f5-662871d36272', 2000.00, 'Produk Kukusan', true, false, 'Hasil produksi aktual dari bahan kg', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('3fb6e1fe-b8bf-4e19-bf48-3e69df5ad965', 'Ubi Ungu', 'ea984a71-fdfe-474a-92f5-662871d36272', 2000.00, 'Produk Kukusan', true, false, 'Hasil produksi aktual dari bahan kg', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('0b75e976-e2f2-4234-8816-351eb9877c68', 'Ubi Madu', 'ea984a71-fdfe-474a-92f5-662871d36272', 2000.00, 'Produk Kukusan', true, false, 'Hasil produksi aktual dari bahan kg', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('b19f7df5-ff4c-46cf-9eb9-9eba41d8d1ae', 'Labu', 'ea984a71-fdfe-474a-92f5-662871d36272', 2000.00, 'Produk Kukusan', true, false, 'Hasil produksi aktual dari bahan kg', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('07389f47-0645-42ed-ba92-f1be5c5cd557', 'Singkong', 'ea984a71-fdfe-474a-92f5-662871d36272', 2000.00, 'Produk Kukusan', true, false, 'Hasil produksi aktual dari bahan kg', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('0a9fb454-388d-44ef-91d1-7f352357692b', 'Pisang', 'ea984a71-fdfe-474a-92f5-662871d36272', 2000.00, 'Produk Kukusan', true, false, 'Dijual per biji', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('b66e9cf0-07bb-4e7f-903b-5dc87737e1bc', 'Jagung Manis', 'ea984a71-fdfe-474a-92f5-662871d36272', 2000.00, 'Produk Kukusan', true, false, 'Dijual per biji', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 'Telur Ayam', 'ea984a71-fdfe-474a-92f5-662871d36272', 3000.00, 'Produk Kukusan', true, false, 'Dijual per biji', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('e6aeda67-01ea-4510-8130-4bfa08f06308', 'Edamame', '2b0c0337-a505-4da4-a814-e8d186b90576', 2000.00, 'Produk Kukusan', true, false, 'Dijual per porsi/capitan', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');
INSERT INTO public.products VALUES ('2291a87a-7497-4730-906b-8a67221aaf7e', 'Kacang', '2b0c0337-a505-4da4-a814-e8d186b90576', 2000.00, 'Produk Kukusan', true, false, 'Dijual per porsi/capitan', '2026-09-24 17:10:30.173449+07', '2026-09-24 17:10:30.173449+07');


--
-- Data for Name: purchase_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: purchases; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: sale_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sale_items VALUES ('0b53c80b-46df-4027-a824-dabb586d342c', 'c1234567-1111-4444-8888-123456789001', '0b75e976-e2f2-4234-8816-351eb9877c68', 5.000, 2000.00, 10000.00, 1571.43, 7857.15, 2142.85);
INSERT INTO public.sale_items VALUES ('81ca54f0-0e6f-4288-8651-1ddb2aa51fe0', 'c1234567-1111-4444-8888-123456789001', '95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 5.000, 3000.00, 15000.00, 3300.00, 16500.00, -1500.00);
INSERT INTO public.sale_items VALUES ('8651c446-addd-4a93-9af5-47da431da939', 'c1234567-1111-4444-8888-123456789001', '2291a87a-7497-4730-906b-8a67221aaf7e', 5.000, 2000.00, 10000.00, 2080.00, 10400.00, -400.00);
INSERT INTO public.sale_items VALUES ('1f3149c7-d765-472f-9874-3a721cfb8583', '22731498-0c02-4aa6-943b-a338eb82bada', '95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 2.000, 3000.00, 6000.00, 3320.00, 6640.00, -640.00);
INSERT INTO public.sale_items VALUES ('6ef81695-7870-498e-b91e-a48c45d0952d', 'd8995295-ebda-4c31-a431-e3dd3be2e5a3', '07389f47-0645-42ed-ba92-f1be5c5cd557', 6.000, 2000.00, 12000.00, 1000.00, 6000.00, 6000.00);


--
-- Data for Name: sale_packaging_items; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sale_packaging_items VALUES ('e1234567-6666-4444-8888-123456789006', 'c1234567-1111-4444-8888-123456789001', 'e1234567-1111-4444-8888-123456789001', 5.000, 500.00, 2500.00);


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sales VALUES ('c1234567-1111-4444-8888-123456789001', '2026-09-24 19:10:47.298211+07', '8a66bc40-70e5-420a-bf0a-77da20f5c094', 35000.00, 0.00, 0.00, 35000.00, 35000.00, 'CASH', 'PAID', 'Pengujian penjualan Lapak');
INSERT INTO public.sales VALUES ('3d4518aa-8679-4d5d-976e-ca7e4645cda5', '2026-09-25 17:00:00+07', '994c8a8b-f849-4112-ac55-35673205ff10', 100000.00, 0.00, 20000.00, 100000.00, 80000.00, 'BANK', 'PAID', 'Simulasi transaksi GoFood');
INSERT INTO public.sales VALUES ('22731498-0c02-4aa6-943b-a338eb82bada', '2026-09-25 18:00:00+07', '8a66bc40-70e5-420a-bf0a-77da20f5c094', 6000.00, 0.00, 0.00, 6000.00, 6000.00, 'CASH', 'PAID', 'Tes API penjualan Lapak - Telur');
INSERT INTO public.sales VALUES ('1f80d55a-c4eb-4bfe-9d35-206451bcb9a6', '2026-09-28 19:00:00+07', '994c8a8b-f849-4112-ac55-35673205ff10', 100000.00, 0.00, 20000.00, 100000.00, 80000.00, 'BANK', 'PAID', 'Tes API penjualan GoFood');
INSERT INTO public.sales VALUES ('d8995295-ebda-4c31-a431-e3dd3be2e5a3', '2026-10-12 21:20:00+07', '8a66bc40-70e5-420a-bf0a-77da20f5c094', 12000.00, 0.00, 0.00, 12000.00, 12000.00, 'CASH', 'PAID', 'Penjualan Lapak Singkong 6 biji');


--
-- Data for Name: sales_channels; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sales_channels VALUES ('8a66bc40-70e5-420a-bf0a-77da20f5c094', 'Lapak', true);
INSERT INTO public.sales_channels VALUES ('994c8a8b-f849-4112-ac55-35673205ff10', 'GoFood', true);


--
-- Data for Name: stock_balances; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.stock_balances VALUES ('40c59682-a010-48cc-8f18-0c8a8460d9db', '6af4047e-4bdb-4742-a261-2e2e987ab3d0', 0.000, 0.00, 1680.00, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.stock_balances VALUES ('56457326-a92d-48b3-81e6-27a9267809aa', '8e19cc3a-e08e-4342-9c35-42c4df08a7a4', 0.000, 0.00, 12571.43, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.stock_balances VALUES ('d9200747-bb09-4cb5-950d-1ed68945dae2', '7a616096-9651-414e-bcf1-13e6ecf9769a', 0.000, 0.00, 20800.00, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.stock_balances VALUES ('58b034ff-2fe9-4160-9f44-02019e4d2719', '67f126a4-847d-4199-937d-199273ed81d6', 0.000, 0.00, 33875.00, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.stock_balances VALUES ('b4db7034-798d-494c-8341-45f726be67d7', '1a47ad2d-4713-4e79-80c4-bf4e04171f2e', 0.000, 0.00, 8000.00, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.stock_balances VALUES ('95548a7c-5b57-4bce-9f8b-eda526a93f60', '1e4c2ec4-1f55-47b3-877c-c14d226dc472', 0.000, 0.00, 3000.00, '2026-10-14 11:21:06.900222+07');
INSERT INTO public.stock_balances VALUES ('85eeb27e-1f8f-4c30-8951-825e99e314e5', '1c5f26fc-437c-4789-a939-155c22204fd1', 0.000, 0.00, 15000.00, '2026-10-14 11:21:06.900222+07');


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.stock_movements VALUES ('328813d9-d08e-4cfe-9a3f-c048ec057d57', '67f126a4-847d-4199-937d-199273ed81d6', 'PRODUCTION_USE', 2.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 33000.00, 66000.00, 'PRODUCTION', 'b1234567-1111-4444-8888-123456789001', '2026-09-24 18:18:49.319678+07', 'Penggunaan 2 kg telur untuk produksi');
INSERT INTO public.stock_movements VALUES ('458c1bb1-d4fb-40b0-84ae-14f8288c6d68', '7a616096-9651-414e-bcf1-13e6ecf9769a', 'PRODUCTION_USE', 2.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 20800.00, 41600.00, 'PRODUCTION', 'b1234567-2222-4444-8888-123456789002', '2026-09-24 18:47:36.193311+07', 'Penggunaan 2 kg kacang untuk produksi');
INSERT INTO public.stock_movements VALUES ('969c9add-d337-401f-8c88-51d3ed8b42e2', '8e19cc3a-e08e-4342-9c35-42c4df08a7a4', 'PRODUCTION_USE', 3.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 12571.43, 37714.29, 'PRODUCTION', 'b1234567-3333-4444-8888-123456789003', '2026-09-24 18:53:03.283629+07', 'Penggunaan 3 kg Ubi Madu untuk produksi');
INSERT INTO public.stock_movements VALUES ('bca9c1a7-14bd-496d-8a97-2f614d33fd7f', '67f126a4-847d-4199-937d-199273ed81d6', 'PRODUCTION_USE', 1.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 33500.00, 33500.00, 'PRODUCTION', 'd78c2404-d27f-4efd-8a73-220892e601ed', '2026-09-25 15:30:00+07', 'Tes API produksi Telur Ayam');
INSERT INTO public.stock_movements VALUES ('a1aec4e9-a766-4f7c-b1e0-cee9b872a551', '1c5f26fc-437c-4789-a939-155c22204fd1', 'PRODUCTION_USE', 0.100, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 28666.67, 2866.67, 'PRODUCTION', '8ebe6bfe-116c-48ab-b7aa-d57b1b5f14f0', '2026-10-06 13:40:00+07', 'Penggunaan bahan untuk produksi');
INSERT INTO public.stock_movements VALUES ('44e52600-c123-4605-afbb-3118f2733574', '1c5f26fc-437c-4789-a939-155c22204fd1', 'PRODUCTION_USE', 0.100, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 28666.67, 2866.67, 'PRODUCTION', '44bd7206-14ac-49d9-a316-25ee3b3e837c', '2026-10-06 15:45:00+07', 'Penggunaan bahan untuk produksi');
INSERT INTO public.stock_movements VALUES ('2452e404-9299-4abf-a3ac-cf0b7c1ce504', '7a616096-9651-414e-bcf1-13e6ecf9769a', 'PRODUCTION_USE', 0.100, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 20800.00, 2080.00, 'PRODUCTION', '44bd7206-14ac-49d9-a316-25ee3b3e837c', '2026-10-06 15:45:00+07', 'Penggunaan bahan untuk produksi');
INSERT INTO public.stock_movements VALUES ('ea98a248-50b6-4beb-8ebe-1fd85b6fd88e', '67f126a4-847d-4199-937d-199273ed81d6', 'PRODUCTION_USE', 1.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 33875.00, 33875.00, 'PRODUCTION', '92120489-17dd-4ba7-adf3-940679927bf8', '2026-10-12 20:30:00+07', 'Penggunaan bahan untuk produksi');
INSERT INTO public.stock_movements VALUES ('ea15f5c8-b38c-4d9a-8bb9-b50804256fa2', '1a47ad2d-4713-4e79-80c4-bf4e04171f2e', 'PRODUCTION_USE', 2.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 8000.00, 16000.00, 'PRODUCTION', 'd6defa3f-4709-4af8-8366-39c6e9ffdc8d', '2026-10-12 21:15:00+07', 'Penggunaan bahan untuk produksi');
INSERT INTO public.stock_movements VALUES ('a2e55873-1bc4-49c9-89b1-e1b4722945d0', '1a47ad2d-4713-4e79-80c4-bf4e04171f2e', 'PRODUCTION_USE', 2.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 8000.00, 16000.00, 'PRODUCTION', '29efb550-6608-416c-9863-aeeb27dbd16d', '2026-10-12 21:15:00+07', 'Penggunaan bahan untuk produksi');
INSERT INTO public.stock_movements VALUES ('c11a21a4-5346-404d-9410-2307170ab91e', '1e4c2ec4-1f55-47b3-877c-c14d226dc472', 'PRODUCTION_USE', 4.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3000.00, 12000.00, 'PRODUCTION', '60deda28-f9d1-44d2-83de-cbd03de40073', '2026-10-12 21:45:00+07', 'Penggunaan bahan untuk produksi');
INSERT INTO public.stock_movements VALUES ('029b70e5-f338-4975-9e48-1f0aef21b303', '1e4c2ec4-1f55-47b3-877c-c14d226dc472', 'PRODUCTION_USE', 3.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3000.00, 9000.00, 'PRODUCTION', '279c793e-7c8a-40d0-98cd-d8f0d2547846', '2026-10-12 21:45:00+07', 'Penggunaan bahan untuk produksi');
INSERT INTO public.stock_movements VALUES ('70520bc3-eb74-45c3-8283-6ab4085898a0', '6af4047e-4bdb-4742-a261-2e2e987ab3d0', 'WASTE', 50.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1680.00, 84000.00, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok mentah Pisang');
INSERT INTO public.stock_movements VALUES ('9897b9a6-c583-45e8-a81a-302b536dc3f5', '8e19cc3a-e08e-4342-9c35-42c4df08a7a4', 'WASTE', 4.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 12571.43, 50285.72, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok mentah Ubi Madu');
INSERT INTO public.stock_movements VALUES ('a34f40cf-988c-48ba-b65c-80f51ec7494b', '7a616096-9651-414e-bcf1-13e6ecf9769a', 'WASTE', 2.900, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 20800.00, 60320.00, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok mentah Kacang');
INSERT INTO public.stock_movements VALUES ('6793262e-e17e-4d9f-b438-ed4f4d5df3a6', '67f126a4-847d-4199-937d-199273ed81d6', 'WASTE', 3.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 33875.00, 101625.00, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok mentah Telur Ayam');
INSERT INTO public.stock_movements VALUES ('3a73fb67-f99b-4a47-9ab5-31331a1bbc70', '1c5f26fc-437c-4789-a939-155c22204fd1', 'WASTE', 3.800, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 28666.67, 108933.35, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok mentah Edamame');
INSERT INTO public.stock_movements VALUES ('f306033c-007f-4f74-b0bb-ff269d60c05e', '1e4c2ec4-1f55-47b3-877c-c14d226dc472', 'WASTE', 5.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3000.00, 15000.00, 'WASTE', NULL, '2026-10-14 11:14:23.968876+07', 'Pengosongan sisa stok mentah Jagung Manis');
INSERT INTO public.stock_movements VALUES ('6c920d51-62af-4770-880c-ecfa68bbb2ab', '1c5f26fc-437c-4789-a939-155c22204fd1', 'WASTE', 2.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 15000.00, 30000.00, 'WASTE', NULL, '2026-10-14 11:20:47.819596+07', 'WASTE: Tes terbuang 2kg mentah');
INSERT INTO public.stock_movements VALUES ('8912130c-3732-4666-a9d9-794bdf719f8c', '1c5f26fc-437c-4789-a939-155c22204fd1', 'WASTE', 38.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 15000.00, 570000.00, 'WASTE', NULL, '2026-10-14 11:20:48.160554+07', 'Pengosongan sisa stok mentah Edamame');


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.units VALUES ('bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 'Kilogram', 'kg', 'weight');
INSERT INTO public.units VALUES ('e3ebb889-3018-4161-b7b9-2a961992f74d', 'Gram', 'g', 'weight');
INSERT INTO public.units VALUES ('ea984a71-fdfe-474a-92f5-662871d36272', 'Biji', 'biji', 'quantity');
INSERT INTO public.units VALUES ('2b0c0337-a505-4da4-a814-e8d186b90576', 'Porsi', 'porsi', 'serving');
INSERT INTO public.units VALUES ('5f13eca6-43a2-4b04-8b12-9dba4146a6b1', 'Lembar', 'lembar', 'quantity');
INSERT INTO public.units VALUES ('967cbbc8-36ad-47ec-acc3-bb3067dd4375', 'Pcs', 'pcs', 'quantity');
INSERT INTO public.units VALUES ('d0b9cdfe-cd0b-4966-af10-4969016980f6', 'Bungkus', 'bungkus', 'package');


--
-- Data for Name: waste; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.waste VALUES ('d1234567-1111-4444-8888-123456789001', '2026-09-24 19:16:31.797954+07', '0b75e976-e2f2-4234-8816-351eb9877c68', 2.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1571.43, 3142.86, 'Produk tidak terjual dan tidak layak disimpan', 'Pengujian waste Ubi Madu', NULL, 'PRODUCT');
INSERT INTO public.waste VALUES ('14de6fb3-fd92-4a7c-953d-788a30916d4c', '2026-09-28 19:00:00+07', '2291a87a-7497-4730-906b-8a67221aaf7e', 2.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 2080.00, 4160.00, 'Rusak', 'Tes API pencatatan waste', NULL, 'PRODUCT');
INSERT INTO public.waste VALUES ('294adc03-b135-4d50-a7a1-5eb0342258b0', '2026-09-28 19:00:00+07', '0b75e976-e2f2-4234-8816-351eb9877c68', 2.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1571.43, 3142.86, 'Rusak', 'Tes API waste Ubi Madu', NULL, 'PRODUCT');
INSERT INTO public.waste VALUES ('30a7fb25-6381-4960-95a8-4da9e37efb5a', '2026-10-14 11:14:23.968876+07', NULL, 50.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1680.00, 84000.00, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok mentah Pisang', '6af4047e-4bdb-4742-a261-2e2e987ab3d0', 'RAW');
INSERT INTO public.waste VALUES ('8876a351-48c7-4f9c-a753-123859509507', '2026-10-14 11:14:23.968876+07', NULL, 4.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 12571.43, 50285.72, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok mentah Ubi Madu', '8e19cc3a-e08e-4342-9c35-42c4df08a7a4', 'RAW');
INSERT INTO public.waste VALUES ('39c4b00d-3b0b-48b8-842a-3c4ea6658e4e', '2026-10-14 11:14:23.968876+07', NULL, 2.900, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 20800.00, 60320.00, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok mentah Kacang', '7a616096-9651-414e-bcf1-13e6ecf9769a', 'RAW');
INSERT INTO public.waste VALUES ('6a72fb31-61f1-427c-a135-2574720d9108', '2026-10-14 11:14:23.968876+07', NULL, 3.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 33875.00, 101625.00, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok mentah Telur Ayam', '67f126a4-847d-4199-937d-199273ed81d6', 'RAW');
INSERT INTO public.waste VALUES ('9a56544d-53f9-4dd9-af5b-cd9dda2531ac', '2026-10-14 11:14:23.968876+07', NULL, 3.800, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 28666.67, 108933.35, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok mentah Edamame', '1c5f26fc-437c-4789-a939-155c22204fd1', 'RAW');
INSERT INTO public.waste VALUES ('fa0591f5-41d7-4043-a84e-d2d86cd2e381', '2026-10-14 11:14:23.968876+07', NULL, 5.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3000.00, 15000.00, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok mentah Jagung Manis', '1e4c2ec4-1f55-47b3-877c-c14d226dc472', 'RAW');
INSERT INTO public.waste VALUES ('5fe1ffd8-35ef-4479-be75-7a40c0e73139', '2026-10-14 11:14:23.968876+07', '0b75e976-e2f2-4234-8816-351eb9877c68', 15.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1571.43, 23571.45, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok matang Ubi Madu', NULL, 'COOKED');
INSERT INTO public.waste VALUES ('78159b9b-ec59-43e6-b416-e6e37080b284', '2026-10-14 11:14:23.968876+07', 'e6aeda67-01ea-4510-8130-4bfa08f06308', 2.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 2917.34, 5834.68, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok matang Edamame', NULL, 'COOKED');
INSERT INTO public.waste VALUES ('768b1d3e-7199-4700-b9c0-2fa1e33c5b41', '2026-10-14 11:14:23.968876+07', '2291a87a-7497-4730-906b-8a67221aaf7e', 16.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 2073.67, 33178.72, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok matang Kacang', NULL, 'COOKED');
INSERT INTO public.waste VALUES ('9d842343-6a63-4b78-9ddf-96e8fafae79f', '2026-10-14 11:14:23.968876+07', '95ce92e3-4044-4ab0-ba22-baf84cb35c9f', 33.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 3340.45, 110234.85, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok matang Telur Ayam', NULL, 'COOKED');
INSERT INTO public.waste VALUES ('d8981d26-bab3-401f-b3f3-6d7297d3b234', '2026-10-14 11:14:23.968876+07', '07389f47-0645-42ed-ba92-f1be5c5cd557', 26.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 1000.00, 26000.00, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok matang Singkong', NULL, 'COOKED');
INSERT INTO public.waste VALUES ('d54ef19b-b471-4c5e-9451-6c892ee4ef90', '2026-10-14 11:14:23.968876+07', 'b66e9cf0-07bb-4e7f-903b-5dc87737e1bc', 3012.000, 'ea984a71-fdfe-474a-92f5-662871d36272', 6.97, 20993.64, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok matang Jagung Manis', NULL, 'COOKED');
INSERT INTO public.waste VALUES ('2d2eba01-beff-4bf8-b5ae-335f7f40495d', '2026-10-14 11:20:47.819596+07', NULL, 2.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 15000.00, 30000.00, 'WASTE', 'Tes terbuang 2kg mentah', '1c5f26fc-437c-4789-a939-155c22204fd1', 'RAW');
INSERT INTO public.waste VALUES ('5bcf3225-72fc-44a1-9964-8db3b76e888f', '2026-10-14 11:20:48.160554+07', NULL, 38.000, 'bc14a2dc-ebad-42ff-882d-b2aab48c45b7', 15000.00, 570000.00, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok mentah Edamame', '1c5f26fc-437c-4789-a939-155c22204fd1', 'RAW');
INSERT INTO public.waste VALUES ('1a52c6e5-72af-46a8-91de-40c9591165b3', '2026-10-14 11:21:06.789432+07', 'e6aeda67-01ea-4510-8130-4bfa08f06308', 3.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 3000.00, 9000.00, 'WASTE', 'Tes terbuang 3 porsi matang', NULL, 'COOKED');
INSERT INTO public.waste VALUES ('d9a4449c-b2bf-4876-bedf-840ad8a8d15c', '2026-10-14 11:21:06.891242+07', 'e6aeda67-01ea-4510-8130-4bfa08f06308', 2.000, '2b0c0337-a505-4da4-a814-e8d186b90576', 3000.00, 6000.00, 'PENGOSONGAN_STOK', 'Pengosongan sisa stok matang Edamame', NULL, 'COOKED');


--
-- Name: cash_transactions cash_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_pkey PRIMARY KEY (id);


--
-- Name: daily_finance daily_finance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_finance
    ADD CONSTRAINT daily_finance_pkey PRIMARY KEY (id);


--
-- Name: daily_modal daily_modal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_modal
    ADD CONSTRAINT daily_modal_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: finished_goods_movements finished_goods_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finished_goods_movements
    ADD CONSTRAINT finished_goods_movements_pkey PRIMARY KEY (id);


--
-- Name: finished_goods_stock finished_goods_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finished_goods_stock
    ADD CONSTRAINT finished_goods_stock_pkey PRIMARY KEY (id);


--
-- Name: ingredients ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);


--
-- Name: packaging_items packaging_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_items
    ADD CONSTRAINT packaging_items_pkey PRIMARY KEY (id);


--
-- Name: packaging_movements packaging_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_movements
    ADD CONSTRAINT packaging_movements_pkey PRIMARY KEY (id);


--
-- Name: packaging_purchase_items packaging_purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_purchase_items
    ADD CONSTRAINT packaging_purchase_items_pkey PRIMARY KEY (id);


--
-- Name: packaging_purchases packaging_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_purchases
    ADD CONSTRAINT packaging_purchases_pkey PRIMARY KEY (id);


--
-- Name: packaging_stock_balance packaging_stock_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_stock_balance
    ADD CONSTRAINT packaging_stock_balance_pkey PRIMARY KEY (id);


--
-- Name: packaging_stock_opname_items packaging_stock_opname_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_stock_opname_items
    ADD CONSTRAINT packaging_stock_opname_items_pkey PRIMARY KEY (id);


--
-- Name: packaging_stock_opnames packaging_stock_opnames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_stock_opnames
    ADD CONSTRAINT packaging_stock_opnames_pkey PRIMARY KEY (id);


--
-- Name: production_inputs production_inputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_inputs
    ADD CONSTRAINT production_inputs_pkey PRIMARY KEY (id);


--
-- Name: production_outputs production_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_outputs
    ADD CONSTRAINT production_outputs_pkey PRIMARY KEY (id);


--
-- Name: production production_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production
    ADD CONSTRAINT production_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sale_packaging_items sale_packaging_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_packaging_items
    ADD CONSTRAINT sale_packaging_items_pkey PRIMARY KEY (id);


--
-- Name: sales_channels sales_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT sales_channels_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: stock_balances stock_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: expense_categories uq_expense_categories_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT uq_expense_categories_name UNIQUE (name);


--
-- Name: finished_goods_stock uq_finished_goods_stock_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finished_goods_stock
    ADD CONSTRAINT uq_finished_goods_stock_product UNIQUE (product_id);


--
-- Name: ingredients uq_ingredients_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT uq_ingredients_name UNIQUE (name);


--
-- Name: packaging_items uq_packaging_items_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_items
    ADD CONSTRAINT uq_packaging_items_name UNIQUE (name);


--
-- Name: packaging_stock_balance uq_packaging_stock_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_stock_balance
    ADD CONSTRAINT uq_packaging_stock_item UNIQUE (packaging_item_id);


--
-- Name: products uq_products_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT uq_products_name UNIQUE (name);


--
-- Name: sales_channels uq_sales_channels_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_channels
    ADD CONSTRAINT uq_sales_channels_name UNIQUE (name);


--
-- Name: stock_balances uq_stock_balances_ingredient; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT uq_stock_balances_ingredient UNIQUE (ingredient_id);


--
-- Name: units uq_units_name_symbol; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT uq_units_name_symbol UNIQUE (name, symbol);


--
-- Name: waste waste_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste
    ADD CONSTRAINT waste_pkey PRIMARY KEY (id);


--
-- Name: idx_cash_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_transactions_date ON public.cash_transactions USING btree (transaction_date);


--
-- Name: idx_cash_transactions_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_transactions_reference ON public.cash_transactions USING btree (reference_type, reference_id);


--
-- Name: idx_expenses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_category ON public.expenses USING btree (category_id);


--
-- Name: idx_expenses_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_date ON public.expenses USING btree (expense_date);


--
-- Name: idx_finished_movements_product_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finished_movements_product_date ON public.finished_goods_movements USING btree (product_id, movement_date);


--
-- Name: idx_finished_movements_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finished_movements_reference ON public.finished_goods_movements USING btree (reference_type, reference_id);


--
-- Name: idx_ingredients_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ingredients_active ON public.ingredients USING btree (active);


--
-- Name: idx_packaging_items_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packaging_items_active ON public.packaging_items USING btree (active);


--
-- Name: idx_packaging_movements_item_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packaging_movements_item_date ON public.packaging_movements USING btree (packaging_item_id, movement_date);


--
-- Name: idx_packaging_purchase_items_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packaging_purchase_items_item ON public.packaging_purchase_items USING btree (packaging_item_id);


--
-- Name: idx_packaging_purchase_items_purchase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packaging_purchase_items_purchase ON public.packaging_purchase_items USING btree (purchase_id);


--
-- Name: idx_packaging_purchases_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_packaging_purchases_date ON public.packaging_purchases USING btree (purchase_date);


--
-- Name: idx_production_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_date ON public.production USING btree (production_date);


--
-- Name: idx_production_inputs_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inputs_ingredient ON public.production_inputs USING btree (ingredient_id);


--
-- Name: idx_production_inputs_production; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_inputs_production ON public.production_inputs USING btree (production_id);


--
-- Name: idx_production_outputs_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_outputs_product ON public.production_outputs USING btree (product_id);


--
-- Name: idx_production_outputs_production; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_outputs_production ON public.production_outputs USING btree (production_id);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_active ON public.products USING btree (active);


--
-- Name: idx_purchase_items_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_ingredient ON public.purchase_items USING btree (ingredient_id);


--
-- Name: idx_purchase_items_purchase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_purchase ON public.purchase_items USING btree (purchase_id);


--
-- Name: idx_purchases_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_date ON public.purchases USING btree (purchase_date);


--
-- Name: idx_sale_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_product ON public.sale_items USING btree (product_id);


--
-- Name: idx_sale_items_sale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_sale ON public.sale_items USING btree (sale_id);


--
-- Name: idx_sale_packaging_sale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_packaging_sale ON public.sale_packaging_items USING btree (sale_id);


--
-- Name: idx_sales_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_channel ON public.sales USING btree (channel_id);


--
-- Name: idx_sales_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_date ON public.sales USING btree (sale_date);


--
-- Name: idx_sales_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_payment_status ON public.sales USING btree (payment_status);


--
-- Name: idx_stock_movements_ingredient_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_ingredient_date ON public.stock_movements USING btree (ingredient_id, movement_date);


--
-- Name: idx_stock_movements_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_reference ON public.stock_movements USING btree (reference_type, reference_id);


--
-- Name: idx_waste_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waste_date ON public.waste USING btree (date);


--
-- Name: idx_waste_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waste_product ON public.waste USING btree (product_id);


--
-- Name: finished_goods_stock trg_finished_goods_stock_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_finished_goods_stock_updated_at BEFORE UPDATE ON public.finished_goods_stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: ingredients trg_ingredients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: packaging_items trg_packaging_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_packaging_items_updated_at BEFORE UPDATE ON public.packaging_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: packaging_stock_balance trg_packaging_stock_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_packaging_stock_updated_at BEFORE UPDATE ON public.packaging_stock_balance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: products trg_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: stock_balances trg_stock_balances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stock_balances_updated_at BEFORE UPDATE ON public.stock_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: expenses fk_expenses_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE RESTRICT;


--
-- Name: finished_goods_movements fk_finished_movement_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finished_goods_movements
    ADD CONSTRAINT fk_finished_movement_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: finished_goods_movements fk_finished_movement_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finished_goods_movements
    ADD CONSTRAINT fk_finished_movement_unit FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: finished_goods_stock fk_finished_stock_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finished_goods_stock
    ADD CONSTRAINT fk_finished_stock_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: ingredients fk_ingredients_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT fk_ingredients_unit FOREIGN KEY (stock_unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: packaging_items fk_packaging_items_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_items
    ADD CONSTRAINT fk_packaging_items_unit FOREIGN KEY (stock_unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: packaging_movements fk_packaging_movement_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_movements
    ADD CONSTRAINT fk_packaging_movement_item FOREIGN KEY (packaging_item_id) REFERENCES public.packaging_items(id) ON DELETE RESTRICT;


--
-- Name: packaging_movements fk_packaging_movement_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_movements
    ADD CONSTRAINT fk_packaging_movement_unit FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: packaging_stock_opname_items fk_packaging_opname_item_opname; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_stock_opname_items
    ADD CONSTRAINT fk_packaging_opname_item_opname FOREIGN KEY (opname_id) REFERENCES public.packaging_stock_opnames(id) ON DELETE CASCADE;


--
-- Name: packaging_stock_opname_items fk_packaging_opname_item_packaging; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_stock_opname_items
    ADD CONSTRAINT fk_packaging_opname_item_packaging FOREIGN KEY (packaging_item_id) REFERENCES public.packaging_items(id) ON DELETE RESTRICT;


--
-- Name: packaging_purchase_items fk_packaging_purchase_items_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_purchase_items
    ADD CONSTRAINT fk_packaging_purchase_items_item FOREIGN KEY (packaging_item_id) REFERENCES public.packaging_items(id) ON DELETE RESTRICT;


--
-- Name: packaging_purchase_items fk_packaging_purchase_items_purchase; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_purchase_items
    ADD CONSTRAINT fk_packaging_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES public.packaging_purchases(id) ON DELETE CASCADE;


--
-- Name: packaging_purchase_items fk_packaging_purchase_items_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_purchase_items
    ADD CONSTRAINT fk_packaging_purchase_items_unit FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: packaging_stock_balance fk_packaging_stock_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packaging_stock_balance
    ADD CONSTRAINT fk_packaging_stock_item FOREIGN KEY (packaging_item_id) REFERENCES public.packaging_items(id) ON DELETE RESTRICT;


--
-- Name: production_inputs fk_production_inputs_ingredient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_inputs
    ADD CONSTRAINT fk_production_inputs_ingredient FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: production_inputs fk_production_inputs_production; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_inputs
    ADD CONSTRAINT fk_production_inputs_production FOREIGN KEY (production_id) REFERENCES public.production(id) ON DELETE CASCADE;


--
-- Name: production_inputs fk_production_inputs_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_inputs
    ADD CONSTRAINT fk_production_inputs_unit FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: production_outputs fk_production_outputs_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_outputs
    ADD CONSTRAINT fk_production_outputs_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: production_outputs fk_production_outputs_production; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_outputs
    ADD CONSTRAINT fk_production_outputs_production FOREIGN KEY (production_id) REFERENCES public.production(id) ON DELETE CASCADE;


--
-- Name: production_outputs fk_production_outputs_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_outputs
    ADD CONSTRAINT fk_production_outputs_unit FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: products fk_products_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_unit FOREIGN KEY (selling_unit_id) REFERENCES public.units(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_items fk_purchase_items_ingredient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT fk_purchase_items_ingredient FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: purchase_items fk_purchase_items_purchase; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;


--
-- Name: purchase_items fk_purchase_items_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT fk_purchase_items_unit FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: sale_items fk_sale_items_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: sale_items fk_sale_items_sale; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_packaging_items fk_sale_packaging_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_packaging_items
    ADD CONSTRAINT fk_sale_packaging_item FOREIGN KEY (packaging_item_id) REFERENCES public.packaging_items(id) ON DELETE RESTRICT;


--
-- Name: sale_packaging_items fk_sale_packaging_sale; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_packaging_items
    ADD CONSTRAINT fk_sale_packaging_sale FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sales fk_sales_channel; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sales_channel FOREIGN KEY (channel_id) REFERENCES public.sales_channels(id) ON DELETE RESTRICT;


--
-- Name: stock_balances fk_stock_balances_ingredient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT fk_stock_balances_ingredient FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: stock_movements fk_stock_movements_ingredient; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_stock_movements_ingredient FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE RESTRICT;


--
-- Name: stock_movements fk_stock_movements_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT fk_stock_movements_unit FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: waste fk_waste_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste
    ADD CONSTRAINT fk_waste_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: waste fk_waste_unit; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste
    ADD CONSTRAINT fk_waste_unit FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE RESTRICT;


--
-- Name: waste waste_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waste
    ADD CONSTRAINT waste_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


