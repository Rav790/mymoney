import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  CircleDollarSign,
  Download,
  Edit3,
  FileText,
  Filter,
  Home,
  Landmark,
  Lock,
  Moon,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  startOfDay,
  subDays,
  subMonths,
} from 'date-fns';

const STORAGE_KEY = 'mymoney_data';
const APP_VERSION = '1.0.0';
const AUTO_LOCK_MINUTES = 5;

const COLORS = {
  primary: '#4F46E5',
  success: '#10B981',
  danger: '#F43F5E',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  subText: '#6B7280',
};

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
];

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'card', label: 'Card' },
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
];

const RECURRENCE_TYPES = ['daily', 'weekly', 'monthly', 'yearly'];
const AVATARS = ['🧑‍💼', '👩‍💼', '🧑‍💻', '👨‍💻', '👩‍🎓', '🧠', '🦊', '🐼', '🚀', '💼'];

const DEFAULT_CATEGORY_SEEDS = [
  { name: 'Food & Dining', icon: '🍔', color: '#F97316', type: 'expense' },
  { name: 'Transport', icon: '🚗', color: '#3B82F6', type: 'expense' },
  { name: 'Shopping', icon: '🛍️', color: '#EC4899', type: 'expense' },
  { name: 'Housing & Rent', icon: '🏠', color: '#8B5CF6', type: 'expense' },
  { name: 'Utilities', icon: '💡', color: '#EAB308', type: 'expense' },
  { name: 'Entertainment', icon: '🎬', color: '#A855F7', type: 'expense' },
  { name: 'Healthcare', icon: '💊', color: '#EF4444', type: 'expense' },
  { name: 'Education', icon: '📚', color: '#14B8A6', type: 'expense' },
  { name: 'Travel', icon: '✈️', color: '#06B6D4', type: 'expense' },
  { name: 'Coffee', icon: '☕', color: '#92400E', type: 'expense' },
  { name: 'Salary', icon: '💼', color: '#10B981', type: 'income' },
  { name: 'Freelance', icon: '💰', color: '#059669', type: 'income' },
  { name: 'Investment', icon: '📈', color: '#0EA5E9', type: 'income' },
  { name: 'Gift', icon: '🎁', color: '#D946EF', type: 'income' },
];

const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const nowIso = () => new Date().toISOString();

const clone = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const toSafeDate = (value) => {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const toInputDate = (isoValue) => {
  const d = toSafeDate(isoValue);
  return format(d, 'yyyy-MM-dd');
};

const inputDateToIso = (dateString) => {
  if (!dateString) return nowIso();
  return new Date(`${dateString}T12:00:00`).toISOString();
};

const toMonthKey = (isoValue) => format(toSafeDate(isoValue), 'yyyy-MM');
const toNumber = (value) => Number.parseFloat(String(value ?? 0)) || 0;
const withTimestamps = (record) => ({
  ...record,
  createdAt: record.createdAt || nowIso(),
  updatedAt: record.updatedAt || record.createdAt || nowIso(),
});

const nextDueDate = (date, frequency) => {
  if (frequency === 'daily') return addDays(date, 1);
  if (frequency === 'weekly') return addWeeks(date, 1);
  if (frequency === 'yearly') return addYears(date, 1);
  return addMonths(date, 1);
};

const triggerDownload = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const hashPin = async (pin) => {
  if (globalThis.crypto?.subtle) {
    const encoded = new TextEncoder().encode(`mymoney:${pin}`);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  return btoa(`mymoney:${pin}`);
};

const createTransactionDraft = () => ({
  type: 'expense',
  amount: '',
  categoryId: '',
  accountId: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  note: '',
  receipt: '',
});

const createBudgetDraft = (month) => ({
  categoryId: '',
  monthlyLimit: '',
  month: month || format(new Date(), 'yyyy-MM'),
  rollover: false,
});

const createAccountDraft = () => ({
  name: '',
  icon: '💵',
  color: COLORS.primary,
  type: 'cash',
  initialBalance: '',
});

const createTransferDraft = () => ({
  fromAccountId: '',
  toAccountId: '',
  amount: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  note: '',
});

const createGoalDraft = () => ({
  name: '',
  icon: '🎯',
  targetAmount: '',
  currentAmount: '',
  targetDate: format(addMonths(new Date(), 6), 'yyyy-MM-dd'),
});

const createRecurringDraft = () => ({
  name: '',
  amount: '',
  type: 'expense',
  categoryId: '',
  accountId: '',
  frequency: 'monthly',
  nextDueDate: format(new Date(), 'yyyy-MM-dd'),
  isActive: true,
});

const createCategoryDraft = () => ({
  name: '',
  icon: '🏷️',
  color: COLORS.primary,
  type: 'expense',
});

const createSeedData = () => {
  const createdAt = nowIso();
  const categories = DEFAULT_CATEGORY_SEEDS.map((seed) =>
    withTimestamps({
      id: uid(),
      ...seed,
      isDefault: true,
    }),
  );

  return {
    version: APP_VERSION,
    createdAt,
    updatedAt: createdAt,
    settings: {
      profileName: '',
      avatar: '🙂',
      currencyCode: 'INR',
      currencySymbol: '₹',
      decimalPlaces: 2,
      darkMode: false,
      createdAt,
      updatedAt: createdAt,
    },
    security: {
      pinHash: '',
      autoLockMinutes: AUTO_LOCK_MINUTES,
      createdAt,
      updatedAt: createdAt,
    },
    accounts: [],
    categories,
    transactions: [],
    budgets: [],
    savingsGoals: [],
    recurringTransactions: [],
    goalHistory: [],
    transfers: [],
  };
};

const sanitizeData = (raw) => {
  if (!raw || typeof raw !== 'object') return createSeedData();
  const createdAt = raw.createdAt || nowIso();
  const legacyAccountNames = ['Cash Wallet', 'Bank Account', 'Credit Card'];
  const hasLegacyAccounts =
    Array.isArray(raw.accounts) &&
    raw.accounts.length === 3 &&
    legacyAccountNames.every((name) => raw.accounts.some((account) => account?.name === name));
  const hasLegacySampleData =
    Array.isArray(raw.transactions) &&
    raw.transactions.length >= 15 &&
    raw.transactions.length <= 25 &&
    Array.isArray(raw.budgets) &&
    raw.budgets.length >= 3 &&
    Array.isArray(raw.savingsGoals) &&
    raw.savingsGoals.length >= 2 &&
    Array.isArray(raw.recurringTransactions) &&
    raw.recurringTransactions.length >= 2;
  const looksLikeOldSeed =
    String(raw?.settings?.profileName || '').trim() === 'Alex Morgan' && hasLegacyAccounts && hasLegacySampleData;
  if (looksLikeOldSeed) {
    const reset = createSeedData();
    reset.security.pinHash = raw.security?.pinHash || '';
    reset.security.autoLockMinutes = Number(raw.security?.autoLockMinutes || AUTO_LOCK_MINUTES);
    reset.settings.darkMode = Boolean(raw.settings?.darkMode);
    reset.settings.decimalPlaces = Number(raw.settings?.decimalPlaces ?? 2);
    reset.settings.updatedAt = nowIso();
    return reset;
  }

  const currencyCode = raw.settings?.currencyCode || 'INR';
  const chosenCurrency = CURRENCIES.find((currency) => currency.code === currencyCode) || CURRENCIES[0];
  const normalizedProfileName = String(raw.settings?.profileName || '').trim();
  const settings = {
    profileName: normalizedProfileName === 'Alex Morgan' ? '' : normalizedProfileName,
    avatar: raw.settings?.avatar || '🙂',
    currencyCode: chosenCurrency.code,
    currencySymbol: raw.settings?.currencySymbol || chosenCurrency.symbol,
    decimalPlaces: Number(raw.settings?.decimalPlaces ?? 2),
    darkMode: Boolean(raw.settings?.darkMode),
    createdAt: raw.settings?.createdAt || createdAt,
    updatedAt: nowIso(),
  };
  const security = {
    pinHash: raw.security?.pinHash || '',
    autoLockMinutes: Number(raw.security?.autoLockMinutes || AUTO_LOCK_MINUTES),
    createdAt: raw.security?.createdAt || createdAt,
    updatedAt: nowIso(),
  };

  const normalizeArray = (array) => (Array.isArray(array) ? array.map((item) => withTimestamps(item)) : []);

  return {
    version: raw.version || APP_VERSION,
    createdAt,
    updatedAt: nowIso(),
    settings,
    security,
    accounts: normalizeArray(raw.accounts),
    categories: normalizeArray(raw.categories),
    transactions: normalizeArray(raw.transactions),
    budgets: normalizeArray(raw.budgets),
    savingsGoals: normalizeArray(raw.savingsGoals),
    recurringTransactions: normalizeArray(raw.recurringTransactions),
    goalHistory: normalizeArray(raw.goalHistory),
    transfers: normalizeArray(raw.transfers),
  };
};

const recalculateDerivedData = (inputData) => {
  const data = clone(inputData);
  const decimals = Number(data.settings?.decimalPlaces ?? 2);
  const round = (value) => Number(toNumber(value).toFixed(decimals));
  const accountMap = new Map();

  (data.accounts || []).forEach((account) => {
    accountMap.set(account.id, round(account.initialBalance));
  });

  (data.transactions || [])
    .slice()
    .sort((left, right) => +toSafeDate(left.date) - +toSafeDate(right.date))
    .forEach((transaction) => {
      const amount = round(transaction.amount);
      if (!accountMap.has(transaction.accountId)) return;
      const current = accountMap.get(transaction.accountId);
      accountMap.set(
        transaction.accountId,
        round(transaction.type === 'income' ? current + amount : current - amount),
      );
    });

  (data.transfers || [])
    .slice()
    .sort((left, right) => +toSafeDate(left.date) - +toSafeDate(right.date))
    .forEach((transfer) => {
      const amount = round(transfer.amount);
      if (accountMap.has(transfer.fromAccountId)) {
        accountMap.set(transfer.fromAccountId, round(accountMap.get(transfer.fromAccountId) - amount));
      }
      if (accountMap.has(transfer.toAccountId)) {
        accountMap.set(transfer.toAccountId, round(accountMap.get(transfer.toAccountId) + amount));
      }
    });

  data.accounts = (data.accounts || []).map((account) =>
    withTimestamps({
      ...account,
      balance: round(accountMap.get(account.id) ?? account.balance ?? account.initialBalance ?? 0),
    }),
  );

  const spendingByBudgetKey = new Map();
  (data.transactions || []).forEach((transaction) => {
    if (transaction.type !== 'expense') return;
    const key = `${transaction.categoryId}_${toMonthKey(transaction.date)}`;
    spendingByBudgetKey.set(key, round((spendingByBudgetKey.get(key) || 0) + toNumber(transaction.amount)));
  });

  data.budgets = (data.budgets || []).map((budget) =>
    withTimestamps({
      ...budget,
      spent: round(spendingByBudgetKey.get(`${budget.categoryId}_${budget.month}`) || 0),
    }),
  );

  data.updatedAt = nowIso();
  return data;
};

const processRecurringTransactions = (inputData) => {
  const data = clone(inputData);
  const currentDate = new Date();
  let generatedCount = 0;

  data.recurringTransactions = (data.recurringTransactions || []).map((recurring) => {
    if (!recurring.isActive) return recurring;
    let dueDate = startOfDay(toSafeDate(recurring.nextDueDate));
    let guard = 0;
    while (!isAfter(dueDate, currentDate) && guard < 120) {
      data.transactions.push(
        withTimestamps({
          id: uid(),
          type: recurring.type,
          amount: Number(toNumber(recurring.amount).toFixed(2)),
          categoryId: recurring.categoryId,
          accountId: recurring.accountId,
          date: dueDate.toISOString(),
          note: recurring.name,
          receipt: '',
          isRecurring: true,
          recurringId: recurring.id,
        }),
      );
      dueDate = nextDueDate(dueDate, recurring.frequency);
      generatedCount += 1;
      guard += 1;
    }

    return withTimestamps({
      ...recurring,
      nextDueDate: dueDate.toISOString(),
    });
  });

  return { data, generatedCount };
};

const buildTransactionsCsv = (transactions, categoriesById, accountsById) => {
  const header = ['ID', 'Type', 'Amount', 'Category', 'Account', 'Date', 'Note', 'Recurring'];
  const rows = transactions.map((transaction) => {
    const categoryName = categoriesById.get(transaction.categoryId)?.name || 'Unknown';
    const accountName = accountsById.get(transaction.accountId)?.name || 'Unknown';
    const escapedNote = String(transaction.note || '').replace(/"/g, '""');
    return [
      transaction.id,
      transaction.type,
      toNumber(transaction.amount).toFixed(2),
      categoryName,
      accountName,
      format(toSafeDate(transaction.date), 'yyyy-MM-dd'),
      `"${escapedNote}"`,
      transaction.isRecurring ? 'Yes' : 'No',
    ].join(',');
  });
  return [header.join(','), ...rows].join('\n');
};

const ProgressBar = ({ value, max, color = COLORS.primary }) => {
  const percentage = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        className="h-3 rounded-full transition-all duration-500"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  );
};

const SkeletonCard = () => (
  <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <div className="mb-3 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
    <div className="h-8 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
    <div className="mt-3 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
    <p className="text-lg font-semibold">{title}</p>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
  </div>
);

const PAGE_TITLES = {
  home: 'Dashboard',
  transactions: 'Transactions',
  transactionForm: 'Add Transaction',
  budget: 'Budget Planner',
  accounts: 'Accounts',
  analytics: 'Analytics',
  goals: 'Savings Goals',
  recurring: 'Recurring Transactions',
  reports: 'Reports',
  settings: 'Settings',
  more: 'More',
};

const DESKTOP_NAV = [
  { key: 'home', label: 'Dashboard', icon: Home },
  { key: 'transactions', label: 'Transactions', icon: Wallet },
  { key: 'budget', label: 'Budget Planner', icon: CircleDollarSign },
  { key: 'accounts', label: 'Accounts', icon: Landmark },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'goals', label: 'Savings Goals', icon: Target },
  { key: 'recurring', label: 'Recurring', icon: Repeat },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const MOBILE_MORE_LINKS = [
  { key: 'accounts', label: 'Accounts', icon: Landmark },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'goals', label: 'Savings Goals', icon: Target },
  { key: 'recurring', label: 'Recurring', icon: Repeat },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [toasts, setToasts] = useState([]);

  const [lockMode, setLockMode] = useState(null);
  const [setupPin, setSetupPin] = useState('');
  const [setupPinConfirm, setSetupPinConfirm] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [profileSetup, setProfileSetup] = useState({ name: '', avatar: '🙂' });

  const [editingTransactionId, setEditingTransactionId] = useState('');
  const [transactionDraft, setTransactionDraft] = useState(createTransactionDraft());
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionFilters, setTransactionFilters] = useState({
    type: 'all',
    categoryId: 'all',
    accountId: 'all',
    startDate: '',
    endDate: '',
    sortBy: 'date_desc',
  });
  const [calendarView, setCalendarView] = useState(false);
  const [refreshingTransactions, setRefreshingTransactions] = useState(false);

  const [budgetMonth, setBudgetMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState('');
  const [budgetDraft, setBudgetDraft] = useState(createBudgetDraft(format(new Date(), 'yyyy-MM')));

  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState('');
  const [accountDraft, setAccountDraft] = useState(createAccountDraft());
  const [transferDraft, setTransferDraft] = useState(createTransferDraft());

  const [analyticsRange, setAnalyticsRange] = useState('month');
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState('');
  const [goalDraft, setGoalDraft] = useState(createGoalDraft());
  const [goalContribution, setGoalContribution] = useState({ goalId: '', amount: '' });

  const [recurringFormOpen, setRecurringFormOpen] = useState(false);
  const [editingRecurringId, setEditingRecurringId] = useState('');
  const [recurringDraft, setRecurringDraft] = useState(createRecurringDraft());

  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [reportYear, setReportYear] = useState(format(new Date(), 'yyyy'));

  const [settingsDraft, setSettingsDraft] = useState(null);
  const [passcodeDraft, setPasscodeDraft] = useState({ oldPin: '', newPin: '', confirmPin: '' });
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [categoryDraft, setCategoryDraft] = useState(createCategoryDraft());

  const touchStartRef = useRef({ id: '', x: 0 });
  const activityRef = useRef(Date.now());

  const addToast = useCallback((type, message) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const persist = useCallback((nextData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    setData(nextData);
  }, []);

  const mutateData = useCallback(
    (updater, toastMessage = '', toastType = 'success') => {
      setData((current) => {
        if (!current) return current;
        const draft = clone(current);
        const updated = updater(draft) || draft;
        const processed = recalculateDerivedData(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(processed));
        return processed;
      });
      if (toastMessage) addToast(toastType, toastMessage);
    },
    [addToast],
  );

  useEffect(() => {
    let loaded;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        loaded = sanitizeData(JSON.parse(raw));
      } else {
        loaded = createSeedData();
      }
    } catch {
      loaded = createSeedData();
    }

    const recurringResult = processRecurringTransactions(loaded);
    const processed = recalculateDerivedData(recurringResult.data);
    persist(processed);

    setTransactionDraft((prev) => ({
      ...prev,
      accountId: processed.accounts[0]?.id || '',
      categoryId: processed.categories.find((category) => category.type !== 'income')?.id || '',
    }));
    setBudgetDraft((prev) => ({
      ...prev,
      categoryId: processed.categories.find((category) => category.type === 'expense')?.id || '',
    }));
    setRecurringDraft((prev) => ({
      ...prev,
      accountId: processed.accounts[0]?.id || '',
      categoryId: processed.categories.find((category) => category.type === 'expense')?.id || '',
    }));
    setTransferDraft((prev) => ({
      ...prev,
      fromAccountId: processed.accounts[0]?.id || '',
      toAccountId: processed.accounts[1]?.id || processed.accounts[0]?.id || '',
    }));
    setSettingsDraft(processed.settings);
    setProfileSetup({
      name: processed.settings.profileName || '',
      avatar: processed.settings.avatar || '🙂',
    });
    setLockMode(processed.security?.pinHash ? 'unlock' : 'setup');
    setLoading(false);

    if (recurringResult.generatedCount > 0) {
      addToast('success', `Auto-logged ${recurringResult.generatedCount} recurring transaction(s).`);
    }
  }, [addToast, persist]);

  useEffect(() => {
    if (!data?.settings) return;
    const enabled = Boolean(data.settings.darkMode);
    document.documentElement.classList.toggle('dark', enabled);
    document.body.classList.toggle('dark', enabled);
    document.documentElement.style.colorScheme = enabled ? 'dark' : 'light';
  }, [data?.settings?.darkMode]);

  useEffect(() => {
    if (!data?.security?.pinHash || lockMode !== null) return undefined;
    const markActivity = () => {
      activityRef.current = Date.now();
    };

    markActivity();
    const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    events.forEach((eventName) => window.addEventListener(eventName, markActivity, true));

    const interval = window.setInterval(() => {
      const idleTime = Date.now() - activityRef.current;
      const maxIdle = (data.security.autoLockMinutes || AUTO_LOCK_MINUTES) * 60 * 1000;
      if (idleTime >= maxIdle) {
        setUnlockPin('');
        setPinError('');
        setLockMode('unlock');
      }
    }, 10000);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, markActivity, true));
      clearInterval(interval);
    };
  }, [data?.security, lockMode]);

  const formatMoney = useCallback(
    (amount) => {
      const symbol = data?.settings?.currencySymbol || '₹';
      const decimals = Number(data?.settings?.decimalPlaces ?? 2);
      return `${symbol}${toNumber(amount).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    },
    [data?.settings],
  );

  const categoriesById = useMemo(() => {
    const map = new Map();
    (data?.categories || []).forEach((category) => map.set(category.id, category));
    return map;
  }, [data?.categories]);

  const accountsById = useMemo(() => {
    const map = new Map();
    (data?.accounts || []).forEach((account) => map.set(account.id, account));
    return map;
  }, [data?.accounts]);

  const sortedTransactions = useMemo(
    () =>
      [...(data?.transactions || [])].sort(
        (left, right) => +toSafeDate(right.date) - +toSafeDate(left.date),
      ),
    [data?.transactions],
  );

  const expenseCategories = useMemo(
    () => (data?.categories || []).filter((category) => category.type !== 'income'),
    [data?.categories],
  );

  const openAddTransaction = useCallback(() => {
    setEditingTransactionId('');
    setTransactionDraft({
      ...createTransactionDraft(),
      accountId: data?.accounts?.[0]?.id || '',
      categoryId:
        (data?.categories || []).find((category) => category.type !== 'income')?.id || '',
    });
    setPage('transactionForm');
  }, [data?.accounts, data?.categories]);

  const openEditTransaction = useCallback((transaction) => {
    setEditingTransactionId(transaction.id);
    setTransactionDraft({
      type: transaction.type,
      amount: String(transaction.amount),
      categoryId: transaction.categoryId,
      accountId: transaction.accountId,
      date: toInputDate(transaction.date),
      note: transaction.note || '',
      receipt: transaction.receipt || '',
    });
    setPage('transactionForm');
  }, []);

  const deleteTransaction = useCallback(
    (transactionId) => {
      if (!window.confirm('Delete this transaction?')) return;
      mutateData((draft) => {
        draft.transactions = draft.transactions.filter((item) => item.id !== transactionId);
        draft.updatedAt = nowIso();
        return draft;
      }, 'Transaction deleted.');
    },
    [mutateData],
  );

  const handleTouchStart = (transactionId, event) => {
    touchStartRef.current = { id: transactionId, x: event.changedTouches[0].clientX };
  };

  const handleTouchEnd = (transactionId, event) => {
    const touch = touchStartRef.current;
    if (touch.id !== transactionId) return;
    const deltaX = event.changedTouches[0].clientX - touch.x;
    if (deltaX < -80) {
      deleteTransaction(transactionId);
    }
    touchStartRef.current = { id: '', x: 0 };
  };

  const dashboardStats = useMemo(() => {
    const monthKey = format(new Date(), 'yyyy-MM');
    const monthTransactions = (data?.transactions || []).filter(
      (transaction) => toMonthKey(transaction.date) === monthKey,
    );
    const income = monthTransactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const expense = monthTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

    const totalBalance = (data?.accounts || []).reduce((sum, account) => sum + toNumber(account.balance), 0);

    const budgetPreview = (data?.budgets || [])
      .filter((budget) => budget.month === monthKey)
      .sort((left, right) => toNumber(right.spent) - toNumber(left.spent))
      .slice(0, 3);

    const savingsPreview = [...(data?.savingsGoals || [])]
      .sort((left, right) => +toSafeDate(left.targetDate) - +toSafeDate(right.targetDate))
      .slice(0, 3);

    return { income, expense, totalBalance, budgetPreview, savingsPreview };
  }, [data?.accounts, data?.budgets, data?.savingsGoals, data?.transactions]);

  const filteredTransactions = useMemo(() => {
    let items = [...sortedTransactions];
    const search = transactionSearch.trim().toLowerCase();

    if (transactionFilters.type !== 'all') {
      items = items.filter((item) => item.type === transactionFilters.type);
    }
    if (transactionFilters.categoryId !== 'all') {
      items = items.filter((item) => item.categoryId === transactionFilters.categoryId);
    }
    if (transactionFilters.accountId !== 'all') {
      items = items.filter((item) => item.accountId === transactionFilters.accountId);
    }
    if (transactionFilters.startDate) {
      const start = startOfDay(toSafeDate(inputDateToIso(transactionFilters.startDate)));
      items = items.filter((item) => toSafeDate(item.date) >= start);
    }
    if (transactionFilters.endDate) {
      const end = addDays(startOfDay(toSafeDate(inputDateToIso(transactionFilters.endDate))), 1);
      items = items.filter((item) => toSafeDate(item.date) < end);
    }
    if (search) {
      items = items.filter((item) => {
        const category = categoriesById.get(item.categoryId)?.name || '';
        const account = accountsById.get(item.accountId)?.name || '';
        return [item.note || '', category, account].join(' ').toLowerCase().includes(search);
      });
    }

    if (transactionFilters.sortBy === 'amount_desc') {
      items.sort((left, right) => toNumber(right.amount) - toNumber(left.amount));
    } else if (transactionFilters.sortBy === 'amount_asc') {
      items.sort((left, right) => toNumber(left.amount) - toNumber(right.amount));
    } else if (transactionFilters.sortBy === 'category') {
      items.sort((left, right) =>
        (categoriesById.get(left.categoryId)?.name || '').localeCompare(categoriesById.get(right.categoryId)?.name || ''),
      );
    } else if (transactionFilters.sortBy === 'date_asc') {
      items.sort((left, right) => +toSafeDate(left.date) - +toSafeDate(right.date));
    } else {
      items.sort((left, right) => +toSafeDate(right.date) - +toSafeDate(left.date));
    }

    return items;
  }, [accountsById, categoriesById, sortedTransactions, transactionFilters, transactionSearch]);

  const groupedCalendarTransactions = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach((transaction) => {
      const key = format(toSafeDate(transaction.date), 'yyyy-MM-dd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(transaction);
    });
    return Object.entries(groups).sort((left, right) => (left[0] > right[0] ? -1 : 1));
  }, [filteredTransactions]);

  const analyticsInterval = useMemo(() => {
    const now = new Date();
    if (analyticsRange === 'week') {
      return { start: subDays(now, 6), end: now };
    }
    if (analyticsRange === 'year') {
      return { start: subDays(now, 364), end: now };
    }
    if (analyticsRange === 'custom') {
      return {
        start: toSafeDate(inputDateToIso(analyticsCustomStart)),
        end: toSafeDate(inputDateToIso(analyticsCustomEnd)),
      };
    }
    return { start: subDays(now, 29), end: now };
  }, [analyticsCustomEnd, analyticsCustomStart, analyticsRange]);

  const analyticsTransactions = useMemo(() => {
    const start = startOfDay(analyticsInterval.start);
    const end = addDays(startOfDay(analyticsInterval.end), 1);
    return (data?.transactions || []).filter((transaction) => {
      const current = toSafeDate(transaction.date);
      return current >= start && current < end;
    });
  }, [analyticsInterval, data?.transactions]);

  const monthlyIncomeExpense = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => subMonths(new Date(), 5 - index));
    return months.map((monthDate) => {
      const monthKey = format(monthDate, 'yyyy-MM');
      const label = format(monthDate, 'MMM');
      const monthTransactions = (data?.transactions || []).filter(
        (transaction) => toMonthKey(transaction.date) === monthKey,
      );
      const income = monthTransactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
      const expense = monthTransactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
      return { month: label, income, expense };
    });
  }, [data?.transactions]);

  const expensePieData = useMemo(() => {
    const expenseMap = new Map();
    analyticsTransactions
      .filter((transaction) => transaction.type === 'expense')
      .forEach((transaction) => {
        const categoryName = categoriesById.get(transaction.categoryId)?.name || 'Other';
        expenseMap.set(categoryName, (expenseMap.get(categoryName) || 0) + toNumber(transaction.amount));
      });
    return [...expenseMap.entries()].map(([name, value]) => ({ name, value }));
  }, [analyticsTransactions, categoriesById]);

  const cashFlowData = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfDay(analyticsInterval.start),
      end: startOfDay(analyticsInterval.end),
    });
    let running = 0;
    return days.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = addDays(dayStart, 1);
      const dayTransactions = analyticsTransactions.filter((transaction) => {
        const current = toSafeDate(transaction.date);
        return current >= dayStart && current < dayEnd;
      });
      dayTransactions.forEach((transaction) => {
        running += transaction.type === 'income' ? toNumber(transaction.amount) : -toNumber(transaction.amount);
      });
      return { date: format(day, 'MMM d'), balance: Number(running.toFixed(2)) };
    });
  }, [analyticsInterval.end, analyticsInterval.start, analyticsTransactions]);

  const topSpendingCategories = useMemo(
    () => [...expensePieData].sort((left, right) => right.value - left.value).slice(0, 5),
    [expensePieData],
  );

  const weeklyHeatmap = useMemo(() => {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const totals = labels.map((label, index) => ({
      label,
      amount: analyticsTransactions
        .filter((transaction) => transaction.type === 'expense' && toSafeDate(transaction.date).getDay() === index)
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0),
    }));
    const max = Math.max(...totals.map((item) => item.amount), 1);
    return totals.map((item) => ({ ...item, intensity: item.amount / max }));
  }, [analyticsTransactions]);

  const monthlyComparison = useMemo(() => {
    const thisMonthKey = format(new Date(), 'yyyy-MM');
    const lastMonthKey = format(subMonths(new Date(), 1), 'yyyy-MM');
    const summarize = (monthKey) => {
      const monthTransactions = (data?.transactions || []).filter((transaction) => toMonthKey(transaction.date) === monthKey);
      const income = monthTransactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
      const expense = monthTransactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
      return { income, expense };
    };
    return {
      thisMonth: summarize(thisMonthKey),
      lastMonth: summarize(lastMonthKey),
    };
  }, [data?.transactions]);

  const savingsGrowthData = useMemo(() => {
    const sortedHistory = [...(data?.goalHistory || [])].sort(
      (left, right) => +toSafeDate(left.date || left.createdAt) - +toSafeDate(right.date || right.createdAt),
    );
    if (!sortedHistory.length) {
      return [
        {
          date: format(new Date(), 'MMM d'),
          total: (data?.savingsGoals || []).reduce((sum, goal) => sum + toNumber(goal.currentAmount), 0),
        },
      ];
    }
    let running = 0;
    return sortedHistory.map((entry) => {
      running += toNumber(entry.amount);
      return {
        date: format(toSafeDate(entry.date || entry.createdAt), 'MMM d'),
        total: Number(running.toFixed(2)),
      };
    });
  }, [data?.goalHistory, data?.savingsGoals]);

  const reportSummary = useMemo(() => {
    const monthTransactions = (data?.transactions || []).filter((transaction) => toMonthKey(transaction.date) === reportMonth);
    const monthIncome = monthTransactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const monthExpense = monthTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const monthNet = monthIncome - monthExpense;

    const yearlyTransactions = (data?.transactions || []).filter(
      (transaction) => format(toSafeDate(transaction.date), 'yyyy') === reportYear,
    );
    const byMonth = Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(Number(reportYear), index, 1);
      const key = format(monthDate, 'yyyy-MM');
      const txs = yearlyTransactions.filter((transaction) => toMonthKey(transaction.date) === key);
      const income = txs
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
      const expense = txs
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
      return { month: format(monthDate, 'MMM'), key, income, expense };
    });

    const highestExpenseMonth = [...byMonth].sort((left, right) => right.expense - left.expense)[0];
    const monthDate = toSafeDate(`${reportMonth}-01T00:00:00`);
    const daysInMonth = endOfMonth(monthDate).getDate();
    const averageDailySpending = daysInMonth > 0 ? monthExpense / daysInMonth : 0;

    return {
      monthIncome,
      monthExpense,
      monthNet,
      byMonth,
      highestExpenseMonth,
      averageDailySpending,
    };
  }, [data?.transactions, reportMonth, reportYear]);

  const transactionCategoriesForDraft = useMemo(
    () =>
      (data?.categories || []).filter(
        (category) => category.type === 'both' || category.type === transactionDraft.type,
      ),
    [data?.categories, transactionDraft.type],
  );

  const setDarkMode = useCallback(
    (enabled) => {
      setSettingsDraft((prev) => ({
        ...(prev || data?.settings || {}),
        darkMode: enabled,
      }));
      mutateData((draft) => {
        draft.settings.darkMode = enabled;
        draft.settings.updatedAt = nowIso();
        return draft;
      });
    },
    [data?.settings, mutateData],
  );

  const handleSaveTransaction = () => {
    const amount = toNumber(transactionDraft.amount);
    const hasSelectedAccount = (data?.accounts || []).some((account) => account.id === transactionDraft.accountId);
    const hasSelectedCategory = (data?.categories || []).some((category) => category.id === transactionDraft.categoryId);
    if (
      !transactionDraft.accountId ||
      !transactionDraft.categoryId ||
      !hasSelectedAccount ||
      !hasSelectedCategory ||
      amount <= 0 ||
      !transactionDraft.date
    ) {
      addToast('error', 'Please fill all required transaction fields.');
      return;
    }

    mutateData((draft) => {
      const timestamp = nowIso();
      const payload = withTimestamps({
        id: editingTransactionId || uid(),
        type: transactionDraft.type,
        amount,
        categoryId: transactionDraft.categoryId,
        accountId: transactionDraft.accountId,
        date: inputDateToIso(transactionDraft.date),
        note: transactionDraft.note.trim(),
        receipt: transactionDraft.receipt || '',
        isRecurring: editingTransactionId
          ? Boolean(draft.transactions.find((item) => item.id === editingTransactionId)?.isRecurring)
          : false,
        recurringId: editingTransactionId
          ? draft.transactions.find((item) => item.id === editingTransactionId)?.recurringId || ''
          : '',
        createdAt:
          draft.transactions.find((item) => item.id === editingTransactionId)?.createdAt || timestamp,
        updatedAt: timestamp,
      });

      if (editingTransactionId) {
        draft.transactions = draft.transactions.map((transaction) =>
          transaction.id === editingTransactionId ? payload : transaction,
        );
      } else {
        draft.transactions.push(payload);
      }

      return draft;
    }, editingTransactionId ? 'Transaction updated.' : 'Transaction saved.');

    setEditingTransactionId('');
    setTransactionDraft({
      ...createTransactionDraft(),
      accountId: data?.accounts?.[0]?.id || '',
      categoryId: (data?.categories || []).find((category) => category.type !== 'income')?.id || '',
    });
    setPage('transactions');
  };

  const handleReceiptUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setTransactionDraft((prev) => ({ ...prev, receipt: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBudget = () => {
    const limit = toNumber(budgetDraft.monthlyLimit);
    if (!budgetDraft.categoryId || limit <= 0 || !budgetDraft.month) {
      addToast('error', 'Please complete the budget form.');
      return;
    }
    const duplicateExists = (data?.budgets || []).some(
      (budget) =>
        budget.id !== editingBudgetId &&
        budget.categoryId === budgetDraft.categoryId &&
        budget.month === budgetDraft.month,
    );
    if (duplicateExists) {
      addToast('error', 'A budget for this category and month already exists.');
      return;
    }

    mutateData((draft) => {
      const timestamp = nowIso();
      const payload = withTimestamps({
        id: editingBudgetId || uid(),
        categoryId: budgetDraft.categoryId,
        monthlyLimit: limit,
        month: budgetDraft.month,
        rollover: budgetDraft.rollover,
        spent: 0,
        createdAt: draft.budgets.find((budget) => budget.id === editingBudgetId)?.createdAt || timestamp,
        updatedAt: timestamp,
      });
      if (editingBudgetId) {
        draft.budgets = draft.budgets.map((budget) => (budget.id === editingBudgetId ? payload : budget));
      } else {
        draft.budgets.push(payload);
      }
      return draft;
    }, editingBudgetId ? 'Budget updated.' : 'Budget created.');

    setBudgetFormOpen(false);
    setEditingBudgetId('');
    setBudgetDraft(createBudgetDraft(budgetMonth));
  };

  const handleDeleteBudget = (budgetId) => {
    if (!window.confirm('Delete this budget?')) return;
    mutateData((draft) => {
      draft.budgets = draft.budgets.filter((budget) => budget.id !== budgetId);
      return draft;
    }, 'Budget deleted.');
  };

  const handleSaveAccount = () => {
    const initialBalance = toNumber(accountDraft.initialBalance);
    if (!accountDraft.name.trim()) {
      addToast('error', 'Account name is required.');
      return;
    }

    mutateData((draft) => {
      const timestamp = nowIso();
      const payload = withTimestamps({
        id: editingAccountId || uid(),
        name: accountDraft.name.trim(),
        icon: accountDraft.icon || '💰',
        color: accountDraft.color || COLORS.primary,
        type: accountDraft.type,
        initialBalance,
        balance: initialBalance,
        createdAt: draft.accounts.find((account) => account.id === editingAccountId)?.createdAt || timestamp,
        updatedAt: timestamp,
      });

      if (editingAccountId) {
        draft.accounts = draft.accounts.map((account) => (account.id === editingAccountId ? payload : account));
      } else {
        draft.accounts.push(payload);
      }
      return draft;
    }, editingAccountId ? 'Account updated.' : 'Account added.');

    setAccountFormOpen(false);
    setEditingAccountId('');
    setAccountDraft(createAccountDraft());
  };

  const handleDeleteAccount = (accountId) => {
    const linkedTransactions = (data?.transactions || []).some((transaction) => transaction.accountId === accountId);
    const linkedTransfers = (data?.transfers || []).some(
      (transfer) => transfer.fromAccountId === accountId || transfer.toAccountId === accountId,
    );
    if (linkedTransactions || linkedTransfers) {
      addToast('error', 'Cannot delete account with linked transactions/transfers.');
      return;
    }
    if (!window.confirm('Delete this account?')) return;
    mutateData((draft) => {
      draft.accounts = draft.accounts.filter((account) => account.id !== accountId);
      return draft;
    }, 'Account deleted.');
  };

  const handleTransfer = () => {
    const amount = toNumber(transferDraft.amount);
    if (!transferDraft.fromAccountId || !transferDraft.toAccountId || amount <= 0 || !transferDraft.date) {
      addToast('error', 'Please fill all transfer fields.');
      return;
    }
    if (transferDraft.fromAccountId === transferDraft.toAccountId) {
      addToast('error', 'Transfer accounts must be different.');
      return;
    }

    mutateData((draft) => {
      draft.transfers.push(
        withTimestamps({
          id: uid(),
          fromAccountId: transferDraft.fromAccountId,
          toAccountId: transferDraft.toAccountId,
          amount,
          date: inputDateToIso(transferDraft.date),
          note: transferDraft.note.trim(),
        }),
      );
      return draft;
    }, 'Transfer completed.');

    setTransferDraft({
      ...createTransferDraft(),
      fromAccountId: data?.accounts?.[0]?.id || '',
      toAccountId: data?.accounts?.[1]?.id || data?.accounts?.[0]?.id || '',
    });
  };

  const handleSaveGoal = () => {
    const targetAmount = toNumber(goalDraft.targetAmount);
    const currentAmount = toNumber(goalDraft.currentAmount);
    if (!goalDraft.name.trim() || targetAmount <= 0 || !goalDraft.targetDate) {
      addToast('error', 'Please complete all goal fields.');
      return;
    }

    mutateData((draft) => {
      const timestamp = nowIso();
      const payload = withTimestamps({
        id: editingGoalId || uid(),
        name: goalDraft.name.trim(),
        icon: goalDraft.icon || '🎯',
        targetAmount,
        currentAmount,
        targetDate: inputDateToIso(goalDraft.targetDate),
        isComplete: currentAmount >= targetAmount,
        createdAt: draft.savingsGoals.find((goal) => goal.id === editingGoalId)?.createdAt || timestamp,
        updatedAt: timestamp,
      });
      if (editingGoalId) {
        draft.savingsGoals = draft.savingsGoals.map((goal) => (goal.id === editingGoalId ? payload : goal));
      } else {
        draft.savingsGoals.push(payload);
      }
      return draft;
    }, editingGoalId ? 'Savings goal updated.' : 'Savings goal added.');

    setGoalFormOpen(false);
    setEditingGoalId('');
    setGoalDraft(createGoalDraft());
  };

  const handleDeleteGoal = (goalId) => {
    if (!window.confirm('Delete this savings goal?')) return;
    mutateData((draft) => {
      draft.savingsGoals = draft.savingsGoals.filter((goal) => goal.id !== goalId);
      draft.goalHistory = draft.goalHistory.filter((entry) => entry.goalId !== goalId);
      return draft;
    }, 'Savings goal deleted.');
  };

  const handleAddGoalMoney = () => {
    const amount = toNumber(goalContribution.amount);
    if (!goalContribution.goalId || amount <= 0) {
      addToast('error', 'Enter a valid contribution amount.');
      return;
    }

    mutateData((draft) => {
      const goal = draft.savingsGoals.find((item) => item.id === goalContribution.goalId);
      if (!goal) return draft;
      goal.currentAmount = Number((toNumber(goal.currentAmount) + amount).toFixed(2));
      goal.isComplete = goal.currentAmount >= toNumber(goal.targetAmount);
      goal.updatedAt = nowIso();
      draft.goalHistory.push(
        withTimestamps({
          id: uid(),
          goalId: goal.id,
          amount,
          date: nowIso(),
          note: 'Manual contribution',
        }),
      );
      return draft;
    }, 'Contribution added to goal.');

    setGoalContribution({ goalId: '', amount: '' });
  };

  const markGoalComplete = (goalId) => {
    mutateData((draft) => {
      const goal = draft.savingsGoals.find((item) => item.id === goalId);
      if (!goal) return draft;
      const target = toNumber(goal.targetAmount);
      const remaining = Math.max(0, target - toNumber(goal.currentAmount));
      goal.currentAmount = target;
      goal.isComplete = true;
      goal.updatedAt = nowIso();
      draft.goalHistory.push(
        withTimestamps({
          id: uid(),
          goalId,
          amount: remaining,
          date: nowIso(),
          note: 'Goal marked complete',
        }),
      );
      return draft;
    }, 'Goal marked complete.');
  };

  const handleSaveRecurring = () => {
    const amount = toNumber(recurringDraft.amount);
    if (!recurringDraft.name.trim() || amount <= 0 || !recurringDraft.categoryId || !recurringDraft.accountId) {
      addToast('error', 'Please complete all recurring transaction fields.');
      return;
    }

    mutateData((draft) => {
      const timestamp = nowIso();
      const payload = withTimestamps({
        id: editingRecurringId || uid(),
        name: recurringDraft.name.trim(),
        amount,
        type: recurringDraft.type,
        categoryId: recurringDraft.categoryId,
        accountId: recurringDraft.accountId,
        frequency: recurringDraft.frequency,
        nextDueDate: inputDateToIso(recurringDraft.nextDueDate),
        isActive: recurringDraft.isActive,
        createdAt:
          draft.recurringTransactions.find((item) => item.id === editingRecurringId)?.createdAt || timestamp,
        updatedAt: timestamp,
      });
      if (editingRecurringId) {
        draft.recurringTransactions = draft.recurringTransactions.map((item) =>
          item.id === editingRecurringId ? payload : item,
        );
      } else {
        draft.recurringTransactions.push(payload);
      }
      return draft;
    }, editingRecurringId ? 'Recurring transaction updated.' : 'Recurring transaction created.');

    setRecurringFormOpen(false);
    setEditingRecurringId('');
    setRecurringDraft({
      ...createRecurringDraft(),
      accountId: data?.accounts?.[0]?.id || '',
      categoryId: (data?.categories || []).find((category) => category.type === 'expense')?.id || '',
    });
  };

  const runRecurringCheck = () => {
    mutateData((draft) => {
      const result = processRecurringTransactions(draft);
      if (result.generatedCount === 0) {
        addToast('success', 'No recurring transactions due right now.');
      } else {
        addToast('success', `${result.generatedCount} recurring transaction(s) logged.`);
      }
      return result.data;
    });
  };

  const exportCsv = () => {
    const csv = buildTransactionsCsv(data?.transactions || [], categoriesById, accountsById);
    triggerDownload(`mymoney-transactions-${format(new Date(), 'yyyyMMdd')}.csv`, csv, 'text/csv;charset=utf-8;');
    addToast('success', 'CSV export downloaded.');
  };

  const printReport = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>MyMoney Report</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>MyMoney Financial Report</h1>
          <p>Month: ${reportMonth}</p>
          <p>Income: ${formatMoney(reportSummary.monthIncome)}</p>
          <p>Expense: ${formatMoney(reportSummary.monthExpense)}</p>
          <p>Net: ${formatMoney(reportSummary.monthNet)}</p>
          <table>
            <thead><tr><th>Month</th><th>Income</th><th>Expense</th></tr></thead>
            <tbody>
              ${reportSummary.byMonth
                .map(
                  (item) =>
                    `<tr><td>${item.month}</td><td>${formatMoney(item.income)}</td><td>${formatMoney(item.expense)}</td></tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const downloadBackup = () => {
    const payload = JSON.stringify(data, null, 2);
    triggerDownload(`mymoney-backup-${format(new Date(), 'yyyyMMdd-HHmm')}.json`, payload, 'application/json');
    addToast('success', 'Backup downloaded.');
  };

  const restoreBackup = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const sanitized = sanitizeData(parsed);
        const recurringResult = processRecurringTransactions(sanitized);
        const processed = recalculateDerivedData(recurringResult.data);
        persist(processed);
        setSettingsDraft(processed.settings);
        setProfileSetup({
          name: processed.settings.profileName || '',
          avatar: processed.settings.avatar || '🙂',
        });
        setLockMode(processed.security?.pinHash ? 'unlock' : 'setup');
        addToast('success', 'Backup restored successfully.');
      } catch {
        addToast('error', 'Invalid backup file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const clearAllData = () => {
    if (!window.confirm('Clear all app data? This cannot be undone.')) return;
    const fresh = recalculateDerivedData(createSeedData());
    persist(fresh);
    setSettingsDraft(fresh.settings);
    setProfileSetup({
      name: '',
      avatar: fresh.settings.avatar || '🙂',
    });
    setLockMode('setup');
    setPage('home');
    addToast('success', 'All data cleared and reset.');
  };

  const saveSettings = () => {
    if (!settingsDraft?.profileName?.trim()) {
      addToast('error', 'Profile name is required.');
      return;
    }
    const currency = CURRENCIES.find((item) => item.code === settingsDraft.currencyCode) || CURRENCIES[0];
    mutateData((draft) => {
      draft.settings = {
        ...draft.settings,
        profileName: settingsDraft.profileName.trim(),
        avatar: settingsDraft.avatar,
        currencyCode: currency.code,
        currencySymbol: currency.symbol,
        decimalPlaces: Number(settingsDraft.decimalPlaces ?? 2),
        darkMode: Boolean(settingsDraft.darkMode),
        updatedAt: nowIso(),
      };
      return draft;
    }, 'Settings saved.');
  };

  const handleSaveCategory = () => {
    const name = categoryDraft.name.trim();
    if (!name) {
      addToast('error', 'Category name is required.');
      return;
    }
    const duplicate = (data?.categories || []).some(
      (category) =>
        category.id !== editingCategoryId &&
        category.name.trim().toLowerCase() === name.toLowerCase() &&
        category.type === categoryDraft.type,
    );
    if (duplicate) {
      addToast('error', 'A category with this name and type already exists.');
      return;
    }

    mutateData((draft) => {
      const timestamp = nowIso();
      const existing = draft.categories.find((category) => category.id === editingCategoryId);
      const payload = withTimestamps({
        id: editingCategoryId || uid(),
        name,
        icon: categoryDraft.icon.trim() || '🏷️',
        color: categoryDraft.color || COLORS.primary,
        type: categoryDraft.type,
        isDefault: existing?.isDefault || false,
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
      });
      if (editingCategoryId) {
        draft.categories = draft.categories.map((category) =>
          category.id === editingCategoryId ? payload : category,
        );
      } else {
        draft.categories.push(payload);
      }
      return draft;
    }, editingCategoryId ? 'Category updated.' : 'Category added.');

    setCategoryFormOpen(false);
    setEditingCategoryId('');
    setCategoryDraft(createCategoryDraft());
  };

  const handleDeleteCategory = (categoryId) => {
    const category = (data?.categories || []).find((item) => item.id === categoryId);
    if (!category) return;
    const linkedTransaction = (data?.transactions || []).some((item) => item.categoryId === categoryId);
    const linkedBudget = (data?.budgets || []).some((item) => item.categoryId === categoryId);
    const linkedRecurring = (data?.recurringTransactions || []).some((item) => item.categoryId === categoryId);
    if (linkedTransaction || linkedBudget || linkedRecurring) {
      addToast('error', 'Cannot delete category with linked records.');
      return;
    }
    if (!window.confirm('Delete this category?')) return;
    mutateData((draft) => {
      draft.categories = draft.categories.filter((item) => item.id !== categoryId);
      return draft;
    }, 'Category deleted.');
  };

  const handleSavePasscode = async () => {
    const newPin = passcodeDraft.newPin.trim();
    const confirmPin = passcodeDraft.confirmPin.trim();
    if (!/^\d{4}$/.test(newPin) || newPin !== confirmPin) {
      addToast('error', 'PIN must be 4 digits and match confirmation.');
      return;
    }
    if (data?.security?.pinHash) {
      const oldHash = await hashPin(passcodeDraft.oldPin.trim());
      if (oldHash !== data.security.pinHash) {
        addToast('error', 'Current PIN is incorrect.');
        return;
      }
    }
    const pinHash = await hashPin(newPin);
    mutateData((draft) => {
      draft.security = {
        ...draft.security,
        pinHash,
        autoLockMinutes: AUTO_LOCK_MINUTES,
        updatedAt: nowIso(),
      };
      return draft;
    }, 'Passcode updated.');
    setPasscodeDraft({ oldPin: '', newPin: '', confirmPin: '' });
  };

  const lockNow = () => {
    if (!data?.security?.pinHash) {
      addToast('error', 'Set a passcode first.');
      return;
    }
    setUnlockPin('');
    setPinError('');
    setLockMode('unlock');
  };

  const handleCompleteProfileSetup = (event) => {
    event.preventDefault();
    const name = profileSetup.name.trim();
    if (!name) {
      setPinError('Please enter your name to continue.');
      return;
    }
    mutateData((draft) => {
      draft.settings.profileName = name;
      draft.settings.avatar = profileSetup.avatar || draft.settings.avatar || '🙂';
      draft.settings.updatedAt = nowIso();
      return draft;
    });
    setSettingsDraft((prev) => ({
      ...(prev || data?.settings || {}),
      profileName: name,
      avatar: profileSetup.avatar || prev?.avatar || data?.settings?.avatar || '🙂',
    }));
    setPinError('');
    setLockMode(null);
    activityRef.current = Date.now();
  };

  const handleSetupPin = async (event) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(setupPin) || setupPin !== setupPinConfirm) {
      setPinError('PIN must be 4 digits and match confirmation.');
      return;
    }
    const pinHash = await hashPin(setupPin);
    mutateData((draft) => {
      draft.security = {
        ...draft.security,
        pinHash,
        autoLockMinutes: AUTO_LOCK_MINUTES,
        updatedAt: nowIso(),
      };
      return draft;
    }, 'Passcode enabled.');
    setSetupPin('');
    setSetupPinConfirm('');
    setPinError('');
    setProfileSetup({
      name: data?.settings?.profileName || '',
      avatar: data?.settings?.avatar || '🙂',
    });
    setLockMode('profile');
    activityRef.current = Date.now();
  };

  const handleUnlock = async (event) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(unlockPin)) {
      setPinError('Enter your 4-digit PIN.');
      return;
    }
    const pinHash = await hashPin(unlockPin);
    if (pinHash === data?.security?.pinHash) {
      setUnlockPin('');
      setPinError('');
      if (String(data?.settings?.profileName || '').trim()) {
        setLockMode(null);
      } else {
        setProfileSetup({
          name: '',
          avatar: data?.settings?.avatar || '🙂',
        });
        setLockMode('profile');
      }
      activityRef.current = Date.now();
    } else {
      setPinError('Incorrect PIN.');
      setUnlockPin('');
    }
  };

  const renderTransactionCard = (transaction) => {
    const category = categoriesById.get(transaction.categoryId);
    const account = accountsById.get(transaction.accountId);
    const amountColor = transaction.type === 'income' ? 'text-emerald-500' : 'text-rose-500';
    const sign = transaction.type === 'income' ? '+' : '-';
    return (
      <div
        key={transaction.id}
        role="button"
        tabIndex={0}
        onClick={() => openEditTransaction(transaction)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openEditTransaction(transaction);
          }
        }}
        onTouchStart={(event) => handleTouchStart(transaction.id, event)}
        onTouchEnd={(event) => handleTouchEnd(transaction.id, event)}
        className="flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
          style={{ backgroundColor: `${category?.color || COLORS.primary}20` }}
        >
          {category?.icon || '💸'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{transaction.note || category?.name || 'Transaction'}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {category?.name || 'Category'} • {account?.name || 'Account'} • {format(toSafeDate(transaction.date), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-base font-bold ${amountColor}`}>
            {sign}
            {formatMoney(transaction.amount)}
          </p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              deleteTransaction(transaction.id);
            }}
            className="mt-1 inline-flex min-h-[28px] items-center gap-1 text-xs text-slate-500 hover:text-rose-500"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-500 p-6 text-white shadow-lg">
        <p className="text-sm opacity-80">Total Balance</p>
        <p className="mt-1 text-3xl font-bold">{formatMoney(dashboardStats.totalBalance)}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/10 p-3">
            <p className="opacity-80">Income (Month)</p>
            <p className="mt-1 text-lg font-semibold text-emerald-200">{formatMoney(dashboardStats.income)}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="opacity-80">Expense (Month)</p>
            <p className="mt-1 text-lg font-semibold text-rose-200">{formatMoney(dashboardStats.expense)}</p>
          </div>
        </div>
      </div>

      {!(data?.accounts || []).length && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
          <p className="font-semibold text-indigo-700 dark:text-indigo-300">Welcome! Start your setup</p>
          <p className="mt-1 text-sm text-indigo-700/80 dark:text-indigo-300/80">
            Add your first account and custom categories before logging transactions.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPage('accounts')}
              className="min-h-[42px] rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Add Account
            </button>
            <button
              type="button"
              onClick={() => {
                setPage('settings');
                setCategoryFormOpen(true);
                setEditingCategoryId('');
                setCategoryDraft(createCategoryDraft());
              }}
              className="min-h-[42px] rounded-xl border border-indigo-300 bg-white px-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
            >
              Add Category
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Recent Transactions</h3>
            <button
              type="button"
              onClick={() => setPage('transactions')}
              className="min-h-[34px] rounded-xl px-3 text-sm text-indigo-600 transition hover:bg-indigo-50 dark:hover:bg-slate-800"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {sortedTransactions.slice(0, 5).map((transaction) => {
              const category = categoriesById.get(transaction.categoryId);
              return (
                <div key={transaction.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{category?.icon || '💸'}</span>
                    <div>
                      <p className="text-sm font-medium">{transaction.note || category?.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{format(toSafeDate(transaction.date), 'MMM d')}</p>
                    </div>
                  </div>
                  <p className={transaction.type === 'income' ? 'font-semibold text-emerald-500' : 'font-semibold text-rose-500'}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatMoney(transaction.amount)}
                  </p>
                </div>
              );
            })}
            {!sortedTransactions.length && (
              <EmptyState title="No transactions yet" description="Add your first transaction to start tracking money." />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold">Budget Overview</h3>
            <div className="space-y-3">
              {dashboardStats.budgetPreview.map((budget) => {
                const category = categoriesById.get(budget.categoryId);
                const ratio = budget.monthlyLimit > 0 ? budget.spent / budget.monthlyLimit : 0;
                const color = ratio < 0.7 ? COLORS.success : ratio < 0.9 ? '#F59E0B' : COLORS.danger;
                return (
                  <div key={budget.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {category?.icon} {category?.name}
                      </span>
                      <span>{formatMoney(budget.spent)} / {formatMoney(budget.monthlyLimit)}</span>
                    </div>
                    <ProgressBar value={budget.spent} max={budget.monthlyLimit} color={color} />
                  </div>
                );
              })}
              {!dashboardStats.budgetPreview.length && (
                <EmptyState title="No budgets set" description="Create budgets to monitor category spending." />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold">Savings Goals</h3>
            <div className="space-y-3">
              {dashboardStats.savingsPreview.map((goal) => {
                const progress = goal.targetAmount ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                return (
                  <div key={goal.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {goal.icon} {goal.name}
                      </span>
                      <span>{Math.min(100, progress).toFixed(0)}%</span>
                    </div>
                    <ProgressBar value={goal.currentAmount} max={goal.targetAmount} color={COLORS.primary} />
                  </div>
                );
              })}
              {!dashboardStats.savingsPreview.length && (
                <EmptyState title="No goals yet" description="Add a goal to start your savings journey." />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input
              value={transactionSearch}
              onChange={(event) => setTransactionSearch(event.target.value)}
              placeholder="Search by note, category, account..."
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            />
          </div>

          <select
            value={transactionFilters.type}
            onChange={(event) => setTransactionFilters((prev) => ({ ...prev, type: event.target.value }))}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <select
            value={transactionFilters.categoryId}
            onChange={(event) => setTransactionFilters((prev) => ({ ...prev, categoryId: event.target.value }))}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="all">All categories</option>
            {(data?.categories || []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>

          <select
            value={transactionFilters.accountId}
            onChange={(event) => setTransactionFilters((prev) => ({ ...prev, accountId: event.target.value }))}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
          >
            <option value="all">All accounts</option>
            {(data?.accounts || []).map((account) => (
              <option key={account.id} value={account.id}>
                {account.icon} {account.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <input
              type="date"
              value={transactionFilters.startDate}
              onChange={(event) => setTransactionFilters((prev) => ({ ...prev, startDate: event.target.value }))}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="date"
              value={transactionFilters.endDate}
              onChange={(event) => setTransactionFilters((prev) => ({ ...prev, endDate: event.target.value }))}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={transactionFilters.sortBy}
              onChange={(event) => setTransactionFilters((prev) => ({ ...prev, sortBy: event.target.value }))}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="date_desc">Newest date</option>
              <option value="date_asc">Oldest date</option>
              <option value="amount_desc">Highest amount</option>
              <option value="amount_asc">Lowest amount</option>
              <option value="category">Category</option>
            </select>
            <button
              type="button"
              onClick={() => setCalendarView((prev) => !prev)}
              className={`inline-flex min-h-[44px] items-center justify-center rounded-xl px-3 text-sm transition ${
                calendarView
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
              title="Calendar view toggle"
            >
              <Calendar size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setRefreshingTransactions(true);
                setTimeout(() => {
                  setRefreshingTransactions(false);
                  addToast('success', 'Refreshed.');
                }, 900);
              }}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
              title="Pull to refresh simulation"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">Tip: swipe left on a transaction card to delete.</p>

      {refreshingTransactions ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : calendarView ? (
        <div className="space-y-4">
          {groupedCalendarTransactions.map(([dateKey, items]) => (
            <div key={dateKey} className="space-y-2">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{format(toSafeDate(dateKey), 'EEEE, MMM d')}</p>
              <div className="space-y-2">{items.map((transaction) => renderTransactionCard(transaction))}</div>
            </div>
          ))}
          {!groupedCalendarTransactions.length && (
            <EmptyState title="No matching transactions" description="Try adjusting filters or adding a new record." />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTransactions.map((transaction) => renderTransactionCard(transaction))}
          {!filteredTransactions.length && (
            <EmptyState title="No matching transactions" description="Try adjusting filters or adding a new record." />
          )}
        </div>
      )}
    </div>
  );

  const renderTransactionForm = () => (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTransactionDraft((prev) => ({ ...prev, type: 'expense' }))}
            className={`min-h-[44px] flex-1 rounded-lg text-sm font-medium transition ${
              transactionDraft.type === 'expense' ? 'bg-rose-500 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setTransactionDraft((prev) => ({ ...prev, type: 'income' }))}
            className={`min-h-[44px] flex-1 rounded-lg text-sm font-medium transition ${
              transactionDraft.type === 'income' ? 'bg-emerald-500 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Income
          </button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={transactionDraft.amount}
            onChange={(event) => setTransactionDraft((prev) => ({ ...prev, amount: event.target.value }))}
            placeholder="0.00"
            className="min-h-[56px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-2xl font-semibold outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Category</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {transactionCategoriesForDraft.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setTransactionDraft((prev) => ({ ...prev, categoryId: category.id }))}
                className={`min-h-[64px] rounded-xl border p-2 text-center transition ${
                  transactionDraft.categoryId === category.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                <div className="text-xl">{category.icon}</div>
                <div className="mt-1 truncate text-xs">{category.name}</div>
              </button>
            ))}
          </div>
          {!transactionCategoriesForDraft.length && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              No categories available for this type. Add one from Settings → Category Manager.
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Account</label>
            <select
              value={transactionDraft.accountId}
              onChange={(event) => setTransactionDraft((prev) => ({ ...prev, accountId: event.target.value }))}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">Select account</option>
              {(data?.accounts || []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.icon} {account.name}
                </option>
              ))}
            </select>
            {!(data?.accounts || []).length && (
              <button
                type="button"
                onClick={() => setPage('accounts')}
                className="mt-2 text-sm font-medium text-indigo-600 underline decoration-dotted"
              >
                No accounts yet. Add your first account.
              </button>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Date</label>
            <input
              type="date"
              value={transactionDraft.date}
              onChange={(event) => setTransactionDraft((prev) => ({ ...prev, date: event.target.value }))}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Note / Description</label>
          <textarea
            value={transactionDraft.note}
            onChange={(event) => setTransactionDraft((prev) => ({ ...prev, note: event.target.value }))}
            rows={3}
            placeholder="Optional note..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Receipt Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleReceiptUpload}
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
          />
          {transactionDraft.receipt && (
            <img
              src={transactionDraft.receipt}
              alt="Receipt preview"
              className="mt-2 max-h-40 rounded-xl border border-slate-200 object-contain dark:border-slate-700"
            />
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleSaveTransaction}
            className="min-h-[46px] rounded-xl bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.99]"
          >
            {editingTransactionId ? 'Update Transaction' : 'Save Transaction'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingTransactionId('');
              setPage('transactions');
            }}
            className="min-h-[46px] rounded-xl border border-slate-300 px-4 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const renderBudget = () => {
    const budgetsThisMonth = (data?.budgets || []).filter((budget) => budget.month === budgetMonth);
    const totalLimit = budgetsThisMonth.reduce((sum, budget) => sum + toNumber(budget.monthlyLimit), 0);
    const totalSpent = budgetsThisMonth.reduce((sum, budget) => sum + toNumber(budget.spent), 0);
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Monthly Budget Overview</p>
              <p className="text-2xl font-bold">
                {formatMoney(totalSpent)} / {formatMoney(totalLimit)}
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="month"
                value={budgetMonth}
                onChange={(event) => {
                  setBudgetMonth(event.target.value);
                  setBudgetDraft((prev) => ({ ...prev, month: event.target.value }));
                }}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => {
                  setBudgetFormOpen(true);
                  setEditingBudgetId('');
                  setBudgetDraft({
                    ...createBudgetDraft(budgetMonth),
                    categoryId: expenseCategories[0]?.id || '',
                  });
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                <Plus size={16} />
                Add Budget
              </button>
            </div>
          </div>
        </div>

        {budgetFormOpen && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="grid gap-3 md:grid-cols-4">
              <select
                value={budgetDraft.categoryId}
                onChange={(event) => setBudgetDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="">Select category</option>
                {expenseCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={budgetDraft.monthlyLimit}
                onChange={(event) => setBudgetDraft((prev) => ({ ...prev, monthlyLimit: event.target.value }))}
                placeholder="Limit"
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
              />
              <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800">
                <input
                  type="checkbox"
                  checked={budgetDraft.rollover}
                  onChange={(event) => setBudgetDraft((prev) => ({ ...prev, rollover: event.target.checked }))}
                />
                Rollover
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveBudget}
                  className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetFormOpen(false)}
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {budgetsThisMonth.map((budget) => {
            const category = categoriesById.get(budget.categoryId);
            const ratio = budget.monthlyLimit > 0 ? budget.spent / budget.monthlyLimit : 0;
            const color = ratio < 0.7 ? COLORS.success : ratio < 0.9 ? '#F59E0B' : COLORS.danger;
            return (
              <div key={budget.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">
                    {category?.icon} {category?.name}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setBudgetFormOpen(true);
                        setEditingBudgetId(budget.id);
                        setBudgetDraft({
                          categoryId: budget.categoryId,
                          monthlyLimit: String(budget.monthlyLimit),
                          month: budget.month,
                          rollover: Boolean(budget.rollover),
                        });
                      }}
                      className="inline-flex min-h-[32px] items-center rounded-lg px-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBudget(budget.id)}
                      className="inline-flex min-h-[32px] items-center rounded-lg px-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatMoney(budget.spent)} spent of {formatMoney(budget.monthlyLimit)}
                </p>
                <div className="mt-3">
                  <ProgressBar value={budget.spent} max={budget.monthlyLimit} color={color} />
                </div>
                <p className="mt-2 text-sm font-medium">
                  Remaining: {formatMoney(Math.max(0, toNumber(budget.monthlyLimit) - toNumber(budget.spent)))}
                </p>
              </div>
            );
          })}
        </div>

        {!budgetsThisMonth.length && (
          <EmptyState title="No budgets this month" description="Create a budget to track category spend limits." />
        )}
      </div>
    );
  };

  const renderAccounts = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Accounts</h3>
          <button
            type="button"
            onClick={() => {
              setAccountFormOpen(true);
              setEditingAccountId('');
              setAccountDraft(createAccountDraft());
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            <Plus size={16} />
            Add Account
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(data?.accounts || []).map((account) => (
            <div key={account.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                    style={{ backgroundColor: `${account.color}22` }}
                  >
                    {account.icon}
                  </span>
                  <div>
                    <p className="font-semibold">{account.name}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{account.type}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountFormOpen(true);
                      setEditingAccountId(account.id);
                      setAccountDraft({
                        name: account.name,
                        icon: account.icon,
                        color: account.color,
                        type: account.type,
                        initialBalance: String(account.initialBalance),
                      });
                    }}
                    className="inline-flex min-h-[32px] items-center rounded-lg px-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(account.id)}
                    className="inline-flex min-h-[32px] items-center rounded-lg px-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xl font-bold">{formatMoney(account.balance)}</p>
            </div>
          ))}
        </div>
      </div>

      {accountFormOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold">{editingAccountId ? 'Edit Account' : 'Add Account'}</h3>
          <div className="grid gap-3 md:grid-cols-5">
            <input
              value={accountDraft.name}
              onChange={(event) => setAccountDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Account name"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              value={accountDraft.icon}
              onChange={(event) => setAccountDraft((prev) => ({ ...prev, icon: event.target.value }))}
              placeholder="Emoji icon"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="color"
              value={accountDraft.color}
              onChange={(event) => setAccountDraft((prev) => ({ ...prev, color: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-2 dark:border-slate-600 dark:bg-slate-800"
            />
            <select
              value={accountDraft.type}
              onChange={(event) => setAccountDraft((prev) => ({ ...prev, type: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={accountDraft.initialBalance}
              onChange={(event) => setAccountDraft((prev) => ({ ...prev, initialBalance: event.target.value }))}
              placeholder="Initial balance"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSaveAccount}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setAccountFormOpen(false)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <ArrowLeftRight size={16} /> Transfer Between Accounts
        </h3>
        {(data?.accounts || []).length < 2 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Add at least 2 accounts to enable transfers.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-5">
            <select
              value={transferDraft.fromAccountId}
              onChange={(event) => setTransferDraft((prev) => ({ ...prev, fromAccountId: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">From account</option>
              {(data?.accounts || []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.icon} {account.name}
                </option>
              ))}
            </select>
            <select
              value={transferDraft.toAccountId}
              onChange={(event) => setTransferDraft((prev) => ({ ...prev, toAccountId: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">To account</option>
              {(data?.accounts || []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.icon} {account.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={transferDraft.amount}
              onChange={(event) => setTransferDraft((prev) => ({ ...prev, amount: event.target.value }))}
              placeholder="Amount"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="date"
              value={transferDraft.date}
              onChange={(event) => setTransferDraft((prev) => ({ ...prev, date: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={handleTransfer}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Transfer
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          {['week', 'month', 'year', 'custom'].map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setAnalyticsRange(range)}
              className={`min-h-[40px] rounded-xl px-3 text-sm font-medium transition ${
                analyticsRange === range
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : range === 'year' ? 'This Year' : 'Custom'}
            </button>
          ))}
          {analyticsRange === 'custom' && (
            <div className="flex gap-2">
              <input
                type="date"
                value={analyticsCustomStart}
                onChange={(event) => setAnalyticsCustomStart(event.target.value)}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <input
                type="date"
                value={analyticsCustomEnd}
                onChange={(event) => setAnalyticsCustomEnd(event.target.value)}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-2 font-semibold">Income vs Expense (Monthly)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyIncomeExpense}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Legend />
                <Bar dataKey="income" fill={COLORS.success} radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" fill={COLORS.danger} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-2 font-semibold">Expense Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label>
                  {expensePieData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={DEFAULT_CATEGORY_SEEDS[index % DEFAULT_CATEGORY_SEEDS.length].color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-2 font-semibold">Cash Flow</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Line type="monotone" dataKey="balance" stroke={COLORS.primary} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-2 font-semibold">Savings Growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={savingsGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Area type="monotone" dataKey="total" stroke={COLORS.primary} fill={`${COLORS.primary}44`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold">Top Spending Categories</h3>
          <div className="space-y-2">
            {topSpendingCategories.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
                <span>
                  #{index + 1} {item.name}
                </span>
                <span className="font-semibold text-rose-500">{formatMoney(item.value)}</span>
              </div>
            ))}
            {!topSpendingCategories.length && <p className="text-sm text-slate-500">No expense data in selected period.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold">Day-of-Week Spending Heatmap</h3>
          <div className="grid grid-cols-7 gap-2">
            {weeklyHeatmap.map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-3 text-center text-xs font-medium"
                style={{ backgroundColor: `rgba(244,63,94,${Math.max(0.1, item.intensity)})`, color: item.intensity > 0.55 ? '#fff' : '#111827' }}
              >
                <p>{item.label}</p>
                <p>{formatMoney(item.amount)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
            <p className="font-semibold">Monthly Comparison</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              This month: {formatMoney(monthlyComparison.thisMonth.income)} income / {formatMoney(monthlyComparison.thisMonth.expense)} expense
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Last month: {formatMoney(monthlyComparison.lastMonth.income)} income / {formatMoney(monthlyComparison.lastMonth.expense)} expense
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGoals = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Savings Goals</h3>
          <button
            type="button"
            onClick={() => {
              setGoalFormOpen(true);
              setEditingGoalId('');
              setGoalDraft(createGoalDraft());
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            <Plus size={16} />
            Add Goal
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {(data?.savingsGoals || []).map((goal) => {
            const progress = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
            const daysLeft = differenceInDays(toSafeDate(goal.targetDate), new Date());
            return (
              <div key={goal.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-start justify-between">
                  <p className="font-semibold">
                    {goal.icon} {goal.name}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setGoalFormOpen(true);
                        setEditingGoalId(goal.id);
                        setGoalDraft({
                          name: goal.name,
                          icon: goal.icon,
                          targetAmount: String(goal.targetAmount),
                          currentAmount: String(goal.currentAmount),
                          targetDate: toInputDate(goal.targetDate),
                        });
                      }}
                      className="inline-flex min-h-[30px] items-center rounded-lg px-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="inline-flex min-h-[30px] items-center rounded-lg px-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {formatMoney(goal.currentAmount)} of {formatMoney(goal.targetAmount)}
                </p>
                <div className="mt-2">
                  <ProgressBar value={goal.currentAmount} max={goal.targetAmount} color={goal.isComplete ? COLORS.success : COLORS.primary} />
                </div>
                <p className="mt-2 text-sm font-medium">
                  {progress.toFixed(0)}% • Target {format(toSafeDate(goal.targetDate), 'MMM d, yyyy')} (
                  {daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days overdue`})
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGoalContribution({ goalId: goal.id, amount: '' })}
                    className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    Add Money
                  </button>
                  {!goal.isComplete && (
                    <button
                      type="button"
                      onClick={() => markGoalComplete(goal.id)}
                      className="min-h-[38px] rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white transition hover:bg-emerald-500"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!(data?.savingsGoals || []).length && (
          <EmptyState title="No savings goals yet" description="Create goals to track progress and stay motivated." />
        )}
      </div>

      {goalContribution.goalId && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-2 font-semibold">Add Money to Goal</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={goalContribution.amount}
              onChange={(event) => setGoalContribution((prev) => ({ ...prev, amount: event.target.value }))}
              placeholder="Contribution amount"
              className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 dark:border-slate-600 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={handleAddGoalMoney}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {goalFormOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold">{editingGoalId ? 'Edit Goal' : 'Add Goal'}</h3>
          <div className="grid gap-3 md:grid-cols-5">
            <input
              value={goalDraft.name}
              onChange={(event) => setGoalDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Goal name"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              value={goalDraft.icon}
              onChange={(event) => setGoalDraft((prev) => ({ ...prev, icon: event.target.value }))}
              placeholder="Emoji icon"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="number"
              value={goalDraft.targetAmount}
              onChange={(event) => setGoalDraft((prev) => ({ ...prev, targetAmount: event.target.value }))}
              placeholder="Target amount"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="number"
              value={goalDraft.currentAmount}
              onChange={(event) => setGoalDraft((prev) => ({ ...prev, currentAmount: event.target.value }))}
              placeholder="Current amount"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="date"
              value={goalDraft.targetDate}
              onChange={(event) => setGoalDraft((prev) => ({ ...prev, targetDate: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSaveGoal}
              className="min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Save Goal
            </button>
            <button
              type="button"
              onClick={() => setGoalFormOpen(false)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 font-semibold">Goal History</h3>
        <div className="space-y-2">
          {[...(data?.goalHistory || [])]
            .sort((left, right) => +toSafeDate(right.date || right.createdAt) - +toSafeDate(left.date || left.createdAt))
            .slice(0, 10)
            .map((entry) => {
              const goal = (data?.savingsGoals || []).find((item) => item.id === entry.goalId);
              return (
                <div key={entry.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70">
                  <span>{goal?.name || 'Goal'} • {entry.note || 'Contribution'}</span>
                  <span className="font-semibold text-emerald-500">+{formatMoney(entry.amount)}</span>
                </div>
              );
            })}
          {!(data?.goalHistory || []).length && <p className="text-sm text-slate-500">No history yet.</p>}
        </div>
      </div>
    </div>
  );

  const renderRecurring = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Recurring Transactions</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runRecurringCheck}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <RefreshCw size={16} />
              Run Due Check
            </button>
            <button
              type="button"
              onClick={() => {
                setRecurringFormOpen(true);
                setEditingRecurringId('');
                setRecurringDraft({
                  ...createRecurringDraft(),
                  accountId: data?.accounts?.[0]?.id || '',
                  categoryId: expenseCategories[0]?.id || '',
                });
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {(data?.recurringTransactions || []).map((recurring) => {
            const category = categoriesById.get(recurring.categoryId);
            const account = accountsById.get(recurring.accountId);
            return (
              <div key={recurring.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{recurring.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {category?.icon} {category?.name} • {account?.name} • {recurring.frequency} • Next:{' '}
                      {format(toSafeDate(recurring.nextDueDate), 'MMM d, yyyy')}
                    </p>
                    <p className={recurring.type === 'income' ? 'font-semibold text-emerald-500' : 'font-semibold text-rose-500'}>
                      {recurring.type === 'income' ? '+' : '-'}
                      {formatMoney(recurring.amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={Boolean(recurring.isActive)}
                        onChange={(event) =>
                          mutateData((draft) => {
                            draft.recurringTransactions = draft.recurringTransactions.map((item) =>
                              item.id === recurring.id ? withTimestamps({ ...item, isActive: event.target.checked }) : item,
                            );
                            return draft;
                          }, 'Recurring status updated.')
                        }
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setRecurringFormOpen(true);
                        setEditingRecurringId(recurring.id);
                        setRecurringDraft({
                          name: recurring.name,
                          amount: String(recurring.amount),
                          type: recurring.type,
                          categoryId: recurring.categoryId,
                          accountId: recurring.accountId,
                          frequency: recurring.frequency,
                          nextDueDate: toInputDate(recurring.nextDueDate),
                          isActive: recurring.isActive,
                        });
                      }}
                      className="inline-flex min-h-[36px] items-center rounded-lg px-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm('Delete this recurring transaction?')) return;
                        mutateData((draft) => {
                          draft.recurringTransactions = draft.recurringTransactions.filter((item) => item.id !== recurring.id);
                          return draft;
                        }, 'Recurring transaction deleted.');
                      }}
                      className="inline-flex min-h-[36px] items-center rounded-lg px-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!(data?.recurringTransactions || []).length && (
            <EmptyState title="No recurring items" description="Add recurring transactions to automate regular entries." />
          )}
        </div>
      </div>

      {recurringFormOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold">{editingRecurringId ? 'Edit Recurring' : 'Add Recurring'}</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={recurringDraft.name}
              onChange={(event) => setRecurringDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Name"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <input
              type="number"
              value={recurringDraft.amount}
              onChange={(event) => setRecurringDraft((prev) => ({ ...prev, amount: event.target.value }))}
              placeholder="Amount"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <select
              value={recurringDraft.type}
              onChange={(event) => setRecurringDraft((prev) => ({ ...prev, type: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select
              value={recurringDraft.frequency}
              onChange={(event) => setRecurringDraft((prev) => ({ ...prev, frequency: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {RECURRENCE_TYPES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {frequency}
                </option>
              ))}
            </select>
            <select
              value={recurringDraft.categoryId}
              onChange={(event) => setRecurringDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">Category</option>
              {(data?.categories || [])
                .filter((category) => category.type === recurringDraft.type || category.type === 'both')
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
            </select>
            <select
              value={recurringDraft.accountId}
              onChange={(event) => setRecurringDraft((prev) => ({ ...prev, accountId: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">Account</option>
              {(data?.accounts || []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.icon} {account.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={recurringDraft.nextDueDate}
              onChange={(event) => setRecurringDraft((prev) => ({ ...prev, nextDueDate: event.target.value }))}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
            <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800">
              <input
                type="checkbox"
                checked={recurringDraft.isActive}
                onChange={(event) => setRecurringDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Active
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveRecurring}
                className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setRecurringFormOpen(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderReports = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            type="month"
            value={reportMonth}
            onChange={(event) => setReportMonth(event.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <input
            type="number"
            value={reportYear}
            onChange={(event) => setReportYear(event.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            min="2000"
            max="2100"
          />
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={printReport}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            <FileText size={16} />
            Printable View
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Monthly Income</p>
          <p className="text-2xl font-bold text-emerald-500">{formatMoney(reportSummary.monthIncome)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Monthly Expense</p>
          <p className="text-2xl font-bold text-rose-500">{formatMoney(reportSummary.monthExpense)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Net Result</p>
          <p className={`text-2xl font-bold ${reportSummary.monthNet >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {formatMoney(reportSummary.monthNet)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 font-semibold">Yearly Overview</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2">Month</th>
                <th className="pb-2">Income</th>
                <th className="pb-2">Expense</th>
              </tr>
            </thead>
            <tbody>
              {reportSummary.byMonth.map((item) => (
                <tr key={item.key} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="py-2">{item.month}</td>
                  <td className="py-2 text-emerald-500">{formatMoney(item.income)}</td>
                  <td className="py-2 text-rose-500">{formatMoney(item.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Highest Expense Month</p>
          <p className="text-lg font-semibold">
            {reportSummary.highestExpenseMonth?.month || '-'} ({formatMoney(reportSummary.highestExpenseMonth?.expense || 0)})
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Average Daily Spending</p>
          <p className="text-lg font-semibold">{formatMoney(reportSummary.averageDailySpending)}</p>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 font-semibold">Profile & Preferences</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={settingsDraft?.profileName || ''}
            onChange={(event) => setSettingsDraft((prev) => ({ ...prev, profileName: event.target.value }))}
            placeholder="Profile name"
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <select
            value={settingsDraft?.currencyCode || 'INR'}
            onChange={(event) => {
              const chosen = CURRENCIES.find((currency) => currency.code === event.target.value) || CURRENCIES[0];
              setSettingsDraft((prev) => ({
                ...prev,
                currencyCode: chosen.code,
                currencySymbol: chosen.symbol,
              }));
            }}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.symbol} {currency.name}
              </option>
            ))}
          </select>
          <select
            value={settingsDraft?.decimalPlaces ?? 2}
            onChange={(event) => setSettingsDraft((prev) => ({ ...prev, decimalPlaces: Number(event.target.value) }))}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            <option value={0}>0 decimal places</option>
            <option value={2}>2 decimal places</option>
          </select>
          <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800">
            <input
              type="checkbox"
              checked={Boolean(settingsDraft?.darkMode)}
              onChange={(event) => setDarkMode(event.target.checked)}
            />
            Dark mode
          </label>
        </div>
        <div className="mt-3">
          <p className="mb-2 text-sm text-slate-500">Avatar</p>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((avatar) => (
              <button
                key={avatar}
                type="button"
                onClick={() => setSettingsDraft((prev) => ({ ...prev, avatar }))}
                className={`min-h-[44px] min-w-[44px] rounded-xl border text-xl transition ${
                  settingsDraft?.avatar === avatar
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                    : 'border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800'
                }`}
              >
                {avatar}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={saveSettings}
          className="mt-4 min-h-[44px] rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Save Settings
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Category Manager</h3>
          <button
            type="button"
            onClick={() => {
              setCategoryFormOpen(true);
              setEditingCategoryId('');
              setCategoryDraft(createCategoryDraft());
            }}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            <Plus size={15} />
            Add Category
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {(data?.categories || []).map((category) => (
            <div key={category.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: `${category.color}22` }}
                >
                  {category.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{category.name}</p>
                  <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
                    {category.type} {category.isDefault ? '• default' : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFormOpen(true);
                    setEditingCategoryId(category.id);
                    setCategoryDraft({
                      name: category.name,
                      icon: category.icon,
                      color: category.color,
                      type: category.type,
                    });
                  }}
                  className="inline-flex min-h-[32px] items-center rounded-lg px-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(category.id)}
                  className="inline-flex min-h-[32px] items-center rounded-lg px-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {categoryFormOpen && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
            <div className="grid gap-2 md:grid-cols-5">
              <input
                value={categoryDraft.name}
                onChange={(event) => setCategoryDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Category name"
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              <input
                value={categoryDraft.icon}
                onChange={(event) => setCategoryDraft((prev) => ({ ...prev, icon: event.target.value }))}
                placeholder="Emoji icon"
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              <input
                type="color"
                value={categoryDraft.color}
                onChange={(event) => setCategoryDraft((prev) => ({ ...prev, color: event.target.value }))}
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-2 dark:border-slate-600 dark:bg-slate-900"
              />
              <select
                value={categoryDraft.type}
                onChange={(event) => setCategoryDraft((prev) => ({ ...prev, type: event.target.value }))}
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="both">Both</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  className="min-h-[42px] flex-1 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFormOpen(false);
                    setEditingCategoryId('');
                    setCategoryDraft(createCategoryDraft());
                  }}
                  className="min-h-[42px] flex-1 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <ShieldCheck size={16} /> Security
        </h3>
        <div className="grid gap-3 md:grid-cols-4">
          {data?.security?.pinHash && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={passcodeDraft.oldPin}
              onChange={(event) => setPasscodeDraft((prev) => ({ ...prev, oldPin: event.target.value }))}
              placeholder="Current PIN"
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          )}
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={passcodeDraft.newPin}
            onChange={(event) => setPasscodeDraft((prev) => ({ ...prev, newPin: event.target.value }))}
            placeholder="New 4-digit PIN"
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={passcodeDraft.confirmPin}
            onChange={(event) => setPasscodeDraft((prev) => ({ ...prev, confirmPin: event.target.value }))}
            placeholder="Confirm PIN"
            className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSavePasscode}
              className="min-h-[44px] flex-1 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Save PIN
            </button>
            <button
              type="button"
              onClick={lockNow}
              className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Lock Now
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Auto-lock is enabled after 5 minutes of inactivity.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 font-semibold">Data Management</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={downloadBackup}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <Download size={16} />
            Backup JSON
          </button>
          <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700">
            <Upload size={16} />
            Restore JSON
            <input type="file" accept="application/json" onChange={restoreBackup} className="hidden" />
          </label>
          <button
            type="button"
            onClick={clearAllData}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-rose-500 px-3 text-sm font-semibold text-white transition hover:bg-rose-400"
          >
            <Trash2 size={16} />
            Clear All Data
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        App Version: {APP_VERSION}
      </div>
    </div>
  );

  const renderMore = () => (
    <div className="grid gap-3 sm:grid-cols-2">
      {MOBILE_MORE_LINKS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setPage(item.key)}
            className="flex min-h-[84px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
          >
            <span className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950">
              <Icon size={18} />
            </span>
            <span className="font-semibold">{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderContent = () => {
    if (page === 'transactions') return renderTransactions();
    if (page === 'transactionForm') return renderTransactionForm();
    if (page === 'budget') return renderBudget();
    if (page === 'accounts') return renderAccounts();
    if (page === 'analytics') return renderAnalytics();
    if (page === 'goals') return renderGoals();
    if (page === 'recurring') return renderRecurring();
    if (page === 'reports') return renderReports();
    if (page === 'settings') return renderSettings();
    if (page === 'more') return renderMore();
    return renderDashboard();
  };

  if (loading || !data) {
    return (
      <div
        className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
        style={{ fontFamily: 'Inter, Poppins, system-ui, sans-serif' }}
      >
        <div className="mx-auto max-w-6xl space-y-3 pt-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (lockMode) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-500 p-5"
        style={{ fontFamily: 'Inter, Poppins, system-ui, sans-serif' }}
      >
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950">
              <Lock size={26} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">MyMoney</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {lockMode === 'setup'
                ? 'Create your secure 4-digit PIN'
                : lockMode === 'unlock'
                  ? 'Unlock with your 4-digit PIN'
                  : 'Great! Now add your profile name'}
            </p>
          </div>

          <form
            onSubmit={
              lockMode === 'setup'
                ? handleSetupPin
                : lockMode === 'unlock'
                  ? handleUnlock
                  : handleCompleteProfileSetup
            }
            className="space-y-3"
          >
            {lockMode === 'setup' ? (
              <>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={setupPin}
                  onChange={(event) => setSetupPin(event.target.value)}
                  placeholder="Create PIN"
                  className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xl tracking-[0.5em] dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={setupPinConfirm}
                  onChange={(event) => setSetupPinConfirm(event.target.value)}
                  placeholder="Confirm PIN"
                  className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xl tracking-[0.5em] dark:border-slate-700 dark:bg-slate-800"
                />
              </>
            ) : lockMode === 'unlock' ? (
              <input
                type="password"
                maxLength={4}
                inputMode="numeric"
                value={unlockPin}
                onChange={(event) => setUnlockPin(event.target.value)}
                placeholder="Enter PIN"
                className="min-h-[52px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-2xl tracking-[0.5em] dark:border-slate-700 dark:bg-slate-800"
              />
            ) : (
              <>
                <input
                  value={profileSetup.name}
                  onChange={(event) => setProfileSetup((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Enter your name"
                  className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-lg dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="grid grid-cols-5 gap-2">
                  {AVATARS.map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setProfileSetup((prev) => ({ ...prev, avatar }))}
                      className={`min-h-[44px] rounded-xl border text-xl ${
                        profileSetup.avatar === avatar
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </>
            )}
            {pinError && <p className="text-center text-sm text-rose-500">{pinError}</p>}
            <button
              type="submit"
              className="min-h-[48px] w-full rounded-xl bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-500"
            >
              {lockMode === 'setup'
                ? 'Save PIN & Continue'
                : lockMode === 'unlock'
                  ? 'Unlock App'
                  : 'Save Profile & Enter App'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F9FAFB] text-[#111827] transition-colors dark:bg-slate-950 dark:text-slate-100"
      style={{ fontFamily: 'Inter, Poppins, system-ui, sans-serif' }}
    >
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="hidden min-h-screen w-72 flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-700 dark:bg-slate-900 lg:flex">
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="rounded-xl bg-indigo-600 p-2 text-white">
              <Wallet size={18} />
            </div>
            <div>
              <p className="font-bold">MyMoney</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Personal Finance Manager</p>
            </div>
          </div>

          <nav className="space-y-1">
            {DESKTOP_NAV.map((item) => {
              const Icon = item.icon;
              const active = page === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPage(item.key)}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition ${
                    active
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div>
                  <h1 className="text-lg font-bold">{PAGE_TITLES[page] || 'MyMoney'}</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{format(new Date(), 'EEEE, MMM d')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium dark:bg-slate-800 sm:inline-flex">
                  {settingsDraft?.avatar || data.settings.avatar || '🙂'}{' '}
                  {String(settingsDraft?.profileName || data.settings.profileName || '').trim() || 'Set name'}
                </span>
                <button
                  type="button"
                  onClick={() => setDarkMode(!Boolean(data.settings.darkMode))}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                  title="Toggle dark mode"
                >
                  {data.settings.darkMode ? <Sun size={17} /> : <Moon size={17} />}
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 lg:pb-6">{renderContent()}</main>
        </div>
      </div>

      {page !== 'transactionForm' && (
        <button
          type="button"
          onClick={openAddTransaction}
          className="fixed bottom-20 right-4 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl transition hover:bg-indigo-500 active:scale-95 lg:bottom-8 lg:right-8"
          title="Quick Add Transaction"
        >
          <Plus size={24} />
        </button>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          <button
            type="button"
            onClick={() => setPage('home')}
            className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl text-xs ${
              page === 'home' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950' : 'text-slate-500'
            }`}
          >
            <Home size={17} />
            Home
          </button>
          <button
            type="button"
            onClick={() => setPage('transactions')}
            className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl text-xs ${
              page === 'transactions' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950' : 'text-slate-500'
            }`}
          >
            <Filter size={17} />
            Transactions
          </button>
          <button
            type="button"
            onClick={openAddTransaction}
            className="flex min-h-[52px] flex-col items-center justify-center rounded-xl text-xs text-indigo-600"
          >
            <div className="mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white">
              <Plus size={14} />
            </div>
            Add
          </button>
          <button
            type="button"
            onClick={() => setPage('budget')}
            className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl text-xs ${
              page === 'budget' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950' : 'text-slate-500'
            }`}
          >
            <CircleDollarSign size={17} />
            Budget
          </button>
          <button
            type="button"
            onClick={() => setPage('more')}
            className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl text-xs ${
              page === 'more' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950' : 'text-slate-500'
            }`}
          >
            <Sparkles size={17} />
            More
          </button>
        </div>
      </nav>

      <div className="pointer-events-none fixed right-4 top-4 z-30 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto min-w-[220px] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
              toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
