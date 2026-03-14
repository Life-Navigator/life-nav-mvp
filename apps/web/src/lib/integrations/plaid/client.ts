import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

function getPlaidClient(): PlaidApi {
  const configuration = new Configuration({
    basePath:
      PlaidEnvironments[(process.env.PLAID_ENV as keyof typeof PlaidEnvironments) || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
        'PLAID-SECRET': process.env.PLAID_CLIENT_SECRET || '',
      },
    },
  });
  return new PlaidApi(configuration);
}

export async function createLinkToken(userId: string, products?: string[]) {
  const client = getPlaidClient();
  const productList = (products || ['auth', 'transactions']).map((p) => p as Products);

  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Life Navigator',
    products: productList,
    country_codes: [CountryCode.Us],
    language: 'en',
  });

  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
  };
}

export async function exchangePublicToken(publicToken: string) {
  const client = getPlaidClient();
  const response = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });

  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

export async function getAccounts(accessToken: string) {
  const client = getPlaidClient();
  const response = await client.accountsGet({ access_token: accessToken });
  return response.data.accounts;
}

export async function getTransactions(accessToken: string, startDate: string, endDate: string) {
  const client = getPlaidClient();
  const response = await client.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
  });
  return {
    transactions: response.data.transactions,
    totalTransactions: response.data.total_transactions,
  };
}

export async function removeItem(accessToken: string) {
  const client = getPlaidClient();
  await client.itemRemove({ access_token: accessToken });
}
