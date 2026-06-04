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

/**
 * Create a sandbox public token directly (no Link UI), driven by a sandbox
 * test username/password. Used by the beta "sample financial profile" flow so
 * a persona can be activated server-side without the user touching Plaid.
 */
export async function createSandboxPublicToken(opts: {
  institutionId: string;
  products?: string[];
  username?: string;
  password?: string;
}) {
  const client = getPlaidClient();
  const productList = (opts.products || ['transactions']).map((p) => p as Products);
  const response = await client.sandboxPublicTokenCreate({
    institution_id: opts.institutionId,
    initial_products: productList,
    options: {
      override_username: opts.username || 'user_good',
      override_password: opts.password || 'pass_good',
    },
  });
  return { publicToken: response.data.public_token };
}

export async function getInvestments(accessToken: string) {
  const client = getPlaidClient();
  const response = await client.investmentsHoldingsGet({ access_token: accessToken });
  return {
    holdings: response.data.holdings,
    securities: response.data.securities,
    accounts: response.data.accounts,
  };
}

export async function getLiabilities(accessToken: string) {
  const client = getPlaidClient();
  const response = await client.liabilitiesGet({ access_token: accessToken });
  return response.data.liabilities;
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
