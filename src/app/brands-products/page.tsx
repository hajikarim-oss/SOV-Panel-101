'use client'

import { useState, useEffect } from 'react'
import {
  Tag, Search, ChevronDown, ChevronRight, Package, Star,
  ExternalLink, Loader2, ShoppingBag, Layers, Filter,
} from 'lucide-react'

interface Category {
  id: string
  name: string
  nodeId: string
  subCategories: SubCategory[]
}

interface SubCategory {
  id: string
  name: string
  nodeId: string
}

interface Brand {
  id: string
  name: string
  categoryId: string
}

export default function BrandsProductsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [selectedSubCat, setSelectedSubCat] = useState<string | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'categories' | 'brands' | 'all'>('all')

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const r = await fetch('/api/amazon/categories')
      const d = await r.json()
      setCategories(d.categories || [])
    } catch {} finally { setLoading(false) }
  }

  const fetchBrands = async (subCatId: string) => {
    setBrandsLoading(true)
    setSelectedSubCat(subCatId)
    try {
      const r = await fetch(`/api/amazon/brands?category_id=${subCatId}`)
      const d = await r.json()
      setBrands(d.brands || [])
    } catch {} finally { setBrandsLoading(false) }
  }

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subCategories.some(s => s.name.toLowerCase().includes(search.toLowerCase()))
  )

  const allBrands = brands
  const filteredBrands = search
    ? allBrands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : allBrands

  if (loading) {
    return (
      <div className="anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#F58220' }} />
          <div style={{ marginTop: 10, fontSize: 13, color: '#64748B', fontWeight: 600 }}>Loading Amazon India catalog...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="anim-fade-up" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Brands & <span className="accent">Products</span></h1>
          <p className="page-subtitle">Browse Amazon India categories, subcategories, brands, and products</p>
        </div>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
          <input
            className="input"
            placeholder="Search categories, brands..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: 38, paddingLeft: 34, fontSize: 13 }}
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="toggle-group" style={{ marginBottom: 20, width: 'fit-content' }}>
        <button className={`toggle-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
          <Layers size={13} /> All Categories
        </button>
        <button className={`toggle-btn ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>
          <Tag size={13} /> Categories
        </button>
        <button className={`toggle-btn ${activeTab === 'brands' ? 'active' : ''}`} onClick={() => setActiveTab('brands')}>
          <ShoppingBag size={13} /> Brands
        </button>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { label: 'Categories', value: categories.length, color: '#1A73E8' },
            { label: 'Subcategories', value: categories.reduce((s, c) => s + c.subCategories.length, 0), color: '#7C3AED' },
            { label: 'Brands', value: filteredBrands.length, color: '#F58220' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${s.color}0D`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                {s.label === 'Categories' ? <Layers size={14} /> : s.label === 'Subcategories' ? <Filter size={14} /> : <ShoppingBag size={14} />}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748B', marginTop: 1 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Category + Brand browser */}
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Left: Category tree */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: 600, overflowY: 'auto' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1.5px solid rgba(26,115,232,0.06)', fontSize: 12.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag size={13} /> Amazon India Categories
            </div>
            {(activeTab === 'all' || activeTab === 'categories') && (
              <div style={{ padding: '4px 0' }}>
                {filteredCategories.map(cat => (
                  <div key={cat.id}>
                    <div
                      onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px', cursor: 'pointer',
                        background: expandedCat === cat.id ? 'rgba(245,130,32,0.04)' : 'transparent',
                        borderBottom: '1px solid rgba(26,115,232,0.04)',
                        fontWeight: expandedCat === cat.id ? 700 : 500,
                        color: '#0F172A', fontSize: 13,
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,115,232,0.03)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = expandedCat === cat.id ? 'rgba(245,130,32,0.04)' : 'transparent' }}
                    >
                      {expandedCat === cat.id ? <ChevronDown size={14} style={{ color: '#F58220', flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />}
                      {cat.name}
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#94A3B8', fontWeight: 500 }}>{cat.subCategories.length}</span>
                    </div>
                    {expandedCat === cat.id && (
                      <div style={{ background: 'rgba(244,247,252,0.5)' }}>
                        {cat.subCategories.map(sub => (
                          <div
                            key={sub.id}
                            onClick={() => fetchBrands(sub.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '8px 16px 8px 40px', cursor: 'pointer',
                              borderBottom: '1px solid rgba(26,115,232,0.03)',
                              fontSize: 12.5, color: selectedSubCat === sub.id ? '#F58220' : '#475569',
                              fontWeight: selectedSubCat === sub.id ? 700 : 500,
                              background: selectedSubCat === sub.id ? 'rgba(245,130,32,0.06)' : 'transparent',
                              transition: 'all 0.1s',
                            }}
                            onMouseEnter={e => { if (selectedSubCat !== sub.id) e.currentTarget.style.background = 'rgba(26,115,232,0.03)' }}
                            onMouseLeave={e => { if (selectedSubCat !== sub.id) e.currentTarget.style.background = 'transparent' }}
                          >
                            {selectedSubCat === sub.id ? <ChevronRight size={12} style={{ color: '#F58220' }} /> : <Package size={12} style={{ color: '#94A3B8' }} />}
                            {sub.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Brands grid */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 300 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1.5px solid rgba(26,115,232,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShoppingBag size={13} />
                {selectedSubCat
                  ? `Brands in ${categories.flatMap(c => c.subCategories).find(s => s.id === selectedSubCat)?.name || ''}`
                  : 'All Brands'}
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>({filteredBrands.length})</span>
              </span>
              {brandsLoading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#F58220' }} />}
            </div>
            {filteredBrands.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8', fontSize: 13 }}>
                {selectedSubCat ? 'No brands found for this subcategory.' : 'Select a subcategory from the left to view brands.'}
              </div>
            ) : (
              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                {filteredBrands.map(brand => (
                  <div
                    key={brand.id}
                    style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: '#FFFFFF', border: '1.5px solid rgba(26,115,232,0.06)',
                      fontSize: 12, fontWeight: 600, color: '#0F172A',
                      textAlign: 'center', cursor: 'default',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,130,32,0.2)'; e.currentTarget.style.background = 'rgba(245,130,32,0.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(26,115,232,0.06)'; e.currentTarget.style.background = '#FFFFFF' }}
                  >
                    {brand.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
