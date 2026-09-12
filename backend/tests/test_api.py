from fastapi.testclient import TestClient
from app.config import get_settings
from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "ai_provider" in data

def test_ai_extraction_mock():
    # Since AI_PROVIDER is mock by default, we can test it directly
    response = client.post("/api/ai/extract", json={"field_report_id": 99999})
    # Field report doesn't exist, should return 404
    assert response.status_code == 404
