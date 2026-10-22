import os
from pathlib import Path
import psycopg
from psycopg import sql
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
with psycopg.connect(
    dbname="postgres",
    user=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
    host=os.environ["POSTGRES_HOST"],
    port=os.environ["POSTGRES_PORT"],
    autocommit=True,
    connect_timeout=5,
) as connection:
    name = os.environ["POSTGRES_DB"]
    if not connection.execute(
        "SELECT 1 FROM pg_database WHERE datname = %s", [name]
    ).fetchone():
        connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
print("Base de datos independiente preparada.")
