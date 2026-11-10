from fastapi.testclient import TestClient

from planer.app import create_app


def send(client, name, session_id, **props):
    client.post(
        "/api/events",
        json={"name": name, "session_id": session_id, "props": props},
    )


def test_admin_without_auth_unauthorized(client):
    response = client.get("/admin")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Basic"


def test_admin_wrong_password_unauthorized(client):
    response = client.get("/admin", auth=("admin", "wrong"))
    assert response.status_code == 401


def test_admin_disabled_without_password_not_found(settings):
    settings.admin_password = ""
    with TestClient(create_app(settings)) as client:
        response = client.get("/admin", auth=("admin", ""))
    assert response.status_code == 404


def test_admin_funnel_counts_unique_sessions(client, admin_auth):
    send(client, "landing_view", "a")
    send(client, "landing_view", "a")
    send(client, "landing_view", "b")
    send(client, "pricing_click", "a", tier="pro")
    client.post(
        "/api/leads",
        json={"email": "a@example.com", "segment": "adhd", "tier": "pro"},
    )
    response = client.get("/admin", auth=admin_auth)
    assert response.status_code == 200
    html = response.text
    assert "Уникальные посетители лендинга" in html
    assert "50.0%" in html  # 1 click and 1 lead of 2 visitors
    assert "a@example.com" in html


def test_admin_csv_has_bom_and_header(client, admin_auth):
    response = client.get("/admin/leads.csv", auth=admin_auth)
    assert response.status_code == 200
    assert response.text.startswith("﻿created_at,email")
    assert "attachment" in response.headers["content-disposition"]


def test_admin_csv_formula_comment_escaped(client, admin_auth):
    client.post(
        "/api/leads",
        json={
            "email": "-x@example.com",
            "segment": "other",
            "comment": '=HYPERLINK("http://evil")',
        },
    )
    response = client.get("/admin/leads.csv", auth=admin_auth)
    assert "'-x@example.com" in response.text
    assert "'=HYPERLINK" in response.text
    assert ",=HYPERLINK" not in response.text


def test_admin_funnel_counts_leads_beyond_page_limit(
    client, admin_auth, monkeypatch
):
    monkeypatch.setattr("planer.admin.router.ADMIN_LEADS_LIMIT", 2)
    send(client, "landing_view", "a")
    for index in range(3):
        client.post(
            "/api/leads",
            json={"email": f"u{index}@example.com", "segment": "adhd"},
        )
    html = client.get("/admin", auth=admin_auth).text
    assert '<td class="num">3</td>' in html
    assert "300.0%" in html  # 3 leads of 1 visitor, not capped at 2
    assert "Заявки (3)" in html
    assert "Показаны последние 2" in html
