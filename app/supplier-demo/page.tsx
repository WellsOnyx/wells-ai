'use client'

/**
 * Wells AI Supplier Mini-App Demo
 *
 * App Store for B2B Procurement
 * Fortune 500 CPOs: This is the future.
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  X,
  ShoppingCart,
  FileText,
  ArrowLeft,
  Package,
  Monitor,
  UtensilsCrossed,
  Wrench,
  Server,
  Megaphone,
  Scale,
  Users,
  Zap,
  Truck,
  Fish,
  Beef
} from 'lucide-react'

// Supplier data with products
const suppliers = [
  {
    id: 'office-supplies',
    name: 'Office Supplies Co.',
    icon: Package,
    color: 'from-blue-500 to-blue-600',
    description: 'Premium office essentials for modern workplaces. Sustainable options available.',
    products: [
      { name: 'Executive Desk Chair', price: 599, unit: 'each' },
      { name: 'Standing Desk Pro', price: 1299, unit: 'each' },
      { name: 'Premium Paper (10 Reams)', price: 89, unit: 'case' },
      { name: 'Wireless Keyboard Bundle', price: 149, unit: 'set' },
      { name: 'Monitor Arms (Dual)', price: 279, unit: 'pair' },
      { name: 'Whiteboard 6x4 ft', price: 449, unit: 'each' },
    ]
  },
  {
    id: 'tech-hardware',
    name: 'Tech Hardware Inc.',
    icon: Monitor,
    color: 'from-purple-500 to-purple-600',
    description: 'Enterprise-grade technology and computing solutions. Dell, HP, Lenovo authorized.',
    products: [
      { name: 'Dell Latitude 7440', price: 1899, unit: 'each' },
      { name: '27" 4K Monitor', price: 549, unit: 'each' },
      { name: 'Docking Station USB-C', price: 299, unit: 'each' },
      { name: 'Wireless Mouse (Bulk 10)', price: 199, unit: 'pack' },
      { name: 'Network Switch 24-Port', price: 899, unit: 'each' },
      { name: 'Server Rack Cabinet', price: 2499, unit: 'each' },
    ]
  },
  {
    id: 'corporate-catering',
    name: 'Corporate Catering',
    icon: UtensilsCrossed,
    color: 'from-orange-500 to-orange-600',
    description: 'Executive dining and event catering. Farm-to-table options. Dietary accommodations.',
    products: [
      { name: 'Executive Lunch (25 pax)', price: 750, unit: 'event' },
      { name: 'All-Day Meeting Package', price: 45, unit: 'person' },
      { name: 'Coffee Service Setup', price: 299, unit: 'day' },
      { name: 'Cocktail Reception', price: 85, unit: 'person' },
      { name: 'Board Room Dinner', price: 125, unit: 'person' },
      { name: 'Snack Box Delivery', price: 18, unit: 'box' },
    ]
  },
  {
    id: 'facilities',
    name: 'Facilities Management',
    icon: Wrench,
    color: 'from-green-500 to-green-600',
    description: 'Complete building maintenance and janitorial services. 24/7 emergency support.',
    products: [
      { name: 'HVAC Maintenance (Annual)', price: 4999, unit: 'contract' },
      { name: 'Deep Cleaning Service', price: 2500, unit: 'floor' },
      { name: 'Plumbing Emergency', price: 350, unit: 'call' },
      { name: 'Electrical Inspection', price: 899, unit: 'building' },
      { name: 'Pest Control (Quarterly)', price: 599, unit: 'quarter' },
      { name: 'Landscaping Monthly', price: 1299, unit: 'month' },
    ]
  },
  {
    id: 'it-services',
    name: 'IT Services',
    icon: Server,
    color: 'from-cyan-500 to-cyan-600',
    description: 'Managed IT, cloud solutions, and cybersecurity. SOC 2 Type II certified.',
    products: [
      { name: 'Help Desk Support (Mo)', price: 2999, unit: 'month' },
      { name: 'Cloud Migration', price: 15000, unit: 'project' },
      { name: 'Security Audit', price: 7500, unit: 'audit' },
      { name: 'Backup & Recovery', price: 1499, unit: 'month' },
      { name: 'Network Monitoring', price: 899, unit: 'month' },
      { name: 'Endpoint Protection', price: 12, unit: 'device/mo' },
    ]
  },
  {
    id: 'marketing',
    name: 'Marketing Agency',
    icon: Megaphone,
    color: 'from-pink-500 to-pink-600',
    description: 'Full-service B2B marketing. Strategy, content, digital, and events.',
    products: [
      { name: 'Brand Strategy Package', price: 25000, unit: 'project' },
      { name: 'Content Marketing (Mo)', price: 8500, unit: 'month' },
      { name: 'Trade Show Booth', price: 35000, unit: 'event' },
      { name: 'Video Production', price: 12000, unit: 'video' },
      { name: 'LinkedIn Campaign', price: 5000, unit: 'month' },
      { name: 'Press Release Service', price: 1500, unit: 'release' },
    ]
  },
  {
    id: 'legal',
    name: 'Legal Services',
    icon: Scale,
    color: 'from-slate-500 to-slate-600',
    description: 'Corporate counsel, contracts, compliance. Fortune 500 experience.',
    products: [
      { name: 'Contract Review', price: 2500, unit: 'contract' },
      { name: 'Compliance Audit', price: 15000, unit: 'audit' },
      { name: 'IP Filing (Trademark)', price: 3500, unit: 'filing' },
      { name: 'Employment Law Retainer', price: 7500, unit: 'month' },
      { name: 'M&A Due Diligence', price: 50000, unit: 'project' },
      { name: 'Board Governance', price: 5000, unit: 'quarter' },
    ]
  },
  {
    id: 'hr-consulting',
    name: 'HR Consulting',
    icon: Users,
    color: 'from-amber-500 to-amber-600',
    description: 'Talent acquisition, compensation, culture transformation. SHRM certified.',
    products: [
      { name: 'Executive Search', price: 45000, unit: 'placement' },
      { name: 'Compensation Study', price: 18000, unit: 'study' },
      { name: 'Leadership Training', price: 8000, unit: 'day' },
      { name: 'Culture Assessment', price: 12000, unit: 'project' },
      { name: 'HR Tech Implementation', price: 25000, unit: 'project' },
      { name: 'Policy Handbook', price: 6500, unit: 'handbook' },
    ]
  },
  {
    id: 'logistics',
    name: 'Express Logistics',
    icon: Truck,
    color: 'from-red-500 to-red-600',
    description: 'Same-day delivery, freight, warehousing. Nationwide coverage.',
    products: [
      { name: 'Same-Day Metro', price: 89, unit: 'delivery' },
      { name: 'Next-Day National', price: 149, unit: 'delivery' },
      { name: 'Freight LTL', price: 450, unit: 'pallet' },
      { name: 'Warehouse Storage', price: 125, unit: 'pallet/mo' },
      { name: 'White Glove Setup', price: 299, unit: 'delivery' },
      { name: 'International Air', price: 1200, unit: 'shipment' },
    ]
  },
  {
    id: 'utilities',
    name: 'Smart Utilities',
    icon: Zap,
    color: 'from-yellow-500 to-yellow-600',
    description: 'Energy management, solar, EV charging. Carbon neutral options.',
    products: [
      { name: 'Energy Audit', price: 3500, unit: 'building' },
      { name: 'Solar Installation', price: 75000, unit: 'project' },
      { name: 'EV Charger (Level 2)', price: 2500, unit: 'station' },
      { name: 'LED Retrofit', price: 15000, unit: 'floor' },
      { name: 'Smart Thermostat', price: 499, unit: 'unit' },
      { name: 'Carbon Offset', price: 25, unit: 'ton' },
    ]
  },
  // Meat & Seafood Suppliers
  {
    id: 'sysco-meat',
    name: 'Sysco Meat & Seafood',
    icon: Beef,
    color: 'from-rose-600 to-rose-700',
    description: 'Sysco Meat & Seafood - Premium protein supplier serving nationwide. Specializing in USDA Choice/Prime beef, fresh poultry, and sustainable seafood.',
    products: [
      { name: 'USDA Prime Ribeye (Case)', price: 489, unit: 'case' },
      { name: 'USDA Choice Strip Loin', price: 329, unit: 'case' },
      { name: 'Ground Beef 80/20 (40lb)', price: 189, unit: 'case' },
      { name: 'Boneless Chicken Breast', price: 145, unit: 'case' },
      { name: 'Pork Tenderloin', price: 167, unit: 'case' },
      { name: 'Atlantic Salmon Fillet', price: 289, unit: 'case' },
      { name: 'Gulf Shrimp 16/20', price: 245, unit: 'case' },
      { name: 'Sea Scallops U/10', price: 389, unit: 'case' },
      { name: 'Lamb Rack Frenched', price: 445, unit: 'case' },
      { name: 'Bacon Slab (15lb)', price: 98, unit: 'case' },
    ]
  },
  {
    id: 'usfoods-protein',
    name: 'US Foods Protein Division',
    icon: Beef,
    color: 'from-red-600 to-red-700',
    description: 'US Foods Protein Division - Premium meat supplier serving restaurants and institutions. Specializing in certified Angus beef, heritage pork, and artisan cuts.',
    products: [
      { name: 'Certified Angus Tenderloin', price: 567, unit: 'case' },
      { name: 'Wagyu Beef Burger Patties', price: 234, unit: 'case' },
      { name: 'Heritage Berkshire Pork Chop', price: 278, unit: 'case' },
      { name: 'Free Range Chicken Wings', price: 156, unit: 'case' },
      { name: 'Veal Osso Buco', price: 345, unit: 'case' },
      { name: 'Duck Breast Magret', price: 289, unit: 'case' },
      { name: 'Beef Short Ribs', price: 234, unit: 'case' },
      { name: 'Italian Sausage Links', price: 145, unit: 'case' },
      { name: 'Turkey Breast Skin-On', price: 189, unit: 'case' },
      { name: 'Brisket Point Cut', price: 267, unit: 'case' },
    ]
  },
  {
    id: 'pfg-meat',
    name: 'Performance Food Group - Meat',
    icon: Beef,
    color: 'from-orange-600 to-orange-700',
    description: 'Performance Food Group - Premium meat supplier serving the Southeast. Specializing in portion-controlled cuts, marinated proteins, and value-added meats.',
    products: [
      { name: 'Portioned Filet Mignon 8oz', price: 445, unit: 'case' },
      { name: 'Marinated Fajita Strips', price: 178, unit: 'case' },
      { name: 'Pre-Seasoned Pulled Pork', price: 156, unit: 'case' },
      { name: 'Breaded Chicken Cutlets', price: 134, unit: 'case' },
      { name: 'Beef Kabob Cubes', price: 267, unit: 'case' },
      { name: 'Smoked Ham Steaks', price: 145, unit: 'case' },
      { name: 'BBQ Pork Ribs Rack', price: 198, unit: 'case' },
      { name: 'Turkey Meatballs', price: 123, unit: 'case' },
      { name: 'Corned Beef Brisket', price: 234, unit: 'case' },
      { name: 'Beef Philly Steak Sliced', price: 289, unit: 'case' },
    ]
  },
  {
    id: 'samuels-seafood',
    name: 'Samuels Seafood',
    icon: Fish,
    color: 'from-blue-600 to-blue-700',
    description: 'Samuels Seafood - Premium seafood supplier serving the Mid-Atlantic. Specializing in wild-caught fish, live shellfish, and sushi-grade products.',
    products: [
      { name: 'Wild Alaskan Halibut', price: 456, unit: 'case' },
      { name: 'Live Maine Lobster (1.5lb)', price: 34, unit: 'each' },
      { name: 'Sushi-Grade Ahi Tuna', price: 389, unit: 'case' },
      { name: 'Jumbo Lump Crab Meat', price: 567, unit: 'case' },
      { name: 'Oysters Blue Point (100ct)', price: 145, unit: 'case' },
      { name: 'Chilean Sea Bass Fillet', price: 489, unit: 'case' },
      { name: 'Littleneck Clams (500ct)', price: 178, unit: 'case' },
      { name: 'Black Cod Miso-Ready', price: 345, unit: 'case' },
      { name: 'PEI Mussels (10lb)', price: 67, unit: 'bag' },
      { name: 'Soft Shell Crabs (Dz)', price: 89, unit: 'dozen' },
    ]
  },
  {
    id: 'inland-market',
    name: 'Inland Market',
    icon: Beef,
    color: 'from-amber-600 to-amber-700',
    description: 'Inland Market - Premium protein supplier serving the Midwest. Specializing in farm-to-table beef, locally sourced pork, and specialty game meats.',
    products: [
      { name: 'Grass-Fed Ribeye Steak', price: 398, unit: 'case' },
      { name: 'Pasture-Raised Pork Belly', price: 234, unit: 'case' },
      { name: 'Farm Fresh Whole Chicken', price: 167, unit: 'case' },
      { name: 'Venison Loin Medallions', price: 445, unit: 'case' },
      { name: 'Bison Ground (5lb)', price: 89, unit: 'pack' },
      { name: 'Elk Tenderloin', price: 389, unit: 'case' },
      { name: 'Wild Boar Sausage', price: 198, unit: 'case' },
      { name: 'Rabbit Whole Fryer', price: 145, unit: 'case' },
      { name: 'Quail Semi-Boneless', price: 178, unit: 'case' },
      { name: 'Goat Leg Bone-In', price: 234, unit: 'case' },
    ]
  },
  {
    id: 'true-world-foods',
    name: 'True World Foods',
    icon: Fish,
    color: 'from-cyan-600 to-cyan-700',
    description: 'True World Foods - Premium Japanese seafood supplier serving nationwide. Specializing in sushi-grade fish, uni, and authentic Japanese proteins.',
    products: [
      { name: 'Bluefin Tuna Akami', price: 678, unit: 'lb' },
      { name: 'Hokkaido Uni (Tray)', price: 156, unit: 'tray' },
      { name: 'Hamachi Fillet', price: 345, unit: 'case' },
      { name: 'Kinmedai Golden Eye', price: 289, unit: 'case' },
      { name: 'Ikura Salmon Roe', price: 234, unit: 'case' },
      { name: 'Tako Octopus Leg', price: 198, unit: 'case' },
      { name: 'A5 Wagyu Striploin', price: 890, unit: 'case' },
      { name: 'Unagi Kabayaki Eel', price: 267, unit: 'case' },
      { name: 'Madai Red Snapper', price: 234, unit: 'case' },
      { name: 'Hotate Scallop Sashimi', price: 178, unit: 'case' },
    ]
  },
  {
    id: 'high-liner-foods',
    name: 'High Liner Foods',
    icon: Fish,
    color: 'from-teal-600 to-teal-700',
    description: 'High Liner Foods - Premium frozen seafood supplier serving North America. Specializing in sustainable sourced fish, breaded products, and value-added seafood.',
    products: [
      { name: 'Beer Battered Cod Fillet', price: 156, unit: 'case' },
      { name: 'Panko Crusted Shrimp', price: 178, unit: 'case' },
      { name: 'Wild Pacific Pollock', price: 134, unit: 'case' },
      { name: 'Coconut Crusted Tilapia', price: 145, unit: 'case' },
      { name: 'Haddock Loins', price: 198, unit: 'case' },
      { name: 'Crab Cakes Premium', price: 234, unit: 'case' },
      { name: 'Calamari Rings & Tentacles', price: 167, unit: 'case' },
      { name: 'Stuffed Sole Florentine', price: 189, unit: 'case' },
      { name: 'Salmon Burger Patties', price: 145, unit: 'case' },
      { name: 'Lobster Mac & Cheese', price: 267, unit: 'case' },
    ]
  },
  {
    id: 'trident-seafoods',
    name: 'Trident Seafoods',
    icon: Fish,
    color: 'from-indigo-600 to-indigo-700',
    description: 'Trident Seafoods - Premium Alaskan seafood supplier serving worldwide. Specializing in wild Alaska salmon, crab, and sustainably harvested seafood.',
    products: [
      { name: 'Wild Alaska Sockeye Salmon', price: 345, unit: 'case' },
      { name: 'King Crab Legs (10lb)', price: 567, unit: 'box' },
      { name: 'Snow Crab Clusters', price: 389, unit: 'case' },
      { name: 'Wild Alaska Pollock Fillet', price: 145, unit: 'case' },
      { name: 'Copper River Salmon', price: 489, unit: 'case' },
      { name: 'Dungeness Crab Whole', price: 234, unit: 'case' },
      { name: 'Alaska Cod Loins', price: 178, unit: 'case' },
      { name: 'Pink Salmon Portions', price: 134, unit: 'case' },
      { name: 'Surimi Crab Flake', price: 98, unit: 'case' },
      { name: 'Smoked Salmon Sliced', price: 267, unit: 'case' },
    ]
  },
]

export default function SupplierDemo() {
  const [selectedSupplier, setSelectedSupplier] = useState<typeof suppliers[0] | null>(null)
  const [cart, setCart] = useState<{[key: string]: number}>({})

  const addToCart = (productName: string) => {
    setCart(prev => ({
      ...prev,
      [productName]: (prev[productName] || 0) + 1
    }))
  }

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-700" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                Supplier Marketplace
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                <ShoppingCart className="w-6 h-6" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            The App Store for
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent"> Enterprise Procurement</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
            Browse verified suppliers, compare pricing, and procure with one click.
            All your vendors, unified in one intelligent marketplace.
          </p>
        </div>
      </section>

      {/* Supplier Grid */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {suppliers.map((supplier) => {
              const Icon = supplier.icon
              return (
                <div
                  key={supplier.id}
                  className="group bg-gray-800/50 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 hover:bg-gray-800/80 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20"
                >
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${supplier.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Name */}
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {supplier.name}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                    {supplier.description}
                  </p>

                  {/* Products count */}
                  <p className="text-xs text-gray-500 mb-4">
                    {supplier.products.length} products available
                  </p>

                  {/* Button */}
                  <button
                    onClick={() => setSelectedSupplier(supplier)}
                    className={`w-full py-3 px-4 rounded-xl bg-gradient-to-r ${supplier.color} text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
                  >
                    Browse Catalog
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Product Modal */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedSupplier(null)}
          />

          {/* Modal */}
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${selectedSupplier.color} flex items-center justify-center`}>
                  <selectedSupplier.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedSupplier.name}</h3>
                  <p className="text-sm text-gray-400">Product Catalog</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product List */}
            <div className="overflow-y-auto max-h-[calc(80vh-100px)] p-6">
              <div className="space-y-4">
                {selectedSupplier.products.map((product, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{product.name}</h4>
                      <p className="text-sm text-gray-400">
                        ${product.price.toLocaleString()} / {product.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addToCart(`${selectedSupplier.id}-${product.name}`)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Add
                      </button>
                      <button className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Quote
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Supplier Description */}
              <div className="mt-6 p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <p className="text-sm text-gray-400">
                  <span className="font-medium text-gray-300">About:</span> {selectedSupplier.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-gray-500">
            Wells AI Supplier Marketplace Demo • Built for Fortune 500 CPOs
          </p>
        </div>
      </footer>
    </div>
  )
}
