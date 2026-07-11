from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routes import suppliers, products, inventory, logistics, news, risk, dashboard

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ChainGuard AI",
    description="AI Supply Chain Risk Intelligence Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(suppliers.router)
app.include_router(products.router)
app.include_router(inventory.router)
app.include_router(logistics.router)
app.include_router(news.router)
app.include_router(risk.router)
app.include_router(dashboard.router)

@app.get("/")
def home():
    return {
        "message": "ChainGuard AI Backend Running Successfully 🚀"
    }