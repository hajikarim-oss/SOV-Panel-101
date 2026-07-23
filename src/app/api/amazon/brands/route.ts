import { NextRequest, NextResponse } from 'next/server'
import { getBrandsForCategory, getAllUniqueBrands } from '@/lib/amazon-india'

export async function GET(req: NextRequest) {
  try {
    const categoryId = req.nextUrl.searchParams.get('category_id')
    const search = req.nextUrl.searchParams.get('search')?.toLowerCase()

    let brands = categoryId ? getBrandsForCategory(categoryId) : getAllUniqueBrands()

    if (search) {
      brands = brands.filter(b => b.toLowerCase().includes(search))
    }

    return NextResponse.json({
      brands: brands.map((name, i) => ({ id: `brand_${i}`, name, categoryId: categoryId || '' })),
      total: brands.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
