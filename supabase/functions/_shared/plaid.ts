// Shared Plaid helper for Edge Functions
// All Plaid API calls go through here — secrets stay in Supabase Vault

const PLAID_ENVS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
};

function getConfig() {
  const clientId = Deno.env.get('PLAID_CLIENT_ID');
  const secret = Deno.env.get('PLAID_SECRET');
  const env = Deno.env.get('PLAID_ENV') || 'sandbox';
  if (!clientId || !secret) throw new Error('Plaid credentials not configured');
  return { clientId, secret, baseUrl: PLAID_ENVS[env] || PLAID_ENVS.sandbox };
}

async function plaidPost(endpoint: string, body: Record<string, unknown>) {
  const { clientId, secret, baseUrl } = getConfig();
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error_message: res.statusText }));
    throw new Error(err.error_message || `Plaid API error: ${res.status}`);
  }
  return res.json();
}

export async function createLinkToken(userId: string, products: string[] = ['auth', 'transactions']) {
  const data = await plaidPost('/link/token/create', {
    user: { client_user_id: userId },
    client_name: 'Life Navigator',
    products,
    country_codes: ['US'],
    language: 'en',
  });
  return { linkToken: data.link_token, expiration: data.expiration };
}

export async function exchangePublicToken(publicToken: string) {
  const data = await plaidPost('/item/public_token/exchange', { public_token: publicToken });
  return { accessToken: data.access_token, itemId: data.item_id };
}

export async function getAccounts(accessToken: string) {
  const data = await plaidPost('/accounts/get', { access_token: accessToken });
  return data.accounts;
}

export async function getTransactions(accessToken: string, startDate: string, endDate: string) {
  const data = await plaidPost('/transactions/get', {
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
  });
  return { transactions: data.transactions, totalTransactions: data.total_transactions };
}

export async function removeItem(accessToken: string) {
  await plaidPost('/item/remove', { access_token: accessToken });
}
