with open(r'C:\Users\guman\Desktop\school-management-system\backend\apps\teachers\views.py', 'r') as f:
    content = f.read()
content = content.replace('if is_school_admin(user):', 'if user.role in ("ADMIN", "OWNER") or user.is_staff or user.is_superuser:')
with open(r'C:\Users\guman\Desktop\school-management-system\backend\apps\teachers\views.py', 'w') as f:
    f.write(content)
print('Done')