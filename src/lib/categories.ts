export interface SubCategory {
  id: string
  name: string
}

export interface Category {
  id: string
  name: string
  subCategories: SubCategory[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'electronics',
    name: 'Electronics',
    subCategories: [
      { id: 'mobiles', name: 'Mobiles & Accessories' },
      { id: 'laptops', name: 'Laptops & Tablets' },
      { id: 'headphones', name: 'Headphones & Earphones' },
      { id: 'smartwatches', name: 'Smart Watches & Wearables' },
      { id: 'cameras', name: 'Cameras & Photography' },
      { id: 'speakers', name: 'Speakers & Soundbars' },
      { id: 'tv', name: 'Televisions' },
      { id: 'gaming', name: 'Gaming Consoles & Accessories' },
      { id: 'computer_components', name: 'Computer Components & Peripherals' },
      { id: 'home_theatre', name: 'Home Theatre & Media Streamers' },
    ],
  },
  {
    id: 'appliances',
    name: 'Appliances',
    subCategories: [
      { id: 'ac', name: 'Air Conditioners' },
      { id: 'refrigerators', name: 'Refrigerators' },
      { id: 'washing_machines', name: 'Washing Machines & Dryers' },
      { id: 'microwaves', name: 'Microwaves & Ovens' },
      { id: 'mixers', name: 'Mixers, Grinders & Blenders' },
      { id: 'vacuum_cleaners', name: 'Vacuum Cleaners' },
      { id: 'water_purifiers', name: 'Water Purifiers & Filters' },
      { id: 'induction_cooktops', name: 'Induction Cooktops & Stoves' },
    ],
  },
  {
    id: 'fashion',
    name: 'Fashion',
    subCategories: [
      { id: 'mens_clothing', name: "Men's Clothing" },
      { id: 'womens_clothing', name: "Women's Clothing" },
      { id: 'kids_clothing', name: "Kids' Clothing" },
      { id: 'mens_footwear', name: "Men's Footwear" },
      { id: 'womens_footwear', name: "Women's Footwear" },
      { id: 'watches', name: 'Watches' },
      { id: 'sunglasses', name: 'Sunglasses & Eyewear' },
      { id: 'bags', name: 'Bags, Wallets & Luggage' },
      { id: 'jewellery', name: 'Fashion Jewellery & Accessories' },
    ],
  },
  {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    subCategories: [
      { id: 'skincare', name: 'Skincare & Body Care' },
      { id: 'haircare', name: 'Hair Care' },
      { id: 'makeup', name: 'Makeup & Cosmetics' },
      { id: 'fragrance', name: 'Fragrances & Deodorants' },
      { id: 'oral_care', name: 'Oral Care' },
      { id: 'shaving', name: 'Shaving & Grooming' },
      { id: 'bath_shower', name: 'Bath & Shower' },
    ],
  },
  {
    id: 'home_kitchen',
    name: 'Home & Kitchen',
    subCategories: [
      { id: 'furniture', name: 'Furniture' },
      { id: 'kitchen_dining', name: 'Kitchen & Dining' },
      { id: 'home_decor', name: 'Home Decor & Festive Needs' },
      { id: 'bedding', name: 'Bedding & Linens' },
      { id: 'bathroom', name: 'Bathroom Accessories' },
      { id: 'storage', name: 'Storage & Organisation' },
      { id: 'lighting', name: 'Lighting & Ceiling Fans' },
      { id: 'gardening', name: 'Gardening & Outdoor' },
    ],
  },
  {
    id: 'sports',
    name: 'Sports, Fitness & Outdoors',
    subCategories: [
      { id: 'gym_equipment', name: 'Gym Equipment & Home Fitness' },
      { id: 'sports_wear', name: 'Sportswear & Activewear' },
      { id: 'cycling', name: 'Cycling & Biking' },
      { id: 'yoga', name: 'Yoga & Pilates' },
      { id: 'outdoor_sports', name: 'Outdoor Sports & Adventure' },
      { id: 'sports_nutrition', name: 'Sports Nutrition & Supplements' },
      { id: 'cricket', name: 'Cricket Equipment' },
      { id: 'football', name: 'Football & Soccer' },
      { id: 'badminton', name: 'Badminton & Tennis' },
    ],
  },
  {
    id: 'automotive',
    name: 'Car & Motorbike',
    subCategories: [
      { id: 'car_accessories', name: 'Car Accessories' },
      { id: 'bike_accessories', name: 'Motorbike Accessories' },
      { id: 'car_care', name: 'Car Care & Detailing' },
      { id: 'tyres', name: 'Tyres & Wheels' },
      { id: 'car_electronics', name: 'Car Electronics & GPS' },
      { id: 'helmets', name: 'Helmets & Riding Gear' },
      { id: 'oils_fluids', name: 'Oils & Fluids' },
    ],
  },
  {
    id: 'grocery',
    name: 'Grocery & Gourmet',
    subCategories: [
      { id: 'snacks', name: 'Snacks & Namkeen' },
      { id: 'tea_coffee', name: 'Tea, Coffee & Beverages' },
      { id: 'staples', name: 'Staples & Cooking Essentials' },
      { id: 'breakfast', name: 'Breakfast Cereals & Spreads' },
      { id: 'health_drinks', name: 'Health Drinks & Supplements' },
      { id: 'baby_food', name: 'Baby Food & Products' },
      { id: 'pet_food', name: 'Pet Food & Accessories' },
    ],
  },
  {
    id: 'books',
    name: 'Books',
    subCategories: [
      { id: 'academic', name: 'Academic & Professional' },
      { id: 'fiction', name: 'Fiction & Literature' },
      { id: 'non_fiction', name: 'Non-Fiction & Biographies' },
      { id: 'children', name: "Children's & Young Adult" },
      { id: 'self_help', name: 'Self-Help & Personal Development' },
      { id: 'business', name: 'Business & Economics' },
      { id: 'comics', name: 'Comics & Graphic Novels' },
    ],
  },
  {
    id: 'toys',
    name: 'Toys & Games',
    subCategories: [
      { id: 'action_figures', name: 'Action Figures & Playsets' },
      { id: 'board_games', name: 'Board Games & Puzzles' },
      { id: 'educational', name: 'Educational & STEM Toys' },
      { id: 'remote_control', name: 'Remote Control & Vehicles' },
      { id: 'soft_toys', name: 'Soft Toys & Plush' },
      { id: 'outdoor_play', name: 'Outdoor Play & Sand Toys' },
    ],
  },
  {
    id: 'health',
    name: 'Health & Household',
    subCategories: [
      { id: 'medical_equipment', name: 'Medical Equipment & Supplies' },
      { id: 'health_monitors', name: 'Health Monitors & Tests' },
      { id: 'wellness', name: 'Wellness & Relaxation' },
      { id: 'household_supplies', name: 'Household Supplies & Cleaning' },
      { id: 'baby_care', name: 'Baby Care & Nursery' },
    ],
  },
  {
    id: 'office',
    name: 'Office Products & Stationery',
    subCategories: [
      { id: 'office_furniture', name: 'Office Furniture & Seating' },
      { id: 'stationery', name: 'Stationery & Writing' },
      { id: 'office_supplies', name: 'Office Supplies & Equipment' },
      { id: 'printer_ink', name: 'Printer Ink & Toner' },
    ],
  },
]
