# ENVIRONMENT_DISCOVERY.md — Phase 1

| Item                         | Value                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GCP account                  | timothy.riffe@lifenavigator.tech (roles/owner)                                                                                    |
| GCP project                  | gen-lang-client-0849161409                                                                                                        |
| Project number               | 763004283556                                                                                                                      |
| Organization                 | 925764858518                                                                                                                      |
| Vertex region                | us-central1 (Gemini); global (Claude, when enabled)                                                                               |
| Fly org                      | Timothy Riffe (slug `personal`)                                                                                                   |
| Fly app                      | lifenavigator-core-api (region iad)                                                                                               |
| Service account              | lifenav-model-runtime@gen-lang-client-0849161409.iam.gserviceaccount.com (exists, enabled)                                        |
| SA roles                     | roles/aiplatform.user, roles/serviceusage.serviceUsageConsumer (+ iam.workloadIdentityUser added Phase 4)                         |
| WIF pools (before)           | none                                                                                                                              |
| **Fly OIDC issuer (actual)** | **https://oidc.fly.io/timothy-riffe** (NOT `/personal` — the token `iss` uses the org-name slug; discovered via a live STS error) |
| Fly OIDC sub format          | `org-name:app-name:machine-name`                                                                                                  |
| Fly OIDC claims              | sub, aud, app_name, app_id, org_id, org_name, machine_id, region, image, image_digest, image_tag                                  |

Reuse: SA reused (already existed). Pool/provider created fresh.
