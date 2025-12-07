// @ts-nocheck
/**
 * Loan Calculator Page
 * Interactive calculators for mortgages, auto loans, and personal loans
 */

'use client';

import { useState } from 'react';

export default function CalculatorPage() {
  const [calculatorType, setCalculatorType] = useState<'mortgage' | 'auto' | 'personal'>('mortgage');

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Loan Calculators</h1>
          <p className="text-xl text-gray-600">
            Estimate your monthly payments and see how much you can afford
          </p>
        </div>

        {/* Calculator Type Selector */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setCalculatorType('mortgage')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              calculatorType === 'mortgage'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            🏠 Mortgage
          </button>
          <button
            onClick={() => setCalculatorType('auto')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              calculatorType === 'auto'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            🚗 Auto Loan
          </button>
          <button
            onClick={() => setCalculatorType('personal')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              calculatorType === 'personal'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            💰 Personal Loan
          </button>
        </div>

        {/* Calculator */}
        {calculatorType === 'mortgage' && <MortgageCalculator />}
        {calculatorType === 'auto' && <AutoCalculator />}
        {calculatorType === 'personal' && <PersonalLoanCalculator />}
      </div>
    </div>
  );
}

function MortgageCalculator() {
  const [homePrice, setHomePrice] = useState(350000);
  const [downPayment, setDownPayment] = useState(70000);
  const [interestRate, setInterestRate] = useState(6.75);
  const [loanTerm, setLoanTerm] = useState(30);
  const [propertyTax, setPropertyTax] = useState(3500);
  const [homeInsurance, setHomeInsurance] = useState(1200);
  const [hoa, setHoa] = useState(0);

  const loanAmount = homePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTerm * 12;

  const monthlyPI =
    (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  const monthlyTax = propertyTax / 12;
  const monthlyInsurance = homeInsurance / 12;
  const monthlyHoa = hoa / 12;
  const monthlyPMI = (homePrice - loanAmount) / homePrice < 0.2 ? (loanAmount * 0.005) / 12 : 0;

  const totalMonthly = monthlyPI + monthlyTax + monthlyInsurance + monthlyHoa + monthlyPMI;

  const totalInterest = monthlyPI * numPayments - loanAmount;
  const totalCost = totalMonthly * numPayments + downPayment;

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6">Mortgage Calculator</h2>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Home Price: ${homePrice.toLocaleString()}
            </label>
            <input
              type="range"
              min="50000"
              max="2000000"
              step="10000"
              value={homePrice}
              onChange={e => setHomePrice(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Down Payment: ${downPayment.toLocaleString()} ({((downPayment / homePrice) * 100).toFixed(1)}%)
            </label>
            <input
              type="range"
              min="0"
              max={homePrice * 0.5}
              step="5000"
              value={downPayment}
              onChange={e => setDownPayment(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interest Rate: {interestRate.toFixed(2)}%
            </label>
            <input
              type="range"
              min="3"
              max="10"
              step="0.125"
              value={interestRate}
              onChange={e => setInterestRate(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loan Term: {loanTerm} years
            </label>
            <select
              value={loanTerm}
              onChange={e => setLoanTerm(parseInt(e.target.value))}
              className="w-full border rounded-lg p-2"
            >
              <option value="15">15 years</option>
              <option value="20">20 years</option>
              <option value="30">30 years</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Annual Property Tax: ${propertyTax.toLocaleString()}
            </label>
            <input
              type="number"
              value={propertyTax}
              onChange={e => setPropertyTax(parseInt(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Annual Home Insurance: ${homeInsurance.toLocaleString()}
            </label>
            <input
              type="number"
              value={homeInsurance}
              onChange={e => setHomeInsurance(parseInt(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly HOA: ${hoa.toLocaleString()}
            </label>
            <input
              type="number"
              value={hoa}
              onChange={e => setHoa(parseInt(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          <div className="bg-amber-50 rounded-lg p-6">
            <div className="text-center">
              <div className="text-gray-600 text-sm mb-2">Monthly Payment (PITI)</div>
              <div className="text-5xl font-bold text-amber-600">
                ${Math.round(totalMonthly).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Principal & Interest</span>
              <span className="font-bold">${Math.round(monthlyPI).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Property Tax</span>
              <span className="font-bold">${Math.round(monthlyTax).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Home Insurance</span>
              <span className="font-bold">${Math.round(monthlyInsurance).toLocaleString()}</span>
            </div>
            {monthlyPMI > 0 && (
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600">PMI</span>
                <span className="font-bold">${Math.round(monthlyPMI).toLocaleString()}</span>
              </div>
            )}
            {monthlyHoa > 0 && (
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600">HOA</span>
                <span className="font-bold">${Math.round(monthlyHoa).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Loan Amount</span>
              <span className="font-semibold">${loanAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Interest</span>
              <span className="font-semibold">${Math.round(totalInterest).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Cost</span>
              <span className="font-semibold">${Math.round(totalCost).toLocaleString()}</span>
            </div>
          </div>

          <button className="w-full bg-amber-600 text-white py-3 rounded-lg font-bold hover:bg-amber-700 transition">
            Apply for This Loan
          </button>
        </div>
      </div>
    </div>
  );
}

function AutoCalculator() {
  const [vehiclePrice, setVehiclePrice] = useState(35000);
  const [downPayment, setDownPayment] = useState(7000);
  const [tradeIn, setTradeIn] = useState(0);
  const [interestRate, setInterestRate] = useState(7.49);
  const [loanTerm, setLoanTerm] = useState(60);

  const loanAmount = vehiclePrice - downPayment - tradeIn;
  const monthlyRate = interestRate / 100 / 12;

  const monthlyPayment =
    (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanTerm))) /
    (Math.pow(1 + monthlyRate, loanTerm) - 1);

  const totalInterest = monthlyPayment * loanTerm - loanAmount;
  const totalCost = monthlyPayment * loanTerm + downPayment;

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6">Auto Loan Calculator</h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vehicle Price: ${vehiclePrice.toLocaleString()}
            </label>
            <input
              type="range"
              min="5000"
              max="150000"
              step="1000"
              value={vehiclePrice}
              onChange={e => setVehiclePrice(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Down Payment: ${downPayment.toLocaleString()}
            </label>
            <input
              type="range"
              min="0"
              max={vehiclePrice * 0.5}
              step="500"
              value={downPayment}
              onChange={e => setDownPayment(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trade-In Value: ${tradeIn.toLocaleString()}
            </label>
            <input
              type="number"
              value={tradeIn}
              onChange={e => setTradeIn(parseInt(e.target.value) || 0)}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interest Rate: {interestRate.toFixed(2)}%
            </label>
            <input
              type="range"
              min="3"
              max="15"
              step="0.25"
              value={interestRate}
              onChange={e => setInterestRate(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loan Term: {loanTerm} months
            </label>
            <select
              value={loanTerm}
              onChange={e => setLoanTerm(parseInt(e.target.value))}
              className="w-full border rounded-lg p-2"
            >
              <option value="36">36 months</option>
              <option value="48">48 months</option>
              <option value="60">60 months</option>
              <option value="72">72 months</option>
            </select>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-amber-50 rounded-lg p-6">
            <div className="text-center">
              <div className="text-gray-600 text-sm mb-2">Monthly Payment</div>
              <div className="text-5xl font-bold text-amber-600">
                ${Math.round(monthlyPayment).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Loan Amount</span>
              <span className="font-bold">${loanAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Total Interest</span>
              <span className="font-bold">${Math.round(totalInterest).toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Total Payments</span>
              <span className="font-bold">${Math.round(totalCost).toLocaleString()}</span>
            </div>
          </div>

          <button className="w-full bg-amber-600 text-white py-3 rounded-lg font-bold hover:bg-amber-700 transition">
            Apply for Auto Loan
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonalLoanCalculator() {
  const [loanAmount, setLoanAmount] = useState(15000);
  const [interestRate, setInterestRate] = useState(11.99);
  const [loanTerm, setLoanTerm] = useState(36);

  const monthlyRate = interestRate / 100 / 12;

  const monthlyPayment =
    (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, loanTerm))) /
    (Math.pow(1 + monthlyRate, loanTerm) - 1);

  const totalInterest = monthlyPayment * loanTerm - loanAmount;
  const totalCost = monthlyPayment * loanTerm;

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold mb-6">Personal Loan Calculator</h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loan Amount: ${loanAmount.toLocaleString()}
            </label>
            <input
              type="range"
              min="1000"
              max="50000"
              step="500"
              value={loanAmount}
              onChange={e => setLoanAmount(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interest Rate: {interestRate.toFixed(2)}%
            </label>
            <input
              type="range"
              min="6"
              max="25"
              step="0.5"
              value={interestRate}
              onChange={e => setInterestRate(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loan Term: {loanTerm} months
            </label>
            <select
              value={loanTerm}
              onChange={e => setLoanTerm(parseInt(e.target.value))}
              className="w-full border rounded-lg p-2"
            >
              <option value="12">12 months</option>
              <option value="24">24 months</option>
              <option value="36">36 months</option>
              <option value="48">48 months</option>
              <option value="60">60 months</option>
            </select>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-amber-50 rounded-lg p-6">
            <div className="text-center">
              <div className="text-gray-600 text-sm mb-2">Monthly Payment</div>
              <div className="text-5xl font-bold text-amber-600">
                ${Math.round(monthlyPayment).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Loan Amount</span>
              <span className="font-bold">${loanAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Total Interest</span>
              <span className="font-bold">${Math.round(totalInterest).toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Total Cost</span>
              <span className="font-bold">${Math.round(totalCost).toLocaleString()}</span>
            </div>
          </div>

          <button className="w-full bg-amber-600 text-white py-3 rounded-lg font-bold hover:bg-amber-700 transition">
            Apply for Personal Loan
          </button>
        </div>
      </div>
    </div>
  );
}
