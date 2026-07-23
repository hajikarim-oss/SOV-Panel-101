import { NextResponse } from 'next/server'
import { AMAZON_INDIA_CATEGORIES, AMAZON_TOP_BRANDS } from '@/lib/amazon-india'

export async function POST() {
  try {
    const { queryAll } = await import('@/lib/supabase')
    const results = { categories: 0, subcategories: 0, brands: 0 }

    for (const cat of AMAZON_INDIA_CATEGORIES) {
      await queryAll(
        `INSERT INTO amazon_categories (id, name, node_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = $2, node_id = $3`,
        [cat.id, cat.name, cat.nodeId]
      )
      results.categories++

      for (const sub of cat.subCategories) {
        await queryAll(
          `INSERT INTO amazon_subcategories (id, name, node_id, category_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET name = $2, node_id = $3, category_id = $4`,
          [sub.id, sub.name, sub.nodeId, cat.id]
        )
        results.subcategories++
      }
    }

    for (const [subCatId, brandNames] of Object.entries(AMAZON_TOP_BRANDS)) {
      for (const name of brandNames) {
        await queryAll(
          `INSERT INTO amazon_brands (name, sub_category_id)
           VALUES ($1, $2)
           ON CONFLICT (name, sub_category_id) DO NOTHING`,
          [name, subCatId]
        )
        results.brands++
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
