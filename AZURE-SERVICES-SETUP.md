# Azure Services Setup Guide

This guide walks through setting up all required Azure services for the LifeNavigator multi-agent system.

## Prerequisites

- Azure subscription with appropriate permissions
- Azure CLI installed (`az` command)
- Node.js 20+ and pnpm 9+ installed

## 1. Azure OpenAI Service

### Create Azure OpenAI Resource

```bash
# Create resource group
az group create --name lifenavigator-rg --location eastus

# Create Azure OpenAI resource
az cognitiveservices account create \
  --name lifenavigator-openai \
  --resource-group lifenavigator-rg \
  --kind OpenAI \
  --sku S0 \
  --location eastus \
  --yes
```

### Deploy Models

1. Go to Azure OpenAI Studio: https://oai.azure.com/
2. Select your resource
3. Deploy the following models:
   - **GPT-4 Turbo**: Deployment name: `gpt-4-turbo`
   - **Text Embedding Ada 002**: Deployment name: `text-embedding-ada-002`

### Get API Keys

```bash
az cognitiveservices account keys list \
  --name lifenavigator-openai \
  --resource-group lifenavigator-rg
```

## 2. Azure Cosmos DB (for GraphRAG)

### Create Cosmos DB Account

```bash
az cosmosdb create \
  --name lifenavigator-cosmos \
  --resource-group lifenavigator-rg \
  --kind GlobalDocumentDB \
  --locations regionName=eastus \
  --default-consistency-level Session \
  --enable-automatic-failover false
```

### Create Database and Containers

```bash
# Create database
az cosmosdb sql database create \
  --account-name lifenavigator-cosmos \
  --resource-group lifenavigator-rg \
  --name lifenavigator-graph

# Create containers
az cosmosdb sql container create \
  --account-name lifenavigator-cosmos \
  --resource-group lifenavigator-rg \
  --database-name lifenavigator-graph \
  --name user-knowledge \
  --partition-key-path /userId \
  --throughput 400

az cosmosdb sql container create \
  --account-name lifenavigator-cosmos \
  --resource-group lifenavigator-rg \
  --database-name lifenavigator-graph \
  --name knowledge-graph \
  --partition-key-path /userId \
  --throughput 400
```

### Get Connection String

```bash
az cosmosdb keys list \
  --name lifenavigator-cosmos \
  --resource-group lifenavigator-rg \
  --type connection-strings
```

## 3. Azure Cognitive Search

### Create Search Service

```bash
az search service create \
  --name lifenavigator-search \
  --resource-group lifenavigator-rg \
  --sku standard \
  --location eastus
```

### Create Index

```javascript
// Run this script after setting up environment variables
const { SearchIndexClient, AzureKeyCredential } = require('@azure/search-documents');

const client = new SearchIndexClient(
  process.env.AZURE_SEARCH_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_SEARCH_API_KEY)
);

const index = {
  name: 'lifenavigator-knowledge',
  fields: [
    { name: 'id', type: 'Edm.String', key: true },
    { name: 'userId', type: 'Edm.String', filterable: true },
    { name: 'type', type: 'Edm.String', filterable: true, facetable: true },
    { name: 'properties', type: 'Edm.String' },
    { name: 'embedding', type: 'Collection(Edm.Single)', vectorSearchDimensions: 1536 },
    { name: 'timestamp', type: 'Edm.DateTimeOffset', filterable: true, sortable: true },
    { name: 'searchText', type: 'Edm.String', searchable: true }
  ],
  vectorSearch: {
    algorithms: [{
      name: 'hnsw',
      kind: 'hnsw',
      parameters: {
        metric: 'cosine',
        m: 4,
        efConstruction: 400,
        efSearch: 500
      }
    }],
    profiles: [{
      name: 'vector-profile',
      algorithmConfigurationName: 'hnsw'
    }]
  }
};

await client.createIndex(index);
```

### Get API Key

```bash
az search admin-key show \
  --service-name lifenavigator-search \
  --resource-group lifenavigator-rg
```

## 4. Azure Database for PostgreSQL

### Create PostgreSQL Server

```bash
az postgres flexible-server create \
  --name lifenavigator-db \
  --resource-group lifenavigator-rg \
  --location eastus \
  --admin-user dbadmin \
  --admin-password YourSecurePassword123! \
  --sku-name Standard_B2s \
  --tier Burstable \
  --storage-size 32 \
  --version 15
```

### Configure Firewall

```bash
# Allow Azure services
az postgres flexible-server firewall-rule create \
  --name lifenavigator-db \
  --resource-group lifenavigator-rg \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Create Database

```bash
az postgres flexible-server db create \
  --server-name lifenavigator-db \
  --resource-group lifenavigator-rg \
  --database-name lifenavigator
```

## 5. Azure Cache for Redis

### Create Redis Cache

```bash
az redis create \
  --name lifenavigator-redis \
  --resource-group lifenavigator-rg \
  --location eastus \
  --sku Standard \
  --vm-size c1 \
  --enable-non-ssl-port false
```

### Get Connection String

```bash
az redis list-keys \
  --name lifenavigator-redis \
  --resource-group lifenavigator-rg
```

## 6. Application Insights

### Create Application Insights

```bash
az monitor app-insights component create \
  --app lifenavigator-insights \
  --location eastus \
  --resource-group lifenavigator-rg \
  --application-type web
```

### Get Instrumentation Key

```bash
az monitor app-insights component show \
  --app lifenavigator-insights \
  --resource-group lifenavigator-rg \
  --query instrumentationKey
```

## 7. Azure Storage Account

### Create Storage Account

```bash
az storage account create \
  --name lifenavigatorstore \
  --resource-group lifenavigator-rg \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2
```

### Create Containers

```bash
# Get connection string
export AZURE_STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
  --name lifenavigatorstore \
  --resource-group lifenavigator-rg \
  --query connectionString -o tsv)

# Create containers
az storage container create --name uploads
az storage container create --name documents
az storage container create --name backups
```

## 8. Deploy to Azure App Service

### Create App Service Plan

```bash
az appservice plan create \
  --name lifenavigator-plan \
  --resource-group lifenavigator-rg \
  --sku P1V3 \
  --is-linux
```

### Create Web App

```bash
az webapp create \
  --name lifenavigator-app \
  --resource-group lifenavigator-rg \
  --plan lifenavigator-plan \
  --runtime "NODE:20-lts"
```

### Configure App Settings

```bash
# Set all environment variables
az webapp config appsettings set \
  --name lifenavigator-app \
  --resource-group lifenavigator-rg \
  --settings @app-settings.json
```

### Deploy Application

```bash
# Build application
pnpm install
pnpm build

# Deploy using ZIP
az webapp deployment source config-zip \
  --name lifenavigator-app \
  --resource-group lifenavigator-rg \
  --src deploy.zip
```

## 9. Security Configuration

### Enable Managed Identity

```bash
az webapp identity assign \
  --name lifenavigator-app \
  --resource-group lifenavigator-rg
```

### Configure Key Vault

```bash
# Create Key Vault
az keyvault create \
  --name lifenavigator-kv \
  --resource-group lifenavigator-rg \
  --location eastus

# Store secrets
az keyvault secret set \
  --vault-name lifenavigator-kv \
  --name OpenAIKey \
  --value "your-openai-key"

# Grant access to web app
az keyvault set-policy \
  --name lifenavigator-kv \
  --object-id $(az webapp identity show --name lifenavigator-app --resource-group lifenavigator-rg --query principalId -o tsv) \
  --secret-permissions get list
```

## 10. Monitoring and Alerts

### Create Alert Rules

```bash
# High error rate alert
az monitor metrics alert create \
  --name high-error-rate \
  --resource-group lifenavigator-rg \
  --scopes /subscriptions/{subscription-id}/resourceGroups/lifenavigator-rg/providers/Microsoft.Web/sites/lifenavigator-app \
  --condition "avg requests/failed > 10" \
  --window-size 5m \
  --evaluation-frequency 1m
```

## Environment Variables Summary

After completing the setup, update your `.env` file with the following:

```env
# Copy values from .env.azure.example and fill in with your actual values
AZURE_OPENAI_ENDPOINT=https://lifenavigator-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=<from-step-1>
AZURE_COSMOSDB_ENDPOINT=https://lifenavigator-cosmos.documents.azure.com:443/
AZURE_COSMOSDB_KEY=<from-step-2>
AZURE_SEARCH_ENDPOINT=https://lifenavigator-search.search.windows.net
AZURE_SEARCH_API_KEY=<from-step-3>
DATABASE_URL=postgresql://dbadmin:YourSecurePassword123!@lifenavigator-db.postgres.database.azure.com:5432/lifenavigator?sslmode=require
REDIS_URL=redis://default:<key>@lifenavigator-redis.redis.cache.windows.net:6380?ssl=true
```

## Testing the Setup

Run the following command to test all services:

```bash
pnpm run test:azure-services
```

## Troubleshooting

### Common Issues

1. **OpenAI API Errors**: Ensure models are deployed and quota is available
2. **Cosmos DB Throttling**: Increase RU/s if needed
3. **Search Index Not Found**: Run the index creation script
4. **Redis Connection Failed**: Check firewall rules and SSL settings
5. **PostgreSQL Connection**: Ensure SSL is enabled and firewall allows your IP

### Support

For issues, check:
- Azure Portal diagnostics
- Application Insights logs
- Container logs: `az webapp log tail --name lifenavigator-app --resource-group lifenavigator-rg`