export interface LanguageRegion {
  id: string
  name: string
  states: string
  langCode: string
  color: string
}

export const languageRegions: LanguageRegion[] = [
  {
    id: 'north',
    name: 'North (Hindi Belt)',
    states: 'Uttar Pradesh, Bihar, Madhya Pradesh, Rajasthan, Haryana, Delhi',
    langCode: 'hi',
    color: '#1A73E8',
  },
  {
    id: 'west_gujarat',
    name: 'Gujarat (Gujarati)',
    states: 'Gujarat',
    langCode: 'gu',
    color: '#06B6D4',
  },
  {
    id: 'west_maharashtra',
    name: 'Maharashtra (Marathi)',
    states: 'Maharashtra, Goa',
    langCode: 'mr',
    color: '#F97316',
  },
  {
    id: 'south_karnataka',
    name: 'Karnataka (Kannada)',
    states: 'Karnataka',
    langCode: 'kn',
    color: '#8B5CF6',
  },
  {
    id: 'south_kerala',
    name: 'Kerala (Malayalam)',
    states: 'Kerala',
    langCode: 'ml',
    color: '#EF4444',
  },
  {
    id: 'south_tamilnadu',
    name: 'Tamil Nadu (Tamil)',
    states: 'Tamil Nadu, Puducherry',
    langCode: 'ta',
    color: '#10B981',
  },
  {
    id: 'south_andhra',
    name: 'Andhra Pradesh & Telangana (Telugu)',
    states: 'Andhra Pradesh, Telangana',
    langCode: 'te',
    color: '#F59E0B',
  },
  {
    id: 'east_odisha',
    name: 'Odisha (Odia)',
    states: 'Odisha',
    langCode: 'or',
    color: '#EC4899',
  },
  {
    id: 'east_bengal',
    name: 'West Bengal (Bengali)',
    states: 'West Bengal',
    langCode: 'bn',
    color: '#14B8A6',
  },
  {
    id: 'northeast',
    name: 'Northeast Region',
    states: 'Assam, Meghalaya, Tripura, Mizoram, Manipur, Nagaland, Arunachal',
    langCode: 'as',
    color: '#6366F1',
  },
]

export function getLanguageRegion(langCode: string): LanguageRegion | undefined {
  return languageRegions.find(r => r.langCode === langCode)
}
