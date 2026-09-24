# Forge runner container image — dedicated VPS runtime.
# Implements issue #11: isolated from the public HF Space and browser UI.
#
# Build: docker build -t are-agent-forge-runner -f forge-runner/Dockerfile .
# Run:   docker run -d --env-file /run/base44/app.env -v $(pwd)/forge-runner-data:/data are-agent-forge-runner

FROM node:22-slim

WORKDIR /app

# Copy the forge runner source
COPY forge-runner/ ./forge-runner/

# The runner is dependency-free — no npm install needed.
# At deployment, the trajectory store and action client are injected
# as compiled modules or via dependency injection.

WORKDIR /app/forge-runner

# Persist run state and trajectory ledger to a mounted volume
ENV FORGE_RUNNER_DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8090/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "runner.js"]
