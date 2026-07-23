import { NextResponse } from 'next/server'
import { AMAZON_INDIA_CATEGORIES, AmazonCategory } from '@/lib/amazon-india'

export async function GET() {
  try {
    const { queryAll } = await import('@/lib/supabase')
    let cats: any[]
    try {
      cats = await queryAll('SELECT * FROM amazon_categories ORDER BY name ASC')
    } catch {
      cats = []
    }

    if (cats.length > 0) {
      const subCats: any[] = await queryAll('SELECT * FROM amazon_subcategories ORDER BY name ASC')
      return NextResponse.json({
        categories: cats.map((c: any) => ({
          id: c.id,
          name: c.name,
          nodeId: c.node_id,
          subCategories: subCats.filter((s: any) => s.category_id === c.id).map((s: any) => ({
            id: s.id, name: s.name, nodeId: s.node_id,
          })),
        })),
        source: 'database',
      })
    }

    return NextResponse.json({
      categories: AMAZON_INDIA_CATEGORIES,
      source: 'seed',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
