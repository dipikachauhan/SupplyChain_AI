from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import core as models

def get_suppliers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Supplier).offset(skip).limit(limit).all()

def get_supplier_by_id(db: Session, supplier_id: str):
    return db.query(models.Supplier).filter(models.Supplier.supplier_id == supplier_id).first()

def get_products(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Product).offset(skip).limit(limit).all()

def get_inventory(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Inventory).offset(skip).limit(limit).all()

def get_logistics(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Logistics).offset(skip).limit(limit).all()

def get_news_events(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.NewsEvent).offset(skip).limit(limit).all()

def get_risk_scores(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.SupplierRiskScore).offset(skip).limit(limit).all()

def get_dashboard_metrics(db: Session):
    total_suppliers = db.query(func.count(models.Supplier.supplier_id)).scalar() or 0
    total_products = db.query(func.count(models.Product.product_id)).scalar() or 0
    high_risk_suppliers = db.query(func.count(models.SupplierRiskScore.id)).filter(
        models.SupplierRiskScore.risk_level == 'High'
    ).scalar() or 0
    recent_news_count = db.query(func.count(models.NewsEvent.id)).scalar() or 0
    total_inventory_items = db.query(func.sum(models.Inventory.current_stock)).scalar() or 0

    return {
        "total_suppliers": total_suppliers,
        "total_products": total_products,
        "high_risk_suppliers": high_risk_suppliers,
        "recent_news_count": recent_news_count,
        "total_inventory": int(total_inventory_items)
    }
