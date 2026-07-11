import os
import sqlite3
import pandas as pd

# Current file -> backend/scripts
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Go back to backend
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)

# Go back to SupplyChain project
PROJECT_DIR = os.path.dirname(BACKEND_DIR)

# Data folder
DATA_DIR = os.path.join(PROJECT_DIR, "data")

# SQLite Database
DATABASE_PATH = os.path.join(BACKEND_DIR, "chainguard.db")

conn = sqlite3.connect(DATABASE_PATH)

print("=" * 50)
print("Loading CSV files into SQLite...")
print("=" * 50)

for file in os.listdir(DATA_DIR):

    if file.endswith(".csv"):

        table_name = file.replace(".csv", "")

        file_path = os.path.join(DATA_DIR, file)

        df = pd.read_csv(file_path)

        df.to_sql(
            table_name,
            conn,
            if_exists="replace",
            index=False
        )

        print(f"Loaded: {table_name}")

conn.close()

print("=" * 50)
print("Database Created Successfully!")
print("=" * 50)