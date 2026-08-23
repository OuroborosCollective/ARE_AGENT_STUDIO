FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./package.json
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend-dist/
ENV API_BACKEND_HOST=0.0.0.0 \
    API_BACKEND_PORT=7860 \
    STATIC_DIR=/app/frontend-dist \
    DATASET_DIR=/data \
    DATASET_WRITE_ENABLED=false \
    DATASET_EXPORT_ENABLED=false \
    OPERATION_CORRECTION_WRITE_ENABLED=false \
    VERIFIED_IMITATION_WRITE_ENABLED=false \
    ENABLE_ADB_BRIDGE=false
RUN mkdir -p /data
EXPOSE 7860
CMD ["node", "backend/server.js"]
