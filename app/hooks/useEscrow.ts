'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

// Escrow ABI (minimal interface)
const ESCROW_ABI = [
  {
    inputs: [
      { name: 'counterparty', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'milestones', type: 'string[]' },
      { name: 'percentages', type: 'uint256[]' },
      { name: 'resolver', type: 'address' },
    ],
    name: 'createEscrow',
    outputs: [{ name: 'escrowId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'escrowId', type: 'uint256' },
      { name: 'milestoneIndex', type: 'uint256' },
    ],
    name: 'releaseMilestone',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'escrowId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    name: 'dispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'escrowId', type: 'uint256' },
      { name: 'winner', type: 'address' },
    ],
    name: 'resolveDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    name: 'getEscrow',
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'counterparty', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'released', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'resolver', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getEscrowsByAccount',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'escrowId', type: 'uint256' }],
    name: 'getMilestones',
    outputs: [
      { name: 'names', type: 'string[]' },
      { name: 'percentages', type: 'uint256[]' },
      { name: 'completed', type: 'bool[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Replace with actual deployed contract address
const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000';

export enum EscrowStatus {
  ACTIVE = 0,
  COMPLETED = 1,
  DISPUTED = 2,
  RESOLVED = 3,
  CANCELLED = 4,
}

export interface Milestone {
  name: string;
  percentage: number;
  completed: boolean;
  amount: string;
}

export interface Escrow {
  id: string;
  creator: string;
  counterparty: string;
  amount: string;
  amountRaw: bigint;
  released: string;
  releasedRaw: bigint;
  status: EscrowStatus;
  resolver: string;
  milestones: Milestone[];
  progressPercentage: number;
}

export interface EscrowData {
  activeEscrows: Escrow[];
  completedEscrows: Escrow[];
  disputedEscrows: Escrow[];
  totalVolume: string;
  isLoading: boolean;
  error: Error | null;
}

export interface EscrowActions {
  create: (
    counterparty: string,
    amount: string,
    milestones: { name: string; percentage: number }[],
    resolver: string
  ) => Promise<string>;
  releaseMilestone: (escrowId: string, milestoneIndex: number) => Promise<void>;
  dispute: (escrowId: string, reason: string) => Promise<void>;
  resolveDispute: (escrowId: string, winner: string) => Promise<void>;
  refetch: () => void;
}

export function useEscrow(): EscrowData & EscrowActions {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [escrows, setEscrows] = useState<Escrow[]>([]);

  // Read user's escrow IDs
  const { data: escrowIdsData, refetch: refetchEscrowIds } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'getEscrowsByAccount',
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

  // Fetch escrow details
  const fetchEscrowDetails = useCallback(async (escrowIds: bigint[]) => {
    if (!escrowIds || escrowIds.length === 0) {
      setEscrows([]);
      return;
    }

    setIsLoading(true);
    try {
      // In production, fetch these in parallel using multicall
      const escrowPromises = escrowIds.map(async (id) => {
        // Fetch escrow data
        const escrowResponse = await fetch(`/api/grain/escrow/${id.toString()}`);
        const escrowData = await escrowResponse.json();

        // Fetch milestones
        const milestonesResponse = await fetch(`/api/grain/escrow/${id.toString()}/milestones`);
        const milestonesData = await milestonesResponse.json();

        const amount = parseFloat(formatUnits(BigInt(escrowData.amount), 18));
        const milestones: Milestone[] = milestonesData.names.map((name: string, index: number) => ({
          name,
          percentage: Number(milestonesData.percentages[index]) / 100,
          completed: milestonesData.completed[index],
          amount: ((amount * Number(milestonesData.percentages[index])) / 10000).toFixed(2),
        }));

        const completedCount = milestones.filter((m) => m.completed).length;
        const progressPercentage = (completedCount / milestones.length) * 100;

        return {
          id: id.toString(),
          creator: escrowData.creator,
          counterparty: escrowData.counterparty,
          amount: formatUnits(BigInt(escrowData.amount), 18),
          amountRaw: BigInt(escrowData.amount),
          released: formatUnits(BigInt(escrowData.released), 18),
          releasedRaw: BigInt(escrowData.released),
          status: escrowData.status as EscrowStatus,
          resolver: escrowData.resolver,
          milestones,
          progressPercentage,
        };
      });

      const fetchedEscrows = await Promise.all(escrowPromises);
      setEscrows(fetchedEscrows);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Watch for escrow IDs changes
  useEffect(() => {
    if (escrowIdsData) {
      fetchEscrowDetails(escrowIdsData as bigint[]);
    }
  }, [escrowIdsData, fetchEscrowDetails]);

  // Filter escrows by status
  const activeEscrows = escrows.filter((e) => e.status === EscrowStatus.ACTIVE);
  const completedEscrows = escrows.filter((e) => e.status === EscrowStatus.COMPLETED);
  const disputedEscrows = escrows.filter((e) => e.status === EscrowStatus.DISPUTED);

  // Calculate total volume
  const totalVolume = escrows
    .reduce((sum, escrow) => sum + parseFloat(escrow.amount), 0)
    .toFixed(2);

  // Actions
  const create = useCallback(
    async (
      counterparty: string,
      amount: string,
      milestones: { name: string; percentage: number }[],
      resolver: string
    ): Promise<string> => {
      if (!isConnected) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        const amountInWei = parseUnits(amount, 18);
        const milestoneNames = milestones.map((m) => m.name);
        const milestonePercentages = milestones.map((m) => BigInt(Math.floor(m.percentage * 100)));

        const result = await writeContract({
          address: ESCROW_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'createEscrow',
          args: [
            counterparty as `0x${string}`,
            amountInWei,
            milestoneNames,
            milestonePercentages,
            resolver as `0x${string}`,
          ],
        });

        // Wait for transaction and extract escrow ID
        // In production, listen to event logs for EscrowCreated event
        return 'pending';
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isConnected, writeContract]
  );

  const releaseMilestone = useCallback(
    async (escrowId: string, milestoneIndex: number) => {
      if (!isConnected) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        await writeContract({
          address: ESCROW_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'releaseMilestone',
          args: [BigInt(escrowId), BigInt(milestoneIndex)],
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

  const dispute = useCallback(
    async (escrowId: string, reason: string) => {
      if (!isConnected) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        await writeContract({
          address: ESCROW_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'dispute',
          args: [BigInt(escrowId), reason],
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

  const resolveDispute = useCallback(
    async (escrowId: string, winner: string) => {
      if (!isConnected) throw new Error('Wallet not connected');
      setIsLoading(true);
      setError(null);

      try {
        await writeContract({
          address: ESCROW_ADDRESS,
          abi: ESCROW_ABI,
          functionName: 'resolveDispute',
          args: [BigInt(escrowId), winner as `0x${string}`],
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
    refetchEscrowIds();
  }, [refetchEscrowIds]);

  return {
    activeEscrows,
    completedEscrows,
    disputedEscrows,
    totalVolume,
    isLoading: isLoading || isConfirming,
    error,
    create,
    releaseMilestone,
    dispute,
    resolveDispute,
    refetch,
  };
}
