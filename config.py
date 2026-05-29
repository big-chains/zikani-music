import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'hard-to-guess-string'

    # Render gives 'postgres://' — fix prefix and use psycopg3 dialect
    _db_url = os.environ.get('DATABASE_URL') or 'sqlite:///zikani.db'
    if _db_url.startswith('postgres://'):
        _db_url = _db_url.replace('postgres://', 'postgresql+psycopg://', 1)
    elif _db_url.startswith('postgresql://'):
        _db_url = _db_url.replace('postgresql://', 'postgresql+psycopg://', 1)
    SQLALCHEMY_DATABASE_URI = _db_url

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    FLW_SECRET_KEY = os.environ.get('FLW_SECRET_KEY')
    # Resend (transactional email - replaces SMTP)
    RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
    RESEND_FROM_EMAIL = os.environ.get('RESEND_FROM_EMAIL', 'Zikani Music <onboarding@resend.dev>')
    MANAGEMENT_EMAIL = os.environ.get('MANAGEMENT_EMAIL')
    SEND_FILE_MAX_AGE_DEFAULT = 0