import os
from flask import Flask, send_from_directory
from flask_cors import CORS # 1. Import CORS
from config import Config
from app.models import db

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # 2. Enable CORS for your specific frontend origin
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    db.init_app(app)

    # Auto-create tables on startup (works for both SQLite locally and PostgreSQL on Render)
    with app.app_context():
        db.create_all()

    # Register your blueprints
    from app.routes import api_bp
    app.register_blueprint(api_bp)

    # Serve static admin HTML files from project root
    root_dir = os.path.dirname(app.root_path)

    @app.route('/')
    def landing_page():
        return send_from_directory(root_dir, 'landing_page.html')

    @app.route('/<path:filename>')
    def serve_static(filename):
        return send_from_directory(root_dir, filename)

    @app.route('/admin')
    def admin_page():
        return send_from_directory(root_dir, 'admin.html')

    @app.route('/admin/dashboard')
    def admin_dashboard_page():
        return send_from_directory(root_dir, 'admin_dashboard.html')

    return app