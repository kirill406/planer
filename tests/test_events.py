def test_events_known_name_stored(client):
    response = client.post(
        "/api/events",
        json={
            "name": "pricing_click",
            "session_id": "s1",
            "props": {"tier": "pro"},
        },
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_events_unknown_name_rejected(client):
    response = client.post(
        "/api/events", json={"name": "hack", "session_id": "s1"}
    )
    assert response.status_code == 422


def test_events_empty_session_rejected(client):
    response = client.post(
        "/api/events", json={"name": "app_open", "session_id": ""}
    )
    assert response.status_code == 422


def test_events_too_many_props_rejected(client):
    props = {f"k{i}": i for i in range(11)}
    response = client.post(
        "/api/events",
        json={"name": "app_open", "session_id": "s1", "props": props},
    )
    assert response.status_code == 422


def test_events_long_prop_value_rejected(client):
    response = client.post(
        "/api/events",
        json={
            "name": "app_open",
            "session_id": "s1",
            "props": {"k": "x" * 101},
        },
    )
    assert response.status_code == 422
