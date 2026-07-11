import os
import sys
import csv

# Add the backend directory to sys.path so we can import app modules
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from app.database import engine, Base, SessionLocal
from app.models import core as models

def clear_db():
    print("Dropping existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating new tables...")
    Base.metadata.create_all(bind=engine)

def import_csv_to_model(csv_path: str, model_class, db_session):
    if not os.path.exists(csv_path):
        print(f"File not found: {csv_path}")
        return

    print(f"Importing {csv_path} into {model_class.__tablename__}...")
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        records = []
        for row in reader:
            # Convert empty strings to None
            clean_row = {k: (v if v.strip() != "" else None) for k, v in row.items()}
            records.append(model_class(**clean_row))
        
        db_session.bulk_save_objects(records)
        db_session.commit()
    print(f"Successfully imported {len(records)} records into {model_class.__tablename__}.")

def main():
    # The data directory is located outside the backend folder
    PROJECT_ROOT = os.path.dirname(BASE_DIR)
    DATA_DIR = os.path.join(PROJECT_ROOT, "data")
    
    clear_db()
    db = SessionLocal()

    mapping = [
        ("countries.csv", models.Country),
        ("risk_categories.csv", models.RiskCategory),
        ("suppliers.csv", models.Supplier),
        ("products.csv", models.Product),
        ("warehouses.csv", models.Warehouse),
        ("inventory.csv", models.Inventory),
        ("logistics.csv", models.Logistics),
        ("manufacturing_plants.csv", models.ManufacturingPlant),
        ("mitigation_log.csv", models.MitigationLog),
        ("news_events.csv", models.NewsEvent),
        ("product_components.csv", models.ProductComponent),
        ("supplier_relationships.csv", models.SupplierRelationship),
        ("supplier_risk_scores.csv", models.SupplierRiskScore),
    ]

    try:
        for filename, model in mapping:
            csv_path = os.path.join(DATA_DIR, filename)
            import_csv_to_model(csv_path, model, db)
    except Exception as e:
        print(f"Error during import: {e}")
        db.rollback()
    finally:
        db.close()
        print("Import process finished.")

if __name__ == "__main__":
    main()
