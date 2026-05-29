import requests
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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

def send_confirmation_email(recipient_email):
    """
    Sends a subscription confirmation email using SMTP (Gmail).
    All stages are logged to the server console for easy debugging.
    """
    smtp_server = current_app.config.get('SMTP_SERVER')
    smtp_port   = current_app.config.get('SMTP_PORT', 587)
    smtp_user   = current_app.config.get('SMTP_USERNAME')
    smtp_pass   = current_app.config.get('SMTP_PASSWORD')

    print(f"[EMAIL] Attempting to send confirmation to {recipient_email}")
    print(f"[EMAIL] SMTP server: {smtp_server}:{smtp_port}  user: {smtp_user}  pass set: {bool(smtp_pass)}")

    subject = "Welcome to the Zikani Music family!"
    body = (
        "Hey there!\n\n"
        "Thank you for joining the Zikani Music mailing list.\n"
        "You'll be the first to hear about exclusive unreleased tracks, early ticket drops, and merch discounts.\n\n"
        "Stay tuned -- something big is coming.\n\n"
        "-- Zikani Team"
    )

    if not smtp_server or not smtp_user or not smtp_pass:
        print("[EMAIL] SMTP not configured -- printing to console instead.")
        print("  To: " + recipient_email + "\n  Subject: " + subject)
        return

    try:
        msg = MIMEMultipart()
        msg['From']    = "Zikani Music <" + smtp_user + ">"
        msg['To']      = recipient_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        print("[EMAIL] Connecting to " + str(smtp_server) + ":" + str(smtp_port) + " ...")
        server = smtplib.SMTP(smtp_server, int(smtp_port), timeout=10)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print("[EMAIL] Confirmation email sent to " + recipient_email)
    except Exception as e:
        print("[EMAIL] Failed to send email to " + recipient_email + ": " + str(e))


def send_booking_email(sender_name, sender_email, message_body):
    """
    Emails a booking/inquiry form submission to management.
    Sets Reply-To to the enquirer's email so the team can reply directly.
    """
    smtp_server = current_app.config.get('SMTP_SERVER')
    smtp_port   = current_app.config.get('SMTP_PORT', 587)
    smtp_user   = current_app.config.get('SMTP_USERNAME')
    smtp_pass   = current_app.config.get('SMTP_PASSWORD')

    if not smtp_server or not smtp_user or not smtp_pass:
        print("[BOOKING] SMTP not configured. Message from: " + sender_email)
        return

    subject = "New Booking Inquiry from " + sender_name
    body = (
        "You have a new booking/inquiry from the Zikani Music website.\n\n"
        "From:    " + sender_name + "\n"
        "Email:   " + sender_email + "\n"
        "-----------------------------------------------\n"
        + message_body +
        "\n-----------------------------------------------\n\n"
        "Reply directly to this email to respond to the enquirer."
    )

    try:
        msg = MIMEMultipart()
        msg['From']     = "Zikani Website <" + smtp_user + ">"
        msg['To']       = smtp_user          # send to management inbox
        msg['Reply-To'] = sender_name + " <" + sender_email + ">"
        msg['Subject']  = subject
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(smtp_server, int(smtp_port), timeout=10)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print("[BOOKING] Inquiry from " + sender_email + " emailed to management.")
    except Exception as e:
        print("[BOOKING] Failed to send booking email: " + str(e))
