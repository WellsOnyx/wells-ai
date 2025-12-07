// @ts-nocheck
/**
 * Lending Landing Page
 * Grain & Vault Personal Lending
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LendingPage() {
  const [products, setProducts] = useState([]);
  const [todaysRates, setTodaysRates] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/lending/products');
      const data = await response.json();

      if (data.success) {
        setProducts(data.products);
        setTodaysRates(data.todaysRates);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatRate = (rate: number) => {
    return (rate * 100).toFixed(3) + '%';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">Grain & Vault Lending</h1>
            <p className="text-2xl mb-8">
              Competitive rates. Fast approvals. GRAIN holder benefits.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/lending/apply"
                className="bg-white text-amber-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-amber-50 transition"
              >
                Apply Now
              </Link>
              <Link
                href="/lending/calculator"
                className="bg-amber-700 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-amber-800 transition"
              >
                Calculate Payment
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Rates */}
      {todaysRates && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-center mb-8">Today's Rates</h2>
            <div className="grid md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-600">
                  {formatRate(todaysRates.mortgage30Year)}
                </div>
                <div className="text-gray-600 mt-2">30-Year Mortgage</div>
                <div className="text-sm text-gray-400">APR</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-600">
                  {formatRate(todaysRates.mortgage15Year)}
                </div>
                <div className="text-gray-600 mt-2">15-Year Mortgage</div>
                <div className="text-sm text-gray-400">APR</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-600">
                  {formatRate(todaysRates.autoNew)}
                </div>
                <div className="text-gray-600 mt-2">New Auto Loan</div>
                <div className="text-sm text-gray-400">APR</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-amber-600">
                  {formatRate(todaysRates.personalUnsecured)}
                </div>
                <div className="text-gray-600 mt-2">Personal Loan</div>
                <div className="text-sm text-gray-400">APR</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600">
                  {formatRate(todaysRates.grainBacked)}
                </div>
                <div className="text-gray-600 mt-2">GRAIN-Backed</div>
                <div className="text-sm text-gray-400">0% APR!</div>
              </div>
            </div>
            <p className="text-center text-sm text-gray-500 mt-4">
              Rates shown are for borrowers with excellent credit. Your rate may vary.
            </p>
          </div>
        </div>
      )}

      {/* GRAIN Benefits Callout */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">GRAIN Holder Benefits</h2>
            <p className="text-xl mb-6">
              Stake GRAIN and unlock exclusive lending benefits:
            </p>
            <div className="grid md:grid-cols-4 gap-6 mt-8">
              <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                <div className="text-2xl font-bold mb-2">0.25% Off</div>
                <div className="text-sm">Per 10,000 GRAIN Staked</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                <div className="text-2xl font-bold mb-2">0% APR</div>
                <div className="text-sm">Use GRAIN as Collateral</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                <div className="text-2xl font-bold mb-2">No PMI</div>
                <div className="text-sm">GRAIN Covers Down Payment</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                <div className="text-2xl font-bold mb-2">Instant</div>
                <div className="text-sm">Approval for GRAIN Loans</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-center mb-12">Our Loan Products</h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Mortgages */}
            <ProductSection
              title="Home Mortgages"
              description="Finance your dream home with competitive rates and flexible terms"
              icon="🏠"
              products={products.filter(p => p.type === 'mortgage')}
            />

            {/* Auto Loans */}
            <ProductSection
              title="Auto Loans"
              description="Drive away in your new or used vehicle with low rates"
              icon="🚗"
              products={products.filter(p => p.type === 'auto')}
            />

            {/* Personal Loans */}
            <ProductSection
              title="Personal Loans"
              description="Flexible financing for whatever life brings"
              icon="💰"
              products={products.filter(p => p.type === 'personal')}
            />
          </div>
        )}
      </div>

      {/* Why Choose Grain & Vault */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-12">Why Choose Grain & Vault?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg p-8 shadow-md">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold mb-2">Fast Approvals</h3>
              <p className="text-gray-600">
                Get a decision in minutes with our automated underwriting system
              </p>
            </div>
            <div className="bg-white rounded-lg p-8 shadow-md">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-bold mb-2">Secure & Private</h3>
              <p className="text-gray-600">
                Bank-level encryption and privacy protection for your information
              </p>
            </div>
            <div className="bg-white rounded-lg p-8 shadow-md">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-2">Transparent Rates</h3>
              <p className="text-gray-600">
                No hidden fees. Clear terms. Know exactly what you're paying
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
        <p className="text-xl text-gray-600 mb-8">
          Get pre-qualified in minutes without affecting your credit score
        </p>
        <Link
          href="/lending/apply"
          className="inline-block bg-amber-600 text-white px-12 py-4 rounded-lg font-bold text-xl hover:bg-amber-700 transition"
        >
          Apply Now
        </Link>
      </div>
    </div>
  );
}

function ProductSection({ title, description, icon, products }) {
  const formatRate = (rate: number) => (rate * 100).toFixed(3) + '%';

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="text-5xl">{icon}</div>
        <div>
          <h3 className="text-3xl font-bold">{title}</h3>
          <p className="text-gray-600">{description}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(product => (
          <div key={product.code} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <h4 className="text-xl font-bold mb-2">{product.name}</h4>
            <p className="text-gray-600 text-sm mb-4">{product.description}</p>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Starting Rate:</span>
                <span className="font-bold text-amber-600">{formatRate(product.baseRate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Term:</span>
                <span className="font-semibold">{product.termMonths} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Loan Range:</span>
                <span className="font-semibold">
                  ${(product.minAmount / 1000).toFixed(0)}K - ${(product.maxAmount / 1000).toFixed(0)}K
                </span>
              </div>
            </div>

            <Link
              href={`/lending/apply?product=${product.code}`}
              className="block mt-4 bg-amber-600 text-white text-center py-2 rounded-lg hover:bg-amber-700 transition"
            >
              Apply Now
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
