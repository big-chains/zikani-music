import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'hard-to-guess-string'

    # Render provides 'postgres://' but SQLAlchemy requires 'postgresql://'
    _db_url = os.environ.get('DATABASE_URL') or 'sqlite:///zikani.db'
    if _db_url.startswith('postgres://'):
        _db_url = _db_url.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URI = _db_url

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    FLW_SECRET_KEY = os.environ.get('FLW_SECRET_KEY')
    SMTP_SERVER = os.environ.get('SMTP_SERVER')
    SMTP_PORT = os.environ.get('SMTP_PORT', 587)
    SMTP_USERNAME = os.environ.get('SMTP_USERNAME')
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
    SEND_FILE_MAX_AGE_DEFAULT = 0