'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

// GRAIN Token ABI (minimal interface)
const GRAIN_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
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
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'mint',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'burn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'lockedBalanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'unlockedBalanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'vestingSchedule',
    outputs: [
      { name: 'start', type: 'uint256' },
      { name: 'cliff', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'total', type: 'uint256' },
      { name: 'released', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Replace with actual deployed contract address
const GRAIN_ADDRESS = process.env.NEXT_PUBLIC_GRAIN_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000';

export interface GrainBalance {
  total: string;
  locked: string;
  unlocked: string;
  raw: {
    total: bigint;
    locked: bigint;
    unlocked: bigint;
  };
}

export interface VestingSchedule {
  start: number;
  cliff: number;
  duration: number;
  total: string;
  released: string;
  percentVested: number;
}

export interface GrainData {
  balance: GrainBalance | null;
  nav: string;
  navRaw: bigint;
  totalSupply: string;
  totalSupplyRaw: bigint;
  vestingSchedule: VestingSchedule | null;
  isLoading: boolean;
  error: Error | null;
}

export interface GrainActions {
  mint: (amount: string) => Promise<void>;
  burn: (amount: string) => Promise<void>;
  transfer: (to: string, amount: string) => Promise<void>;
  refetch: () => void;
}

export function useGrain(): GrainData & GrainActions {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Read balance
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: GRAIN_ADDRESS,
    abi: GRAIN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Read locked balance
  const { data: lockedData, refetch: refetchLocked } = useReadContract({
    address: GRAIN_ADDRESS,
    abi: GRAIN_ABI,
    functionName: 'lockedBalanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Read unlocked balance
  const { data: unlockedData, refetch: refetchUnlocked } = useReadContract({
    address: GRAIN_ADDRESS,
    abi: GRAIN_ABI,
    functionName: 'unlockedBalanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Read NAV
  const { data: navData, refetch: refetchNav } = useReadContract({
    address: GRAIN_ADDRESS,
    abi: GRAIN_ABI,
    functionName: 'nav',
  });

  // Read total supply
  const { data: totalSupplyData, refetch: refetchSupply } = useReadContract({
    address: GRAIN_ADDRESS,
    abi: GRAIN_ABI,
    functionName: 'totalSupply',
  });

  // Read vesting schedule
  const { data: vestingData, refetch: refetchVesting } = useReadContract({
    address: GRAIN_ADDRESS,
    abi: GRAIN_ABI,
    functionName: 'vestingSchedule',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Write contracts
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
  });

  // Process balance data
  const balance: GrainBalance | null = balanceData
    ? {
        total: formatUnits(balanceData as bigint, 18),
        locked: formatUnits((lockedData as bigint) || 0n, 18),
        unlocked: formatUnits((unlockedData as bigint) || 0n, 18),
        raw: {
          total: balanceData as bigint,
          locked: (lockedData as bigint) || 0n,
          unlocked: (unlockedData as bigint) || 0n,
        },
      }
    : null;

  // Process NAV
  const nav = navData ? formatUnits(navData as bigint, 6) : '0.00';
  const navRaw = (navData as bigint) || 0n;

  // Process total supply
  const totalSupply = totalSupplyData ? formatUnits(totalSupplyData as bigint, 18) : '0';
  const totalSupplyRaw = (totalSupplyData as bigint) || 0n;

  // Process vesting schedule
  const vestingSchedule: VestingSchedule | null = vestingData
    ? (() => {
        const [start, cliff, duration, total, released] = vestingData as [bigint, bigint, bigint, bigint, bigint];
        const now = Math.floor(Date.now() / 1000);
        const elapsed = Math.max(0, now - Number(start));
        const percentVested = Math.min(100, (elapsed / Number(duration)) * 100);

        return {
          start: Number(start),
          cliff: Number(cliff),
          duration: Number(duration),
          total: formatUnits(total, 18),
          released: formatUnits(released, 18),
          percentVested,
        };
      })()
    : null;

  // Actions
  const mint = useCallback(
    async (amount: string) => {
      if (!isConnected) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        const amountInWei = parseUnits(amount, 18);
        await writeContract({
          address: GRAIN_ADDRESS,
          abi: GRAIN_ABI,
          functionName: 'mint',
          args: [amountInWei],
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

  const burn = useCallback(
    async (amount: string) => {
      if (!isConnected) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        const amountInWei = parseUnits(amount, 18);
        await writeContract({
          address: GRAIN_ADDRESS,
          abi: GRAIN_ABI,
          functionName: 'burn',
          args: [amountInWei],
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

  const transfer = useCallback(
    async (to: string, amount: string) => {
      if (!isConnected) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        const amountInWei = parseUnits(amount, 18);
        await writeContract({
          address: GRAIN_ADDRESS,
          abi: GRAIN_ABI,
          functionName: 'transfer',
          args: [to as `0x${string}`, amountInWei],
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
    refetchBalance();
    refetchLocked();
    refetchUnlocked();
    refetchNav();
    refetchSupply();
    refetchVesting();
  }, [refetchBalance, refetchLocked, refetchUnlocked, refetchNav, refetchSupply, refetchVesting]);

  return {
    balance,
    nav,
    navRaw,
    totalSupply,
    totalSupplyRaw,
    vestingSchedule,
    isLoading: isLoading || isConfirming,
    error,
    mint,
    burn,
    transfer,
    refetch,
  };
}
