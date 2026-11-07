FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /app/backend/requirements.txt

COPY frontend/package.json frontend/package-lock.json /app/frontend/
RUN cd /app/frontend && npm ci

COPY backend /app/backend
COPY frontend /app/frontend

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN cd /app/frontend && npm run build

WORKDIR /app
EXPOSE 3000

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
