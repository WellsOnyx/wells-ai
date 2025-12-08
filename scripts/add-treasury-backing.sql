-- Add Treasury Backing
-- Use this script to add new assets to the GRAIN treasury

-- Example 1: Add USD cash reserve
INSERT INTO treasury_backing (
  asset_type,
  asset_name,
  amount,
  custodian,
  verification_method,
  verification_proof
) VALUES (
  'usd_cash',
  'USD Cash Reserve - SVB',
  500000.00,
  'Silicon Valley Bank',
  'bank_statement',
  'https://example.com/proof/svb-statement-2025-01.pdf'
);

-- Example 2: Add T-Bills
INSERT INTO treasury_backing (
  asset_type,
  asset_name,
  amount,
  apy,
  custodian,
  verification_method,
  verification_proof
) VALUES (
  't_bills',
  '3-Month US Treasury Bills',
  300000.00,
  4.25,
  'BNY Mellon',
  'custodian_api',
  'https://api.bnymellon.com/holdings/verification/abc123'
);

-- Example 3: Add USDC stablecoin
INSERT INTO treasury_backing (
  asset_type,
  asset_name,
  amount,
  apy,
  custodian,
  verification_method,
  verification_proof
) VALUES (
  'stablecoin',
  'USDC',
  200000.00,
  0.0,
  'Circle',
  'blockchain',
  '0x1234567890abcdef1234567890abcdef12345678' -- Blockchain address
);

-- Example 4: Add Money Market Fund
INSERT INTO treasury_backing (
  asset_type,
  asset_name,
  amount,
  apy,
  custodian,
  verification_method,
  verification_proof
) VALUES (
  'money_market',
  'Vanguard Federal Money Market Fund',
  250000.00,
  4.75,
  'Vanguard',
  'custodian_api',
  'https://api.vanguard.com/holdings/verification/xyz789'
);

-- After adding backing, record new GRAIN price
SELECT record_grain_price();

-- Check current state
SELECT
  asset_type,
  asset_name,
  amount,
  custodian,
  status
FROM treasury_backing
WHERE status = 'active'
ORDER BY amount DESC;

-- Check current GRAIN price
SELECT * FROM get_grain_price();
