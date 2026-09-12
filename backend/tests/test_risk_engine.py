import pytest
from app.services.risk_engine import classify_health, detect_risks

def test_classify_health():
    # On track
    assert classify_health(5.0, 0, 0) == "on_track"
    assert classify_health(-4.0, 0, 0) == "on_track"

    # At risk
    assert classify_health(-6.0, 0, 0) == "at_risk"
    assert classify_health(0.0, 1, 0) == "at_risk"

    # Delayed
    assert classify_health(-11.0, 0, 0) == "delayed"
    assert classify_health(0.0, 6, 0) == "delayed"

    # Critical
    assert classify_health(0.0, 0, 1) == "critical"
    assert classify_health(-25.0, 0, 0) == "critical"

def test_detect_risks_empty():
    assert detect_risks(1, [], {}) == []

def test_detect_risks_critical():
    # Rule 1: Critical (delayed + affects upcoming milestone < 21 days)
    activities = [{
        "db_id": 100,
        "activity_id": "A1",
        "activity_name": "Task 1",
        "status": "delayed",
        "progress_variance": -15.0,
        "planned_finish": "2030-01-10", # 10 days away (mocked via rule)
        "level": 3
    }]
    dep_map = {"A1": ["A2"]}

    # Mock the _days_until somehow? The risk engine uses real datetime,
    # so we'll just pass a recent future date.
    import datetime
    future_date = (datetime.date.today() + datetime.timedelta(days=10)).isoformat()
    activities[0]["planned_finish"] = future_date

    risks = detect_risks(1, activities, dep_map)
    
    assert len(risks) == 1
    assert risks[0]["level"] == "critical"
    assert "Task 1" in risks[0]["title"]
