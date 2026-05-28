from app import create_app
from app.models import db, Admin
from werkzeug.security import generate_password_hash

app = create_app()

def setup_admin():
    with app.app_context():
        email = input("Enter admin email: ")
        password = input("Enter admin password: ")
        
        # Security: Hash the password before saving to the database
        hashed_pw = generate_password_hash(password, method='pbkdf2:sha256')
        
        if Admin.query.filter_by(email=email).first():
            print("Admin with this email already exists.")
            return

        new_admin = Admin(email=email, password_hash=hashed_pw)
        db.session.add(new_admin)
        db.session.commit()
        print(f"✅ Admin user {email} created successfully!")

if __name__ == '__main__':
    setup_admin()