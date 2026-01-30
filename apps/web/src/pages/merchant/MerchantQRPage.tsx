import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, Download, Printer, RefreshCw, Store, Grid3X3,
  Package, Check, X, AlertCircle, Copy, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useMerchantStore } from '@/store/merchant-store';

export default function MerchantQRPage() {
  const {
    selectedStore,
    zones,
    qrCodes,
    isLoading,
    error,
    fetchZones,
    fetchQRCodes,
    generateQRCodes,
    clearError,
  } = useMerchantStore();

  const [activeTab, setActiveTab] = useState<'store' | 'zone' | 'product'>('store');
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedQRs, setSelectedQRs] = useState<string[]>([]);

  useEffect(() => {
    if (selectedStore) {
      fetchZones();
      fetchQRCodes();
    }
  }, [selectedStore, fetchZones, fetchQRCodes]);

  const filteredQRCodes = qrCodes.filter(qr => qr.qr_type === activeTab);

  const handleGenerateQR = async (type: 'store' | 'zone' | 'product', referenceIds?: string[]) => {
    const codes = await generateQRCodes({
      qr_type: type,
      reference_ids: referenceIds,
      include_all: !referenceIds,
    });
    if (codes.length > 0) {
      setShowGenerateDialog(false);
    }
  };

  const handleDownloadQR = (qrCode: typeof qrCodes[0]) => {
    const link = document.createElement('a');
    link.download = `mirrorx-qr-${qrCode.qr_type}-${qrCode.short_code}.png`;
    link.href = qrCode.qr_data_url;
    link.click();
  };

  const handleDownloadSelected = () => {
    selectedQRs.forEach(id => {
      const qr = qrCodes.find(q => q.id === id);
      if (qr) {
        handleDownloadQR(qr);
      }
    });
  };

  const handlePrintSelected = () => {
    const selectedCodes = qrCodes.filter(q => selectedQRs.includes(q.id));
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>MirrorX QR Codes - ${selectedStore?.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
            }
            .qr-card {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 16px;
              text-align: center;
              page-break-inside: avoid;
            }
            .qr-card img {
              width: 150px;
              height: 150px;
            }
            .qr-card h3 {
              margin: 8px 0 4px;
              font-size: 14px;
            }
            .qr-card p {
              margin: 0;
              font-size: 12px;
              color: #666;
            }
            .qr-card .code {
              font-family: monospace;
              background: #f5f5f5;
              padding: 4px 8px;
              border-radius: 4px;
              margin-top: 8px;
              display: inline-block;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
              Print QR Codes
            </button>
          </div>
          <h1 style="text-align: center; margin-bottom: 20px;">${selectedStore?.name} - QR Codes</h1>
          <div class="grid">
            ${selectedCodes.map(qr => `
              <div class="qr-card">
                <img src="${qr.qr_data_url}" alt="QR Code" />
                <h3>${getQRTitle(qr)}</h3>
                <p class="code">${qr.short_code}</p>
                <p style="margin-top: 8px; font-size: 10px; color: #999;">
                  ${qr.deep_link_url}
                </p>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const getQRTitle = (qr: typeof qrCodes[0]) => {
    if (qr.qr_type === 'store') {
      return selectedStore?.name || 'Store QR';
    }
    if (qr.qr_type === 'zone') {
      const zone = zones.find(z => z.id === qr.reference_id);
      return zone?.name || 'Zone QR';
    }
    return `Product: ${qr.reference_id.slice(0, 8)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleSelectQR = (id: string) => {
    setSelectedQRs(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedQRs(filteredQRCodes.map(qr => qr.id));
  };

  const deselectAll = () => {
    setSelectedQRs([]);
  };

  if (!selectedStore) {
    return (
      <div className="p-8 text-center">
        <QrCode className="w-16 h-16 text-white/20 mx-auto mb-4" />
        <h2 className="text-white text-xl font-semibold mb-2">No Store Selected</h2>
        <p className="text-white/60">Select a store from the sidebar to manage QR codes</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">QR Codes</h1>
          <p className="text-white/60">Generate and manage QR codes for {selectedStore.name}</p>
        </div>

        <div className="flex items-center gap-3">
          {selectedQRs.length > 0 && (
            <>
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/10"
                onClick={handleDownloadSelected}
              >
                <Download className="w-4 h-4 mr-2" />
                Download ({selectedQRs.length})
              </Button>
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/10"
                onClick={handlePrintSelected}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print ({selectedQRs.length})
              </Button>
            </>
          )}
          <Button
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
            onClick={() => setShowGenerateDialog(true)}
          >
            <QrCode className="w-4 h-4 mr-2" />
            Generate QR
          </Button>
        </div>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="store" className="data-[state=active]:bg-indigo-500">
              <Store className="w-4 h-4 mr-2" />
              Store
            </TabsTrigger>
            <TabsTrigger value="zone" className="data-[state=active]:bg-indigo-500">
              <Grid3X3 className="w-4 h-4 mr-2" />
              Zones
            </TabsTrigger>
            <TabsTrigger value="product" className="data-[state=active]:bg-indigo-500">
              <Package className="w-4 h-4 mr-2" />
              Products
            </TabsTrigger>
          </TabsList>

          {filteredQRCodes.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/60 hover:text-white"
                onClick={selectAll}
              >
                Select All
              </Button>
              {selectedQRs.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white"
                  onClick={deselectAll}
                >
                  Deselect All
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Store QR */}
        <TabsContent value="store">
          {filteredQRCodes.length === 0 ? (
            <EmptyQRState
              type="store"
              onGenerate={() => handleGenerateQR('store')}
              isLoading={isLoading}
            />
          ) : (
            <QRGrid
              qrCodes={filteredQRCodes}
              selectedQRs={selectedQRs}
              onToggleSelect={toggleSelectQR}
              onDownload={handleDownloadQR}
              onCopy={copyToClipboard}
              getTitle={getQRTitle}
            />
          )}
        </TabsContent>

        {/* Zone QRs */}
        <TabsContent value="zone">
          {filteredQRCodes.length === 0 ? (
            <EmptyQRState
              type="zone"
              onGenerate={() => handleGenerateQR('zone')}
              isLoading={isLoading}
            />
          ) : (
            <QRGrid
              qrCodes={filteredQRCodes}
              selectedQRs={selectedQRs}
              onToggleSelect={toggleSelectQR}
              onDownload={handleDownloadQR}
              onCopy={copyToClipboard}
              getTitle={getQRTitle}
            />
          )}
        </TabsContent>

        {/* Product QRs */}
        <TabsContent value="product">
          {filteredQRCodes.length === 0 ? (
            <EmptyQRState
              type="product"
              onGenerate={() => handleGenerateQR('product')}
              isLoading={isLoading}
            />
          ) : (
            <QRGrid
              qrCodes={filteredQRCodes}
              selectedQRs={selectedQRs}
              onToggleSelect={toggleSelectQR}
              onDownload={handleDownloadQR}
              onCopy={copyToClipboard}
              getTitle={getQRTitle}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Generate QR Dialog */}
      <GenerateQRDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        zones={zones}
        onGenerate={handleGenerateQR}
        isLoading={isLoading}
      />
    </div>
  );
}

// Empty State Component
interface EmptyQRStateProps {
  type: 'store' | 'zone' | 'product';
  onGenerate: () => void;
  isLoading: boolean;
}

function EmptyQRState({ type, onGenerate, isLoading }: EmptyQRStateProps) {
  const icons = {
    store: Store,
    zone: Grid3X3,
    product: Package,
  };
  const Icon = icons[type];

  return (
    <div className="text-center py-20">
      <Icon className="w-16 h-16 text-white/20 mx-auto mb-4" />
      <h2 className="text-white text-xl font-semibold mb-2">No {type} QR codes</h2>
      <p className="text-white/60 mb-6">Generate QR codes for your {type}s</p>
      <Button
        className="bg-indigo-500 hover:bg-indigo-600 text-white"
        onClick={onGenerate}
        disabled={isLoading}
      >
        {isLoading ? (
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <QrCode className="w-4 h-4 mr-2" />
        )}
        Generate {type} QR
      </Button>
    </div>
  );
}

// QR Grid Component
interface QRGridProps {
  qrCodes: any[];
  selectedQRs: string[];
  onToggleSelect: (id: string) => void;
  onDownload: (qr: any) => void;
  onCopy: (text: string) => void;
  getTitle: (qr: any) => string;
}

function QRGrid({
  qrCodes,
  selectedQRs,
  onToggleSelect,
  onDownload,
  onCopy,
  getTitle,
}: QRGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <AnimatePresence>
        {qrCodes.map((qr, index) => (
          <motion.div
            key={qr.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              'bg-white/5 rounded-xl border overflow-hidden cursor-pointer transition-all',
              selectedQRs.includes(qr.id)
                ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                : 'border-white/5 hover:border-white/20'
            )}
            onClick={() => onToggleSelect(qr.id)}
          >
            {/* Selection Indicator */}
            <div className={cn(
              'absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-all',
              selectedQRs.includes(qr.id)
                ? 'bg-indigo-500 text-white'
                : 'bg-white/10 text-transparent'
            )}>
              <Check className="w-4 h-4" />
            </div>

            {/* QR Image */}
            <div className="aspect-square p-4 bg-white flex items-center justify-center relative">
              <img
                src={qr.qr_data_url}
                alt={getTitle(qr)}
                className="w-full h-full object-contain"
              />
            </div>

            {/* QR Info */}
            <div className="p-3">
              <h3 className="text-white font-medium text-sm truncate">{getTitle(qr)}</h3>
              <p className="text-white/40 text-xs font-mono mt-1">{qr.short_code}</p>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs border-white/10 text-white hover:bg-white/10"
                  onClick={() => onDownload(qr)}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 border-white/10 text-white hover:bg-white/10"
                  onClick={() => onCopy(qr.deep_link_url)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 border-white/10 text-white hover:bg-white/10"
                  onClick={() => window.open(qr.deep_link_url, '_blank')}
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Generate QR Dialog
interface GenerateQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zones: any[];
  onGenerate: (type: 'store' | 'zone' | 'product', referenceIds?: string[]) => Promise<void>;
  isLoading: boolean;
}

function GenerateQRDialog({
  open,
  onOpenChange,
  zones,
  onGenerate,
  isLoading,
}: GenerateQRDialogProps) {
  const [qrType, setQrType] = useState<'store' | 'zone' | 'product'>('store');
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (qrType === 'zone' && selectedZones.length > 0) {
      await onGenerate('zone', selectedZones);
    } else {
      await onGenerate(qrType);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-midnight border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Generate QR Codes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-white/70">QR Type</Label>
            <Select value={qrType} onValueChange={(v) => setQrType(v as any)}>
              <SelectTrigger className="mt-1 bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-midnight border-white/10">
                <SelectItem value="store" className="text-white hover:bg-white/10">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    Store Entry QR
                  </div>
                </SelectItem>
                <SelectItem value="zone" className="text-white hover:bg-white/10">
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4" />
                    Zone QRs
                  </div>
                </SelectItem>
                <SelectItem value="product" className="text-white hover:bg-white/10">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Product QRs
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {qrType === 'zone' && zones.length > 0 && (
            <div>
              <Label className="text-white/70">Select Zones (or leave empty for all)</Label>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {zones.map((zone) => (
                  <label
                    key={zone.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all',
                      selectedZones.includes(zone.id)
                        ? 'bg-indigo-500/20 border border-indigo-500/50'
                        : 'bg-white/5 border border-white/10 hover:border-white/20'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedZones.includes(zone.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedZones([...selectedZones, zone.id]);
                        } else {
                          setSelectedZones(selectedZones.filter(id => id !== zone.id));
                        }
                      }}
                      className="sr-only"
                    />
                    <div className={cn(
                      'w-5 h-5 rounded border flex items-center justify-center',
                      selectedZones.includes(zone.id)
                        ? 'bg-indigo-500 border-indigo-500'
                        : 'border-white/30'
                    )}>
                      {selectedZones.includes(zone.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-white">{zone.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/5 rounded-lg p-4">
            <h4 className="text-white font-medium mb-2">What will be generated:</h4>
            <ul className="text-white/60 text-sm space-y-1">
              {qrType === 'store' && (
                <li>- 1 QR code for store entry point</li>
              )}
              {qrType === 'zone' && (
                <li>
                  - {selectedZones.length > 0 ? selectedZones.length : zones.length} zone QR codes
                </li>
              )}
              {qrType === 'product' && (
                <li>- QR codes for all active products</li>
              )}
            </ul>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4 mr-2" />
              )}
              Generate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
