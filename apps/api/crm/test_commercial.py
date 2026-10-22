from datetime import timedelta
from uuid import uuid4
from django.test import TestCase, TransactionTestCase
from django.core.management import call_command
from django.db import close_old_connections
from django.contrib.auth import get_user_model
from concurrent.futures import ThreadPoolExecutor
from io import StringIO
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Business, Client, Professional, Quote, Activity
from .tests import fixtures


class CommercialCRMTests(TestCase):
    def setUp(self):
        self.business, self.user, self.contact, self.service, self.person = fixtures()
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        self.other = Business.objects.create(name="Otra empresa", slug="otra")
        self.other_contact = Client.objects.create(business=self.other, name="Privado")
        self.other_person = Professional.objects.create(
            business=self.other, name="Privado"
        )

    def payload(self, **changes):
        return {
            "client": self.contact.pk,
            "title": "Mantenimiento anual",
            "valid_until": str(timezone.localdate() + timedelta(days=30)),
            "items": [
                {"description": "Servicio", "quantity": "1.5", "unit_price": 1999}
            ],
            "discount_percent": 10,
            "tax_percent": 21,
            "request_key": str(uuid4()),
            **changes,
        }

    def create_quote(self, **changes):
        response = self.api.post("/api/quotes/", self.payload(**changes), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def patch_quote(self, quote, **changes):
        return self.api.patch(
            f"/api/quotes/{quote['id']}/",
            {"version": quote["version"], **changes},
            format="json",
        )

    def test_totals_are_server_calculated_with_half_up_rounding(self):
        quote = self.create_quote(subtotal=1, total=1, tax=0)
        self.assertEqual(quote["subtotal"], 2999)
        self.assertEqual(quote["discount"], 300)
        self.assertEqual(quote["tax"], 567)
        self.assertEqual(quote["total"], 3266)
        self.assertEqual(quote["items"][0]["total"], 2999)

    def test_invalid_items_and_overflow_are_rejected(self):
        for items in [
            [],
            "invalid",
            [None],
            [{"description": "x", "quantity": "NaN", "unit_price": 100}],
            [{"description": "x", "quantity": "1.001", "unit_price": 100}],
            [{"description": "x", "quantity": "1", "unit_price": -1}],
            [{"description": "x", "quantity": "10000", "unit_price": 100000000}],
        ]:
            with self.subTest(items=items):
                response = self.api.post(
                    "/api/quotes/", self.payload(items=items), format="json"
                )
                self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Quote.objects.exists())

    def test_version_conflict_prevents_lost_edits(self):
        quote = self.create_quote()
        changed = self.patch_quote(quote, title="Nueva propuesta")
        self.assertEqual(changed.status_code, 200)
        stale = self.patch_quote(quote, title="Cambio antiguo")
        self.assertEqual(stale.status_code, 400)
        self.assertEqual(Quote.objects.get(pk=quote["id"]).title, "Nueva propuesta")

    def test_snapshots_and_document_content_are_immutable_after_send(self):
        quote = self.create_quote()
        sent = self.patch_quote(quote, status="sent")
        self.assertEqual(sent.status_code, 200, sent.data)
        self.assertIsNotNone(sent.data["issued_at"])
        self.assertEqual(sent.data["recipient"]["name"], self.contact.name)
        self.contact.name = "Nombre cambiado"
        self.contact.save()
        self.business.name = "Empresa cambiada"
        self.business.save()
        self.assertEqual(
            self.patch_quote(sent.data, title="No permitido").status_code, 400
        )
        accepted = self.patch_quote(sent.data, status="accepted")
        self.assertEqual(accepted.status_code, 200, accepted.data)
        self.assertEqual(accepted.data["recipient"]["name"], "Cliente")
        self.assertEqual(accepted.data["sender"]["name"], "Pruebas")
        self.assertEqual(
            self.patch_quote(accepted.data, status="rejected").status_code, 400
        )

    def test_state_machine_and_expiry(self):
        quote = self.create_quote()
        self.assertEqual(self.patch_quote(quote, status="accepted").status_code, 400)
        sent = self.patch_quote(quote, status="sent").data
        self.assertEqual(self.patch_quote(sent, status="expired").status_code, 400)
        Quote.objects.filter(pk=quote["id"]).update(
            valid_until=timezone.localdate() - timedelta(days=1)
        )
        self.assertEqual(self.patch_quote(sent, status="accepted").status_code, 400)
        self.assertEqual(self.patch_quote(sent, status="expired").status_code, 200)

    def test_numbering_idempotency_and_tenant_isolation(self):
        payload = self.payload()
        first = self.api.post("/api/quotes/", payload, format="json")
        second = self.api.post("/api/quotes/", payload, format="json")
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(second.status_code, 200)
        self.assertEqual(self.create_quote()["number"], 2)
        response = self.api.post(
            "/api/quotes/", self.payload(client=self.other_contact.pk), format="json"
        )
        self.assertEqual(response.status_code, 400)
        foreign = Quote.objects.create(
            business=self.other,
            client=self.other_contact,
            title="Privado",
            number=1,
            valid_until=timezone.localdate(),
        )
        self.assertEqual(self.api.get(f"/api/quotes/{foreign.pk}/").status_code, 404)
        response = self.api.post(
            "/api/quotes/",
            self.payload(request_key=str(foreign.request_key)),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        bootstrap = self.api.get("/api/bootstrap/").data
        self.assertEqual(len(bootstrap["quotes"]), 2)
        self.assertTrue(
            all(q["client"] == self.contact.pk for q in bootstrap["quotes"])
        )

    def test_activity_author_timestamps_scope_and_immutability(self):
        payload = {
            "client": self.contact.pk,
            "kind": "call",
            "subject": "Seguimiento",
            "body": "Enviar propuesta",
            "occurred_at": timezone.now().isoformat(),
            "author": "Otra persona",
        }
        response = self.api.post("/api/activities/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["author"], self.user.username)
        self.assertEqual(
            self.api.patch(
                f"/api/activities/{response.data['id']}/",
                {"subject": "Cambiar"},
                format="json",
            ).status_code,
            400,
        )
        self.assertEqual(
            self.api.delete(f"/api/activities/{response.data['id']}/").status_code, 400
        )
        for changes in [
            {"client": self.other_contact.pk},
            {"occurred_at": (timezone.now() + timedelta(days=1)).isoformat()},
        ]:
            self.assertEqual(
                self.api.post(
                    "/api/activities/", {**payload, **changes}, format="json"
                ).status_code,
                400,
            )
        self.assertEqual(Activity.objects.count(), 1)

    def test_owner_scope_probabilities_and_lost_reason(self):
        response = self.api.patch(
            f"/api/clients/{self.contact.pk}/",
            {"owner": self.other_person.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        response = self.api.patch(
            f"/api/clients/{self.contact.pk}/",
            {"owner": self.person.pk, "lifecycle": "lead", "source": "Recomendación"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        payload = {"client": self.contact.pk, "title": "Proyecto", "value": 10000}
        for changes in [
            {"probability": 101},
            {"owner": self.other_person.pk},
            {"stage": "lost"},
        ]:
            self.assertEqual(
                self.api.post(
                    "/api/opportunities/", {**payload, **changes}, format="json"
                ).status_code,
                400,
            )
        response = self.api.post(
            "/api/opportunities/",
            {**payload, "stage": "lost", "lost_reason": "Presupuesto insuficiente"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_demo_enrichment_is_explicit_and_idempotent(self):
        self.business.slug = "estudio-norte"
        self.business.save()
        call_command("seed_crm_demo", stdout=StringIO())
        self.assertEqual(Quote.objects.count(), 0)
        self.business.is_demo = True
        self.business.save()
        call_command("seed_crm_demo", stdout=StringIO())
        call_command("seed_crm_demo", stdout=StringIO())
        self.assertEqual(Quote.objects.count(), 3)
        self.assertEqual(Activity.objects.count(), 6)
        self.assertTrue(Client.objects.filter(pk=self.contact.pk).exists())


class ConcurrentQuoteTests(TransactionTestCase):
    def test_concurrent_quotes_receive_distinct_sequential_numbers(self):
        business, user, client, service, person = fixtures()

        def create_quote(index):
            close_old_connections()
            try:
                api = APIClient()
                api.force_authenticate(get_user_model().objects.get(pk=user.pk))
                response = api.post(
                    "/api/quotes/",
                    {
                        "client": client.pk,
                        "title": f"Propuesta {index}",
                        "valid_until": str(timezone.localdate() + timedelta(days=30)),
                        "items": [
                            {
                                "description": "Servicio",
                                "quantity": "1",
                                "unit_price": 10000,
                            }
                        ],
                        "request_key": str(uuid4()),
                    },
                    format="json",
                )
                return response.status_code, response.data.get("number")
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(create_quote, range(2)))
        self.assertEqual(sorted(results), [(201, 1), (201, 2)])
