#!/bin/bash
PROJECT_ID="lifenav-prod"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"
SA_NAME="terraform-deployer"
GITHUB_ORG="Life-Navigator"

echo "Project Number: $PROJECT_NUMBER"
echo "Setting up Workload Identity Federation for GitHub org: $GITHUB_ORG"
echo ""

echo "Step 1: Creating Workload Identity Pool..."
gcloud iam workload-identity-pools create $POOL_NAME --project=$PROJECT_ID --location="global" --display-name="GitHub Actions Pool"

echo ""
echo "Step 2: Creating OIDC Provider..."
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME --project=$PROJECT_ID --location="global" --workload-identity-pool=$POOL_NAME --display-name="GitHub Provider" --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" --issuer-uri="https://token.actions.githubusercontent.com"

echo ""
echo "Step 3: Granting impersonation permission..."
gcloud iam service-accounts add-iam-policy-binding $SA_NAME@$PROJECT_ID.iam.gserviceaccount.com --project=$PROJECT_ID --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository_owner/$GITHUB_ORG"

echo ""
echo "============================================"
echo "SUCCESS! Add these to GitHub Secrets:"
echo "============================================"
echo ""
echo "GCP_PROJECT_ID:"
echo "$PROJECT_ID"
echo ""
echo "GCP_WORKLOAD_IDENTITY_PROVIDER:"
echo "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/providers/$PROVIDER_NAME"
echo ""
echo "GCP_SERVICE_ACCOUNT:"
echo "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
echo ""
