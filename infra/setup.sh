#!/bin/bash
# Run ONCE to provision all GCP infrastructure.
# Prerequisites: gcloud CLI installed, authenticated, project set.
set -e

PROJECT_ID=$(gcloud config get-value project)
REGION=us-central1
SQL_INSTANCE=ticketing-mysql
REGISTRY=$REGION-docker.pkg.dev/$PROJECT_ID/ticketing

echo "Project: $PROJECT_ID | Region: $REGION"

# ── APIs ─────────────────────────────────────────────────────────────────────
echo "=== Enabling APIs ==="
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com

# ── Artifact Registry ────────────────────────────────────────────────────────
echo "=== Artifact Registry ==="
gcloud artifacts repositories create ticketing \
  --repository-format=docker \
  --location=$REGION \
  --description="Ticketing system images"

gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

# ── Cloud SQL (MySQL 8.0) ─────────────────────────────────────────────────────
echo "=== Cloud SQL ==="
# db-f1-micro: ~$8/month, sufficient for personal project
gcloud sql instances create $SQL_INSTANCE \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --no-backup

gcloud sql databases create ticketing --instance=$SQL_INSTANCE

# Set root password — replace CHANGE_ME
DB_PASSWORD="CHANGE_ME_STRONG_PASSWORD"
gcloud sql users set-password root \
  --instance=$SQL_INSTANCE \
  --password=$DB_PASSWORD

echo "SQL instance connection name:"
gcloud sql instances describe $SQL_INSTANCE --format="get(connectionName)"

# ── Secret Manager ───────────────────────────────────────────────────────────
echo "=== Secrets ==="
# Store DB password
echo -n "$DB_PASSWORD" | \
  gcloud secrets create db-password --data-file=- --replication-policy=automatic

# Store JWT secret — replace CHANGE_ME with 32+ random chars
echo -n "CHANGE_ME_JWT_SECRET_MIN_32_CHARS" | \
  gcloud secrets create jwt-secret --data-file=- --replication-policy=automatic

# ── Service Account for Cloud Run ─────────────────────────────────────────────
echo "=== Service Account ==="
gcloud iam service-accounts create ticketing-run \
  --display-name="Ticketing Cloud Run SA"

SA=ticketing-run@$PROJECT_ID.iam.gserviceaccount.com

# Allow Cloud Run SA to access secrets
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/secretmanager.secretAccessor"

# Allow Cloud Run SA to connect to Cloud SQL
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/cloudsql.client"

echo ""
echo "=== Setup complete ==="
echo "Registry: $REGISTRY"
echo "SQL connection: $(gcloud sql instances describe $SQL_INSTANCE --format='get(connectionName)')"
echo ""
echo "Next: edit infra/deploy.sh with your values, then run it."
