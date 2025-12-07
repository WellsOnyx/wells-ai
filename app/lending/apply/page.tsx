// @ts-nocheck
/**
 * Loan Application Form
 * Multi-step application process
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function ApplyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Product
    productCode: searchParams.get('product') || '',

    // Personal Info
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    ssn: '',
    dateOfBirth: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',

    // Employment
    employerName: '',
    jobTitle: '',
    employmentType: '',
    employmentStartDate: '',
    annualIncome: '',
    additionalIncome: '',

    // Financial
    monthlyHousingPayment: '',
    monthlyDebtPayments: '',
    liquidAssets: '',
    totalAssets: '',

    // Loan Details
    requestedAmount: '',
    loanPurpose: '',
    downPayment: '',

    // Property (if mortgage)
    propertyAddress: '',
    propertyCity: '',
    propertyState: '',
    propertyZip: '',
    propertyValue: '',
    propertyUse: '',

    // Vehicle (if auto)
    vehicleYear: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleVin: '',
    vehicleMileage: '',
    vehicleValue: '',
    vehicleCondition: 'good',

    // GRAIN
    grainBalance: '',
    grainStaked: '',

    // Co-borrower
    hasCoBorrower: false,
  });

  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/lending/products');
      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleNext = () => {
    setCurrentStep(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/lending/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to decision page or success page
        router.push(`/lending/application/${data.application.id}`);
      } else {
        setError(data.error || 'Failed to submit application');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find(p => p.code === formData.productCode);
  const isMortgage = selectedProduct?.type === 'mortgage';
  const isAuto = selectedProduct?.type === 'auto';

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Loan Application</h1>
          <p className="text-gray-600">Complete your application in just a few steps</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {[1, 2, 3, 4, 5, 6].map(step => (
              <div key={step} className="flex-1">
                <div className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      step <= currentStep
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {step}
                  </div>
                  {step < 6 && (
                    <div
                      className={`flex-1 h-1 ${
                        step < currentStep ? 'bg-amber-600' : 'bg-gray-200'
                      }`}
                    ></div>
                  )}
                </div>
                <div className="text-xs mt-2 text-center">
                  {step === 1 && 'Product'}
                  {step === 2 && 'Personal'}
                  {step === 3 && 'Employment'}
                  {step === 4 && 'Financial'}
                  {step === 5 && 'Details'}
                  {step === 6 && 'Review'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8">
          {/* Step 1: Product Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mb-6">Select Loan Product</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Type *
                </label>
                <select
                  name="productCode"
                  value={formData.productCode}
                  onChange={handleChange}
                  required
                  className="w-full border rounded-lg p-3"
                >
                  <option value="">Select a loan product...</option>
                  <optgroup label="Mortgages">
                    {products.filter(p => p.type === 'mortgage').map(product => (
                      <option key={product.code} value={product.code}>
                        {product.name} - {(product.baseRate * 100).toFixed(3)}% APR
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Auto Loans">
                    {products.filter(p => p.type === 'auto').map(product => (
                      <option key={product.code} value={product.code}>
                        {product.name} - {(product.baseRate * 100).toFixed(3)}% APR
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Personal Loans">
                    {products.filter(p => p.type === 'personal').map(product => (
                      <option key={product.code} value={product.code}>
                        {product.name} - {(product.baseRate * 100).toFixed(3)}% APR
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {selectedProduct && (
                <div className="bg-amber-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-2">{selectedProduct.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{selectedProduct.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Rate:</span> {(selectedProduct.baseRate * 100).toFixed(3)}%
                    </div>
                    <div>
                      <span className="text-gray-600">Term:</span> {selectedProduct.termMonths} months
                    </div>
                    <div>
                      <span className="text-gray-600">Min Amount:</span> ${selectedProduct.minAmount.toLocaleString()}
                    </div>
                    <div>
                      <span className="text-gray-600">Max Amount:</span> ${selectedProduct.maxAmount.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requested Loan Amount *
                </label>
                <input
                  type="number"
                  name="requestedAmount"
                  value={formData.requestedAmount}
                  onChange={handleChange}
                  required
                  min={selectedProduct?.minAmount}
                  max={selectedProduct?.maxAmount}
                  className="w-full border rounded-lg p-3"
                  placeholder="Enter loan amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loan Purpose
                </label>
                <select
                  name="loanPurpose"
                  value={formData.loanPurpose}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-3"
                >
                  <option value="">Select purpose...</option>
                  {isMortgage && (
                    <>
                      <option value="PURCHASE">Home Purchase</option>
                      <option value="REFINANCE">Refinance</option>
                      <option value="REFINANCE_CASH_OUT">Cash-Out Refinance</option>
                    </>
                  )}
                  {isAuto && (
                    <>
                      <option value="AUTO_PURCHASE">Vehicle Purchase</option>
                      <option value="AUTO_REFINANCE">Auto Refinance</option>
                    </>
                  )}
                  {!isMortgage && !isAuto && (
                    <>
                      <option value="DEBT_CONSOLIDATION">Debt Consolidation</option>
                      <option value="HOME_IMPROVEMENT">Home Improvement</option>
                      <option value="MEDICAL_EXPENSES">Medical Expenses</option>
                      <option value="OTHER">Other</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Personal Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mb-6">Personal Information</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Social Security Number *
                  </label>
                  <input
                    type="password"
                    name="ssn"
                    value={formData.ssn}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                    placeholder="XXX-XX-XXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address *
                </label>
                <input
                  type="text"
                  name="streetAddress"
                  value={formData.streetAddress}
                  onChange={handleChange}
                  required
                  className="w-full border rounded-lg p-3"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                    maxLength={2}
                    className="w-full border rounded-lg p-3"
                    placeholder="CA"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Employment */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mb-6">Employment Information</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employment Type *
                </label>
                <select
                  name="employmentType"
                  value={formData.employmentType}
                  onChange={handleChange}
                  required
                  className="w-full border rounded-lg p-3"
                >
                  <option value="">Select...</option>
                  <option value="FULL_TIME">Full-Time</option>
                  <option value="PART_TIME">Part-Time</option>
                  <option value="SELF_EMPLOYED">Self-Employed</option>
                  <option value="CONTRACT">Contract/1099</option>
                  <option value="RETIRED">Retired</option>
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employer Name *
                  </label>
                  <input
                    type="text"
                    name="employerName"
                    value={formData.employerName}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employment Start Date *
                  </label>
                  <input
                    type="date"
                    name="employmentStartDate"
                    value={formData.employmentStartDate}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Annual Income *
                  </label>
                  <input
                    type="number"
                    name="annualIncome"
                    value={formData.annualIncome}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                    placeholder="$100,000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Income (optional)
                </label>
                <input
                  type="number"
                  name="additionalIncome"
                  value={formData.additionalIncome}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-3"
                  placeholder="Rental, investment income, etc."
                />
              </div>
            </div>
          )}

          {/* Step 4: Financial Information */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mb-6">Financial Information</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Housing Payment *
                  </label>
                  <input
                    type="number"
                    name="monthlyHousingPayment"
                    value={formData.monthlyHousingPayment}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                    placeholder="Current rent or mortgage"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Debt Payments *
                  </label>
                  <input
                    type="number"
                    name="monthlyDebtPayments"
                    value={formData.monthlyDebtPayments}
                    onChange={handleChange}
                    required
                    className="w-full border rounded-lg p-3"
                    placeholder="Credit cards, car loans, etc."
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Assets
                  </label>
                  <input
                    type="number"
                    name="totalAssets"
                    value={formData.totalAssets}
                    onChange={handleChange}
                    className="w-full border rounded-lg p-3"
                    placeholder="Savings, investments, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Liquid Assets
                  </label>
                  <input
                    type="number"
                    name="liquidAssets"
                    value={formData.liquidAssets}
                    onChange={handleChange}
                    className="w-full border rounded-lg p-3"
                    placeholder="Cash, checking, savings"
                  />
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-bold mb-3">GRAIN Holdings (Optional)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Stake GRAIN to receive rate discounts up to 1.5%!
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GRAIN Balance
                    </label>
                    <input
                      type="number"
                      name="grainBalance"
                      value={formData.grainBalance}
                      onChange={handleChange}
                      className="w-full border rounded-lg p-3"
                      placeholder="Total GRAIN owned"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GRAIN Staked
                    </label>
                    <input
                      type="number"
                      name="grainStaked"
                      value={formData.grainStaked}
                      onChange={handleChange}
                      className="w-full border rounded-lg p-3"
                      placeholder="GRAIN to stake for discount"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Property/Vehicle Details */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mb-6">
                {isMortgage ? 'Property Details' : isAuto ? 'Vehicle Details' : 'Loan Details'}
              </h2>

              {isMortgage && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Property Address *
                    </label>
                    <input
                      type="text"
                      name="propertyAddress"
                      value={formData.propertyAddress}
                      onChange={handleChange}
                      required
                      className="w-full border rounded-lg p-3"
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City *
                      </label>
                      <input
                        type="text"
                        name="propertyCity"
                        value={formData.propertyCity}
                        onChange={handleChange}
                        required
                        className="w-full border rounded-lg p-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State *
                      </label>
                      <input
                        type="text"
                        name="propertyState"
                        value={formData.propertyState}
                        onChange={handleChange}
                        required
                        maxLength={2}
                        className="w-full border rounded-lg p-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ZIP *
                      </label>
                      <input
                        type="text"
                        name="propertyZip"
                        value={formData.propertyZip}
                        onChange={handleChange}
                        required
                        className="w-full border rounded-lg p-3"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Property Value *
                      </label>
                      <input
                        type="number"
                        name="propertyValue"
                        value={formData.propertyValue}
                        onChange={handleChange}
                        required
                        className="w-full border rounded-lg p-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Down Payment *
                      </label>
                      <input
                        type="number"
                        name="downPayment"
                        value={formData.downPayment}
                        onChange={handleChange}
                        required
                        className="w-full border rounded-lg p-3"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Property Use *
                    </label>
                    <select
                      name="propertyUse"
                      value={formData.propertyUse}
                      onChange={handleChange}
                      required
                      className="w-full border rounded-lg p-3"
                    >
                      <option value="">Select...</option>
                      <option value="PRIMARY_RESIDENCE">Primary Residence</option>
                      <option value="SECOND_HOME">Second Home</option>
                      <option value="INVESTMENT">Investment Property</option>
                    </select>
                  </div>
                </>
              )}

              {isAuto && (
                <>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Year *
                      </label>
                      <input
                        type="number"
                        name="vehicleYear"
                        value={formData.vehicleYear}
                        onChange={handleChange}
                        required
                        min="1990"
                        max={new Date().getFullYear() + 1}
                        className="w-full border rounded-lg p-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Make *
                      </label>
                      <input
                        type="text"
                        name="vehicleMake"
                        value={formData.vehicleMake}
                        onChange={handleChange}
                        required
                        className="w-full border rounded-lg p-3"
                        placeholder="Toyota, Ford, etc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Model *
                      </label>
                      <input
                        type="text"
                        name="vehicleModel"
                        value={formData.vehicleModel}
                        onChange={handleChange}
                        required
                        className="w-full border rounded-lg p-3"
                        placeholder="Camry, F-150, etc."
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VIN
                      </label>
                      <input
                        type="text"
                        name="vehicleVin"
                        value={formData.vehicleVin}
                        onChange={handleChange}
                        maxLength={17}
                        className="w-full border rounded-lg p-3"
                        placeholder="17-character VIN"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mileage *
                      </label>
                      <input
                        type="number"
                        name="vehicleMileage"
                        value={formData.vehicleMileage}
                        onChange={handleChange}
                        required
                        className="w-full border rounded-lg p-3"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vehicle Value *
                      </label>
                      <input
                        type="number"
                        name="vehicleValue"
                        value={formData.vehicleValue}
                        onChange={handleChange}
                        required
                        className="w-full border rounded-lg p-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Condition *
                      </label>
                      <select
                        name="vehicleCondition"
                        value={formData.vehicleCondition}
                        onChange={handleChange}
                        required
                        className="w-full border rounded-lg p-3"
                      >
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {!isMortgage && !isAuto && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Down Payment (if applicable)
                  </label>
                  <input
                    type="number"
                    name="downPayment"
                    value={formData.downPayment}
                    onChange={handleChange}
                    className="w-full border rounded-lg p-3"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mb-6">Review & Submit</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                <div>
                  <h3 className="font-bold mb-2">Loan Details</h3>
                  <p>Product: {selectedProduct?.name}</p>
                  <p>Amount: ${parseFloat(formData.requestedAmount || 0).toLocaleString()}</p>
                  <p>Purpose: {formData.loanPurpose || 'Not specified'}</p>
                </div>

                <div>
                  <h3 className="font-bold mb-2">Personal Information</h3>
                  <p>Name: {formData.firstName} {formData.lastName}</p>
                  <p>Email: {formData.email}</p>
                  <p>Phone: {formData.phone}</p>
                </div>

                <div>
                  <h3 className="font-bold mb-2">Employment</h3>
                  <p>Employer: {formData.employerName}</p>
                  <p>Title: {formData.jobTitle}</p>
                  <p>Income: ${parseFloat(formData.annualIncome || 0).toLocaleString()}/year</p>
                </div>

                {formData.grainStaked && parseFloat(formData.grainStaked) > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-bold mb-2">GRAIN Benefits</h3>
                    <p>Staked GRAIN: {parseFloat(formData.grainStaked).toLocaleString()}</p>
                    <p className="text-green-600 font-semibold">
                      Estimated Rate Discount: {
                        parseFloat(formData.grainStaked) >= 250000 ? '1.50%' :
                        parseFloat(formData.grainStaked) >= 100000 ? '1.00%' :
                        parseFloat(formData.grainStaked) >= 50000 ? '0.75%' :
                        parseFloat(formData.grainStaked) >= 25000 ? '0.50%' :
                        parseFloat(formData.grainStaked) >= 10000 ? '0.25%' : '0.00%'
                      }
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  By submitting this application, you authorize Grain & Vault to obtain your credit report
                  and verify the information provided. This will result in a hard inquiry on your credit.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
              >
                Back
              </button>
            )}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!formData.productCode && currentStep === 1}
                className="ml-auto px-8 py-3 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="ml-auto px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
