"""
Management command: create_school_admin

Creates the initial school administrator account securely.
This command must be run once before the system is used.
It is the ONLY way to create an ADMIN account -- the public API
refuses to create accounts with role=ADMIN.

Usage:
    python manage.py create_school_admin

The command will prompt for username, email, and password interactively.
Use --username, --email, and --password for non-interactive/CI use.

Examples:
    # Interactive (prompts for missing values)
    python manage.py create_school_admin

    # Non-interactive (CI / first-run script)
    python manage.py create_school_admin \\
        --username admin \\
        --email admin@school.com \\
        --password "S3cur3P@ss!" \\
        --school-name "Springfield Elementary"
"""

import getpass
import sys

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create the initial school administrator account."

    def add_arguments(self, parser):
        parser.add_argument("--username", type=str, default=None)
        parser.add_argument("--email", type=str, default=None)
        parser.add_argument("--password", type=str, default=None,
                            help="Provide password (not recommended for production -- use interactive mode instead).")
        parser.add_argument("--first-name", type=str, default="")
        parser.add_argument("--last-name", type=str, default="")
        parser.add_argument("--school-name", type=str, default="")
        parser.add_argument("--phone", type=str, default="")
        parser.add_argument(
            "--force",
            action="store_true",
            default=False,
            help="Create even if an admin already exists.",
        )

    def handle(self, *args, **options):
        from apps.accounts.models import User

        # Check if admin already exists
        existing_admins = User.objects.filter(role=User.Role.ADMIN)
        if existing_admins.exists() and not options["force"]:
            self.stdout.write(self.style.WARNING(
                f"\nAn admin account already exists ({existing_admins.first().username}).\n"
                "Use --force to create another admin.\n"
            ))
            sys.exit(0)

        # Collect username
        username = options["username"]
        if not username:
            username = input("Username: ").strip()
        if not username:
            raise CommandError("Username is required.")
        if User.objects.filter(username__iexact=username).exists():
            raise CommandError(f"Username '{username}' is already taken.")

        # Collect email
        email = options["email"]
        if not email:
            email = input("Email address: ").strip()

        # Collect password (never echoed)
        password = options["password"]
        if not password:
            while True:
                password = getpass.getpass("Password: ")
                password2 = getpass.getpass("Password (again): ")
                if password != password2:
                    self.stderr.write("Passwords do not match. Try again.\n")
                    continue
                try:
                    validate_password(password)
                    break
                except ValidationError as e:
                    self.stderr.write("\n".join(e.messages) + "\n")
        else:
            try:
                validate_password(password)
            except ValidationError as e:
                raise CommandError("\n".join(e.messages))

        first_name = options["first_name"] or ""
        last_name = options["last_name"] or ""
        school_name = options["school_name"] or ""
        phone = options["phone"] or ""

        admin = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            school_name=school_name,
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )

        self.stdout.write(self.style.SUCCESS(
            f"\nAdmin account created successfully!\n"
            f"  Username : {admin.username}\n"
            f"  Email    : {admin.email or '(not set)'}\n"
            f"  Role     : {admin.role}\n\n"
            "You can now start the server and log in at /login.\n"
        ))
