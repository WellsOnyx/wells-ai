'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

// Vault ABI (minimal interface)
const VAULT_ABI = [
  {
    inputs: [],
    name: 'totalAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nav',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tier', type: 'uint8' }],
    name: 'getTierAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tier', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'lastUpdate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'navHistory',
    outputs: [
      { name: 'timestamp', type: 'uint256[]' },
      { name: 'values', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Replace with actual deployed contract address
const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000';

export enum AssetTier {
  LIQUID = 1,     // Tier 1: USDC, cash equivalents
  FLOAT = 2,      // Tier 2: In-transit funds
  PHYSICAL = 3,   // Tier 3: Physical inventory
  INVESTMENTS = 4, // Tier 4: Venture investments
  RECEIVABLES = 5, // Tier 5: Accounts receivable
}

export interface TierAssets {
  tier: AssetTier;
  name: string;
  amount: string;
  amountRaw: bigint;
  percentage: number;
}

export interface NAVHistory {
  timestamp: number;
  value: string;
  change24h?: number;
  change7d?: number;
  change30d?: number;
}

export interface VaultData {
  totalAssets: string;
  totalAssetsRaw: bigint;
  nav: string;
  navRaw: bigint;
  tiers: TierAssets[];
  history: NAVHistory[];
  lastUpdate: number;
  isLoading: boolean;
  error: Error | null;
}

export interface VaultActions {
  deposit: (tier: AssetTier, amount: string) => Promise<void>;
  withdraw: (tier: AssetTier, amount: string) => Promise<void>;
  refetch: () => void;
}

const TIER_NAMES = {
  [AssetTier.LIQUID]: 'Liquid Assets (USDC)',
  [AssetTier.FLOAT]: 'Float (In Transit)',
  [AssetTier.PHYSICAL]: 'Physical Inventory',
  [AssetTier.INVESTMENTS]: 'Venture Investments',
  [AssetTier.RECEIVABLES]: 'Accounts Receivable',
};

export function useVault(): VaultData & VaultActions {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Read total assets
  const { data: totalAssetsData, refetch: refetchTotalAssets } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
  });

  // Read NAV
  const { data: navData, refetch: refetchNav } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'nav',
  });

  // Read last update
  const { data: lastUpdateData, refetch: refetchLastUpdate } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'lastUpdate',
  });

  // Read tier assets
  const { data: tier1Data, refetch: refetchTier1 } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getTierAssets',
    args: [1],
  });

  const { data: tier2Data, refetch: refetchTier2 } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getTierAssets',
    args: [2],
  });

  const { data: tier3Data, refetch: refetchTier3 } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getTierAssets',
    args: [3],
  });

  const { data: tier4Data, refetch: refetchTier4 } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getTierAssets',
    args: [4],
  });

  const { data: tier5Data, refetch: refetchTier5 } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getTierAssets',
    args: [5],
  });

  // Read NAV history
  const { data: historyData, refetch: refetchHistory } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'navHistory',
  });

  // Write contracts
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
  });

  // Process total assets
  const totalAssets = totalAssetsData ? formatUnits(totalAssetsData as bigint, 6) : '0';
  const totalAssetsRaw = (totalAssetsData as bigint) || 0n;

  // Process NAV
  const nav = navData ? formatUnits(navData as bigint, 6) : '0.00';
  const navRaw = (navData as bigint) || 0n;

  // Process last update
  const lastUpdate = lastUpdateData ? Number(lastUpdateData) : 0;

  // Process tier data
  const tierDataArray = [
    { tier: AssetTier.LIQUID, data: tier1Data },
    { tier: AssetTier.FLOAT, data: tier2Data },
    { tier: AssetTier.PHYSICAL, data: tier3Data },
    { tier: AssetTier.INVESTMENTS, data: tier4Data },
    { tier: AssetTier.RECEIVABLES, data: tier5Data },
  ];

  const tiers: TierAssets[] = tierDataArray.map(({ tier, data }) => {
    const amountRaw = (data as bigint) || 0n;
    const amount = formatUnits(amountRaw, 6);
    const percentage = totalAssetsRaw > 0n ? Number((amountRaw * 10000n) / totalAssetsRaw) / 100 : 0;

    return {
      tier,
      name: TIER_NAMES[tier],
      amount,
      amountRaw,
      percentage,
    };
  });

  // Process NAV history
  const history: NAVHistory[] = historyData
    ? (() => {
        const [timestamps, values] = historyData as [bigint[], bigint[]];
        return timestamps.map((timestamp, index) => {
          const value = formatUnits(values[index], 6);
          return {
            timestamp: Number(timestamp),
            value,
          };
        });
      })()
    : [];

  // Calculate changes if we have history
  if (history.length > 0) {
    const current = parseFloat(history[history.length - 1].value);
    const oneDayAgo = Date.now() / 1000 - 86400;
    const sevenDaysAgo = Date.now() / 1000 - 604800;
    const thirtyDaysAgo = Date.now() / 1000 - 2592000;

    const find24h = history.find((h) => h.timestamp >= oneDayAgo);
    const find7d = history.find((h) => h.timestamp >= sevenDaysAgo);
    const find30d = history.find((h) => h.timestamp >= thirtyDaysAgo);

    if (find24h) {
      const prev = parseFloat(find24h.value);
      history[history.length - 1].change24h = ((current - prev) / prev) * 100;
    }
    if (find7d) {
      const prev = parseFloat(find7d.value);
      history[history.length - 1].change7d = ((current - prev) / prev) * 100;
    }
    if (find30d) {
      const prev = parseFloat(find30d.value);
      history[history.length - 1].change30d = ((current - prev) / prev) * 100;
    }
  }

  // Actions
  const deposit = useCallback(
    async (tier: AssetTier, amount: string) => {
      if (!isConnected) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        const amountInWei = parseUnits(amount, 6);
        await writeContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'deposit',
          args: [tier, amountInWei],
        });
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isConnected, writeContract]
  );

  const withdraw = useCallback(
    async (tier: AssetTier, amount: string) => {
      if (!isConnected) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        const amountInWei = parseUnits(amount, 6);
        await writeContract({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'withdraw',
          args: [tier, amountInWei],
        });
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isConnected, writeContract]
  );

  const refetch = useCallback(() => {
    refetchTotalAssets();
    refetchNav();
    refetchLastUpdate();
    refetchTier1();
    refetchTier2();
    refetchTier3();
    refetchTier4();
    refetchTier5();
    refetchHistory();
  }, [
    refetchTotalAssets,
    refetchNav,
    refetchLastUpdate,
    refetchTier1,
    refetchTier2,
    refetchTier3,
    refetchTier4,
    refetchTier5,
    refetchHistory,
  ]);

  return {
    totalAssets,
    totalAssetsRaw,
    nav,
    navRaw,
    tiers,
    history,
    lastUpdate,
    isLoading: isLoading || isConfirming,
    error,
    deposit,
    withdraw,
    refetch,
  };
}
