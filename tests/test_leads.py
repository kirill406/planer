LEAD = {"email": "Anna@Example.com", "segment": "events", "tier": "pro"}


def test_leads_create_new_email_created(client):
    response = client.post("/api/leads", json=LEAD)
    assert response.status_code == 200
    assert response.json() == {"ok": True, "created": True}


def test_leads_repeat_email_updates_without_duplicate(client, admin_auth):
    client.post("/api/leads", json=LEAD)
    repeat = {**LEAD, "email": "anna@example.com", "segment": "adhd"}
    response = client.post("/api/leads", json=repeat)
    assert response.json() == {"ok": True, "created": False}
    csv_text = client.get("/admin/leads.csv", auth=admin_auth).text
    assert csv_text.count("anna@example.com") == 1
    assert ",adhd," in csv_text


def test_leads_invalid_email_rejected(client):
    response = client.post("/api/leads", json={**LEAD, "email": "nope"})
    assert response.status_code == 422


def test_leads_unknown_segment_rejected(client):
    response = client.post("/api/leads", json={**LEAD, "segment": "x"})
    assert response.status_code == 422


def test_leads_honeypot_filled_not_saved(client, admin_auth):
    response = client.post(
        "/api/leads", json={**LEAD, "website": "http://spam"}
    )
    assert response.json() == {"ok": True, "created": False}
    csv_text = client.get("/admin/leads.csv", auth=admin_auth).text
    assert "anna@example.com" not in csv_text
