import psycopg

try:
    with psycopg.connect(
        "postgresql://wms_user:wms_pass_dev@localhost:5432/wms_db"
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT version()")
            print(f"✅ PostgreSQL connected: {cur.fetchone()[0]}")
except Exception as e:
    print(f"❌ Error: {e}")