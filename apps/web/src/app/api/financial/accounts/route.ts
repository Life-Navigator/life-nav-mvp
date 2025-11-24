import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all Plaid-connected accounts (source of truth for financial data)
    const plaidItems = await prisma.plaidItem.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        accounts: true,
      },
    });

    // Extract and transform Plaid accounts to match expected format
    const accounts = plaidItems.flatMap(item =>
      item.accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        subtype: acc.subtype,
        balance: acc.currentBalance,
        availableBalance: acc.availableBalance,
        creditLimit: acc.creditLimit,
        interestRate: null, // Plaid doesn't provide this directly
        institution: item.institutionName,
      }))
    );

    // Categorize accounts for calculator import
    // Plaid types: depository, investment, credit, loan, brokerage
    // Plaid subtypes: checking, savings, cd, money market, 401k, ira, roth, etc.
    const categorizedAccounts = {
      checking: accounts
        .filter(a => a.type === 'depository' && a.subtype === 'checking')
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      savings: accounts
        .filter(a => a.type === 'depository' && ['savings', 'cd', 'money market'].includes(a.subtype || ''))
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      taxable: accounts
        .filter(a =>
          (a.type === 'investment' || a.type === 'brokerage') &&
          !['401k', '401a', '403b', 'ira', 'roth', 'roth 401k'].includes(a.subtype || '') &&
          !a.name?.toLowerCase().includes('ira') &&
          !a.name?.toLowerCase().includes('401k') &&
          !a.name?.toLowerCase().includes('403b') &&
          !a.name?.toLowerCase().includes('roth')
        )
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      traditionalIRA: accounts
        .filter(a =>
          a.subtype === 'ira' ||
          a.name?.toLowerCase().includes('traditional ira') ||
          a.name?.toLowerCase().includes('traditional_ira') ||
          (a.name?.toLowerCase().includes('ira') && !a.name?.toLowerCase().includes('roth'))
        )
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      rothIRA: accounts
        .filter(a =>
          a.subtype === 'roth' ||
          (a.name?.toLowerCase().includes('roth') && a.name?.toLowerCase().includes('ira'))
        )
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      account401k: accounts
        .filter(a =>
          ['401k', '401a', '403b', 'roth 401k'].includes(a.subtype || '') ||
          a.name?.toLowerCase().includes('401k') ||
          a.name?.toLowerCase().includes('401(k)') ||
          a.name?.toLowerCase().includes('403b') ||
          a.name?.toLowerCase().includes('403(b)')
        )
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      annuity: accounts
        .filter(a =>
          a.subtype === 'annuity' ||
          a.name?.toLowerCase().includes('annuity')
        )
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      totalDebt: accounts
        .filter(a => a.type === 'credit' || a.type === 'loan')
        .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0),

      creditAvailable: accounts
        .filter(a => a.type === 'credit')
        .reduce((sum, a) => sum + ((a.creditLimit || 0) - Math.abs(a.balance || 0)), 0),
    };

    // Return both categorized totals and raw account list
    return NextResponse.json({
      categorized: categorizedAccounts,
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        balance: a.balance,
        institution: a.institution,
      })),
      totalNetWorth: Object.values(categorizedAccounts).reduce((sum: number, val) => {
        if (typeof val === 'number') return sum + val;
        return sum;
      }, 0) - categorizedAccounts.totalDebt,
    });

  } catch (error) {
    console.error('Error fetching financial accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}
