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
    name: 'Electronics & Computers',
    subCategories: [
      { id: 'smartphones', name: 'Smartphones & Accessories' },
      { id: 'laptops', name: 'Laptops & Tablets' },
      { id: 'audio', name: 'Audio & Headphones' },
      { id: 'wearables', name: 'Smart Home & Wearables' }
    ]
  },
  {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    subCategories: [
      { id: 'makeup', name: 'Cosmetics & Makeup' },
      { id: 'hair', name: 'Hair Care' },
      { id: 'skincare', name: 'Skincare & Body' },
      { id: 'fragrance', name: 'Fragrances' }
    ]
  },
  {
    id: 'home',
    name: 'Home & Kitchen',
    subCategories: [
      { id: 'kitchen', name: 'Kitchen Appliances' },
      { id: 'smart_appliances', name: 'Smart Appliances' },
      { id: 'furniture', name: 'Furniture & Decor' },
      { id: 'outdoor', name: 'Garden & Outdoor' }
    ]
  },
  {
    id: 'fitness',
    name: 'Fitness & Sports',
    subCategories: [
      { id: 'gym', name: 'Gym Equipment' },
      { id: 'apparel', name: 'Athletic Apparel' },
      { id: 'recreation', name: 'Outdoor Recreation' },
      { id: 'nutrition', name: 'Supplements & Nutrition' }
    ]
  }
]
