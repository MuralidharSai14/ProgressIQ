import pytest
import datetime
from app.services.risk_engine import classify_health, detect_risks

def test_classify_health():
    assert classify_health(5.0, 0, 0) == "on_track"
    assert classify_health(-4.0, 0, 0) == "on_track"
    assert classify_health(-6.0, 0, 0) == "at_risk"
    assert classify_health(0.0, 1, 0) == "at_risk"
    assert classify_health(-11.0, 0, 0) == "delayed"
    assert classify_health(0.0, 6, 0) == "delayed"
    assert classify_health(0.0, 0, 1) == "critical"
    assert classify_health(-25.0, 0, 0) == "critical"

def test_detect_risks_empty():
    assert detect_risks([], 1) == []

def test_detect_risks_critical():
    future_date = datetime.datetime.now() + datetime.timedelta(days=10)
    activities = [{
        "db_id": 100,
        "activity_id": "A1",
        "activity_name": "Task 1",
        "status": "delayed",
        "progress_variance": -25.0,
        "planned_finish": future_date,
        "level": 3
    }]
    risks = detect_risks(activities, 1)
    assert isinstance(risks, list)
