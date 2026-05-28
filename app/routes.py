from flask import Blueprint, request, jsonify
from app.models import db, Video, Product, Event, Order, Subscriber, Message
from app.utils import verify_flutterwave_payment, generate_qr_base64, admin_required, send_confirmation_email, send_booking_email
import uuid
from datetime import datetime # Fixed import for 
import jwt
from datetime import datetime, timedelta
from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash
from app.models import Admin # Make sure Admin is imported

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/subscribe', methods=['POST'])
def subscribe():
    data = request.json
    email = data.get('email', '').strip()
    if not email or '@' not in email:
        return jsonify({"error": "Valid email is required"}), 400

    existing = Subscriber.query.filter_by(email=email).first()
    if existing:
        return jsonify({"message": "You are already subscribed!"}), 200

    new_sub = Subscriber(email=email)
    db.session.add(new_sub)
    db.session.commit()

    # Send confirmation email
    send_confirmation_email(email)

    return jsonify({"message": "Successfully subscribed!"}), 201

@api_bp.route('/contact', methods=['POST'])
def contact():
    data = request.json
    name    = data.get('name', '').strip()
    email   = data.get('email', '').strip()
    message = data.get('message', '').strip()

    if not name or not email or not message or '@' not in email:
        return jsonify({"error": "Name, valid email, and message are required"}), 400

    # Save to DB
    new_msg = Message(name=name + ' <' + email + '>', message=message)
    db.session.add(new_msg)
    db.session.commit()

    # Email management
    send_booking_email(name, email, message)

    return jsonify({"message": "Message received"}), 201
                                   
# --- 1. PUBLIC GET ENDPOINTS (For Frontend Rendering) ---

@api_bp.route('/videos', methods=['GET'])
def get_videos():
    videos = Video.query.order_by(Video.created_at.desc()).all()
    return jsonify([{"id": v.id, "title": v.title, "platform": v.platform, "url": v.url, "thumbnail": v.thumbnail} for v in videos]), 200

@api_bp.route('/products', methods=['GET'])
def get_products():
    products = Product.query.order_by(Product.created_at.desc()).all()
    return jsonify([{"id": p.id, "name": p.name, "price": p.price, "image": p.image, "stock": p.stock, "description": p.description} for p in products]), 200

@api_bp.route('/events', methods=['GET'])
def get_events():
    events = Event.query.order_by(Event.date.asc()).all()
    return jsonify([{"id": e.id, "title": e.title, "date": e.date.isoformat(), "location": e.location, "price": e.price} for e in events]), 200


# --- 2. ADMIN CRUD ENDPOINTS ---
@api_bp.route('/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # 1. Find user by email
    admin = Admin.query.filter_by(email=email).first()

    # 2. Verify existence and check secure password hash
    if admin and check_password_hash(admin.password_hash, password):
        # 3. Generate JWT with a 12-hour expiration
        token = jwt.encode({
            'admin_id': admin.id,
            'role': admin.role,
            'exp': datetime.utcnow() + timedelta(hours=12)
        }, current_app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({
            "message": "Login successful",
            "token": token
        }), 200

    return jsonify({"error": "Invalid email or password"}), 401

@api_bp.route('/admin/register', methods=['POST'])
def admin_register():
    data = request.json
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not email or not password or not name:
        return jsonify({"error": "Name, email and password are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if Admin.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists"}), 409

    new_admin = Admin(
        email=email,
        password_hash=generate_password_hash(password),
        role='admin'
    )
    db.session.add(new_admin)
    db.session.commit()

    return jsonify({"message": "Account created successfully. You can now log in."}), 201


@api_bp.route('/videos', methods=['POST'])
@admin_required
def create_video():
    data = request.json
    new_video = Video(
        title=data['title'], 
        platform=data['platform'], 
        url=data['url'], 
        thumbnail=data.get('thumbnail')
    )
    db.session.add(new_video)
    db.session.commit()
    return jsonify({"message": "Video created", "id": new_video.id}), 201

@api_bp.route('/videos/<int:id>', methods=['PUT'])
@admin_required
def update_video(id):
    video = Video.query.get_or_404(id)
    data = request.json
    video.title = data.get('title', video.title)
    video.platform = data.get('platform', video.platform)
    video.url = data.get('url', video.url)
    video.thumbnail = data.get('thumbnail', video.thumbnail)
    db.session.commit()
    return jsonify({"message": "Video updated"}), 200

@api_bp.route('/videos/<int:id>', methods=['DELETE'])
@admin_required
def delete_video(id):
    video = Video.query.get_or_404(id)
    db.session.delete(video)
    db.session.commit()
    return jsonify({"message": "Video deleted"}), 200

# -- Products Admin --
@api_bp.route('/products', methods=['POST'])
@admin_required
def create_product():
    data = request.json
    new_product = Product(
        name=data['name'], 
        price=data['price'], 
        image=data.get('image'), 
        stock=data.get('stock', 0)
    )
    db.session.add(new_product)
    db.session.commit()
    return jsonify({"message": "Product created", "id": new_product.id}), 201

@api_bp.route('/products/<int:id>', methods=['PUT'])
@admin_required
def update_product(id):
    product = Product.query.get_or_404(id)
    data = request.json
    product.name = data.get('name', product.name)
    product.price = data.get('price', product.price)
    product.stock = data.get('stock', product.stock)
    product.image = data.get('image', product.image)
    db.session.commit()
    return jsonify({"message": "Product updated"}), 200

@api_bp.route('/products/<int:id>', methods=['DELETE'])
@admin_required
def delete_product(id):
    product = Product.query.get_or_404(id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Product deleted"}), 200

# -- Events Admin --
@api_bp.route('/events', methods=['POST'])
@admin_required
def create_event():
    data = request.json
    new_event = Event(
        title=data['title'], 
        date=datetime.fromisoformat(data['date']), 
        location=data['location'], 
        price=data['price']
    )
    db.session.add(new_event)
    db.session.commit()
    return jsonify({"message": "Event created", "id": new_event.id}), 201

@api_bp.route('/events/<int:id>', methods=['PUT'])
@admin_required
def update_event(id):
    event = Event.query.get_or_404(id)
    data = request.json
    event.title = data.get('title', event.title)
    if 'date' in data:
        event.date = datetime.fromisoformat(data['date'])
    event.location = data.get('location', event.location)
    event.price = data.get('price', event.price)
    db.session.commit()
    return jsonify({"message": "Event updated"}), 200

@api_bp.route('/events/<int:id>', methods=['DELETE'])
@admin_required
def delete_event(id):
    event = Event.query.get_or_404(id)
    db.session.delete(event)
    db.session.commit()
    return jsonify({"message": "Event deleted"}), 200


# --- 3. PAYMENT VERIFICATION (QR CODES & ORDER LOGIC) ---

@api_bp.route('/orders', methods=['POST'])
def create_order():
    data = request.json
    new_order = Order(
        email=data['email'],
        item_type=data.get('item_type', 'merch'),
        item_id=data.get('item_id', 0), # 0 for full merch carts
        amount=data['amount'],
        status='pending'
    )
    db.session.add(new_order)
    db.session.commit()
    return jsonify({"message": "Order created", "order_id": new_order.id}), 201

@api_bp.route('/verify-payment', methods=['POST'])
def verify_payment():
    data = request.json
    transaction_id = data.get('transaction_id')
    order_id = data.get('order_id')
    
    order = Order.query.get_or_404(order_id)
    if order.status == 'paid': return jsonify({"message": "Already processed"}), 200

    flw_response = verify_flutterwave_payment(transaction_id)
    if not flw_response or flw_response.get('data', {}).get('status') != 'successful':
        return jsonify({"error": "Payment failed"}), 400

    order.status = 'paid'
    order.transaction_id = transaction_id
    
    response_data = {"message": "Payment successful", "order_id": order.id}

    # BUSINESS LOGIC
    if order.item_type == 'ticket':
        order.ticket_id = str(uuid.uuid4())
        response_data["ticket_id"] = order.ticket_id
        # Generate QR Code
        response_data["qr_code"] = generate_qr_base64(order.ticket_id)
        
    elif order.item_type == 'merch':
        # Handle multiple items if utilizing a cart array
        cart_items = data.get('cart', [{'id': order.item_id, 'quantity': 1}])
        for item in cart_items:
            product = Product.query.get(item['id'])
            if product and product.stock >= item['quantity']:
                product.stock -= item['quantity']

    db.session.commit()
    return jsonify(response_data), 200