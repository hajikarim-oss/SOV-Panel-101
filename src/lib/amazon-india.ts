export interface AmazonCategory {
  id: string
  name: string
  nodeId: string
  subCategories: AmazonSubCategory[]
}

export interface AmazonSubCategory {
  id: string
  name: string
  nodeId: string
}

export interface AmazonBrand {
  id: string
  name: string
  categoryId: string
  subCategoryId: string
  products: AmazonProduct[]
}

export interface AmazonProduct {
  id: string
  name: string
  asin: string
  price: number | null
  imageUrl: string
  rating: number | null
  reviewCount: number
}

export const AMAZON_INDIA_CATEGORIES: AmazonCategory[] = [
  {
    id: 'electronics',
    name: 'Electronics',
    nodeId: '976419031',
    subCategories: [
      { id: 'mobiles', name: 'Mobiles & Accessories', nodeId: '1805560031' },
      { id: 'laptops', name: 'Laptops & Tablets', nodeId: '1375424031' },
      { id: 'headphones', name: 'Headphones & Earphones', nodeId: '1388921031' },
      { id: 'smartwatches', name: 'Smart Watches & Wearables', nodeId: '1757104031' },
      { id: 'cameras', name: 'Cameras & Photography', nodeId: '1389401031' },
      { id: 'speakers', name: 'Speakers & Soundbars', nodeId: '1388977031' },
      { id: 'tv', name: 'Televisions', nodeId: '1389360031' },
      { id: 'gaming', name: 'Gaming Consoles & Accessories', nodeId: '4092094031' },
      { id: 'computer_components', name: 'Computer Components & Peripherals', nodeId: '1375425031' },
      { id: 'home_theatre', name: 'Home Theatre & Media Streamers', nodeId: '1388969031' },
    ],
  },
  {
    id: 'appliances',
    name: 'Appliances',
    nodeId: '6648217031',
    subCategories: [
      { id: 'ac', name: 'Air Conditioners', nodeId: '3474656031' },
      { id: 'refrigerators', name: 'Refrigerators', nodeId: '3474657031' },
      { id: 'washing_machines', name: 'Washing Machines & Dryers', nodeId: '3474658031' },
      { id: 'microwaves', name: 'Microwaves & Ovens', nodeId: '3474659031' },
      { id: 'mixers', name: 'Mixers, Grinders & Blenders', nodeId: '1385071031' },
      { id: 'vacuum_cleaners', name: 'Vacuum Cleaners', nodeId: '1380120031' },
      { id: 'water_purifiers', name: 'Water Purifiers & Filters', nodeId: '1380121031' },
      { id: 'induction_cooktops', name: 'Induction Cooktops & Stoves', nodeId: '1385073031' },
    ],
  },
  {
    id: 'fashion',
    name: 'Fashion',
    nodeId: '1571273031',
    subCategories: [
      { id: 'mens_clothing', name: "Men's Clothing", nodeId: '1968024031' },
      { id: 'womens_clothing', name: "Women's Clothing", nodeId: '1968123031' },
      { id: 'kids_clothing', name: "Kids' Clothing", nodeId: '1968300031' },
      { id: 'mens_footwear', name: "Men's Footwear", nodeId: '1983578031' },
      { id: 'womens_footwear', name: "Women's Footwear", nodeId: '1983632031' },
      { id: 'watches', name: 'Watches', nodeId: '1757064031' },
      { id: 'sunglasses', name: 'Sunglasses & Eyewear', nodeId: '6540099031' },
      { id: 'bags', name: 'Bags, Wallets & Luggage', nodeId: '1380245031' },
      { id: 'jewellery', name: 'Fashion Jewellery & Accessories', nodeId: '1968326031' },
    ],
  },
  {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    nodeId: '1350380031',
    subCategories: [
      { id: 'skincare', name: 'Skincare & Body Care', nodeId: '1373483031' },
      { id: 'haircare', name: 'Hair Care', nodeId: '1350381031' },
      { id: 'makeup', name: 'Makeup & Cosmetics', nodeId: '1373491031' },
      { id: 'fragrance', name: 'Fragrances & Deodorants', nodeId: '1373517031' },
      { id: 'oral_care', name: 'Oral Care', nodeId: '1373496031' },
      { id: 'shaving', name: 'Shaving & Grooming', nodeId: '1373500031' },
      { id: 'bath_shower', name: 'Bath & Shower', nodeId: '1350381031' },
    ],
  },
  {
    id: 'home_kitchen',
    name: 'Home & Kitchen',
    nodeId: '2454177031',
    subCategories: [
      { id: 'furniture', name: 'Furniture', nodeId: '1380119031' },
      { id: 'kitchen_dining', name: 'Kitchen & Dining', nodeId: '1380033031' },
      { id: 'home_decor', name: 'Home Decor & Festive Needs', nodeId: '1380037031' },
      { id: 'bedding', name: 'Bedding & Linens', nodeId: '1380039031' },
      { id: 'bathroom', name: 'Bathroom Accessories', nodeId: '1380042031' },
      { id: 'storage', name: 'Storage & Organisation', nodeId: '1380060031' },
      { id: 'lighting', name: 'Lighting & Ceiling Fans', nodeId: '1380048031' },
      { id: 'gardening', name: 'Gardening & Outdoor', nodeId: '2454179031' },
    ],
  },
  {
    id: 'sports',
    name: 'Sports, Fitness & Outdoors',
    nodeId: '3419591031',
    subCategories: [
      { id: 'gym_equipment', name: 'Gym Equipment & Home Fitness', nodeId: '1180681031' },
      { id: 'sports_wear', name: 'Sportswear & Activewear', nodeId: '3419601031' },
      { id: 'cycling', name: 'Cycling & Biking', nodeId: '3405310031' },
      { id: 'yoga', name: 'Yoga & Pilates', nodeId: '3419682031' },
      { id: 'outdoor_sports', name: 'Outdoor Sports & Adventure', nodeId: '3419627031' },
      { id: 'sports_nutrition', name: 'Sports Nutrition & Supplements', nodeId: '1571286031' },
      { id: 'cricket', name: 'Cricket Equipment', nodeId: '3405360031' },
      { id: 'football', name: 'Football & Soccer', nodeId: '3405370031' },
      { id: 'badminton', name: 'Badminton & Tennis', nodeId: '3405380031' },
    ],
  },
  {
    id: 'automotive',
    name: 'Car & Motorbike',
    nodeId: '4770058031',
    subCategories: [
      { id: 'car_accessories', name: 'Car Accessories', nodeId: '4770061031' },
      { id: 'bike_accessories', name: 'Motorbike Accessories', nodeId: '4770060031' },
      { id: 'car_care', name: 'Car Care & Detailing', nodeId: '4770062031' },
      { id: 'tyres', name: 'Tyres & Wheels', nodeId: '4770066031' },
      { id: 'car_electronics', name: 'Car Electronics & GPS', nodeId: '4770064031' },
      { id: 'helmets', name: 'Helmets & Riding Gear', nodeId: '4770065031' },
      { id: 'oils_fluids', name: 'Oils & Fluids', nodeId: '4770067031' },
    ],
  },
  {
    id: 'grocery',
    name: 'Grocery & Gourmet',
    nodeId: '2454178031',
    subCategories: [
      { id: 'snacks', name: 'Snacks & Namkeen', nodeId: '4863160031' },
      { id: 'tea_coffee', name: 'Tea, Coffee & Beverages', nodeId: '4863170031' },
      { id: 'staples', name: 'Staples & Cooking Essentials', nodeId: '4863180031' },
      { id: 'breakfast', name: 'Breakfast Cereals & Spreads', nodeId: '4863190031' },
      { id: 'health_drinks', name: 'Health Drinks & Supplements', nodeId: '4863200031' },
      { id: 'baby_food', name: 'Baby Food & Products', nodeId: '4863210031' },
      { id: 'pet_food', name: 'Pet Food & Accessories', nodeId: '4863220031' },
    ],
  },
  {
    id: 'books',
    name: 'Books',
    nodeId: '976389031',
    subCategories: [
      { id: 'academic', name: 'Academic & Professional', nodeId: '4149381031' },
      { id: 'fiction', name: 'Fiction & Literature', nodeId: '976390031' },
      { id: 'non_fiction', name: 'Non-Fiction & Biographies', nodeId: '976391031' },
      { id: 'children', name: "Children's & Young Adult", nodeId: '976398031' },
      { id: 'self_help', name: 'Self-Help & Personal Development', nodeId: '1571277031' },
      { id: 'business', name: 'Business & Economics', nodeId: '1318157031' },
      { id: 'comics', name: 'Comics & Graphic Novels', nodeId: '976395031' },
    ],
  },
  {
    id: 'toys',
    name: 'Toys & Games',
    nodeId: '1350380031',
    subCategories: [
      { id: 'action_figures', name: 'Action Figures & Playsets', nodeId: '1373470031' },
      { id: 'board_games', name: 'Board Games & Puzzles', nodeId: '1373459031' },
      { id: 'educational', name: 'Educational & STEM Toys', nodeId: '1373468031' },
      { id: 'remote_control', name: 'Remote Control & Vehicles', nodeId: '1373467031' },
      { id: 'soft_toys', name: 'Soft Toys & Plush', nodeId: '1373465031' },
      { id: 'outdoor_play', name: 'Outdoor Play & Sand Toys', nodeId: '1373472031' },
    ],
  },
  {
    id: 'health',
    name: 'Health & Household',
    nodeId: '1350380031',
    subCategories: [
      { id: 'medical_equipment', name: 'Medical Equipment & Supplies', nodeId: '1373481031' },
      { id: 'health_monitors', name: 'Health Monitors & Tests', nodeId: '1373482031' },
      { id: 'wellness', name: 'Wellness & Relaxation', nodeId: '1373484031' },
      { id: 'household_supplies', name: 'Household Supplies & Cleaning', nodeId: '1373478031' },
      { id: 'baby_care', name: 'Baby Care & Nursery', nodeId: '1373479031' },
    ],
  },
  {
    id: 'office',
    name: 'Office Products & Stationery',
    nodeId: '2454177031',
    subCategories: [
      { id: 'office_furniture', name: 'Office Furniture & Seating', nodeId: '1380034031' },
      { id: 'stationery', name: 'Stationery & Writing', nodeId: '1380035031' },
      { id: 'office_supplies', name: 'Office Supplies & Equipment', nodeId: '1380036031' },
      { id: 'printer_ink', name: 'Printer Ink & Toner', nodeId: '1380038031' },
    ],
  },
]

export const AMAZON_TOP_BRANDS: Record<string, string[]> = {
  mobiles: ['Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Realme', 'Vivo', 'Oppo', 'Motorola', 'Nothing', 'Google Pixel', 'iQOO', 'Infinix', 'Tecno', 'Micromax', 'Lava'],
  laptops: ['Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Samsung', 'Microsoft Surface', 'Xiaomi', 'LG', 'Avita', 'Realme'],
  headphones: ['Sony', 'Bose', 'JBL', 'Sennheiser', 'Audio-Technica', 'Marshall', 'Beats', 'Skullcandy', 'boat', 'Realme', 'OnePlus', 'Nothing', 'Noise', 'pTron'],
  smartwatches: ['Apple', 'Samsung', 'Noise', 'boAt', 'Fire-Boltt', 'OnePlus', 'Amazfit', 'Fossil', 'Garmin', 'Fitbit', 'Huawei', 'Realme'],
  speakers: ['JBL', 'Sony', 'Marshall', 'Bose', 'Harman Kardon', 'Sonos', 'Ultimate Ears', 'boAt', 'Philips', 'Samsung', 'LG', 'Zebronics'],
  tv: ['Samsung', 'Sony', 'LG', 'OnePlus', 'Xiaomi', 'TCL', 'Hisense', 'Panasonic', 'Toshiba', 'Vu', 'Kodak', 'Motorola', 'Nokia'],
  ac: ['LG', 'Samsung', 'Daikin', 'Voltas', 'Blue Star', 'Hitachi', 'Panasonic', 'Carrier', 'Whirlpool', 'Lloyd', 'Godrej', 'Havells'],
  refrigerators: ['LG', 'Samsung', 'Whirlpool', 'Godrej', 'Bosch', 'Haier', 'Panasonic', 'Sony', 'Hitachi', 'Lloyd', 'Voltas Beko'],
  washing_machines: ['LG', 'Samsung', 'Bosch', 'Whirlpool', 'IFB', 'Haier', 'Panasonic', 'Godrej', 'Lloyd', 'Voltas Beko'],
  skincare: ['Neutrogena', 'Cetaphil', 'The Ordinary', 'Minimalist', 'Plum', 'Mamaearth', 'Lakme', 'Olay', 'L\'Oreal', 'Nivea', 'Ponds', 'Garnier', 'Dermatouch', 'Aveeno'],
  haircare: ['Dove', 'L\'Oreal', 'Indulekha', 'Mamaearth', 'WOW Skin Science', 'Biotique', 'Pantene', 'Head & Shoulders', 'TRESemmé', 'Livon', 'Garnier', 'Bajaj Almont'],
  makeup: ['Maybelline', 'Lakme', 'MAC', 'NYX', 'Sugar Cosmetics', 'Swiss Beauty', 'Insight', 'Blue Heaven', 'elf', 'Huda Beauty', 'MARS'], 
  fragrance: ['Park Avenue', 'Fogg', 'Engage', 'Denver', 'Wild Stone', 'Ustraa', 'Bella Vita', 'Skinn by Titan', 'Armaf', 'Ajmal'],
  'mens_clothing': ['Levi\'s', 'US Polo Assn', 'Allen Solly', 'Van Heusen', 'Peter England', 'Blck', 'Netplay', 'Roadster', 'HRX', 'Wrogn', 'Puma', 'Adidas', 'Nike', 'Under Armour'],
  'womens_clothing': ['H&M', 'Zara', 'Mango', 'Forever 21', 'Max', 'Libas', 'SASSAFRAS', 'Mast & Harbour', 'Tokyo Talkies', 'Laksha', 'Indo Era'],
  'mens_footwear': ['Nike', 'Adidas', 'Puma', 'Reebok', 'Skechers', 'Woodland', 'Red Tape', 'Bata', 'Liberty', 'Crocs', 'Campus', 'Lotto'],
  'womens_footwear': ['Nike', 'Adidas', 'Puma', 'Skechers', 'Crocs', 'Bata', 'Metro', 'Red Tape', 'Mochi', 'Aerosoft', 'Catwalk'],
  watches: ['Titan', 'Fastrack', 'Timex', 'Casio', 'Daniel Wellington', 'Fossil', 'Davidoff', 'Tissot', 'Seiko', 'Hugo Boss', 'Tommy Hilfiger'],
  bags: ['American Tourister', 'Skybags', 'Wildcraft', 'Safari', 'VIP', 'Delsey', 'Samsonite', 'Quechua', 'F Gear', 'Puma', 'Adidas', 'Nike'],
  furniture: ['Wakefit', 'Duroflex', 'Century', 'Urban Ladder', 'Pepperfry', 'Godrej Interio', 'Nilkamal', 'HomeTown', 'IKEA'],
  'kitchen_dining': ['Prestige', 'Hawkins', 'Butterfly', 'Vinod', 'Cello', 'Milton', 'Borosil', 'La Opala', 'Corelle', 'Signoraware'],
  'gym_equipment': ['Cultfit', 'PROTONER', 'Kore Fitness', 'Strauss', 'Nivia', 'Cosco', 'Reebok', 'Adidas', 'Fitkit', 'Stayfit'],
  sports_wear: ['Nike', 'Adidas', 'Puma', 'Decathlon', 'Reebok', 'Under Armour', 'HRX', 'Jockey', 'US Polo Assn', 'Van Heusen'],
  'car_accessories': ['3M', 'Philips', 'Michelin', 'Boost', 'GadgEon', 'Autovista', 'Staun', 'Garmin', 'Auxmar', 'Pidilite'],
  'baby_care': ['Mee Mee', 'Johnson & Johnson', 'Himalaya', 'Baby Dove', 'Pampers', 'Huggies', 'Sebamed', 'Aveeno', 'Chicco'],
  'tea_coffee': ['Tata Tea', 'Brooke Bond', 'Bru', 'Nescafe', 'Davidoff', 'Lipton', 'Twinings', 'Green Label', 'Continental', 'Wagh Bakri'],
  snacks: ['Lays', 'Kurkure', 'Bingo', 'Haldiram', 'Bikaji', 'Balaji', 'Parle', 'Britannia', 'Uncle Chipps', 'Pringles'],
}

export function getBrandsForCategory(categoryId: string): string[] {
  return AMAZON_TOP_BRANDS[categoryId] || []
}

export function getAllUniqueBrands(): string[] {
  const brands = new Set<string>()
  for (const [, brandList] of Object.entries(AMAZON_TOP_BRANDS)) {
    for (const b of brandList) brands.add(b)
  }
  return Array.from(brands).sort()
}
