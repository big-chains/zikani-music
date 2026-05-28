from datetime import datetime, timedelta
from app import create_app
from app.models import db, Product, Event

# Initialize the Flask app so we can use its context
app = create_app()

def seed_database():
    with app.app_context():
        # Check if we already have data to prevent duplicates if run twice
        if Product.query.first() or Event.query.first():
            print("Database already has data. Skipping seed process.")
            return

        print("Seeding database with dummy Merch and Events...")

        # --- Create Dummy Products (Merch) ---
        product1 = Product(
            name="Futurist Heavy Hoodie",
            price=45000.00, # MWK
            image="https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=600&q=80",
            description="Premium heavyweight hoodie with Zikani Afro-futurist branding.",
            stock=50
        )
        
        product2 = Product(
            name="Zikani Snapback",
            price=15000.00, # MWK
            image="https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=600&q=80",
            description="Classic black snapback hat with embroidered logo.",
            stock=100
        )

        # --- Create Dummy Events (Tickets) ---
        event1 = Event(
            title="Lake of Stars Festival",
            date=datetime.now() + timedelta(days=30), # 30 days from today
            location="Mangochi, Malawi",
            price=25000.00, # MWK
            description="Headline performance by Zikani at the legendary Lake of Stars."
        )

        event2 = Event(
            title="Afro-Tech Arena",
            date=datetime.now() + timedelta(days=60), # 60 days from today
            location="Johannesburg, RSA",
            price=40000.00, # MWK
            description="International debut at the Afro-Tech Arena."
        )

        # Add all items to the database session
        db.session.add_all([product1, product2, event1, event2])
        
        # Commit the transaction to save them permanently
        db.session.commit()

        print("✅ Successfully added dummy products and events to zikani.db!")

if __name__ == "__main__":
    seed_database()