from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, time
from uuid import uuid4
from zoneinfo import ZoneInfo
from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import (
    Business,
    Membership,
    Client,
    Service,
    Professional,
    Resource,
    Appointment,
    Payment,
    Block,
)
from .scheduling import local_instant
from rest_framework.exceptions import ValidationError


def fixtures():
    business = Business.objects.create(
        name="Pruebas",
        slug="pruebas",
        weekdays=[0, 1, 2, 3, 4, 5, 6],
        public_booking=True,
    )
    user = get_user_model().objects.create_user(
        username="tester", password="Testing-Nexo-9854"
    )
    Membership.objects.create(user=user, business=business, role="admin")
    client = Client.objects.create(
        business=business, name="Cliente", email="test@example.com"
    )
    service = Service.objects.create(
        business=business, name="Consulta", duration=60, price=6500
    )
    professional = Professional.objects.create(business=business, name="Profesional")
    professional.services.add(service)
    return business, user, client, service, professional


class CRMTests(TestCase):
    def setUp(self):
        self.business, self.user, self.client_record, self.service, self.person = (
            fixtures()
        )
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        self.day = timezone.localdate() + timedelta(days=3)

    def payload(self, hour="10:00", **extra):
        return {
            "client": self.client_record.pk,
            "service": self.service.pk,
            "professional": self.person.pk,
            "start_local": f"{self.day}T{hour}",
            "request_key": str(uuid4()),
            **extra,
        }

    def create(self, **extra):
        response = self.api.post(
            "/api/appointments/", self.payload(**extra), format="json"
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_booking_conflicts_and_adjacent_slots(self):
        self.create()
        response = self.api.post(
            "/api/appointments/", self.payload("10:30"), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            self.api.post(
                "/api/appointments/", self.payload("11:00"), format="json"
            ).status_code,
            201,
        )

    def test_resource_conflict_between_professionals(self):
        room = Resource.objects.create(business=self.business, name="Sala")
        other = Professional.objects.create(business=self.business, name="Otro")
        other.services.add(self.service)
        self.create(resource=room.pk)
        response = self.api.post(
            "/api/appointments/",
            self.payload(professional=other.pk, resource=room.pk),
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_reprogramming_preserves_original_on_conflict(self):
        first = self.create()
        self.create(hour="12:00")
        response = self.api.patch(
            f"/api/appointments/{first['id']}/",
            {"version": 1, "start_local": f"{self.day}T12:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            Appointment.objects.get(pk=first["id"])
            .starts_at.astimezone(ZoneInfo("Europe/Madrid"))
            .hour,
            10,
        )

    def test_version_checks_and_cancellation_release(self):
        visit = self.create()
        url = f"/api/appointments/{visit['id']}/"
        self.assertEqual(
            self.api.patch(
                url, {"version": 7, "status": "cancelled"}, format="json"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.api.patch(
                url, {"version": 1, "status": "cancelled"}, format="json"
            ).status_code,
            200,
        )
        self.create()

    def test_price_snapshot_survives_service_update(self):
        visit = self.create()
        self.service.price = 9900
        self.service.duration = 90
        self.service.save()
        response = self.api.patch(
            f"/api/appointments/{visit['id']}/",
            {"version": 1, "start_local": f"{self.day}T11:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["price"], 6500)
        self.assertEqual(response.data["duration"], 60)

    def test_reject_outside_hours_and_past(self):
        for start in [
            f"{self.day}T08:00",
            f"{self.day}T18:30",
            "2000-01-01T10:00",
            f"{self.day}T10:07",
        ]:
            self.assertEqual(
                self.api.post(
                    "/api/appointments/", self.payload(start_local=start), format="json"
                ).status_code,
                400,
            )

    def test_public_booking_rollback_and_no_history_linking(self):
        self.api.force_authenticate(None)
        body = {
            "name": "Persona",
            "email": "test@example.com",
            "phone": "600000000",
            "service": self.service.pk,
            "professional": self.person.pk,
            "start_local": f"{self.day}T10:00",
            "request_key": str(uuid4()),
            "accepted": True,
        }
        response = self.api.post("/api/public/pruebas/book/", body, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        visit = Appointment.objects.get()
        self.assertNotEqual(visit.client_id, self.client_record.pk)
        self.assertEqual(visit.status, "pending")
        count = Client.objects.count()
        body["request_key"] = str(uuid4())
        response = self.api.post("/api/public/pruebas/book/", body, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Client.objects.count(), count)

    def test_disabled_public_page(self):
        self.business.public_booking = False
        self.business.save()
        self.api.force_authenticate(None)
        self.assertEqual(self.api.get("/api/public/pruebas/").status_code, 404)

    def test_unauthorized_access_denied(self):
        self.api.force_authenticate(None)
        self.assertEqual(self.api.get("/api/bootstrap/").status_code, 403)

    def test_login_and_public_booking_require_csrf(self):
        api = APIClient(enforce_csrf_checks=True)
        self.assertEqual(
            api.post(
                "/api/login/",
                {"username": "tester", "password": "Testing-Nexo-9854"},
                format="json",
            ).status_code,
            403,
        )
        self.assertEqual(
            api.post("/api/public/pruebas/book/", {}, format="json").status_code, 403
        )
        csrf = api.get("/api/session/").data["csrf"]
        self.assertEqual(
            api.post(
                "/api/login/",
                {"username": "tester", "password": "Testing-Nexo-9854"},
                format="json",
                HTTP_X_CSRFTOKEN=csrf,
            ).status_code,
            200,
        )

    def test_team_cannot_modify_settings_services_or_export(self):
        membership = self.user.membership
        membership.role = "staff"
        membership.save()
        self.assertEqual(
            self.api.patch("/api/settings/", {"name": "No"}, format="json").status_code,
            403,
        )
        self.assertEqual(
            self.api.post("/api/services/", {"name": "No"}, format="json").status_code,
            403,
        )
        self.assertEqual(self.api.get("/api/export/").status_code, 403)
        self.assertEqual(
            self.api.post(
                "/api/clients/", {"name": "Permitido"}, format="json"
            ).status_code,
            201,
        )

    def test_tenant_isolation_for_objects_and_relations(self):
        other = Business.objects.create(name="Otro", slug="otro", weekdays=[0])
        stranger = Client.objects.create(business=other, name="Ajeno")
        response = self.api.patch(
            f"/api/clients/{stranger.pk}/", {"name": "No"}, format="json"
        )
        self.assertEqual(response.status_code, 404)
        response = self.api.post(
            "/api/appointments/", self.payload(client=stranger.pk), format="json"
        )
        self.assertEqual(response.status_code, 400)
        response = self.api.post(
            "/api/tasks/",
            {"client": stranger.pk, "title": "No", "due_date": str(self.day)},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertNotIn(
            stranger.pk,
            [c["id"] for c in self.api.get("/api/bootstrap/").data["clients"]],
        )

    def test_duplicate_booking_request_is_idempotent(self):
        body = self.payload()
        first = self.api.post("/api/appointments/", body, format="json")
        second = self.api.post("/api/appointments/", body, format="json")
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(Appointment.objects.count(), 1)

    def test_payments_validation_and_idempotency(self):
        visit = self.create()
        body = {
            "appointment": visit["id"],
            "amount": 4000,
            "method": "card",
            "paid_at": timezone.now().isoformat(),
            "request_key": str(uuid4()),
        }
        response = self.api.post("/api/payments/", body, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            self.api.post("/api/payments/", body, format="json").status_code, 200
        )
        self.assertEqual(Payment.objects.count(), 1)
        body["request_key"] = str(uuid4())
        self.assertEqual(
            self.api.post("/api/payments/", body, format="json").status_code, 400
        )
        body["amount"] = 0
        self.assertEqual(
            self.api.post("/api/payments/", body, format="json").status_code, 400
        )

    def test_blocks_prevent_reservations_and_cannot_cover_existing(self):
        visit = self.create()
        blocked = {
            "reason": "Ausencia",
            "starts_local": f"{self.day}T10:00",
            "ends_local": f"{self.day}T11:00",
        }
        self.assertEqual(
            self.api.post("/api/blocks/", blocked, format="json").status_code, 400
        )
        blocked.update(starts_local=f"{self.day}T12:00", ends_local=f"{self.day}T13:00")
        response = self.api.post("/api/blocks/", blocked, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(
            self.api.post(
                "/api/appointments/", self.payload("12:00"), format="json"
            ).status_code,
            400,
        )

    def test_availability_matches_conflicts_and_snapshot(self):
        self.create()
        query = f"/api/availability/?month={str(self.day)[:7]}&service={self.service.pk}&professional={self.person.pk}"
        response = self.api.get(query)
        self.assertEqual(response.status_code, 200)
        slots = next(
            d["slots"] for d in response.data["days"] if d["date"] == str(self.day)
        )
        self.assertNotIn(f"{self.day}T10:30", slots)
        self.assertIn(f"{self.day}T11:00", slots)

    def test_dst_ambiguous_and_nonexistent_times(self):
        for value in ["2027-03-28T02:30", "2026-10-25T02:30"]:
            with self.assertRaises(ValidationError):
                local_instant(value, self.business)
        self.assertEqual(
            local_instant("2026-10-25T09:00", self.business).utcoffset(),
            timedelta(hours=1),
        )

    def test_export_escapes_formulas(self):
        self.client_record.name = '=HYPERLINK("example.com")'
        self.client_record.save()
        response = self.api.get("/api/export/?kind=clients")
        self.assertEqual(response.status_code, 200)
        self.assertIn("'=HYPERLINK", response.content.decode("utf-8"))

    def test_cannot_delete_financial_history(self):
        visit = self.create()
        self.assertEqual(
            self.api.delete(f"/api/appointments/{visit['id']}/").status_code, 400
        )
        self.assertEqual(
            self.api.delete(f"/api/clients/{self.client_record.pk}/").status_code, 400
        )

    def test_settings_validation(self):
        for body in [
            {"weekdays": [True]},
            {"weekdays": []},
            {"timezone": "wrong/zone"},
            {"opening": "21:00", "closing": "09:00"},
        ]:
            self.assertEqual(
                self.api.patch("/api/settings/", body, format="json").status_code, 400
            )


class ConcurrentBookingTest(TransactionTestCase):
    def test_only_one_competing_booking_succeeds(self):
        business, user, client, service, person = fixtures()
        day = timezone.localdate() + timedelta(days=4)

        def book(_):
            close_old_connections()
            try:
                api = APIClient()
                api.force_authenticate(get_user_model().objects.get(pk=user.pk))
                return api.post(
                    "/api/appointments/",
                    {
                        "client": client.pk,
                        "service": service.pk,
                        "professional": person.pk,
                        "start_local": f"{day}T11:00",
                        "request_key": str(uuid4()),
                    },
                    format="json",
                ).status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(book, range(2)))
        self.assertEqual(sorted(results), [201, 400])
        self.assertEqual(Appointment.objects.count(), 1)
