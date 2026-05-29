import requests
import qrcode
import base64
from io import BytesIO
from functools import wraps
from flask import request, jsonify, current_app
import jwt
from datetime import datetime, timedelta
from app.models import Admin
# ... (keep your existing imports and generate_qr_base64 function)

def admin_required(f):
    """Protects routes by requiring a valid JWT token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check if Authorization header exists and follows "Bearer <token>" format
        if 'Authorization' in request.headers:
            parts = request.headers['Authorization'].split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                token = parts[1]
        
        if not token:
            return jsonify({"error": "Authentication token is missing"}), 401

        try:
            # Decode the token using the app's secret key
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            current_admin = Admin.query.get(data['admin_id'])
            
            if not current_admin:
                raise Exception("Admin user not found")
                
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token. Please log in again."}), 401
        except Exception as e:
            return jsonify({"error": str(e)}), 401

        # Token is valid, proceed to the requested route
        return f(*args, **kwargs)
        
    return decorated

def generate_qr_base64(data):
    """Generates a QR code and returns it as a base64 string for immediate frontend display."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = BytesIO()
    img.save(buffered, "PNG")  # positional: avoids Pyrefly false-positive on format= kwarg
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


def verify_flutterwave_payment(transaction_id):
    """
    Calls the Flutterwave API to verify a transaction.
    """
    secret_key = current_app.config['FLW_SECRET_KEY']
    url = f"https://api.flutterwave.com/v3/transactions/{transaction_id}/verify"
    
    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Flutterwave Verification Error: {e}")
        return None


def _send_via_resend(to_email, subject, html_body):
    """
    Sends an email using Resend's HTTP API.
    Much more reliable than raw SMTP in cloud environments.
    Sign up free at https://resend.com and get an API key.
    Add RESEND_API_KEY and RESEND_FROM_EMAIL to your Render environment variables.
    """
    api_key  = current_app.config.get('RESEND_API_KEY')
    from_addr = current_app.config.get('RESEND_FROM_EMAIL', 'Zikani Music <onboarding@resend.dev>')

    if not api_key:
        print("[EMAIL] RESEND_API_KEY not set — skipping email.")
        return False

    payload = {
        "from":    from_addr,
        "to":      [to_email],
        "subject": subject,
        "html":    html_body,
    }

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        if resp.status_code in (200, 201):
            print(f"[EMAIL] Sent '{subject}' to {to_email}")
            return True
        else:
            print(f"[EMAIL] Resend error {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"[EMAIL] Failed: {e}")
        return False


def send_confirmation_email(recipient_email):
    """Sends a subscription confirmation email via Resend."""
    subject = "Welcome to the Zikani Music family!"
    html_body = """
    <div style="font-family:Arial,sans-serif;background:#121418;color:#fff;padding:40px;border-radius:12px;max-width:560px;margin:auto;">
      <h2 style="color:#4cdbb0;">Welcome to the crew! 🎵</h2>
      <p>Thank you for joining the <strong>Zikani Music</strong> mailing list.</p>
      <p>You'll be the first to hear about exclusive unreleased tracks, early ticket drops, and merch discounts.</p>
      <p style="color:#4cdbb0;font-weight:bold;">Stay tuned — something big is coming.</p>
      <hr style="border-color:#333;margin:30px 0;">
      <p style="font-size:12px;color:#666;">— Zikani Team</p>
    </div>
    """
    _send_via_resend(recipient_email, subject, html_body)


def send_booking_email(sender_name, sender_email, message_body):
    """Emails a booking/inquiry form submission to management via Resend."""
    management_email = current_app.config.get('MANAGEMENT_EMAIL') or current_app.config.get('RESEND_FROM_EMAIL')

    if not management_email:
        print(f"[BOOKING] No management email set. Inquiry from: {sender_email}")
        return

    subject = f"New Booking Inquiry from {sender_name}"
    html_body = f"""
    <div style="font-family:Arial,sans-serif;background:#121418;color:#fff;padding:40px;border-radius:12px;max-width:560px;margin:auto;">
      <h2 style="color:#4cdbb0;">New Booking / Inquiry</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px;color:#999;width:80px;">From:</td><td style="padding:8px;"><strong>{sender_name}</strong></td></tr>
        <tr><td style="padding:8px;color:#999;">Email:</td><td style="padding:8px;"><a href="mailto:{sender_email}" style="color:#4cdbb0;">{sender_email}</a></td></tr>
      </table>
      <hr style="border-color:#333;margin:20px 0;">
      <p style="white-space:pre-wrap;">{message_body}</p>
      <hr style="border-color:#333;margin:20px 0;">
      <p style="font-size:12px;color:#666;">Reply directly to this email to respond to the enquirer.</p>
    </div>
    """
    _send_via_resend(management_email, subject, html_body)


def admin_required(f):
    """Protects routes by requiring a valid JWT token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check if Authorization header exists and follows "Bearer <token>" format
        if 'Authorization' in request.headers:
            parts = request.headers['Authorization'].split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                token = parts[1]
        
        if not token:
            return jsonify({"error": "Authentication token is missing"}), 401

        try:
            # Decode the token using the app's secret key
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            current_admin = Admin.query.get(data['admin_id'])
            
            if not current_admin:
                raise Exception("Admin user not found")
                
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token. Please log in again."}), 401
        except Exception as e:
            return jsonify({"error": str(e)}), 401

        # Token is valid, proceed to the requested route
        return f(*args, **kwargs)
        
    return decorated

def generate_qr_base64(data):
    """Generates a QR code and returns it as a base64 string for immediate frontend display."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = BytesIO()
    img.save(buffered, "PNG")  # positional: avoids Pyrefly false-positive on format= kwarg
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


def verify_flutterwave_payment(transaction_id):
    """
    Calls the Flutterwave API to verify a transaction.
    """
    secret_key = current_app.config['FLW_SECRET_KEY']
    url = f"https://api.flutterwave.com/v3/transactions/{transaction_id}/verify"
    
    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Flutterwave Verification Error: {e}")
        return None

