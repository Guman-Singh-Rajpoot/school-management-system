from rest_framework.permissions import BasePermission, SAFE_METHODS


# ============================================================
# ADMIN
# ============================================================

class IsAdmin(BasePermission):
    """Only authenticated Admin users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'ADMIN'
        )


# ============================================================
# TEACHER
# ============================================================

class IsTeacher(BasePermission):
    """Only authenticated Teacher users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'TEACHER'
        )


# ============================================================
# STUDENT
# ============================================================

class IsStudent(BasePermission):
    """Only authenticated Student users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'STUDENT'
        )


# ============================================================
# ADMIN OR TEACHER
# ============================================================

class IsAdminOrTeacher(BasePermission):
    """Allows authenticated Admin or Teacher users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ('ADMIN', 'TEACHER')
        )


# ============================================================
# ADMIN OR READ ONLY
# ============================================================

class IsAdminOrReadOnly(BasePermission):
    """
    ADMIN:
        GET       allowed
        POST      allowed
        PUT       allowed
        PATCH     allowed
        DELETE    allowed

    TEACHER:
        GET       allowed
        POST      denied
        PUT       denied
        PATCH     denied
        DELETE    denied

    STUDENT:
        GET       allowed
        POST      denied
        PUT       denied
        PATCH     denied
        DELETE    denied
    """

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        return user.role == 'ADMIN'


# ============================================================
# ADMIN OR SELF STUDENT
# ============================================================

class IsAdminOrSelfStudent(BasePermission):
    """
    Student record permission.

    ADMIN:
        Full CRUD access to every student.

    TEACHER:
        Read-only access to all students.

    STUDENT:
        Read-only access to their own student record.
    """

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        # Admin can perform all operations.
        if user.role == 'ADMIN':
            return True

        # Teacher can only read.
        if user.role == 'TEACHER':
            return request.method in SAFE_METHODS

        # Student can only read.
        if user.role == 'STUDENT':
            return request.method in SAFE_METHODS

        return False

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Admin can access every student.
        if user.role == 'ADMIN':
            return True

        # Teacher can read every student.
        if user.role == 'TEACHER':
            return request.method in SAFE_METHODS

        # Student can read only their own record.
        if user.role == 'STUDENT':
            return (
                request.method in SAFE_METHODS
                and getattr(obj, 'user', None) == user
            )

        return False


# ============================================================
# GENERIC ADMIN OR OWNER
# ============================================================

class IsAdminOrOwnerOfObject(BasePermission):
    """
    Generic object-level permission.

    ADMIN:
        Full access.

    Other users:
        Access only when:
        1. Their role is allowed.
        2. owner_attr points to their User object.

    Example:

        class IsSelfTeacher(IsAdminOrOwnerOfObject):
            owner_attr = 'user'
            allowed_roles = ('TEACHER',)

    Example:

        class IsSelfTeacherViaTeacherFK(IsAdminOrOwnerOfObject):
            owner_attr = 'teacher.user'
            allowed_roles = ('TEACHER',)
    """

    owner_attr = 'user'
    allowed_roles = ()

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
        )

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Admin can access everything.
        if user.role == 'ADMIN':
            return True

        # Check allowed role.
        if user.role not in self.allowed_roles:
            return False

        # Follow the owner relationship.
        target = obj

        for part in self.owner_attr.split('.'):
            target = getattr(target, part, None)

            if target is None:
                return False

        # Object belongs to current user.
        return target == user


# ============================================================
# SELF TEACHER
# ============================================================

class IsSelfTeacher(IsAdminOrOwnerOfObject):
    """
    ADMIN:
        Full access.

    TEACHER:
        Own Teacher record only.
    """

    owner_attr = 'user'
    allowed_roles = ('TEACHER',)


# ============================================================
# SELF TEACHER THROUGH FOREIGN KEY
# ============================================================

class IsSelfTeacherViaTeacherFK(IsAdminOrOwnerOfObject):
    """
    ADMIN:
        Full access.

    TEACHER:
        Own teacher-related record only.

    Relationship:
        object.teacher.user
    """

    owner_attr = 'teacher.user'
    allowed_roles = ('TEACHER',)


# ============================================================
# SELF TEACHER THROUGH TEACHER SALARY FOREIGN KEY
# ============================================================

class IsSelfTeacherViaTeacherSalaryFK(IsAdminOrOwnerOfObject):
    """
    ADMIN:
        Full access.

    TEACHER:
        Own salary-payment records only.

    Relationship:
        object.teacher_salary.teacher.user
    """

    owner_attr = 'teacher_salary.teacher.user'
    allowed_roles = ('TEACHER',)


# ============================================================
# SELF STUDENT
# ============================================================

class IsSelfStudent(IsAdminOrOwnerOfObject):
    """
    ADMIN:
        Full access.

    STUDENT:
        Own Student record only.
    """

    owner_attr = 'user'
    allowed_roles = ('STUDENT',)


# ============================================================
# SELF STUDENT THROUGH FOREIGN KEY
# ============================================================

class IsSelfStudentViaStudentFK(IsAdminOrOwnerOfObject):
    """
    ADMIN:
        Full access.

    STUDENT:
        Own student-related record only.

    Relationship:
        object.student.user
    """

    owner_attr = 'student.user'
    allowed_roles = ('STUDENT',)


# ============================================================
# STUDENT OR TEACHER THROUGH STUDENT FOREIGN KEY
# ============================================================

class IsSelfStudentOrTeacherViaStudentFK(BasePermission):
    """
    ADMIN:
        Full access.

    TEACHER:
        Read/access student-related records.

    STUDENT:
        Own student-related records only.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
        )

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Admin can access everything.
        if user.role == 'ADMIN':
            return True

        # Teacher can access student-related records.
        if user.role == 'TEACHER':
            return True

        # Student can access only their own records.
        if user.role == 'STUDENT':
            student = getattr(obj, 'student', None)

            return (
                getattr(student, 'user', None) == user
            )

        return False


# ============================================================
# STUDENT FEE PAYMENT
# ============================================================

class IsSelfStudentViaStudentFeeFK(
    IsAdminOrOwnerOfObject
):
    """
    ADMIN:
        Full access.

    STUDENT:
        Own fee/payment records only.

    Relationship:

        Payment
            ↓
        student_fee
            ↓
        student
            ↓
        user
    """

    owner_attr = 'student_fee.student.user'
    allowed_roles = ('STUDENT',)


# ============================================================
# SELF USER / NOTIFICATION
# ============================================================

class IsSelfUser(IsAdminOrOwnerOfObject):
    """
    ADMIN:
        Full access.

    TEACHER/STUDENT:
        Access only objects belonging to themselves.

    Example:
        object.recipient
    """

    owner_attr = 'recipient'
    allowed_roles = (
        'TEACHER',
        'STUDENT',
    )