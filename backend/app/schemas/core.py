from pydantic import BaseModel, Field
from typing import Optional, List

class CountryBase(BaseModel):
    country: str
    region: Optional[str] = None
    risk_zone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class Country(CountryBase):
    class Config:
        from_attributes = True

class InventoryBase(BaseModel):
    supplier_id: str
    current_stock: Optional[int] = None
    safety_stock: Optional[int] = None
    buffer_days: Optional[int] = None
    warehouse: Optional[str] = None

class Inventory(InventoryBase):
    id: int
    class Config:
        from_attributes = True

class LogisticsBase(BaseModel):
    route_id: str
    supplier_id: str
    origin_country: Optional[str] = None
    destination_country: Optional[str] = None
    origin_port: Optional[str] = None
    destination_port: Optional[str] = None
    transport_method: Optional[str] = None
    transit_time_days: Optional[int] = None

class Logistics(LogisticsBase):
    class Config:
        from_attributes = True

class ManufacturingPlantBase(BaseModel):
    plant_id: str
    country: Optional[str] = None
    city: Optional[str] = None
    capacity: Optional[int] = None

class ManufacturingPlant(ManufacturingPlantBase):
    class Config:
        from_attributes = True

class MitigationLogBase(BaseModel):
    supplier_id: str
    issue: Optional[str] = None
    recommendation: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    timestamp: Optional[str] = None

class MitigationLog(MitigationLogBase):
    id: int
    class Config:
        from_attributes = True

class NewsEventBase(BaseModel):
    date: Optional[str] = None
    headline: Optional[str] = None
    country: Optional[str] = None
    risk_category: Optional[str] = None
    severity: Optional[str] = None
    affected_supplier: Optional[str] = None
    status: Optional[str] = None

class NewsEvent(NewsEventBase):
    id: int
    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    product_id: str
    model: Optional[str] = None
    launch_year: Optional[int] = None
    segment: Optional[str] = None

class Product(ProductBase):
    class Config:
        from_attributes = True

class ProductComponentBase(BaseModel):
    product_id: str
    component: Optional[str] = None
    supplier_id: str

class ProductComponent(ProductComponentBase):
    id: int
    class Config:
        from_attributes = True

class RiskCategoryBase(BaseModel):
    risk_category: str

class RiskCategory(RiskCategoryBase):
    class Config:
        from_attributes = True

class SupplierBase(BaseModel):
    supplier_id: str
    supplier_name: Optional[str] = None
    tier: Optional[int] = None
    component: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    criticality: Optional[str] = None
    lead_time_days: Optional[int] = None
    capacity: Optional[int] = None
    inventory_buffer: Optional[int] = None
    transport_mode: Optional[str] = None
    backup_supplier: Optional[str] = None
    status: Optional[str] = None

class Supplier(SupplierBase):
    class Config:
        from_attributes = True

class SupplierRiskSummary(BaseModel):
    risk_probability: Optional[float] = None
    business_impact: Optional[float] = None
    risk_level: Optional[str] = None
    last_updated: Optional[str] = None

class SupplierSummary(SupplierBase):
    risk_score: Optional[SupplierRiskSummary] = None

class SupplierProduct(BaseModel):
    product_id: str
    component: Optional[str] = None

class SupplierNews(BaseModel):
    id: int
    date: Optional[str] = None
    headline: Optional[str] = None
    country: Optional[str] = None
    risk_category: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None

class SupplierLogistics(LogisticsBase):
    class Config:
        from_attributes = True

class SupplierRelationshipSummary(BaseModel):
    source_supplier: str
    target_supplier: str
    dependency_strength: Optional[str] = None

    class Config:
        from_attributes = True

class SupplierDetail(SupplierSummary):
    products: List[SupplierProduct] = Field(default_factory=list)
    recent_news: List[SupplierNews] = Field(default_factory=list)
    logistics_relationships: List[SupplierLogistics] = Field(default_factory=list)
    supplier_relationships: List[SupplierRelationshipSummary] = Field(default_factory=list)

class SupplierRelationshipBase(BaseModel):
    source_supplier: str
    target_supplier: str
    dependency_strength: Optional[str] = None

class SupplierRelationship(SupplierRelationshipBase):
    id: int
    class Config:
        from_attributes = True

class SupplierRiskScoreBase(BaseModel):
    supplier_id: str
    risk_probability: Optional[float] = None
    business_impact: Optional[float] = None
    risk_level: Optional[str] = None
    last_updated: Optional[str] = None

class SupplierRiskScore(SupplierRiskScoreBase):
    id: int
    class Config:
        from_attributes = True

class WarehouseBase(BaseModel):
    warehouse_id: str
    country: Optional[str] = None
    city: Optional[str] = None
    storage_capacity: Optional[int] = None
    inventory: Optional[int] = None

class Warehouse(WarehouseBase):
    class Config:
        from_attributes = True

class DashboardMetrics(BaseModel):
    total_suppliers: int
    total_products: int
    high_risk_suppliers: int
    recent_news_count: int
    total_inventory: int
