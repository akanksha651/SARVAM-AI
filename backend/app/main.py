from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

app = FastAPI(
    title="SARVAM AI",
    description="Open-weight AI powered problem-solving platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return {
        "project": "SARVAM AI",
        "message": "Welcome to SARVAM AI",
        "status": "running"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "SARVAM Backend"
    }
