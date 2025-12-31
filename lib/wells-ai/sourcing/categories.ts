/**
 * Wells AI Sourcing Categories & Schema
 *
 * Hierarchical category taxonomy for buyer sourcing requests.
 * Includes common specs per category and matching criteria weights.
 */

// ============================================================================
// CATEGORY TAXONOMY
// ============================================================================

export interface CategorySpec {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean';
  options?: string[];
  unit?: string;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
}

export interface SubCategory {
  id: string;
  name: string;
  icon: string;
  specs: CategorySpec[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories: SubCategory[];
  defaultSpecs: CategorySpec[]; // Specs that apply to all subcategories
}

// Common specs that apply across many categories
export const COMMON_SPECS: CategorySpec[] = [
  {
    id: 'quantity',
    label: 'Quantity Needed',
    type: 'number',
    placeholder: '1000',
    required: true,
    helperText: 'Approximate quantity for initial order'
  },
  {
    id: 'unit',
    label: 'Unit of Measure',
    type: 'select',
    options: ['units', 'kg', 'lbs', 'liters', 'gallons', 'pallets', 'containers', 'cases', 'boxes'],
    required: true
  },
  {
    id: 'frequency',
    label: 'Order Frequency',
    type: 'select',
    options: ['one-time', 'weekly', 'monthly', 'quarterly', 'annually', 'as-needed'],
    required: true
  },
  {
    id: 'budget_min',
    label: 'Budget Min ($)',
    type: 'number',
    placeholder: '10000',
    helperText: 'Your minimum expected spend'
  },
  {
    id: 'budget_max',
    label: 'Budget Max ($)',
    type: 'number',
    placeholder: '50000',
    helperText: 'Your maximum expected spend'
  },
  {
    id: 'delivery_location',
    label: 'Delivery Location',
    type: 'text',
    placeholder: 'City, State or Full Address',
    required: true
  },
  {
    id: 'required_certifications',
    label: 'Required Certifications',
    type: 'multiselect',
    options: ['ISO9001', 'ISO14001', 'FDA', 'USDA', 'CE', 'UL', 'NSF', 'Organic', 'Fair Trade', 'Kosher', 'Halal', 'None Required']
  }
];

// Full category taxonomy
export const SOURCING_CATEGORIES: Category[] = [
  {
    id: 'raw_materials',
    name: 'Raw Materials',
    icon: '🪨',
    description: 'Metals, plastics, chemicals, and other raw inputs',
    defaultSpecs: [
      { id: 'grade', label: 'Grade/Quality', type: 'text', placeholder: 'e.g., 304 Stainless, Food Grade' },
      { id: 'origin_preference', label: 'Origin Preference', type: 'select', options: ['USA Only', 'North America', 'Any', 'Specific Country'] }
    ],
    subcategories: [
      {
        id: 'metals',
        name: 'Metals & Alloys',
        icon: '🔩',
        specs: [
          { id: 'metal_type', label: 'Metal Type', type: 'select', options: ['Steel', 'Aluminum', 'Copper', 'Brass', 'Titanium', 'Other'] },
          { id: 'form', label: 'Form', type: 'select', options: ['Sheet', 'Coil', 'Bar', 'Wire', 'Tube', 'Plate', 'Custom'] },
          { id: 'thickness', label: 'Thickness/Gauge', type: 'text', placeholder: 'e.g., 18 gauge, 0.5mm' }
        ]
      },
      {
        id: 'plastics',
        name: 'Plastics & Polymers',
        icon: '🧪',
        specs: [
          { id: 'plastic_type', label: 'Plastic Type', type: 'select', options: ['HDPE', 'LDPE', 'PP', 'PET', 'PVC', 'ABS', 'Nylon', 'Other'] },
          { id: 'form', label: 'Form', type: 'select', options: ['Pellets', 'Sheet', 'Film', 'Tube', 'Custom'] },
          { id: 'color', label: 'Color', type: 'text', placeholder: 'Natural, Custom Pantone, etc.' }
        ]
      },
      {
        id: 'chemicals',
        name: 'Chemicals & Compounds',
        icon: '⚗️',
        specs: [
          { id: 'chemical_name', label: 'Chemical Name/CAS', type: 'text', placeholder: 'Chemical name or CAS number', required: true },
          { id: 'purity', label: 'Purity Required', type: 'text', placeholder: 'e.g., 99.5%' },
          { id: 'hazmat', label: 'Hazardous Material?', type: 'boolean' }
        ]
      },
      {
        id: 'textiles',
        name: 'Textiles & Fabrics',
        icon: '🧵',
        specs: [
          { id: 'fabric_type', label: 'Fabric Type', type: 'select', options: ['Cotton', 'Polyester', 'Nylon', 'Wool', 'Silk', 'Blend', 'Technical'] },
          { id: 'weight', label: 'Weight (GSM)', type: 'number', placeholder: '150' },
          { id: 'width', label: 'Width', type: 'text', placeholder: '60 inches' }
        ]
      }
    ]
  },
  {
    id: 'packaging',
    name: 'Packaging',
    icon: '📦',
    description: 'Boxes, containers, labels, and packaging materials',
    defaultSpecs: [
      { id: 'custom_print', label: 'Custom Printing?', type: 'boolean' },
      { id: 'sustainable', label: 'Sustainable/Eco-Friendly?', type: 'boolean' }
    ],
    subcategories: [
      {
        id: 'boxes',
        name: 'Boxes & Cartons',
        icon: '📦',
        specs: [
          { id: 'box_type', label: 'Box Type', type: 'select', options: ['Corrugated', 'Folding Carton', 'Rigid', 'Mailer', 'Custom'] },
          { id: 'dimensions', label: 'Dimensions (LxWxH)', type: 'text', placeholder: '12x8x6 inches' },
          { id: 'flute', label: 'Flute/Board Type', type: 'text', placeholder: 'B-flute, E-flute, etc.' }
        ]
      },
      {
        id: 'containers',
        name: 'Bottles & Containers',
        icon: '🫙',
        specs: [
          { id: 'material', label: 'Material', type: 'select', options: ['Glass', 'PET', 'HDPE', 'Aluminum', 'Steel'] },
          { id: 'volume', label: 'Volume', type: 'text', placeholder: '500ml, 16oz, etc.' },
          { id: 'closure_type', label: 'Closure Type', type: 'text', placeholder: 'Screw cap, pump, spray, etc.' }
        ]
      },
      {
        id: 'labels',
        name: 'Labels & Tags',
        icon: '🏷️',
        specs: [
          { id: 'label_type', label: 'Label Type', type: 'select', options: ['Pressure Sensitive', 'Shrink Sleeve', 'In-Mold', 'Hang Tag', 'RFID'] },
          { id: 'size', label: 'Size', type: 'text', placeholder: '4x6 inches' },
          { id: 'finish', label: 'Finish', type: 'select', options: ['Matte', 'Gloss', 'Satin', 'Metallic', 'Holographic'] }
        ]
      },
      {
        id: 'flexible',
        name: 'Flexible Packaging',
        icon: '🛍️',
        specs: [
          { id: 'type', label: 'Type', type: 'select', options: ['Pouches', 'Bags', 'Wrap', 'Sachets', 'Blister'] },
          { id: 'barrier', label: 'Barrier Requirements', type: 'text', placeholder: 'Moisture, oxygen, UV, etc.' },
          { id: 'resealable', label: 'Resealable?', type: 'boolean' }
        ]
      }
    ]
  },
  {
    id: 'components',
    name: 'Components & Parts',
    icon: '⚙️',
    description: 'Electronic, mechanical, and manufactured components',
    defaultSpecs: [
      { id: 'tolerance', label: 'Tolerance Required', type: 'text', placeholder: '+/- 0.001"' },
      { id: 'testing_required', label: 'Testing/Inspection Required', type: 'text' }
    ],
    subcategories: [
      {
        id: 'electronics',
        name: 'Electronic Components',
        icon: '🔌',
        specs: [
          { id: 'component_type', label: 'Component Type', type: 'select', options: ['PCB', 'Semiconductor', 'Capacitor', 'Resistor', 'Connector', 'Display', 'Sensor', 'Other'] },
          { id: 'part_number', label: 'Part Number (if known)', type: 'text', placeholder: 'Manufacturer part number' },
          { id: 'rohs', label: 'RoHS Compliant?', type: 'boolean' }
        ]
      },
      {
        id: 'mechanical',
        name: 'Mechanical Parts',
        icon: '🔧',
        specs: [
          { id: 'part_type', label: 'Part Type', type: 'select', options: ['Gears', 'Bearings', 'Fasteners', 'Springs', 'Shafts', 'Housings', 'Custom'] },
          { id: 'material', label: 'Material', type: 'text', placeholder: 'Steel, Aluminum, Plastic, etc.' },
          { id: 'drawing', label: 'Have Engineering Drawing?', type: 'boolean' }
        ]
      },
      {
        id: 'motors',
        name: 'Motors & Drives',
        icon: '⚡',
        specs: [
          { id: 'motor_type', label: 'Motor Type', type: 'select', options: ['AC', 'DC', 'Servo', 'Stepper', 'BLDC', 'Gearmotor'] },
          { id: 'power', label: 'Power Rating', type: 'text', placeholder: '1HP, 500W, etc.' },
          { id: 'voltage', label: 'Voltage', type: 'text', placeholder: '120V, 220V, 24VDC, etc.' }
        ]
      },
      {
        id: 'hydraulics',
        name: 'Hydraulics & Pneumatics',
        icon: '💧',
        specs: [
          { id: 'type', label: 'Type', type: 'select', options: ['Cylinder', 'Pump', 'Valve', 'Hose', 'Fitting', 'Actuator'] },
          { id: 'pressure', label: 'Pressure Rating', type: 'text', placeholder: 'PSI or Bar' },
          { id: 'flow', label: 'Flow Rate', type: 'text', placeholder: 'GPM or L/min' }
        ]
      }
    ]
  },
  {
    id: 'equipment',
    name: 'Equipment & Machinery',
    icon: '🏭',
    description: 'Industrial equipment, machinery, and tools',
    defaultSpecs: [
      { id: 'new_or_used', label: 'New or Used', type: 'select', options: ['New Only', 'Refurbished OK', 'Used OK'] },
      { id: 'warranty_needed', label: 'Warranty Required?', type: 'boolean' },
      { id: 'installation', label: 'Installation Needed?', type: 'boolean' }
    ],
    subcategories: [
      {
        id: 'manufacturing',
        name: 'Manufacturing Equipment',
        icon: '🏭',
        specs: [
          { id: 'equipment_type', label: 'Equipment Type', type: 'text', placeholder: 'CNC, Press, Extruder, etc.' },
          { id: 'capacity', label: 'Capacity/Size', type: 'text', placeholder: 'Tonnage, bed size, etc.' },
          { id: 'automation', label: 'Automation Level', type: 'select', options: ['Manual', 'Semi-Auto', 'Fully Automatic'] }
        ]
      },
      {
        id: 'material_handling',
        name: 'Material Handling',
        icon: '🏗️',
        specs: [
          { id: 'type', label: 'Type', type: 'select', options: ['Forklift', 'Conveyor', 'Crane', 'Pallet Jack', 'Lift Table', 'AGV'] },
          { id: 'capacity', label: 'Capacity', type: 'text', placeholder: 'Weight capacity' },
          { id: 'power', label: 'Power Source', type: 'select', options: ['Electric', 'Propane', 'Diesel', 'Manual'] }
        ]
      },
      {
        id: 'testing',
        name: 'Testing & Inspection',
        icon: '🔬',
        specs: [
          { id: 'test_type', label: 'Test Type', type: 'text', placeholder: 'CMM, NDT, Tensile, etc.' },
          { id: 'accuracy', label: 'Accuracy Required', type: 'text' },
          { id: 'sample_size', label: 'Sample Size', type: 'text' }
        ]
      }
    ]
  },
  {
    id: 'logistics',
    name: 'Logistics & Freight',
    icon: '🚚',
    description: 'Shipping, warehousing, and fulfillment services',
    defaultSpecs: [
      { id: 'origin', label: 'Origin Location', type: 'text', required: true },
      { id: 'destination', label: 'Destination Location', type: 'text', required: true }
    ],
    subcategories: [
      {
        id: 'freight',
        name: 'Freight & Shipping',
        icon: '🚛',
        specs: [
          { id: 'mode', label: 'Transport Mode', type: 'select', options: ['Truckload (TL)', 'Less Than Truckload (LTL)', 'Rail', 'Air', 'Ocean', 'Intermodal'] },
          { id: 'weight', label: 'Weight', type: 'text', placeholder: 'Total weight (lbs or kg)' },
          { id: 'dimensions', label: 'Dimensions', type: 'text', placeholder: 'LxWxH or # of pallets' },
          { id: 'hazmat', label: 'Hazmat?', type: 'boolean' }
        ]
      },
      {
        id: 'warehousing',
        name: 'Warehousing & Storage',
        icon: '🏢',
        specs: [
          { id: 'space_needed', label: 'Space Needed (sq ft)', type: 'number' },
          { id: 'storage_type', label: 'Storage Type', type: 'select', options: ['Dry', 'Climate Controlled', 'Cold Storage', 'Freezer', 'Hazmat'] },
          { id: 'duration', label: 'Duration', type: 'select', options: ['Short-term', '3-6 months', '6-12 months', '1+ year'] }
        ]
      },
      {
        id: 'fulfillment',
        name: '3PL & Fulfillment',
        icon: '📬',
        specs: [
          { id: 'order_volume', label: 'Monthly Order Volume', type: 'number' },
          { id: 'sku_count', label: 'SKU Count', type: 'number' },
          { id: 'integration', label: 'Integration Needed', type: 'text', placeholder: 'Shopify, WooCommerce, etc.' }
        ]
      }
    ]
  },
  {
    id: 'services',
    name: 'Manufacturing Services',
    icon: '🔨',
    description: 'Contract manufacturing, finishing, and specialty services',
    defaultSpecs: [
      { id: 'volume', label: 'Volume/Batch Size', type: 'text' },
      { id: 'lead_time_target', label: 'Target Lead Time', type: 'text', placeholder: 'e.g., 2 weeks' }
    ],
    subcategories: [
      {
        id: 'machining',
        name: 'CNC Machining',
        icon: '🔧',
        specs: [
          { id: 'process', label: 'Process', type: 'multiselect', options: ['Milling', 'Turning', 'EDM', 'Grinding', 'Swiss'] },
          { id: 'material', label: 'Material', type: 'text' },
          { id: 'complexity', label: 'Part Complexity', type: 'select', options: ['Simple', 'Medium', 'Complex', 'Very Complex'] }
        ]
      },
      {
        id: 'molding',
        name: 'Injection Molding',
        icon: '🧊',
        specs: [
          { id: 'material', label: 'Material', type: 'text', placeholder: 'ABS, PP, Nylon, etc.' },
          { id: 'tooling', label: 'Tooling Status', type: 'select', options: ['Need New Tool', 'Have Tool', 'Modify Existing'] },
          { id: 'annual_volume', label: 'Annual Volume', type: 'number' }
        ]
      },
      {
        id: 'finishing',
        name: 'Surface Finishing',
        icon: '✨',
        specs: [
          { id: 'finish_type', label: 'Finish Type', type: 'multiselect', options: ['Painting', 'Powder Coating', 'Plating', 'Anodizing', 'Polishing', 'Passivation'] },
          { id: 'substrate', label: 'Substrate Material', type: 'text' },
          { id: 'color', label: 'Color/Spec', type: 'text' }
        ]
      },
      {
        id: 'assembly',
        name: 'Assembly & Kitting',
        icon: '🔗',
        specs: [
          { id: 'components', label: 'Number of Components', type: 'number' },
          { id: 'complexity', label: 'Assembly Complexity', type: 'select', options: ['Simple', 'Medium', 'Complex'] },
          { id: 'testing', label: 'Testing Required?', type: 'boolean' }
        ]
      }
    ]
  },
  {
    id: 'food_ingredients',
    name: 'Food & Ingredients',
    icon: '🌾',
    description: 'Food ingredients, flavors, and agricultural products',
    defaultSpecs: [
      { id: 'organic', label: 'Organic Required?', type: 'boolean' },
      { id: 'non_gmo', label: 'Non-GMO Required?', type: 'boolean' },
      { id: 'allergen_free', label: 'Allergen Free Requirements', type: 'text' }
    ],
    subcategories: [
      {
        id: 'ingredients',
        name: 'Ingredients',
        icon: '🧂',
        specs: [
          { id: 'ingredient_type', label: 'Ingredient Type', type: 'text', required: true },
          { id: 'grade', label: 'Grade', type: 'select', options: ['Food Grade', 'Pharmaceutical Grade', 'Industrial'] },
          { id: 'shelf_life', label: 'Min Shelf Life Needed', type: 'text' }
        ]
      },
      {
        id: 'flavors',
        name: 'Flavors & Extracts',
        icon: '🍋',
        specs: [
          { id: 'flavor_type', label: 'Flavor Type', type: 'text' },
          { id: 'natural_or_artificial', label: 'Natural/Artificial', type: 'select', options: ['Natural Only', 'Natural Preferred', 'Artificial OK'] },
          { id: 'application', label: 'Application', type: 'text', placeholder: 'Beverage, baked goods, etc.' }
        ]
      },
      {
        id: 'commodities',
        name: 'Agricultural Commodities',
        icon: '🌽',
        specs: [
          { id: 'commodity', label: 'Commodity', type: 'text', required: true },
          { id: 'origin', label: 'Origin', type: 'text' },
          { id: 'grade', label: 'Grade/Quality', type: 'text' }
        ]
      }
    ]
  },
  {
    id: 'other',
    name: 'Other',
    icon: '📋',
    description: 'Custom or specialty sourcing needs',
    defaultSpecs: [],
    subcategories: [
      {
        id: 'custom',
        name: 'Custom Request',
        icon: '✍️',
        specs: [
          { id: 'detailed_description', label: 'Detailed Description', type: 'text', required: true, helperText: 'Describe what you need in detail' }
        ]
      }
    ]
  }
];

// ============================================================================
// MATCHING CRITERIA WEIGHTS
// ============================================================================

export interface MatchingWeight {
  criterion: string;
  weight: number; // 0-100
  description: string;
}

export const MATCHING_WEIGHTS: MatchingWeight[] = [
  { criterion: 'product_match', weight: 30, description: 'How well the supplier products match the request category' },
  { criterion: 'capacity', weight: 20, description: 'Whether supplier has capacity to fulfill the order' },
  { criterion: 'certifications', weight: 15, description: 'Supplier has required certifications' },
  { criterion: 'lead_time', weight: 15, description: 'Supplier lead time meets the timeline requirements' },
  { criterion: 'location', weight: 10, description: 'Supplier can deliver to the required location' },
  { criterion: 'price_range', weight: 10, description: 'Supplier typically operates in the budget range' }
];

// GRAIN bonus for suppliers using Wells payment rails
export const GRAIN_ENABLED_BONUS = 15; // +15% match score for GRAIN-enabled suppliers

// ============================================================================
// URGENCY / TIMELINE OPTIONS
// ============================================================================

export type SourcingUrgency = 'urgent' | 'standard' | 'future' | 'ongoing';

export const URGENCY_OPTIONS: { value: SourcingUrgency; label: string; description: string; days: number }[] = [
  { value: 'urgent', label: 'Urgent', description: 'Need quotes within 24-48 hours', days: 2 },
  { value: 'standard', label: 'Standard', description: 'Within 1-2 weeks is fine', days: 14 },
  { value: 'future', label: 'Future Need', description: 'Planning for 30+ days out', days: 30 },
  { value: 'ongoing', label: 'Ongoing Supply', description: 'Looking for a long-term supplier', days: 90 }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getCategoryById(categoryId: string): Category | undefined {
  return SOURCING_CATEGORIES.find(c => c.id === categoryId);
}

export function getSubcategoryById(categoryId: string, subcategoryId: string): SubCategory | undefined {
  const category = getCategoryById(categoryId);
  return category?.subcategories.find(s => s.id === subcategoryId);
}

export function getAllSpecs(categoryId: string, subcategoryId: string): CategorySpec[] {
  const category = getCategoryById(categoryId);
  const subcategory = getSubcategoryById(categoryId, subcategoryId);

  if (!category || !subcategory) return COMMON_SPECS;

  return [...COMMON_SPECS, ...category.defaultSpecs, ...subcategory.specs];
}

export function flattenCategories(): { id: string; name: string; parentId: string; parentName: string }[] {
  const result: { id: string; name: string; parentId: string; parentName: string }[] = [];

  for (const category of SOURCING_CATEGORIES) {
    for (const subcategory of category.subcategories) {
      result.push({
        id: subcategory.id,
        name: subcategory.name,
        parentId: category.id,
        parentName: category.name
      });
    }
  }

  return result;
}

// ============================================================================
// REQUEST STATUS
// ============================================================================

export type SourcingRequestStatus =
  | 'draft'
  | 'submitted'
  | 'matching'
  | 'matched'
  | 'in_review'
  | 'quoted'
  | 'negotiating'
  | 'deal_closed'
  | 'cancelled';

export const REQUEST_STATUS_CONFIG: Record<SourcingRequestStatus, { label: string; color: string; description: string }> = {
  draft: { label: 'Draft', color: 'gray', description: 'Not yet submitted' },
  submitted: { label: 'Submitted', color: 'blue', description: 'Waiting for AI matching' },
  matching: { label: 'Finding Matches', color: 'indigo', description: 'AI is analyzing suppliers' },
  matched: { label: 'Matches Found', color: 'purple', description: 'Review your matched suppliers' },
  in_review: { label: 'Reviewing', color: 'yellow', description: 'You are reviewing suppliers' },
  quoted: { label: 'Quotes Received', color: 'orange', description: 'Suppliers have sent quotes' },
  negotiating: { label: 'Negotiating', color: 'cyan', description: 'In active negotiation' },
  deal_closed: { label: 'Deal Closed', color: 'green', description: 'Transaction complete' },
  cancelled: { label: 'Cancelled', color: 'red', description: 'Request was cancelled' }
};

// ============================================================================
// MATCH STATUS
// ============================================================================

export type MatchStatus =
  | 'pending'
  | 'interested'
  | 'declined'
  | 'intro_requested'
  | 'intro_sent'
  | 'in_negotiation'
  | 'quote_received'
  | 'won'
  | 'lost';

export const MATCH_STATUS_CONFIG: Record<MatchStatus, { label: string; color: string }> = {
  pending: { label: 'Pending Review', color: 'gray' },
  interested: { label: 'Interested', color: 'blue' },
  declined: { label: 'Declined', color: 'red' },
  intro_requested: { label: 'Intro Requested', color: 'yellow' },
  intro_sent: { label: 'Intro Sent', color: 'indigo' },
  in_negotiation: { label: 'In Negotiation', color: 'purple' },
  quote_received: { label: 'Quote Received', color: 'orange' },
  won: { label: 'Won', color: 'green' },
  lost: { label: 'Lost', color: 'gray' }
};
