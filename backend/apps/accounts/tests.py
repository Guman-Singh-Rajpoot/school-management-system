"""
End-to-end permission/security tests for the whole system.

Covers requirement #20's checklist: role-based CRUD rules, object-level
security (a teacher/student can never reach another teacher/student's
record by ID), automatic payment/salary timestamps, and that a fresh
database has zero application records.

Run with:  python manage.py test apps.accounts.tests
"""
from datetime import date

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.academics.models import Session, SchoolClass
from apps.students.models import Student
from apps.teachers.models import Teacher, TeacherSalary
from apps.fees.models import FeeStructure, StudentFee


def make_admin():
    return User.objects.create_user(username='admin1', password='pass12345', role=User.Role.ADMIN)


def make_teacher(username='teacher1', **kwargs):
    user = User.objects.create_user(username=username, password='pass12345', role=User.Role.TEACHER)
    return Teacher.objects.create(
        user=user,
        employee_id=kwargs.get('employee_id', f'EMP-{username}'),
        gender='F',
        date_of_birth=date(1990, 1, 1),
        qualification='M.Sc',
        department='Science',
        joining_date=date(2020, 6, 1),
        salary=40000,
    )


def make_student(username='student1', school_class=None, **kwargs):
    user = User.objects.create_user(username=username, password='pass12345', role=User.Role.STUDENT)
    return Student.objects.create(
        user=user,
        admission_number=kwargs.get('admission_number', f'ADM-{username}'),
        gender='F',
        date_of_birth=date(2012, 1, 1),
        admission_date=date(2022, 4, 1),
        school_class=school_class,
    )


class BaseAPITestCase(APITestCase):
    def auth_as(self, user):
        self.client.force_authenticate(user=user)


class DatabaseStartsEmptyTests(APITestCase):
    def test_no_demo_records_on_fresh_database(self):
        """A freshly migrated database must contain zero application records."""
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(Student.objects.count(), 0)
        self.assertEqual(Teacher.objects.count(), 0)


class StudentPermissionTests(BaseAPITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.session = Session.objects.create(name='2026-2027', start_date=date(2026, 4, 1), end_date=date(2027, 3, 31))
        self.school_class = SchoolClass.objects.create(name='Class 10', session=self.session)
        self.student_a = make_student('alice', school_class=self.school_class)
        self.student_b = make_student('bob', school_class=self.school_class)

    def test_admin_can_create_student(self):
        self.auth_as(self.admin)
        payload = {
            'username': 'newstudent', 'email': 'new@example.com', 'first_name': 'New',
            'last_name': 'Student', 'password': 'pass12345',
            'admission_number': 'ADM-NEW', 'gender': 'M',
            'date_of_birth': '2012-05-01', 'admission_date': '2022-04-01',
        }
        resp = self.client.post('/api/students/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_admin_can_edit_student(self):
        self.auth_as(self.admin)
        resp = self.client.patch(f'/api/students/{self.student_a.id}/', {'city': 'Lucknow'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_student_can_access_own_record(self):
        self.auth_as(self.student_a.user)
        resp = self.client.get(f'/api/students/{self.student_a.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_student_cannot_access_another_students_record(self):
        self.auth_as(self.student_a.user)
        resp = self.client.get(f'/api/students/{self.student_b.id}/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_edit_own_record(self):
        """Only Admin edits master student data -- not even the student themself."""
        self.auth_as(self.student_a.user)
        resp = self.client.patch(f'/api/students/{self.student_a.id}/', {'city': 'Delhi'}, format='json')
        self.assertIn(resp.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED))

    def test_unauthenticated_request_rejected(self):
        resp = self.client.get('/api/students/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class TeacherPermissionTests(BaseAPITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.teacher_2 = make_teacher('teacher2', employee_id='EMP-002')
        self.teacher_5 = make_teacher('teacher5', employee_id='EMP-005')

    def test_admin_can_create_teacher(self):
        self.auth_as(self.admin)
        payload = {
            'username': 'newteacher', 'email': 'nt@example.com', 'first_name': 'New',
            'last_name': 'Teacher', 'password': 'pass12345',
            'employee_id': 'EMP-NEW', 'gender': 'M', 'date_of_birth': '1988-01-01',
            'qualification': 'B.Ed', 'department': 'Maths', 'joining_date': '2021-01-01',
        }
        resp = self.client.post('/api/teachers/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_teacher_can_access_own_record(self):
        self.auth_as(self.teacher_2.user)
        resp = self.client.get(f'/api/teachers/{self.teacher_2.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_teacher_cannot_access_another_teachers_record(self):
        """GET /api/teachers/<other id>/ as a different teacher -> 403."""
        self.auth_as(self.teacher_2.user)
        resp = self.client.get(f'/api/teachers/{self.teacher_5.id}/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_cannot_create_teacher(self):
        self.auth_as(self.teacher_2.user)
        resp = self.client.post('/api/teachers/', {'username': 'x'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_cannot_edit_another_teacher(self):
        self.auth_as(self.teacher_2.user)
        resp = self.client.patch(f'/api/teachers/{self.teacher_5.id}/', {'department': 'Hacked'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_cannot_access_admin_dashboard_fee_summary(self):
        """The admin fee dashboard summary must be Admin-only."""
        self.auth_as(self.teacher_2.user)
        resp = self.client.get('/api/fees/student-fees/dashboard_summary/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class TeacherSalaryPermissionTests(BaseAPITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.teacher_a = make_teacher('teachA', employee_id='EMP-A')
        self.teacher_b = make_teacher('teachB', employee_id='EMP-B')
        self.salary_a = TeacherSalary.objects.create(
            teacher=self.teacher_a, salary_month=date(2026, 8, 1), amount=40000, created_by=self.admin,
        )
        self.salary_b = TeacherSalary.objects.create(
            teacher=self.teacher_b, salary_month=date(2026, 8, 1), amount=35000, created_by=self.admin,
        )

    def test_admin_can_record_salary_payment(self):
        self.auth_as(self.admin)
        resp = self.client.post('/api/teachers/salary-payments/', {
            'teacher_salary': self.salary_a.id, 'amount': '10000', 'payment_method': 'CASH',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_salary_payment_timestamp_is_automatic(self):
        self.auth_as(self.admin)
        resp = self.client.post('/api/teachers/salary-payments/', {
            'teacher_salary': self.salary_a.id, 'amount': '10000', 'payment_method': 'CASH',
            'created_at': '2000-01-01T00:00:00Z',  # attempt to spoof -- must be ignored
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(resp.data['created_at'][:4], '2000')
        self.assertEqual(resp.data['created_by'], self.admin.id)

    def test_teacher_can_access_own_salary(self):
        self.auth_as(self.teacher_a.user)
        resp = self.client.get(f'/api/teachers/salaries/{self.salary_a.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_teacher_cannot_access_another_teachers_salary(self):
        self.auth_as(self.teacher_a.user)
        resp = self.client.get(f'/api/teachers/salaries/{self.salary_b.id}/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_cannot_create_salary_record(self):
        self.auth_as(self.teacher_a.user)
        resp = self.client.post('/api/teachers/salaries/', {
            'teacher': self.teacher_a.id, 'salary_month': '2026-09-01', 'amount': '40000',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class FeePermissionTests(BaseAPITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.session = Session.objects.create(name='2026-2027', start_date=date(2026, 4, 1), end_date=date(2027, 3, 31))
        self.school_class = SchoolClass.objects.create(name='Class 9', session=self.session)
        self.student_a = make_student('alice2', school_class=self.school_class)
        self.student_b = make_student('bob2', school_class=self.school_class)
        self.fee_structure = FeeStructure.objects.create(
            school_class=self.school_class, session=self.session, fee_type='Tuition',
            amount=50000, due_date=date(2026, 6, 1),
        )
        self.fee_a = StudentFee.objects.create(student=self.student_a, fee_structure=self.fee_structure)
        self.fee_b = StudentFee.objects.create(student=self.student_b, fee_structure=self.fee_structure)

    def test_admin_can_record_fee_payment(self):
        self.auth_as(self.admin)
        resp = self.client.post('/api/fees/payments/', {
            'student_fee': self.fee_a.id, 'amount': '10000', 'method': 'CASH',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_payment_timestamp_is_automatic(self):
        self.auth_as(self.admin)
        resp = self.client.post('/api/fees/payments/', {
            'student_fee': self.fee_a.id, 'amount': '10000', 'method': 'CASH',
            'created_at': '2000-01-01T00:00:00Z', 'paid_on': '2000-01-01',  # spoof attempt
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(resp.data['created_at'][:4], '2000')
        self.assertNotEqual(resp.data['paid_on'][:4], '2000')
        self.assertEqual(resp.data['created_by'], self.admin.id)

    def test_student_can_access_own_fees(self):
        self.auth_as(self.student_a.user)
        resp = self.client.get(f'/api/fees/student-fees/{self.fee_a.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_student_cannot_modify_fees(self):
        self.auth_as(self.student_a.user)
        resp = self.client.patch(f'/api/fees/student-fees/{self.fee_a.id}/', {'discount_amount': '5000'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_add_payment_records(self):
        self.auth_as(self.student_a.user)
        resp = self.client.post('/api/fees/payments/', {
            'student_fee': self.fee_a.id, 'amount': '1000', 'method': 'CASH',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_view_another_students_fees(self):
        self.auth_as(self.student_a.user)
        resp = self.client.get(f'/api/fees/student-fees/{self.fee_b.id}/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class AttendancePermissionTests(BaseAPITestCase):
    def setUp(self):
        self.admin = make_admin()
        self.teacher = make_teacher('teachC', employee_id='EMP-C')
        self.session = Session.objects.create(name='2026-2027', start_date=date(2026, 4, 1), end_date=date(2027, 3, 31))
        self.school_class = SchoolClass.objects.create(name='Class 8', session=self.session)
        self.student_a = make_student('alice3', school_class=self.school_class)
        self.student_b = make_student('bob3', school_class=self.school_class)

    def test_student_cannot_modify_attendance(self):
        self.auth_as(self.student_a.user)
        resp = self.client.post('/api/attendance/', {
            'student': self.student_a.id, 'date': '2026-08-27', 'status': 'PRESENT',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_mark_attendance(self):
        self.auth_as(self.admin)
        resp = self.client.post('/api/attendance/', {
            'student': self.student_a.id, 'date': '2026-08-27', 'status': 'PRESENT',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('created_at', resp.data)


class DashboardAccessTests(BaseAPITestCase):
    """Admin-only aggregate endpoints must reject Teacher/Student."""

    def setUp(self):
        self.admin = make_admin()
        self.teacher = make_teacher('teachD', employee_id='EMP-D')
        self.student = make_student('carol')

    def test_teacher_cannot_access_admin_only_backup_endpoint(self):
        self.auth_as(self.teacher.user)
        resp = self.client.get('/api/documents/backups/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_access_admin_only_backup_endpoint(self):
        self.auth_as(self.student.user)
        resp = self.client.get('/api/documents/backups/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_access_backup_endpoint(self):
        self.auth_as(self.admin)
        resp = self.client.get('/api/documents/backups/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
