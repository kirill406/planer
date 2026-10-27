def test_pages_landing_renders(client):
    response = client.get("/")
    assert response.status_code == 200
    assert 'id="lead-form"' in response.text


def test_pages_app_renders(client):
    response = client.get("/app")
    assert response.status_code == 200
    assert 'id="app"' in response.text


def test_pages_service_worker_served_from_root(client):
    response = client.get("/sw.js")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/javascript")


def test_pages_manifest_served(client):
    response = client.get("/manifest.webmanifest")
    assert response.status_code == 200
    assert response.json()["start_url"] == "/app"


def test_pages_healthz_ok(client):
    assert client.get("/healthz").json()["status"] == "ok"


def test_pages_static_engine_served(client):
    response = client.get("/static/js/engine.js")
    assert response.status_code == 200


def test_pages_localtime_naive_value_treated_as_utc():
    from datetime import UTC, datetime

    from planer.pages.router import localtime

    naive = datetime(2026, 10, 28, 12, 0)
    aware = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)
    assert localtime(naive) == localtime(aware)
    assert localtime(naive).tzinfo is not None
