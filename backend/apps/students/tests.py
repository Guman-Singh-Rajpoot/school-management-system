"""
Section 2: student class/section assignment, school-scoped creation,
roll-number uniqueness, transfers, and school-wise isolation.

Run:  python manage.py test apps.students.tests
"""
from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import School, User
from apps.academics.models import Session, SchoolClass, Section
from apps.attendance.models import Attendance
from apps.students.models import Student
from apps.fees.models import FeeStructure, StudentFee


def make_school(name='Alpha Public School', reg='REG-ALPHA'):
    return School.objects.create(name=name, registration_number=reg)


def make_admin(school, username='admin'):
    return User.objects.create_user(
        username=username, password='pass12345', role=User.Role.ADMIN, school=school,
    )


def setup_school(school):
    return Session.objects.create(
        school=school, name='2026-2027',
        start_date=date(2026, 4, 1), end_date=date(2027, 3, 31), is_current=True,
    )


def create_student_policy(school, school_class, section, username, adm, roll='1'):
    user = User.objects.create_user(
        username=username, password='pass12345', role=User.Role.STUDENT, school=school,
    )
    return Student.objects.create(
        user=user, admission_number=adm, gender='M',
        date_of_birth=date(2012, 1, 1), admission_date=date(2025, 4, 1),
        school_class=school_class, section=section, roll_number=roll,
        session=school_class.session,
    )


def base_payload(class_id=None, section_id=None, roll=None):
    payload = {
        'username': 'newstud', 'email': 'newstud@example.com',
        'first_name': 'New', 'last_name': 'Student',
        'password': 'TempPass99!', 'must_change_password': True,
        'admission_number': 'ADM-NEW', 'gender': 'M',
        'date_of_birth': '2012-05-01', 'admission_date': '2026-05-01',
        'mobile_number': '9876543210',
        'father_name': 'Father Name', 'father_mobile': '9876500001',
        'mother_name': 'Mother Name', 'mother_mobile': '9876500002',
    }
    if class_id:
        payload['school_class'] = class_id
    if section_id:
        payload['section'] = section_id
    if roll:
        payload['roll_number'] = roll
    return payload


class StudentCreationTests(APITestCase):
    def setUp(self):
        self.school = make_school()
        self.other = make_school('Beta Public School', 'REG-BETA')
        self.admin = make_admin(self.school, 'adminAlpha')
        self.admin_b = make_admin(self.other, 'adminBeta')
        self.session = setup_school(self.school)
        self.session_b = setup_school(self.other)
        self.class_1 = SchoolClass.objects.create(name='Class 1', session=self.session)
        self.class_1_s2 = SchoolClass.objects.create(name='Class 2', session=self.session)
        self.section_a = Section.objects.create(name='A', class_room=self.class_1)
        self.section_b = Section.objects.create(name='B', class_room=self.class_1)
        self.client.force_authenticate(user=self.admin)

    def test_create_with_class_section_and_school(self):
        resp = self.client.post('/api/students/', base_payload(
            self.class_1.id, self.section_a.id, roll='01',
        ), format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        student = Student.objects.get(user__username='newstud')
        self.assertEqual(student.school_class_id, self.class_1.id)
        self.assertEqual(student.section_id, self.section_a.id)
        self.assertEqual(student.user.school_id, self.school.id)
        # Session defaulted to the school's current session.
        self.assertEqual(student.session_id, self.session.id)

    def test_new_student_appears_in_class_list(self):
        self.client.post('/api/students/', base_payload(
            self.class_1.id, self.section_a.id, roll='01',
        ), format='json')
        resp = self.client.get('/api/students/', {'school_class': self.class_1.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data.get('results', resp.data) if hasattr(resp.data, 'get') else resp.data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['admission_number'], 'ADM-NEW')

    def test_duplicate_roll_number_rejected(self):
        create_student_policy(self.school, self.class_1, self.section_a, 'exist1', 'ADM-1', roll='01')
        resp = self.client.post('/api/students/', base_payload(
            self.class_1.id, self.section_a.id, roll='01',
        ), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        # Duplicate prevention may surface as a roll_number field error
        # (serializer validation) or a non_field error (DB unique set).
        self.assertTrue(
            'roll_number' in resp.data or 'non_field_errors' in resp.data,
            f"Expected duplicate roll_number error, got: {resp.data}",
        )

    def test_other_section_of_same_class_allowed(self):
        resp = self.client.post('/api/students/', base_payload(
            self.class_1.id, self.section_b.id, roll='01',
        ), format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_mismatched_section_rejected(self):
        other_class_section = Section.objects.create(name='X', class_room=self.class_1_s2)
        resp = self.client.post('/api/students/', base_payload(
            self.class_1.id, other_class_section.id, roll='01',
        ), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('section', resp.data)

    def test_cross_school_class_rejected(self):
        class_b = SchoolClass.objects.create(name='Class 1', session=self.session_b)
        resp = self.client.post('/api/students/', base_payload(class_b.id), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_class_required_when_school_has_classes(self):
        resp = self.client.post('/api/students/', base_payload(), format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('school_class', resp.data)

    def test_roll_defaults_across_separate_sections(self):
        """Same roll number may exist in different sections of one class."""
        self.client.post('/api/students/', base_payload(
            self.class_1.id, self.section_a.id, roll='07',
        ), format='json')
        resp = self.client.post('/api/students/', {
            **base_payload(self.class_1.id, self.section_b.id, roll='07'),
            'username': 'newstud3', 'email': 's3@example.com',
            'admission_number': 'ADM-3',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)


class StudentTransferTests(APITestCase):
    def setUp(self):
        self.school = make_school()
        self.other = make_school('Beta Public School', 'REG-BETA')
        self.admin = make_admin(self.school, 'adminAlpha')
        self.admin_b = make_admin(self.other, 'adminBeta')
        self.session = setup_school(self.school)
        self.session_b = setup_school(self.other)
        self.class_1 = SchoolClass.objects.create(name='Class 1', session=self.session)
        self.class_2 = SchoolClass.objects.create(name='Class 2', session=self.session)
        self.class_1_b = SchoolClass.objects.create(name='Class 1', session=self.session_b)
        self.section_a = Section.objects.create(name='A', class_room=self.class_1)
        self.section_a2 = Section.objects.create(name='A', class_room=self.class_2)
        self.section_b = Section.objects.create(name='B', class_room=self.class_1)
        self.student = create_student_policy(
            self.school, self.class_1, self.section_a, 'transferStud', 'ADM-T1', roll='10',
        )
        self.client.force_authenticate(user=self.admin)

    def test_transfer_between_sections(self):
        resp = self.client.post(f'/api/students/{self.student.id}/transfer/', {
            'school_class': self.class_1.id, 'section': self.section_b.id,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.student.refresh_from_db()
        self.assertEqual(self.student.section_id, self.section_b.id)

    def test_transfer_between_classes_and_history_preserved(self):
        # Existing attendance and financial records attach to the Student row.
        Attendance.objects.create(
            student=self.student, date=date(2026, 6, 1), status='PRESENT',
        )
        FeeStructure.objects.create(
            school_class=self.class_1, session=self.session, fee_type='Tuition', amount=2000,
        )
        bill = StudentFee.objects.create(
            student=self.student, fee_structure=FeeStructure.objects.first(),
            month=7, year=2026,
        )
        bill.payments.create(amount=1500, method='CASH')

        resp = self.client.post(f'/api/students/{self.student.id}/transfer/', {
            'school_class': self.class_2.id, 'section': self.section_a2.id, 'roll_number': '05',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.student.refresh_from_db()
        self.assertEqual(self.student.school_class_id, self.class_2.id)
        self.assertEqual(self.student.roll_number, '05')
        # Financial record follows the student untouched.
        bill.refresh_from_db()
        self.assertEqual(bill.paid_amount, 1500)
        self.assertEqual(Attendance.objects.filter(student=self.student).count(), 1)

    def test_transfer_roll_collision_rejected(self):
        create_student_policy(self.school, self.class_2, self.section_a2, 'occupied', 'ADM-2', roll='05')
        resp = self.client.post(f'/api/students/{self.student.id}/transfer/', {
            'school_class': self.class_2.id, 'section': self.section_a2.id, 'roll_number': '05',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('roll_number', resp.data)

    def test_transfer_cross_school_rejected(self):
        resp = self.client.post(f'/api/students/{self.student.id}/transfer/', {
            'school_class': self.class_1_b.id,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_teacher_cannot_transfer(self):
        from apps.teachers.models import Teacher
        t_user = User.objects.create_user(username='t1', password='pass12345', role=User.Role.TEACHER)
        Teacher.objects.create(
            user=t_user, employee_id='EMP-T1', gender='F', date_of_birth=date(1990, 1, 1),
            qualification='B.Ed', department='Arts', joining_date=date(2020, 1, 1), salary=30000,
        )
        self.client.force_authenticate(t_user)
        resp = self.client.post(f'/api/students/{self.student.id}/transfer/', {
            'school_class': self.class_2.id,
        }, format='json')
        self.assertIn(resp.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED))


class StudentIsolationTests(APITestCase):
    def setUp(self):
        self.school = make_school()
        self.other = make_school('Beta Public School', 'REG-BETA')
        self.session = setup_school(self.school)
        self.session_b = setup_school(self.other)
        self.class_1 = SchoolClass.objects.create(name='Class 1', session=self.session)
        self.class_1_b = SchoolClass.objects.create(name='Class 1', session=self.session_b)
        self.admin = make_admin(self.school, 'adminIsoA')
        self.admin_b = make_admin(self.other, 'adminIsoB')
        self.student_a = create_student_policy(self.school, self.class_1, None, 'isoA', 'ADM-A')
        self.student_b = create_student_policy(self.other, self.class_1_b, None, 'isoB', 'ADM-B')

    def test_admin_list_scoped_to_own_school(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/students/')
        data = resp.data.get('results', resp.data) if hasattr(resp.data, 'get') else resp.data
        ids = {row['id'] for row in data}
        self.assertIn(self.student_a.id, ids)
        self.assertNotIn(self.student_b.id, ids)

    def test_academics_scoped_to_own_school(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/academics/classes/')
        data = resp.data.get('results', resp.data) if hasattr(resp.data, 'get') else resp.data
        ids = {row['id'] for row in data}
        self.assertIn(self.class_1.id, ids)
        self.assertNotIn(self.class_1_b.id, ids)
        self.client.force_authenticate(user=self.admin_b)
        resp = self.client.get('/api/academics/classes/')
        data = resp.data.get('results', resp.data) if hasattr(resp.data, 'get') else resp.data
        ids = {row['id'] for row in data}
        self.assertIn(self.class_1_b.id, ids)
        self.assertNotIn(self.class_1.id, ids)

    def test_no_public_student_registration(self):
        """An anonymous user cannot create student accounts."""
        self.client.force_authenticate(user=None)
        resp = self.client.post('/api/students/', base_payload(), format='json')
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
