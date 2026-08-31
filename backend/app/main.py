from fastapi import FastAPI

app = FastAPI(
    title="SIH26206 Disaster Response Intelligence",
    description="Backend API for the dynamic disaster-response decision-support system.",
    version="0.1.0",
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "disaster-response-backend",
        "version": "0.1.0",
    }