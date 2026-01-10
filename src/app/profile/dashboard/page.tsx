'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

interface Transaction {
  id: string;
  transaction_id: string;
  user_id: string;
  amount: number;
  phone_number: string;
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
}

interface DashboardStats {
  total_transactions: number;
  completed_transactions: number;
  failed_transactions: number;
  pending_transactions: number;
  total_amount_spent: number;
}

interface MonthlyPayment {
  [month: string]: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  
  // Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    total_transactions: 0,
    completed_transactions: 0,
    failed_transactions: 0,
    pending_transactions: 0,
    total_amount_spent: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [monthlyPayments, setMonthlyPayments] = useState<MonthlyPayment>({});

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount).replace('KES', 'KSh');
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-KE').format(num);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatMonthYear = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current session from Supabase
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('No authenticated user found');
        setIsLoading(false);
        router.push('/login');
        return;
      }

      // Load all data in parallel using Supabase queries
      await Promise.all([
        loadTransactionStats(session.user.id),
        loadRecentTransactions(session.user.id),
        loadMonthlyPayments(session.user.id),
      ]);

      setIsLoading(false);
    } catch (err: any) {
      setError(`Failed to load dashboard data: ${err.message}`);
      setIsLoading(false);
    }
  }, []);

  const loadTransactionStats = async (userId: string) => {
    try {
      // Try calling the server-side function first (more efficient)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_transaction_stats', { p_user_id: userId });

      if (!rpcError && rpcData) {
        // rpcData may be an array (Postgres returns a rowset) or an object depending on setup
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        setDashboardStats({
          total_transactions: Number(row?.total_transactions || 0),
          completed_transactions: Number(row?.completed_transactions || 0),
          failed_transactions: Number(row?.failed_transactions || 0),
          pending_transactions: Number(row?.pending_transactions || 0),
          total_amount_spent: Number(row?.total_amount_spent || 0),
        });
        return;
      }

      // Fallback: query the mpesa_transactions table directly
      const { data, error } = await supabase
        .from('mpesa_transactions')
        .select('id,transaction_id,amount,status,created_at')
        .eq('user_id', userId);

      if (error) throw error;

      const txs: Transaction[] = (data as any) || [];

      const total = txs.length;
      const completed = txs.filter(t => t.status === 'completed').length;
      const failed = txs.filter(t => t.status === 'failed').length;
      const pending = txs.filter(t => t.status === 'pending').length;
      const totalAmount = txs.reduce((s, t) => s + (Number(t.amount) || 0), 0);

      setDashboardStats({
        total_transactions: total,
        completed_transactions: completed,
        failed_transactions: failed,
        pending_transactions: pending,
        total_amount_spent: totalAmount,
      });
    } catch (err: any) {
      throw new Error(err.message || 'Failed to load transaction stats');
    }
  };

  const loadRecentTransactions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('mpesa_transactions')
        .select('id,transaction_id,phone_number,amount,status,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setRecentTransactions((data as Transaction[]) || []);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to load recent transactions');
    }
  };

  const loadMonthlyPayments = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('mpesa_transactions')
        .select('amount,created_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const txs: Transaction[] = (data as any) || [];
      const monthlyData: MonthlyPayment = {};

      txs.forEach(transaction => {
        const monthKey = formatMonthYear(transaction.created_at);
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (Number(transaction.amount) || 0);
      });

      setMonthlyPayments(monthlyData);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to load monthly payments');
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          icon: '✓',
        };
      case 'failed':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          icon: '✕',
        };
      case 'pending':
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          icon: '⏱',
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          icon: '?',
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-indigo-600 text-white px-4 py-4">
          <h1 className="text-xl font-bold">Dashboard</h1>
        </header>
        <div className="flex items-center justify-center h-[calc(100vh-64px)] px-5">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-600 mb-2">
              Failed to load dashboard
            </h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md">
              {error}
            </p>
            <button
              onClick={loadDashboardData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-indigo-600 text-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Dashboard</h1>
          <button
            onClick={loadDashboardData}
            className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Overview Cards */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Overview</h2>
          
          {/* Top Row - Main Stats */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard
              title="Total Spent"
              value={formatCurrency(dashboardStats.total_amount_spent)}
              icon="💳"
              iconColor="text-green-600"
              bgColor="bg-green-50"
            />
            <StatCard
              title="Transactions"
              value={dashboardStats.total_transactions.toString()}
              icon="🧾"
              iconColor="text-indigo-600"
              bgColor="bg-blue-50"
            />
          </div>

          {/* Bottom Row - Status Breakdown */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              title="Completed"
              value={dashboardStats.completed_transactions.toString()}
              icon="✓"
              iconColor="text-green-600"
              bgColor="bg-green-50"
              compact
            />
            <StatCard
              title="Pending"
              value={dashboardStats.pending_transactions.toString()}
              icon="⏱"
              iconColor="text-orange-600"
              bgColor="bg-orange-50"
              compact
            />
            <StatCard
              title="Failed"
              value={dashboardStats.failed_transactions.toString()}
              icon="✕"
              iconColor="text-red-600"
              bgColor="bg-red-50"
              compact
            />
          </div>
        </section>

        {/* Monthly Chart */}
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Monthly Payments</h2>
          
          {Object.keys(monthlyPayments).length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-600">No payment data available</p>
            </div>
          ) : (
            <MonthlyChart data={monthlyPayments} formatCurrency={formatCurrency} />
          )}
        </section>

        {/* Recent Transactions */}
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Recent Transactions</h2>
          </div>
          
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {recentTransactions.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  getStatusConfig={getStatusConfig}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon,
  iconColor,
  bgColor,
  compact = false,
}: {
  title: string;
  value: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  compact?: boolean;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-4 border border-opacity-10`}>
      <div className="flex items-start justify-between mb-2">
        <span className={`text-xl ${compact ? 'text-base' : 'text-lg'}`}>{icon}</span>
      </div>
      <div className={`${iconColor} font-bold ${compact ? 'text-lg' : 'text-xl'} mb-1`}>
        {value}
      </div>
      <div className="text-gray-600 text-xs font-medium">
        {title}
      </div>
    </div>
  );
}

// Monthly Chart Component
function MonthlyChart({
  data,
  formatCurrency,
}: {
  data: MonthlyPayment;
  formatCurrency: (amount: number) => string;
}) {
  const sortedEntries = Object.entries(data).sort((a, b) => {
    const dateA = new Date(a[0]);
    const dateB = new Date(b[0]);
    return dateA.getTime() - dateB.getTime();
  });

  const maxAmount = Math.max(...sortedEntries.map(([_, value]) => value));

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max h-52 items-end">
        {sortedEntries.map(([month, amount]) => {
          const heightRatio = amount / maxAmount;
          
          return (
            <div key={month} className="flex flex-col items-center" style={{ minWidth: '80px' }}>
              <div className="text-xs font-semibold mb-1 text-center">
                {formatCurrency(amount).replace('.00', '')}
              </div>
              <div
                className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t transition-all duration-300"
                style={{ height: `${150 * heightRatio}px`, minHeight: '20px' }}
              />
              <div className="text-xs font-medium mt-2 text-gray-600 text-center">
                {month}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Transaction Item Component
function TransactionItem({
  transaction,
  formatCurrency,
  formatDate,
  getStatusConfig,
}: {
  transaction: Transaction;
  formatCurrency: (amount: number) => string;
  formatDate: (dateStr: string) => string;
  getStatusConfig: (status: string) => { color: string; bgColor: string; icon: string };
}) {
  const statusConfig = getStatusConfig(transaction.status);

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
      {/* Status Icon */}
      <div className={`${statusConfig.bgColor} ${statusConfig.color} w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0`}>
        {statusConfig.icon}
      </div>

      {/* Transaction Details */}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-base text-gray-900">
          {formatCurrency(transaction.amount)}
        </div>
        <div className="text-xs text-gray-600 truncate">
          {transaction.phone_number}
        </div>
        <div className="text-xs text-gray-500">
          {formatDate(transaction.created_at)}
        </div>
      </div>

      {/* Status Badge and ID */}
      <div className="text-right flex-shrink-0">
        <div className={`${statusConfig.bgColor} ${statusConfig.color} px-2 py-1 rounded-full text-xs font-bold uppercase mb-1 inline-block`}>
          {transaction.status}
        </div>
        <div className="text-xs text-gray-500">
          #{transaction.transaction_id.substring(0, 8)}...
        </div>
      </div>
    </div>
  );
}