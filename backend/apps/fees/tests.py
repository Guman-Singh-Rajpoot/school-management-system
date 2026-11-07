"""
Section 1: class-wise monthly fee structure tests.

Covers fee structure CRUD with school isolation, monthly schedule
generation (eligibility, idempotency, per-category bills), status
lifecycle (PENDING/PARTIALLY_PAID/PAID/OVERDUE), historical preservation
when structures change, student-specific adjustments, and reports.

Run:  python manage.py test apps.fees.tests
"""
from datetime import date

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import School, User
from apps.academics.models import Session, SchoolClass, Section
from apps.students.models import Student
from apps.fees.models import FeeStructure, StudentFee, StudentFeeAdjustment


def make_school(name='Alpha Public School', reg='REG-ALPHA'):
    return School.objects.create(name=name, registration_number=reg)


def make_admin(school, username='admin'):
    return User.objects.create_user(
        username=username, password='pass12345', role=User.Role.ADMIN, school=school,
    )


def setup_school(school):
    session = Session.objects.create(
        school=school, name='2026-2027',
        start_date=date(2026, 4, 1), end_date=date(2027, 3, 31), is_current=True,
    )
    return session


def make_student(school, school_class, username, admission_number, section=None,
                 admission_date=date(2025, 4, 1), status=Student.Status.ACTIVE):
    user = User.objects.create_user(
        username=username, password='pass12345', role=User.Role.STUDENT, school=school,
    )
    return Student.objects.create(
        user=user, admission_number=admission_number, gender='M',
        date_of_birth=date(2012, 1, 1), admission_date=admission_date,
        school_class=school_class, section=section, session=school_class.session,
        status=status,
    )


class FeeStructureAPITests(APITestCase):
    """Creating/editing/activating fee structures, scoped per school."""

    def setUp(self):
        self.school_a = make_school()
        self.school_b = make_school('Beta Public School', 'REG-BETA')
        self.admin_a = make_admin(self.school_a, 'adminA')
        self.admin_b = make_admin(self.school_b, 'adminB')
        self.session_a = setup_school(self.school_a)
        self.session_b = setup_school(self.school_b)
        self.class_a = SchoolClass.objects.create(name='Class 1', session=self.session_a)
        self.class_b = SchoolClass.objects.create(name='Class 1', session=self.session_b)
        self.client.force_authenticate(user=self.admin_a)

    def test_admin_can_create_fee_structure(self):
        resp = self.client.post('/api/fees/fee-structures/', {
            'school_class': self.class_a.id,
            'session': self.session_a.id,
            'fee_type': 'Tuition',
            'amount': '2000',
            'due_day': 10,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(FeeStructure.objects.count(), 1)

    def test_duplicate_category_rejected(self):
        FeeStructure.objects.create(
            school_class=self.class_a, session=self.session_a, fee_type='Tuition', amount=2000,
        )
        resp = self.client.post('/api/fees/fee-structures/', {
            'school_class': self.class_a.id, 'session': self.session_a.id,
            'fee_type': 'tuition', 'amount': '3000',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cross_school_class_rejected(self):
        resp = self.client.post('/api/fees/fee-structures/', {
            'school_class': self.class_b.id, 'session': self.session_b.id,
            'fee_type': 'Tuition', 'amount': '2000',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(FeeStructure.objects.count(), 0)

    def test_class_name_collision_across_schools_is_allowed(self):
        """Two schools may each have their own 'Class 1' + '2026-2027'."""
        resp_a = self.client.post('/api/fees/fee-structures/', {
            'school_class': self.class_a.id, 'session': self.session_a.id,
            'fee_type': 'Tuition', 'amount': '2000',
        }, format='json')
        self.assertEqual(resp_a.status_code, status.HTTP_201_CREATED)
        self.client.force_authenticate(user=self.admin_b)
        resp_b = self.client.post('/api/fees/fee-structures/', {
            'school_class': self.class_b.id, 'session': self.session_b.id,
            'fee_type': 'Tuition', 'amount': '2500',
        }, format='json')
        self.assertEqual(resp_b.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            FeeStructure.objects.filter(school_class=self.class_a, fee_type='Tuition').count(), 1,
        )
        self.assertEqual(
            FeeStructure.objects.filter(school_class=self.class_b, fee_type='Tuition').count(), 1,
        )

    def test_admin_cannot_edit_other_schools_structure(self):
        self.client.force_authenticate(user=self.admin_b)
        structure = FeeStructure.objects.create(
            school_class=self.class_a, session=self.session_a, fee_type='Tuition', amount=2000,
        )
        resp = self.client.patch(
            f'/api/fees/fee-structures/{structure.id}/', {'amount': '1'},
            format='json',
        )
        self.assertIn(resp.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))
        structure.refresh_from_db()
        self.assertEqual(structure.amount, 2000)

    def test_class_overview_scoped_to_own_school(self):
        FeeStructure.objects.create(
            school_class=self.class_a, session=self.session_a, fee_type='Tuition', amount=2000,
        )
        FeeStructure.objects.create(
            school_class=self.class_b, session=self.session_b, fee_type='Other', amount=100,
        )
        resp = self.client.get('/api/fees/fee-structures/class-overview/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['monthly_total'], '2000.00')
        self.client.force_authenticate(user=self.admin_b)
        resp = self.client.get('/api/fees/fee-structures/class-overview/')
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['monthly_total'], '100.00')


class MonthlyGenerationTests(APITestCase):
    """Generation: eligibility, idempotency, per-category rows."""

    def setUp(self):
        self.school = make_school()
        self.admin = make_admin(self.school)
        self.session = setup_school(self.school)
        self.class_1 = SchoolClass.objects.create(name='Class 1', session=self.session)
        self.section_a = Section.objects.create(name='A', class_room=self.class_1)
        # Amounts are dummy examples; the admin must confirm before saving.
        FeeStructure.objects.create(
            school_class=self.class_1, session=self.session, fee_type='Tuition', amount=2000,
        )
        FeeStructure.objects.create(
            school_class=self.class_1, session=self.session, fee_type='Transport', amount=500,
        )
        FeeStructure.objects.create(
            school_class=self.class_1, session=self.session, fee_type='Computer', amount=200,
        )
        self.student = make_student(self.school, self.class_1, 'studentX', 'ADM-X', self.section_a)
        self.client.force_authenticate(user=self.admin)

    def generate(self, month=7, year=2026, url='/api/fees/fee-structures/generate-schedule/'):
        return self.client.post(url, {
            'school_class': self.class_1.id, 'month': month, 'year': year,
        }, format='json')

    def test_generate_creates_one_bill_per_category(self):
        resp = self.generate()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(resp.data['created'], 3)
        self.assertEqual(StudentFee.objects.filter(month=7, year=2026).count(), 3)
        # Monthly total per student = 2000 + 500 + 200
        total = sum(
            f.gross_amount for f in StudentFee.objects.filter(student=self.student)
        )
        self.assertEqual(total, 2700)
        # due dates captured from due_day
        for fee in StudentFee.objects.filter(student=self.student):
            self.assertEqual(fee.due_date, date(2026, 7, 10))

    def test_generation_is_idempotent(self):
        self.generate()
        resp = self.generate()
        self.assertEqual(resp.data['created'], 0)
        self.assertEqual(resp.data['skipped'], 3)
        self.assertEqual(StudentFee.objects.filter(month=7, year=2026).count(), 3)

    def test_midmonth_admission_excluded_from_earlier_month(self):
        make_student(self.school, self.class_1, 'lateJoin', 'ADM-LATE',
                     admission_date=date(2026, 7, 15))
        resp = self.generate(month=6)  # June: mid-July joiner excluded
        self.assertEqual(resp.data['created'], 3)
        self.assertEqual(resp.data['skipped'], 3)
        self.assertEqual(
            StudentFee.objects.filter(student__user__username='lateJoin').count(), 0,
        )
        resp = self.generate(month=7)  # joined in July: 3 enroll-eligible bills
        self.assertEqual(resp.data['created'], 6)  # X (3) + lateJoin (3)
        self.assertEqual(
            StudentFee.objects.filter(student__user__username='lateJoin', month=7).count(), 3,
        )

    def test_inactive_student_skipped(self):
        make_student(self.school, self.class_1, 'graduated', 'ADM-G',
                     status=Student.Status.GRADUATED)
        resp = self.generate()
        self.assertEqual(resp.data['created'], 3)
        self.assertEqual(StudentFee.objects.count(), 3)

    def test_scope_other_school_class_forbidden(self):
        other = make_school('Gamma School', 'REG-GAMMA')
        session_b = Session.objects.create(
            school=other, name='2026-2027',
            start_date=date(2026, 4, 1), end_date=date(2027, 3, 31),
        )
        class_b = SchoolClass.objects.create(name='Class 1', session=session_b)
        resp = self.client.post('/api/fees/fee-structures/generate-schedule/', {
            'school_class': class_b.id, 'month': 7, 'year': 2026,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_new_amounts_apply_to_future_periods_only(self):
        """Editing the structure must NOT alter already-generated bills."""
        self.generate(month=7)
        old_bill = StudentFee.objects.get(
            student=self.student, month=7, fee_structure__fee_type='Tuition',
        )
        self.assertEqual(old_bill.gross_amount, 2000)

        structure = FeeStructure.objects.get(school_class=self.class_1, fee_type='Tuition')
        structure.amount = 3000
        structure.save()

        old_bill.refresh_from_db()
        self.assertEqual(old_bill.gross_amount, 2000)

        self.generate(month=8)
        new_bill = StudentFee.objects.get(
            student=self.student, month=8, fee_structure__fee_type='Tuition',
        )
        self.assertEqual(new_bill.gross_amount, 3000)

        # Paid amounts on the historical bill are untouched
        old_bill.payments.create(amount=2000, method='CASH')
        structure.amount = 9999
        structure.save()
        old_bill.refresh_from_db()
        self.assertEqual(old_bill.gross_amount, 2000)
        self.assertEqual(old_bill.paid_amount, 2000)


class FeeStatusTests(APITestCase):
    """PENDING / PARTIALLY_PAID / PAID / OVERDUE lifecycle."""

    def _future_month(self, delta_days=60):
        """A (year, month) roughly `delta_days` in the future relative to now,
        so unpaid bills are not yet OVERDUE."""
        import datetime
        d = datetime.date.today() + datetime.timedelta(days=delta_days)
        return d.month, d.year

    def _past_month(self, delta_days=60):
        """A (year, month) in the past, so unpaid bills are OVERDUE."""
        import datetime
        d = datetime.date.today() - datetime.timedelta(days=delta_days)
        return d.month, d.year

    def setUp(self):
        self.school = make_school()
        self.admin = make_admin(self.school, 'adminStatus')
        self.session = setup_school(self.school)
        self.class_1 = SchoolClass.objects.create(name='Class 2', session=self.session)
        self.section = Section.objects.create(name='A', class_room=self.class_1)
        self.student = make_student(self.school, self.class_1, 'statusStud', 'ADM-S', self.section)
        self.client.force_authenticate(user=self.admin)

    def _create_bill(self, month=7, year=2026, due_day=10):
        structure = FeeStructure.objects.create(
            school_class=self.class_1, session=self.session, fee_type='Exam',
            amount=2500, due_day=due_day,
        )
        return StudentFee.objects.create(
            student=self.student, fee_structure=structure, month=month, year=year,
        )

    def test_pending_then_partially_paid_then_paid(self):
        month, year = self._future_month()
        bill = self._create_bill(month=month, year=year)
        self.assertEqual(bill.payment_status, 'PENDING')
        bill.payments.create(amount=1000, method='CASH')
        self.assertEqual(bill.payment_status, 'PARTIALLY_PAID')
        bill.payments.create(amount=1500, method='UPI')
        self.assertEqual(bill.payment_status, 'PAID')

    def test_overdue_when_due_date_has_passed(self):
        month, year = self._past_month()
        bill = self._create_bill(month=month, year=year, due_day=1)
        self.assertEqual(bill.payment_status, 'OVERDUE')

    def test_due_day_clamped_to_month_length(self):
        bill = self._create_bill(month=2, year=2025, due_day=28)
        self.assertEqual(bill.due_date, date(2025, 2, 28))
        self.assertEqual(bill.payment_status, 'OVERDUE')


class FeeAdjustmentTests(APITestCase):
    """Student-specific fee adjustments applied at generation."""

    def setUp(self):
        self.school = make_school()
        self.admin = make_admin(self.school)
        self.session = setup_school(self.school)
        self.class_1 = SchoolClass.objects.create(name='Class 3', session=self.session)
        FeeStructure.objects.create(
            school_class=self.class_1, session=self.session, fee_type='Tuition', amount=3000,
        )
        self.student = make_student(self.school, self.class_1, 'scholar', 'ADM-W')
        self.client.force_authenticate(user=self.admin)

    def test_adjustment_applies_to_generated_bill(self):
        resp = self.client.post('/api/fees/adjustments/', {
            'student': self.student.id, 'fee_type': 'Tuition',
            'discount_amount': '500', 'scholarship_amount': '200',
            'concession_reason': 'Sibling discount',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)

        self.client.post('/api/fees/fee-structures/generate-schedule/', {
            'school_class': self.class_1.id, 'month': 7, 'year': 2026,
        }, format='json')
        bill = StudentFee.objects.get(student=self.student, month=7)
        self.assertEqual(bill.discount_amount, 500)
        self.assertEqual(bill.scholarship_amount, 200)
        self.assertEqual(bill.net_payable, 2300)

    def test_pre_existing_bill_not_retroactively_altered(self):
        self.client.post('/api/fees/fee-structures/generate-schedule/', {
            'school_class': self.class_1.id, 'month': 7, 'year': 2026,
        }, format='json')
        StudentFeeAdjustment.objects.create(
            student=self.student, fee_type='Tuition', discount_amount=1000,
        )
        bill = StudentFee.objects.get(student=self.student, month=7)
        bill.refresh_from_db()
        self.assertEqual(bill.discount_amount, 0)
        # Next month picks it up.
        self.client.post('/api/fees/fee-structures/generate-schedule/', {
            'school_class': self.class_1.id, 'month': 8, 'year': 2026,
        }, format='json')
        aug = StudentFee.objects.get(student=self.student, month=8)
        self.assertEqual(aug.discount_amount, 1000)

    def test_preview_does_not_create_bills(self):
        resp = self.client.post('/api/fees/fee-structures/preview-schedule/', {
            'school_class': self.class_1.id, 'month': 7, 'year': 2026,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['eligible_students'], 1)
        self.assertEqual(resp.data['monthly_total_per_student'], '3000.00')
        self.assertEqual(StudentFee.objects.count(), 0)
