import os

import psycopg2
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        # Supabase and cloud Postgres require SSL
        if "sslmode=" not in database_url and "localhost" not in database_url and "127.0.0.1" not in database_url:
            separator = "&" if "?" in database_url else "?"
            database_url = f"{database_url}{separator}sslmode=require"
        return psycopg2.connect(database_url, options="-c timezone=Asia/Jakarta")
    return psycopg2.connect(
        host=os.getenv("DATABASE_HOST"),
        port=os.getenv("DATABASE_PORT"),
        database=os.getenv("DATABASE_NAME"),
        user=os.getenv("DATABASE_USER"),
        password=os.getenv("DATABASE_PASSWORD"),
        options="-c timezone=Asia/Jakarta",
    )