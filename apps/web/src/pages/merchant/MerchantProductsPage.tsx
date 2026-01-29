import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Upload, Search, Trash2, Edit2,
  Check, X, Download, AlertCircle, Image as ImageIcon, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useMerchantStore } from '@/store/merchant-store';
import type { ProductImportRow } from '@/lib/api';

const CATEGORIES = [
  'tops', 'shirts', 'dresses', 'sarees', 'kurtas', 'jackets', 'coats',
  'sweaters', 'hoodies', 'pants', 'jeans', 'shorts', 'skirts', 'leggings',
  'suits', 'blazers', 't-shirts', 'blouses', 'tunics', 'jumpsuits',
  'ethnic', 'western', 'fusion', 'other'
];

const GENDERS = ['male', 'female', 'unisex'];

export default function MerchantProductsPage() {
  const {
    selectedStore,
    products,
    zones,
    productsTotal,
    isLoading,
    error,
    fetchProducts,
    fetchZones,
    createProduct,
    updateProduct,
    deleteProduct,
    importProducts,
    clearError,
  } = useMerchantStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<typeof products[0] | null>(null);
  const [importResults, setImportResults] = useState<{
    success: boolean;
    imported_count: number;
    errors: Array<{ row: number; sku: string; error: string }>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedStore) {
      fetchZones();
      fetchProducts({ search: searchQuery, zone_id: selectedZone || undefined, category: selectedCategory || undefined });
    }
  }, [selectedStore, fetchZones, fetchProducts, searchQuery, selectedZone, selectedCategory]);

  const formatPrice = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  // CSV Parser
  const parseCSV = useCallback((text: string): ProductImportRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows: ProductImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: Record<string, string | number | string[]> = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      // Map CSV columns to ProductImportRow
      const product: ProductImportRow = {
        sku: String(row.sku || row.product_id || ''),
        name: String(row.name || row.product_name || ''),
        brand: String(row.brand || ''),
        category: String(row.category || ''),
        gender: String(row.gender || 'unisex'),
        price: Math.round(parseFloat(String(row.price || row.mrp || 0)) * 100), // Convert to paise
        original_price: row.original_price ? Math.round(parseFloat(String(row.original_price)) * 100) : undefined,
        image_url: String(row.image_url || row.image || ''),
        additional_images: row.additional_images ? String(row.additional_images).split('|').map(s => s.trim()) : [],
        sizes: row.sizes ? String(row.sizes).split('|').map(s => s.trim()) : ['S', 'M', 'L', 'XL'],
        colors: row.colors ? String(row.colors).split('|').map(s => s.trim()) : [],
        material: String(row.material || ''),
        care_instructions: String(row.care_instructions || ''),
        stock_quantity: parseInt(String(row.stock_quantity || row.stock || 100)),
        zone_id: String(row.zone_id || ''),
        aisle: String(row.aisle || ''),
        row: String(row.row || ''),
        shelf: String(row.shelf || ''),
        rack: String(row.rack || ''),
      };

      if (product.sku && product.name && product.price > 0 && product.image_url) {
        rows.push(product);
      }
    }

    return rows;
  }, []);

  // Parse CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      setImportResults({
        success: false,
        imported_count: 0,
        errors: [{ row: 0, sku: '', error: 'No valid products found in CSV' }],
      });
      return;
    }

    const result = await importProducts(rows);
    setImportResults(result);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddProduct = async (data: Partial<ProductImportRow>) => {
    if (!data.name || !data.price || !data.image_url) return;

    await createProduct({
      name: data.name,
      brand: data.brand,
      category: data.category,
      gender: data.gender,
      price: data.price,
      original_price: data.original_price,
      image_url: data.image_url,
      additional_images: data.additional_images,
      sizes: data.sizes,
      colors: data.colors,
      material: data.material,
      care_instructions: data.care_instructions,
      stock_quantity: data.stock_quantity,
      zone_id: data.zone_id,
      aisle: data.aisle,
      row: data.row,
      shelf: data.shelf,
      rack: data.rack,
    });
    setShowAddDialog(false);
  };

  const handleUpdateProduct = async (data: Partial<ProductImportRow>) => {
    if (!editingProduct) return;
    await updateProduct(editingProduct.id, data as any);
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      await deleteProduct(productId);
    }
  };

  const downloadSampleCSV = () => {
    const headers = [
      'sku', 'name', 'brand', 'category', 'gender', 'price', 'original_price',
      'image_url', 'sizes', 'colors', 'material', 'stock_quantity',
      'zone_id', 'aisle', 'row', 'shelf', 'rack'
    ].join(',');

    const sampleRows = [
      'SKU001,Blue Cotton Shirt,Arrow,shirts,male,1299,1599,https://example.com/shirt.jpg,S|M|L|XL,Blue|White,Cotton,50,zone-1,A,1,2,3',
      'SKU002,Floral Summer Dress,Zara,dresses,female,2499,2999,https://example.com/dress.jpg,XS|S|M|L,Red|Yellow,Polyester,30,zone-2,B,2,1,1',
    ];

    const csv = [headers, ...sampleRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mirrorx_products_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!selectedStore) {
    return (
      <div className="p-8 text-center">
        <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
        <h2 className="text-white text-xl font-semibold mb-2">No Store Selected</h2>
        <p className="text-white/60">Select a store from the sidebar to manage products</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-white/60">{productsTotal} products in {selectedStore.name}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-white/10 text-white hover:bg-white/10"
            onClick={() => setShowImportDialog(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
        </div>

        <Select value={selectedZone} onValueChange={setSelectedZone}>
          <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="All Zones" />
          </SelectTrigger>
          <SelectContent className="bg-midnight border-white/10">
            <SelectItem value="" className="text-white hover:bg-white/10">All Zones</SelectItem>
            {zones.map((zone) => (
              <SelectItem key={zone.id} value={zone.id} className="text-white hover:bg-white/10">
                {zone.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="bg-midnight border-white/10">
            <SelectItem value="" className="text-white hover:bg-white/10">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat} className="text-white hover:bg-white/10 capitalize">
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-red-400 hover:text-red-300"
            onClick={clearError}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Products Grid */}
      {isLoading && products.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">No Products Yet</h2>
          <p className="text-white/60 mb-6">Import products via CSV or add them manually</p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10"
              onClick={() => setShowImportDialog(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Button
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <AnimatePresence>
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/5 rounded-xl border border-white/5 overflow-hidden group"
              >
                {/* Product Image */}
                <div className="aspect-[3/4] relative overflow-hidden bg-white/5">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-white/20" />
                    </div>
                  )}

                  {/* Discount Badge */}
                  {product.original_price && product.original_price > product.price && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
                      {Math.round((1 - product.price / product.original_price) * 100)}% OFF
                    </div>
                  )}

                  {/* Actions Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/20"
                      onClick={() => setEditingProduct(product)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-3">
                  <p className="text-white/50 text-xs uppercase">{product.brand}</p>
                  <h3 className="text-white font-medium text-sm truncate">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white font-bold">{formatPrice(product.price)}</span>
                    {product.original_price && product.original_price > product.price && (
                      <span className="text-white/40 text-sm line-through">
                        {formatPrice(product.original_price)}
                      </span>
                    )}
                  </div>
                  {product.location && (
                    <p className="text-white/40 text-xs mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {product.location.aisle && `Aisle ${product.location.aisle}`}
                      {product.location.row && ` Row ${product.location.row}`}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Import CSV Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-midnight border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Products from CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-white/60 text-sm">
              Upload a CSV file with your product catalog. Required columns: sku, name, price, image_url
            </p>

            {/* File Upload Area */}
            <div
              className={cn(
                'border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer',
                'hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-white/40 mx-auto mb-3" />
              <p className="text-white font-medium">Click to upload CSV</p>
              <p className="text-white/40 text-sm mt-1">or drag and drop</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Import Results */}
            {importResults && (
              <div className={cn(
                'p-4 rounded-lg',
                importResults.imported_count > 0
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-red-500/10 border border-red-500/20'
              )}>
                {importResults.imported_count > 0 ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <Check className="w-5 h-5" />
                    <span>Successfully imported {importResults.imported_count} products</span>
                  </div>
                ) : null}

                {importResults.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-red-400 text-sm font-medium mb-1">
                      {importResults.errors.length} errors:
                    </p>
                    <ul className="text-red-400/80 text-xs space-y-1">
                      {importResults.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>
                          Row {err.row}: {err.sku} - {err.error}
                        </li>
                      ))}
                      {importResults.errors.length > 5 && (
                        <li>...and {importResults.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Sample CSV Download */}
            <Button
              variant="outline"
              className="w-full border-white/10 text-white hover:bg-white/10"
              onClick={downloadSampleCSV}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Sample CSV Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Product Dialog */}
      <ProductFormDialog
        open={showAddDialog || !!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingProduct(null);
          }
        }}
        product={editingProduct}
        zones={zones}
        onSave={editingProduct ? handleUpdateProduct : handleAddProduct}
        isLoading={isLoading}
      />
    </div>
  );
}

// Product Form Dialog Component
interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  zones: any[];
  onSave: (data: Partial<ProductImportRow>) => Promise<void>;
  isLoading: boolean;
}

function ProductFormDialog({
  open,
  onOpenChange,
  product,
  zones,
  onSave,
  isLoading,
}: ProductFormDialogProps) {
  const [formData, setFormData] = useState<Partial<ProductImportRow>>({
    name: '',
    brand: '',
    category: '',
    gender: 'unisex',
    price: 0,
    original_price: 0,
    image_url: '',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [],
    material: '',
    stock_quantity: 100,
    zone_id: '',
    aisle: '',
    row: '',
    shelf: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        brand: product.brand || '',
        category: product.category || '',
        gender: product.gender || 'unisex',
        price: product.price || 0,
        original_price: product.original_price || 0,
        image_url: product.image_url || '',
        sizes: product.sizes || ['S', 'M', 'L', 'XL'],
        colors: product.colors || [],
        material: product.material || '',
        stock_quantity: product.stock_quantity || 100,
        zone_id: product.zone_id || '',
        aisle: product.location?.aisle || '',
        row: product.location?.row || '',
        shelf: product.location?.shelf || '',
      });
    } else {
      setFormData({
        name: '',
        brand: '',
        category: '',
        gender: 'unisex',
        price: 0,
        original_price: 0,
        image_url: '',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: [],
        material: '',
        stock_quantity: 100,
        zone_id: '',
        aisle: '',
        row: '',
        shelf: '',
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-midnight border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2">
              <Label className="text-white/70">Product Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 bg-white/5 border-white/10 text-white"
                placeholder="Blue Cotton Shirt"
                required
              />
            </div>

            {/* Brand */}
            <div>
              <Label className="text-white/70">Brand</Label>
              <Input
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="mt-1 bg-white/5 border-white/10 text-white"
                placeholder="Arrow"
              />
            </div>

            {/* Category */}
            <div>
              <Label className="text-white/70">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-midnight border-white/10">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-white hover:bg-white/10 capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gender */}
            <div>
              <Label className="text-white/70">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-midnight border-white/10">
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g} className="text-white hover:bg-white/10 capitalize">
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Zone */}
            <div>
              <Label className="text-white/70">Store Zone</Label>
              <Select
                value={formData.zone_id}
                onValueChange={(value) => setFormData({ ...formData, zone_id: value })}
              >
                <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent className="bg-midnight border-white/10">
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id} className="text-white hover:bg-white/10">
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price */}
            <div>
              <Label className="text-white/70">Price (₹) *</Label>
              <Input
                type="number"
                value={(formData.price || 0) / 100}
                onChange={(e) => setFormData({ ...formData, price: Math.round(parseFloat(e.target.value) * 100) })}
                className="mt-1 bg-white/5 border-white/10 text-white"
                placeholder="1299"
                min="0"
                step="1"
                required
              />
            </div>

            {/* Original Price */}
            <div>
              <Label className="text-white/70">Original Price (₹)</Label>
              <Input
                type="number"
                value={(formData.original_price || 0) / 100}
                onChange={(e) => setFormData({ ...formData, original_price: Math.round(parseFloat(e.target.value) * 100) })}
                className="mt-1 bg-white/5 border-white/10 text-white"
                placeholder="1599"
                min="0"
                step="1"
              />
            </div>

            {/* Image URL */}
            <div className="col-span-2">
              <Label className="text-white/70">Image URL *</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="mt-1 bg-white/5 border-white/10 text-white"
                placeholder="https://example.com/product.jpg"
                required
              />
            </div>

            {/* Sizes */}
            <div>
              <Label className="text-white/70">Sizes (comma separated)</Label>
              <Input
                value={formData.sizes?.join(', ')}
                onChange={(e) => setFormData({ ...formData, sizes: e.target.value.split(',').map(s => s.trim()) })}
                className="mt-1 bg-white/5 border-white/10 text-white"
                placeholder="S, M, L, XL"
              />
            </div>

            {/* Stock */}
            <div>
              <Label className="text-white/70">Stock Quantity</Label>
              <Input
                type="number"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) })}
                className="mt-1 bg-white/5 border-white/10 text-white"
                min="0"
              />
            </div>

            {/* Location */}
            <div className="col-span-2">
              <Label className="text-white/70">Location (Planogram)</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                <Input
                  value={formData.aisle}
                  onChange={(e) => setFormData({ ...formData, aisle: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Aisle"
                />
                <Input
                  value={formData.row}
                  onChange={(e) => setFormData({ ...formData, row: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Row"
                />
                <Input
                  value={formData.shelf}
                  onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Shelf"
                />
                <Input
                  value={formData.rack}
                  onChange={(e) => setFormData({ ...formData, rack: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Rack"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {product ? 'Update Product' : 'Add Product'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
