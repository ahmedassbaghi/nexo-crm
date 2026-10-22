import os
from getpass import getpass
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_slug
from django.db import transaction
from crm.models import Business, Membership


class Command(BaseCommand):
    help = "Da de alta un negocio vacío con su administrador, sin datos ficticios."

    def add_arguments(self, parser):
        parser.add_argument("--name", required=True)
        parser.add_argument("--slug", required=True)
        parser.add_argument("--username", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        name, slug, username = options["name"], options["slug"], options["username"]
        try:
            validate_slug(slug)
        except ValidationError:
            raise CommandError("Slug no válido: usa letras, números y guiones.")
        if not name.strip() or len(name) > 120 or len(slug) > 50 or len(username) > 150:
            raise CommandError("Nombre, slug o usuario no válido.")
        if (
            Business.objects.filter(slug=slug).exists()
            or get_user_model().objects.filter(username=username).exists()
        ):
            raise CommandError(
                "El negocio o usuario ya existe. No se ha modificado ningún registro."
            )
        password = os.getenv("NEXO_ADMIN_PASSWORD") or getpass(
            "Contraseña del administrador (mínimo 10 caracteres): "
        )
        try:
            validate_password(password)
        except ValidationError as error:
            raise CommandError(" ".join(error.messages))
        business = Business.objects.create(
            name=name, slug=slug, weekdays=[0, 1, 2, 3, 4]
        )
        user = get_user_model().objects.create_user(
            username=username, password=password, first_name=name[:150]
        )
        Membership.objects.create(business=business, user=user, role="admin")
        self.stdout.write(
            self.style.SUCCESS(
                f"Negocio '{name}' creado. Accede y configura servicios, profesionales y horarios. Reserva pública desactivada inicialmente."
            )
        )
