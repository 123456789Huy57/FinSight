FROM python:3.12-slim

WORKDIR /app
ENV VNSTOCK_HOME=/data/vnstock

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

ARG INSTALL_VNSTOCK=false
COPY requirements.txt requirements-vnstock.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN if [ "$INSTALL_VNSTOCK" = "true" ]; then pip install --no-cache-dir -r requirements-vnstock.txt; fi
RUN mkdir -p /data/vnstock

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
