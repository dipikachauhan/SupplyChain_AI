from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Text
from app.database import Base

class Country(Base):
    __tablename__ = "countries"
    country = Column(String, primary_key=True, index=True)
    region = Column(String)
    risk_zone = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)

class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    supplier_id = Column(String, index=True)
    current_stock = Column(Integer)
    safety_stock = Column(Integer)
    buffer_days = Column(Integer)
    warehouse = Column(String)

class Logistics(Base):
    __tablename__ = "logistics"
    route_id = Column(String, primary_key=True, index=True)
    supplier_id = Column(String, index=True)
    origin_country = Column(String)
    destination_country = Column(String)
    origin_port = Column(String)
    destination_port = Column(String)
    transport_method = Column(String)
    transit_time_days = Column(Integer)

class ManufacturingPlant(Base):
    __tablename__ = "manufacturing_plants"
    plant_id = Column(String, primary_key=True, index=True)
    country = Column(String)
    city = Column(String)
    capacity = Column(Integer)

class MitigationLog(Base):
    __tablename__ = "mitigation_log"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    supplier_id = Column(String, index=True)
    issue = Column(Text)
    recommendation = Column(Text)
    priority = Column(String)
    status = Column(String)
    timestamp = Column(String)

class NewsEvent(Base):
    __tablename__ = "news_events"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(String)
    headline = Column(Text)
    country = Column(String)
    risk_category = Column(String)
    severity = Column(String)
    affected_supplier = Column(String)
    status = Column(String)

class Product(Base):
    __tablename__ = "products"
    product_id = Column(String, primary_key=True, index=True)
    model = Column(String)
    launch_year = Column(Integer)
    segment = Column(String)

class ProductComponent(Base):
    __tablename__ = "product_components"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(String, index=True)
    component = Column(String)
    supplier_id = Column(String, index=True)

class RiskCategory(Base):
    __tablename__ = "risk_categories"
    risk_category = Column(String, primary_key=True, index=True)

class Supplier(Base):
    __tablename__ = "suppliers"
    supplier_id = Column(String, primary_key=True, index=True)
    supplier_name = Column(String)
    tier = Column(Integer)
    component = Column(String)
    country = Column(String)
    city = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    criticality = Column(String)
    lead_time_days = Column(Integer)
    capacity = Column(Integer)
    inventory_buffer = Column(Integer)
    transport_mode = Column(String)
    backup_supplier = Column(String)
    status = Column(String)

class SupplierRelationship(Base):
    __tablename__ = "supplier_relationships"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    source_supplier = Column(String, index=True)
    target_supplier = Column(String, index=True)
    dependency_strength = Column(String)

class SupplierRiskScore(Base):
    __tablename__ = "supplier_risk_scores"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    supplier_id = Column(String, index=True)
    risk_probability = Column(Float)
    business_impact = Column(Float)
    risk_level = Column(String)
    last_updated = Column(String)

class Warehouse(Base):
    __tablename__ = "warehouses"
    warehouse_id = Column(String, primary_key=True, index=True)
    country = Column(String)
    city = Column(String)
    storage_capacity = Column(Integer)
    inventory = Column(Integer)
