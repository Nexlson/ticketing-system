#!/bin/bash
# Build, push, and deploy both services to Cloud Run.
# Run from repo root: ./infra/deploy.sh
set -e

# ── Config — fill these in ────────────────────────────────────────────────────
PROJECT_ID=$(gcloud config get-value project)
REGION=us-central1
SQL_INSTANCE=ticketing-mysql
SQL_CONNECTION="$PROJECT_ID:$REGION:$SQL_INSTANCE"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/ticketing"

# Redis: use Upstash (free tier) — https://upstash.com
# Create a Redis DB there, copy the redis:// URL below
REDIS_URL="rediss://default:TOKEN@hostname.upstash.io:PORT"

JWT_EXPIRES_IN="5min"
# ─────────────────────────────────────────────────────────────────────────────

SA="ticketing-run@$PROJECT_ID.iam.gserviceaccount.com"

echo "=== Building backend ==="
docker build -t "$REGISTRY/backend:latest" ./backend
docker push "$REGISTRY/backend:latest"

echo "=== Deploying backend ==="
gcloud run deploy ticketing-backend \
  --image="$REGISTRY/backend:latest" \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --service-account=$SA \
  --add-cloudsql-instances=$SQL_CONNECTION \
  --set-secrets="JWT_SECRET=jwt-secret:latest,DATABASE_PASSWORD=db-password:latest" \
  --set-env-vars="\
DATABASE_URL=mysql://root:\${DATABASE_PASSWORD}@localhost/ticketing?socket=/cloudsql/$SQL_CONNECTION,\
REDIS_URL=$REDIS_URL,\
JWT_EXPIRES_IN=$JWT_EXPIRES_IN,\
PORT=3000,\
FRONTEND_URL=https://ticketing-frontend-placeholder" \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1

# Get backend URL for frontend build
BACKEND_URL=$(gcloud run services describe ticketing-backend \
  --region=$REGION \
  --format="get(status.url)")

echo "Backend URL: $BACKEND_URL"

echo "=== Building frontend ==="
docker build \
  --build-arg NEXT_PUBLIC_API_URL="$BACKEND_URL/v1" \
  -t "$REGISTRY/frontend:latest" \
  ./frontend
docker push "$REGISTRY/frontend:latest"

echo "=== Deploying frontend ==="
gcloud run deploy ticketing-frontend \
  --image="$REGISTRY/frontend:latest" \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --service-account=$SA \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1

FRONTEND_URL=$(gcloud run services describe ticketing-frontend \
  --region=$REGION \
  --format="get(status.url)")

echo ""
echo "=== Deployed ==="
echo "Frontend: $FRONTEND_URL"
echo "Backend:  $BACKEND_URL"

# Update backend FRONTEND_URL now that we know it
echo "=== Updating backend FRONTEND_URL ==="
gcloud run services update ticketing-backend \
  --region=$REGION \
  --update-env-vars="FRONTEND_URL=$FRONTEND_URL"
