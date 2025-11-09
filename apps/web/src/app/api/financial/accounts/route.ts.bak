import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch all active financial accounts
    const accounts = await prisma.financialAccount.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        subtype: true,
        balance: true,
        availableBalance: true,
        creditLimit: true,
        interestRate: true,
        institution: true,
      },
      orderBy: {
        institution: 'asc',
      },
    });

    // Categorize accounts for calculator import
    const categorizedAccounts = {
      checking: accounts
        .filter(a => a.type === 'checking' || a.subtype === 'checking')
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      savings: accounts
        .filter(a => a.type === 'savings' || a.subtype === 'savings')
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      taxable: accounts
        .filter(a =>
          (a.type === 'investment' || a.subtype === 'brokerage') &&
          !a.name.toLowerCase().includes('ira') &&
          !a.name.toLowerCase().includes('401k') &&
          !a.name.toLowerCase().includes('403b') &&
          !a.name.toLowerCase().includes('roth')
        )
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      traditionalIRA: accounts
        .filter(a =>
          a.name.toLowerCase().includes('traditional ira') ||
          a.name.toLowerCase().includes('traditional_ira') ||
          (a.name.toLowerCase().includes('ira') && !a.name.toLowerCase().includes('roth'))
        )
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      rothIRA: accounts
        .filter(a =>
          a.name.toLowerCase().includes('roth') &&
          a.name.toLowerCase().includes('ira')
        )
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      account401k: accounts
        .filter(a =>
          a.name.toLowerCase().includes('401k') ||
          a.name.toLowerCase().includes('401(k)') ||
          a.name.toLowerCase().includes('403b') ||
          a.name.toLowerCase().includes('403(b)')
        )
        .reduce((sum, a) => sum + (a.balance || 0), 0),

      annuity: accounts
        .filter(a =>
          a.name.toLowerCase().includes('annuity') ||
          a.type === 'annuity'
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
