/**
 * Grain & Vault Country Configuration
 *
 * Supported countries with KYC requirements, ID types, and compliance rules.
 *
 * SANCTIONED COUNTRIES ARE BLOCKED AT THE APPLICATION LEVEL.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CountryConfig {
  code: string                    // ISO 3166-1 alpha-2
  name: string
  currency: string                // Local currency code
  flag: string                    // Emoji flag
  enabled: boolean

  // KYC Requirements
  kyc: {
    requiresNationalId: boolean
    requiresTaxId: boolean
    requiresProofOfAddress: boolean
    requiresSourceOfFunds: boolean
    minAge: number
  }

  // Accepted ID Types
  acceptedIdTypes: IdType[]

  // Tax ID Configuration
  taxId: {
    name: string                  // e.g., "SSN", "SIN", "CURP", "NI Number"
    format: string                // Regex pattern
    example: string
    required: boolean
  } | null

  // Phone Format
  phone: {
    prefix: string
    format: string
    example: string
  }

  // Address Format
  address: {
    hasState: boolean
    stateLabel: string            // "State", "Province", "Prefecture", "Emirate"
    postalCodeLabel: string       // "ZIP Code", "Postal Code", "Postcode"
    postalCodeFormat: string      // Regex
  }

  // Limits (in USD equivalent)
  limits: {
    level1Daily: number
    level2Daily: number
    level3Daily: number
  }
}

export type IdType =
  | 'passport'
  | 'drivers_license'
  | 'national_id'
  | 'state_id'
  | 'residence_card'
  | 'military_id'
  | 'my_number_card'        // Japan
  | 'emirates_id'           // UAE
  | 'nric'                  // Singapore
  | 'dni'                   // Argentina
  | 'ine'                   // Mexico

// ============================================================================
// SUPPORTED COUNTRIES
// ============================================================================

export const SUPPORTED_COUNTRIES: Record<string, CountryConfig> = {
  US: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    flag: '🇺🇸',
    enabled: true,
    kyc: {
      requiresNationalId: false,
      requiresTaxId: true,
      requiresProofOfAddress: true,
      requiresSourceOfFunds: true,
      minAge: 18
    },
    acceptedIdTypes: ['passport', 'drivers_license', 'state_id', 'military_id'],
    taxId: {
      name: 'SSN (Last 4)',
      format: '^\\d{4}$',
      example: '1234',
      required: true
    },
    phone: {
      prefix: '+1',
      format: '^\\d{10}$',
      example: '(555) 123-4567'
    },
    address: {
      hasState: true,
      stateLabel: 'State',
      postalCodeLabel: 'ZIP Code',
      postalCodeFormat: '^\\d{5}(-\\d{4})?$'
    },
    limits: {
      level1Daily: 1000,
      level2Daily: 10000,
      level3Daily: 100000
    }
  },

  CA: {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    flag: '🇨🇦',
    enabled: true,
    kyc: {
      requiresNationalId: false,
      requiresTaxId: true,
      requiresProofOfAddress: true,
      requiresSourceOfFunds: true,
      minAge: 18
    },
    acceptedIdTypes: ['passport', 'drivers_license', 'national_id'],
    taxId: {
      name: 'SIN (Last 3)',
      format: '^\\d{3}$',
      example: '123',
      required: false
    },
    phone: {
      prefix: '+1',
      format: '^\\d{10}$',
      example: '(416) 555-1234'
    },
    address: {
      hasState: true,
      stateLabel: 'Province',
      postalCodeLabel: 'Postal Code',
      postalCodeFormat: '^[A-Za-z]\\d[A-Za-z][ -]?\\d[A-Za-z]\\d$'
    },
    limits: {
      level1Daily: 1000,
      level2Daily: 10000,
      level3Daily: 100000
    }
  },

  MX: {
    code: 'MX',
    name: 'Mexico',
    currency: 'MXN',
    flag: '🇲🇽',
    enabled: true,
    kyc: {
      requiresNationalId: true,
      requiresTaxId: true,
      requiresProofOfAddress: true,
      requiresSourceOfFunds: true,
      minAge: 18
    },
    acceptedIdTypes: ['passport', 'ine', 'national_id'],
    taxId: {
      name: 'CURP',
      format: '^[A-Z]{4}\\d{6}[HM][A-Z]{5}[A-Z0-9]\\d$',
      example: 'HEGG560427MVZRRL04',
      required: true
    },
    phone: {
      prefix: '+52',
      format: '^\\d{10}$',
      example: '55 1234 5678'
    },
    address: {
      hasState: true,
      stateLabel: 'Estado',
      postalCodeLabel: 'Código Postal',
      postalCodeFormat: '^\\d{5}$'
    },
    limits: {
      level1Daily: 1000,
      level2Daily: 10000,
      level3Daily: 100000
    }
  },

  AR: {
    code: 'AR',
    name: 'Argentina',
    currency: 'ARS',
    flag: '🇦🇷',
    enabled: true,
    kyc: {
      requiresNationalId: true,
      requiresTaxId: true,
      requiresProofOfAddress: true,
      requiresSourceOfFunds: true,
      minAge: 18
    },
    acceptedIdTypes: ['passport', 'dni', 'national_id'],
    taxId: {
      name: 'CUIT/CUIL',
      format: '^\\d{2}-\\d{8}-\\d{1}$',
      example: '20-12345678-9',
      required: true
    },
    phone: {
      prefix: '+54',
      format: '^\\d{10}$',
      example: '11 1234 5678'
    },
    address: {
      hasState: true,
      stateLabel: 'Provincia',
      postalCodeLabel: 'Código Postal',
      postalCodeFormat: '^[A-Z]\\d{4}[A-Z]{3}$'
    },
    limits: {
      level1Daily: 1000,
      level2Daily: 10000,
      level3Daily: 100000
    }
  },

  GB: {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    flag: '🇬🇧',
    enabled: true,
    kyc: {
      requiresNationalId: false,
      requiresTaxId: false,
      requiresProofOfAddress: true,
      requiresSourceOfFunds: true,
      minAge: 18
    },
    acceptedIdTypes: ['passport', 'drivers_license', 'residence_card'],
    taxId: {
      name: 'NI Number',
      format: '^[A-Z]{2}\\d{6}[A-Z]$',
      example: 'AB123456C',
      required: false
    },
    phone: {
      prefix: '+44',
      format: '^\\d{10,11}$',
      example: '7911 123456'
    },
    address: {
      hasState: false,
      stateLabel: 'County',
      postalCodeLabel: 'Postcode',
      postalCodeFormat: '^[A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}$'
    },
    limits: {
      level1Daily: 1000,
      level2Daily: 10000,
      level3Daily: 100000
    }
  },

  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    flag: '🇦🇪',
    enabled: true,
    kyc: {
      requiresNationalId: true,
      requiresTaxId: false,
      requiresProofOfAddress: true,
      requiresSourceOfFunds: true,
      minAge: 21
    },
    acceptedIdTypes: ['passport', 'emirates_id', 'residence_card'],
    taxId: null, // UAE has no income tax
    phone: {
      prefix: '+971',
      format: '^\\d{9}$',
      example: '50 123 4567'
    },
    address: {
      hasState: true,
      stateLabel: 'Emirate',
      postalCodeLabel: 'P.O. Box',
      postalCodeFormat: '^\\d{1,6}$'
    },
    limits: {
      level1Daily: 1000,
      level2Daily: 25000,  // Higher limits for UAE
      level3Daily: 250000
    }
  },

  JP: {
    code: 'JP',
    name: 'Japan',
    currency: 'JPY',
    flag: '🇯🇵',
    enabled: true,
    kyc: {
      requiresNationalId: true,
      requiresTaxId: false,
      requiresProofOfAddress: true,
      requiresSourceOfFunds: true,
      minAge: 20
    },
    acceptedIdTypes: ['passport', 'drivers_license', 'my_number_card', 'residence_card'],
    taxId: {
      name: 'My Number (Last 4)',
      format: '^\\d{4}$',
      example: '1234',
      required: false
    },
    phone: {
      prefix: '+81',
      format: '^\\d{10,11}$',
      example: '90 1234 5678'
    },
    address: {
      hasState: true,
      stateLabel: 'Prefecture',
      postalCodeLabel: 'Postal Code',
      postalCodeFormat: '^\\d{3}-\\d{4}$'
    },
    limits: {
      level1Daily: 1000,
      level2Daily: 10000,
      level3Daily: 100000
    }
  },

  SG: {
    code: 'SG',
    name: 'Singapore',
    currency: 'SGD',
    flag: '🇸🇬',
    enabled: true,
    kyc: {
      requiresNationalId: true,
      requiresTaxId: false,
      requiresProofOfAddress: true,
      requiresSourceOfFunds: true,
      minAge: 18
    },
    acceptedIdTypes: ['passport', 'nric', 'drivers_license'],
    taxId: {
      name: 'NRIC/FIN',
      format: '^[STFG]\\d{7}[A-Z]$',
      example: 'S1234567D',
      required: true
    },
    phone: {
      prefix: '+65',
      format: '^\\d{8}$',
      example: '9123 4567'
    },
    address: {
      hasState: false,
      stateLabel: 'District',
      postalCodeLabel: 'Postal Code',
      postalCodeFormat: '^\\d{6}$'
    },
    limits: {
      level1Daily: 1000,
      level2Daily: 20000,  // Higher limits for Singapore
      level3Daily: 200000
    }
  }
}

// ============================================================================
// SANCTIONED COUNTRIES (US OFAC + EU + UN)
// ============================================================================

export const SANCTIONED_COUNTRIES: string[] = [
  'CU',  // Cuba
  'IR',  // Iran
  'KP',  // North Korea
  'SY',  // Syria
  'RU',  // Russia (partial sanctions, blocking for simplicity)
  'BY',  // Belarus
  'VE',  // Venezuela (partial)
  'MM',  // Myanmar/Burma
  'SD',  // Sudan
  'SS',  // South Sudan
  'CF',  // Central African Republic
  'CD',  // Democratic Republic of Congo
  'LY',  // Libya
  'SO',  // Somalia
  'YE',  // Yemen
  'ZW',  // Zimbabwe
  'NI',  // Nicaragua
]

export const SANCTIONED_COUNTRY_NAMES: Record<string, string> = {
  CU: 'Cuba',
  IR: 'Iran',
  KP: 'North Korea',
  SY: 'Syria',
  RU: 'Russia',
  BY: 'Belarus',
  VE: 'Venezuela',
  MM: 'Myanmar',
  SD: 'Sudan',
  SS: 'South Sudan',
  CF: 'Central African Republic',
  CD: 'Democratic Republic of Congo',
  LY: 'Libya',
  SO: 'Somalia',
  YE: 'Yemen',
  ZW: 'Zimbabwe',
  NI: 'Nicaragua',
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a country is supported
 */
export function isCountrySupported(countryCode: string): boolean {
  return countryCode in SUPPORTED_COUNTRIES && SUPPORTED_COUNTRIES[countryCode].enabled
}

/**
 * Check if a country is sanctioned
 */
export function isCountrySanctioned(countryCode: string): boolean {
  return SANCTIONED_COUNTRIES.includes(countryCode.toUpperCase())
}

/**
 * Get country config
 */
export function getCountryConfig(countryCode: string): CountryConfig | null {
  return SUPPORTED_COUNTRIES[countryCode.toUpperCase()] || null
}

/**
 * Get all enabled countries for dropdown
 */
export function getEnabledCountries(): CountryConfig[] {
  return Object.values(SUPPORTED_COUNTRIES)
    .filter(c => c.enabled)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get ID type display name
 */
export function getIdTypeName(idType: IdType, countryCode: string): string {
  const names: Record<IdType, string> = {
    passport: 'Passport',
    drivers_license: "Driver's License",
    national_id: 'National ID Card',
    state_id: 'State ID',
    residence_card: 'Residence Card',
    military_id: 'Military ID',
    my_number_card: 'My Number Card',
    emirates_id: 'Emirates ID',
    nric: 'NRIC/FIN',
    dni: 'DNI',
    ine: 'INE (Voter ID)',
  }
  return names[idType] || idType
}

/**
 * Validate tax ID format for country
 */
export function validateTaxId(taxId: string, countryCode: string): boolean {
  const config = getCountryConfig(countryCode)
  if (!config?.taxId) return true // No tax ID required

  const regex = new RegExp(config.taxId.format)
  return regex.test(taxId)
}

/**
 * Validate postal code format for country
 */
export function validatePostalCode(postalCode: string, countryCode: string): boolean {
  const config = getCountryConfig(countryCode)
  if (!config) return false

  const regex = new RegExp(config.address.postalCodeFormat, 'i')
  return regex.test(postalCode)
}

/**
 * Get verification limits for country and level
 */
export function getVerificationLimits(countryCode: string, level: 1 | 2 | 3): number {
  const config = getCountryConfig(countryCode)
  if (!config) return 0

  switch (level) {
    case 1: return config.limits.level1Daily
    case 2: return config.limits.level2Daily
    case 3: return config.limits.level3Daily
    default: return config.limits.level1Daily
  }
}

// ============================================================================
// PROVINCE/STATE LISTS
// ============================================================================

export const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'Washington D.C.' }
]

export const CA_PROVINCES = [
  { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' }, { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' }, { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' }, { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' }, { code: 'ON', name: 'Ontario' }, { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' }, { code: 'SK', name: 'Saskatchewan' }, { code: 'YT', name: 'Yukon' }
]

export const MX_STATES = [
  { code: 'AGU', name: 'Aguascalientes' }, { code: 'BCN', name: 'Baja California' },
  { code: 'BCS', name: 'Baja California Sur' }, { code: 'CAM', name: 'Campeche' },
  { code: 'CHP', name: 'Chiapas' }, { code: 'CHH', name: 'Chihuahua' }, { code: 'CMX', name: 'Ciudad de México' },
  { code: 'COA', name: 'Coahuila' }, { code: 'COL', name: 'Colima' }, { code: 'DUR', name: 'Durango' },
  { code: 'GUA', name: 'Guanajuato' }, { code: 'GRO', name: 'Guerrero' }, { code: 'HID', name: 'Hidalgo' },
  { code: 'JAL', name: 'Jalisco' }, { code: 'MEX', name: 'México' }, { code: 'MIC', name: 'Michoacán' },
  { code: 'MOR', name: 'Morelos' }, { code: 'NAY', name: 'Nayarit' }, { code: 'NLE', name: 'Nuevo León' },
  { code: 'OAX', name: 'Oaxaca' }, { code: 'PUE', name: 'Puebla' }, { code: 'QUE', name: 'Querétaro' },
  { code: 'ROO', name: 'Quintana Roo' }, { code: 'SLP', name: 'San Luis Potosí' }, { code: 'SIN', name: 'Sinaloa' },
  { code: 'SON', name: 'Sonora' }, { code: 'TAB', name: 'Tabasco' }, { code: 'TAM', name: 'Tamaulipas' },
  { code: 'TLA', name: 'Tlaxcala' }, { code: 'VER', name: 'Veracruz' }, { code: 'YUC', name: 'Yucatán' },
  { code: 'ZAC', name: 'Zacatecas' }
]

export const AR_PROVINCES = [
  { code: 'C', name: 'Buenos Aires (Ciudad)' }, { code: 'B', name: 'Buenos Aires (Provincia)' },
  { code: 'K', name: 'Catamarca' }, { code: 'H', name: 'Chaco' }, { code: 'U', name: 'Chubut' },
  { code: 'X', name: 'Córdoba' }, { code: 'W', name: 'Corrientes' }, { code: 'E', name: 'Entre Ríos' },
  { code: 'P', name: 'Formosa' }, { code: 'Y', name: 'Jujuy' }, { code: 'L', name: 'La Pampa' },
  { code: 'F', name: 'La Rioja' }, { code: 'M', name: 'Mendoza' }, { code: 'N', name: 'Misiones' },
  { code: 'Q', name: 'Neuquén' }, { code: 'R', name: 'Río Negro' }, { code: 'A', name: 'Salta' },
  { code: 'J', name: 'San Juan' }, { code: 'D', name: 'San Luis' }, { code: 'Z', name: 'Santa Cruz' },
  { code: 'S', name: 'Santa Fe' }, { code: 'G', name: 'Santiago del Estero' },
  { code: 'V', name: 'Tierra del Fuego' }, { code: 'T', name: 'Tucumán' }
]

export const JP_PREFECTURES = [
  { code: '01', name: 'Hokkaido' }, { code: '02', name: 'Aomori' }, { code: '03', name: 'Iwate' },
  { code: '04', name: 'Miyagi' }, { code: '05', name: 'Akita' }, { code: '06', name: 'Yamagata' },
  { code: '07', name: 'Fukushima' }, { code: '08', name: 'Ibaraki' }, { code: '09', name: 'Tochigi' },
  { code: '10', name: 'Gunma' }, { code: '11', name: 'Saitama' }, { code: '12', name: 'Chiba' },
  { code: '13', name: 'Tokyo' }, { code: '14', name: 'Kanagawa' }, { code: '15', name: 'Niigata' },
  { code: '16', name: 'Toyama' }, { code: '17', name: 'Ishikawa' }, { code: '18', name: 'Fukui' },
  { code: '19', name: 'Yamanashi' }, { code: '20', name: 'Nagano' }, { code: '21', name: 'Gifu' },
  { code: '22', name: 'Shizuoka' }, { code: '23', name: 'Aichi' }, { code: '24', name: 'Mie' },
  { code: '25', name: 'Shiga' }, { code: '26', name: 'Kyoto' }, { code: '27', name: 'Osaka' },
  { code: '28', name: 'Hyogo' }, { code: '29', name: 'Nara' }, { code: '30', name: 'Wakayama' },
  { code: '31', name: 'Tottori' }, { code: '32', name: 'Shimane' }, { code: '33', name: 'Okayama' },
  { code: '34', name: 'Hiroshima' }, { code: '35', name: 'Yamaguchi' }, { code: '36', name: 'Tokushima' },
  { code: '37', name: 'Kagawa' }, { code: '38', name: 'Ehime' }, { code: '39', name: 'Kochi' },
  { code: '40', name: 'Fukuoka' }, { code: '41', name: 'Saga' }, { code: '42', name: 'Nagasaki' },
  { code: '43', name: 'Kumamoto' }, { code: '44', name: 'Oita' }, { code: '45', name: 'Miyazaki' },
  { code: '46', name: 'Kagoshima' }, { code: '47', name: 'Okinawa' }
]

export const AE_EMIRATES = [
  { code: 'AZ', name: 'Abu Dhabi' }, { code: 'AJ', name: 'Ajman' }, { code: 'DU', name: 'Dubai' },
  { code: 'FU', name: 'Fujairah' }, { code: 'RK', name: 'Ras Al Khaimah' }, { code: 'SH', name: 'Sharjah' },
  { code: 'UQ', name: 'Umm Al Quwain' }
]

/**
 * Get states/provinces for a country
 */
export function getStatesForCountry(countryCode: string): { code: string; name: string }[] {
  switch (countryCode) {
    case 'US': return US_STATES
    case 'CA': return CA_PROVINCES
    case 'MX': return MX_STATES
    case 'AR': return AR_PROVINCES
    case 'JP': return JP_PREFECTURES
    case 'AE': return AE_EMIRATES
    case 'GB': return [] // UK doesn't use states in addresses typically
    case 'SG': return [] // Singapore is a city-state
    default: return []
  }
}
