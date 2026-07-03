FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml .

# Install deps first (cached layer — only rebuilds when pyproject.toml changes)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.30.0" \
    "chromadb>=0.6.0" \
    "pydantic>=2.8.0" \
    "pydantic-settings>=2.3.0" \
    "python-jose[cryptography]>=3.3.0" \
    "passlib[argon2]>=1.7.4" \
    "sqlalchemy>=2.0.30" \
    "psycopg[binary]>=3.1.19" \
    "redis>=5.0.7" \
    "email-validator>=2.0.0" \
    "boto3>=1.34.0"

# Copy source last (cache only busts on code changes)
COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
