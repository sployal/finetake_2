'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  X, 
  Check, 
  Trash2, 
  Download, 
  Share2, 
  RefreshCw, 
  Filter, 
  ShoppingCart, 
  CreditCard,
  Image as ImageIcon,
  CheckSquare,
  Square
} from 'lucide-react';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types
interface ImageData {
  id: string;
  image_url: string;
  status: 'paid' | 'unpaid';
  collection_title?: string;
  sender_name?: string;
  file_name?: string;
}

interface PaymentStatusUpdate {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'timeout';
  isPending: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  message?: string;
  mpesaReceiptNumber?: string;
}

interface DeleteResult {
  success: boolean;
  successCount: number;
  failedCount: number;
  message?: string;
  error?: string;
}

// Image Service
const imageService = {
  unpaidImages: [] as ImageData[],
  paidImages: [] as ImageData[],
  isLoading: false,
  
  async loadImages(userId: string) {
    this.isLoading = true;
    try {
      let imagesData: any[] = [];
      let loaded = false;

      // Try user_images table first
      const { data: userImagesData, error: userImagesError } = await supabase
        .from('user_images')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!userImagesError && userImagesData) {
        imagesData = userImagesData;
        loaded = true;
      }

      // If not found, try collections table
      if (!loaded) {
        const { data: collectionsData, error: collectionsError } = await supabase
          .from('collections')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!collectionsError && collectionsData) {
          imagesData = collectionsData;
          loaded = true;
        }
      }

      // If still not found, try marketplace_images table
      if (!loaded) {
        const { data: marketplaceData, error: marketplaceError } = await supabase
          .from('marketplace_images')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!marketplaceError && marketplaceData) {
          imagesData = marketplaceData;
          loaded = true;
        }
      }

      // If still not found, try to get images from user_purchases or user_collections
      if (!loaded) {
        // Check if user has purchased images
        const { data: purchasesData, error: purchasesError } = await supabase
          .from('user_purchases')
          .select('*, image:image_id(*)')
          .eq('user_id', userId);

        if (!purchasesError && purchasesData && purchasesData.length > 0) {
          // Map purchased images
          imagesData = purchasesData
            .filter(p => p.image)
            .map(p => ({ ...p.image, status: 'paid', purchase_id: p.id }));
          loaded = true;
        }
      }

      // If we have images, check payment status from purchases table
      if (imagesData.length > 0) {
        const { data: purchases, error: purchasesError } = await supabase
          .from('user_purchases')
          .select('image_id, status')
          .eq('user_id', userId)
          .in('image_id', imagesData.map(img => img.id));

        if (!purchasesError && purchases) {
          const purchaseMap = new Map(
            purchases.map(p => [p.image_id, p.status === 'completed' || p.status === 'paid'])
          );
          
          // Update image status based on purchases
          imagesData = imagesData.map(img => ({
            ...img,
            status: purchaseMap.get(img.id) ? 'paid' : (img.status || 'unpaid')
          }));
        }
      }

      // Process the loaded images
      this.processImages(imagesData);
    } catch (err) {
      console.error('Error loading images:', err);
      this.unpaidImages = [];
      this.paidImages = [];
    } finally {
      this.isLoading = false;
    }
  },

  processImages(images: any[]) {
    this.unpaidImages = [];
    this.paidImages = [];

    images.forEach((img) => {
      const imageData: ImageData = {
        id: img.id,
        image_url: img.image_url || img.imageUrl || img.url || '',
        status: img.status === 'paid' || img.is_paid || img.payment_status === 'completed' ? 'paid' : 'unpaid',
        collection_title: img.collection_title || img.title || img.name || undefined,
        sender_name: img.sender_name || img.sender || img.photographer_name || undefined,
        file_name: img.file_name || img.filename || undefined
      };

      if (imageData.status === 'paid') {
        this.paidImages.push(imageData);
      } else {
        this.unpaidImages.push(imageData);
      }
    });
  }
};

const adminPricingHelper = {
  currentPrice: 100,
  
  async loadCurrentPrice() {
    try {
      // Try to fetch current price from settings or pricing table
      const { data: settings, error } = await supabase
        .from('settings')
        .select('image_price, current_price')
        .eq('key', 'image_price')
        .single();

      if (!error && settings) {
        this.currentPrice = settings.image_price || settings.current_price || 100;
        return;
      }

      // Try pricing table
      const { data: pricing, error: pricingError } = await supabase
        .from('pricing')
        .select('price')
        .eq('item_type', 'image')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!pricingError && pricing) {
        this.currentPrice = pricing.price || 100;
      }
    } catch (error) {
      console.error('Error loading current price:', error);
      // Keep default price of 100
    }
  }
};

const paymentManager = {
  isValidPhoneNumber(phone: string) {
    return /^(07|01)\d{8}$/.test(phone);
  },
  
  isValidAmount(amount: number) {
    return amount > 0 && amount <= 150000;
  },
  
  async initiateImagePayment(params: {
    phoneNumber: string;
    imageIds: string[];
    totalAmount: number;
    transactionDescription: string;
  }) {
    // TODO: Replace with actual API call
    return { success: true, transactionId: 'mock-txn-id', error: null };
  },
  
  cancelTransaction(txnId: string) {
    // TODO: Implement cancellation
  }
};

const deleteService = {
  async deleteImage(imageId: string): Promise<DeleteResult> {
    try {
      // Try to delete from user_images table
      const { error: userImagesError } = await supabase
        .from('user_images')
        .delete()
        .eq('id', imageId);

      if (userImagesError) {
        // Try collections table
        const { error: collectionsError } = await supabase
          .from('collections')
          .delete()
          .eq('id', imageId);

        if (collectionsError) {
          // Try marketplace_images table
          const { error: marketplaceError } = await supabase
            .from('marketplace_images')
            .delete()
            .eq('id', imageId);

          if (marketplaceError) {
            console.error('Error deleting image:', marketplaceError);
            return { success: false, successCount: 0, failedCount: 1, error: marketplaceError.message };
          }
        }
      }

      return { success: true, successCount: 1, failedCount: 0 };
    } catch (error: any) {
      console.error('Error deleting image:', error);
      return { success: false, successCount: 0, failedCount: 1, error: error.message };
    }
  },
  
  async deleteMultipleImages(imageIds: string[]): Promise<DeleteResult> {
    try {
      let successCount = 0;
      let failedCount = 0;

      for (const imageId of imageIds) {
        const result = await this.deleteImage(imageId);
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
        }
      }

      return { 
        success: failedCount === 0, 
        successCount, 
        failedCount 
      };
    } catch (error: any) {
      console.error('Error deleting multiple images:', error);
      return { 
        success: false, 
        successCount: 0, 
        failedCount: imageIds.length, 
        error: error.message 
      };
    }
  }
};

const downloadManager = {
  sanitizeFileName(name: string) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  },
  
  async downloadImage(url: string, fileName: string) {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  },
  
  async shareImage(url: string, fileName: string) {
    if (navigator.share) {
      await navigator.share({
        title: fileName,
        text: 'Check out this image',
        url: url
      });
    }
  }
};

// Main Component
export default function Market() {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [senderFilter, setSenderFilter] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(100);
  const [images, setImages] = useState<ImageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set());
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  
  // Dialog states
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [selectedImageForDownload, setSelectedImageForDownload] = useState<ImageData | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentDetails, setPaymentDetails] = useState<{
    imageIds: string[];
    totalAmount: number;
    description: string;
  } | null>(null);

  useEffect(() => {
    loadUserAndImages();
    loadCurrentPrice();
  }, []);

  const loadUserAndImages = async () => {
    try {
      setIsLoading(true);
      
      // Get current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('User not authenticated:', userError);
        showSnackBar('Please sign in to view images', 'error');
        setIsLoading(false);
        return;
      }

      // Load images for the logged-in user
      await imageService.loadImages(user.id);
      
      // Update state with loaded images
      const allImages = [...imageService.unpaidImages, ...imageService.paidImages];
      setImages(allImages);
      
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      
      setIsAdmin(profile?.is_admin || false);
    } catch (error) {
      console.error('Error loading user and images:', error);
      showSnackBar('Failed to load images', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadImages = async () => {
    await loadUserAndImages();
  };

  const loadCurrentPrice = async () => {
    await adminPricingHelper.loadCurrentPrice();
    setCurrentPrice(adminPricingHelper.currentPrice);
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedImages(new Set());
    }
  };

  const toggleImageSelection = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId);
    } else {
      newSelected.add(imageId);
    }
    setSelectedImages(newSelected);
  };

  const calculateTotalPrice = () => {
    return selectedImages.size * currentPrice;
  };

  const handleSingleImageDeletion = async (image: ImageData) => {
    if (!confirm(`Delete "${image.collection_title || 'this image'}"?`)) return;

    setDeletingImages(prev => new Set(prev).add(image.id));
    try {
      const result = await deleteService.deleteImage(image.id);
      if (result.success) {
        showSnackBar('Image deleted successfully', 'success');
        loadImages();
      } else {
        showSnackBar(result.error || 'Failed to delete image', 'error');
      }
    } catch (error) {
      showSnackBar(`Error deleting image: ${error}`, 'error');
    } finally {
      setDeletingImages(prev => {
        const next = new Set(prev);
        next.delete(image.id);
        return next;
      });
    }
  };

  const handleBulkDeletion = async () => {
    if (selectedImages.size === 0) {
      showSnackBar('No images selected for deletion', 'error');
      return;
    }

    if (!confirm(`Delete ${selectedImages.size} image${selectedImages.size === 1 ? '' : 's'}?`)) return;

    setIsBulkDeleting(true);
    try {
      const result = await deleteService.deleteMultipleImages(Array.from(selectedImages));
      showSnackBar(`Deleted ${result.successCount} image${result.successCount === 1 ? '' : 's'}`, 'success');
      
      if (result.successCount > 0) {
        setSelectedImages(new Set());
        setIsSelectionMode(false);
        loadImages();
      }
    } catch (error) {
      showSnackBar(`Error during bulk deletion: ${error}`, 'error');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSingleImagePayment = (image: ImageData) => {
    setPaymentDetails({
      imageIds: [image.id],
      totalAmount: currentPrice,
      description: `Purchase 1 image: ${image.collection_title || 'Untitled'}`
    });
    setShowPaymentDialog(true);
  };

  const handleBulkPayment = () => {
    if (selectedImages.size === 0) {
      showSnackBar('No images selected for payment', 'error');
      return;
    }

    setPaymentDetails({
      imageIds: Array.from(selectedImages),
      totalAmount: calculateTotalPrice(),
      description: `Purchase ${selectedImages.size} image${selectedImages.size === 1 ? '' : 's'}`
    });
    setShowPaymentDialog(true);
  };

  const initiatePayment = async () => {
    if (!paymentDetails) return;

    if (!phoneNumber) {
      showSnackBar('Please enter your phone number', 'error');
      return;
    }

    if (!paymentManager.isValidPhoneNumber(phoneNumber)) {
      showSnackBar('Please enter a valid Kenyan phone number (e.g., 0712345678)', 'error');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const response = await paymentManager.initiateImagePayment({
        phoneNumber,
        imageIds: paymentDetails.imageIds,
        totalAmount: paymentDetails.totalAmount,
        transactionDescription: paymentDetails.description
      });

      if (response.success && response.transactionId) {
        setCurrentTransactionId(response.transactionId);
        showSnackBar('Payment initiated. Check your phone for M-Pesa prompt.', 'success');
      } else {
        setIsProcessingPayment(false);
        showSnackBar(response.error || 'Failed to initiate payment', 'error');
      }
    } catch (error) {
      setIsProcessingPayment(false);
      showSnackBar(`Error initiating payment: ${error}`, 'error');
    }
  };

  const getFilteredImages = () => {
    let filtered: ImageData[] = [];

    // Use the images state instead of imageService directly
    const unpaid = images.filter(img => img.status === 'unpaid');
    const paid = images.filter(img => img.status === 'paid');

    if (statusFilter === 'all') {
      filtered = [...unpaid, ...paid];
    } else if (statusFilter === 'unpaid') {
      filtered = [...unpaid];
    } else {
      filtered = [...paid];
    }

    if (senderFilter !== 'all') {
      filtered = filtered.filter(img => img.sender_name === senderFilter);
    }

    return filtered;
  };

  const getAllSenders = () => {
    const senders = new Set<string>();
    images.forEach(img => {
      senders.add(img.sender_name || 'Unknown');
    });
    return Array.from(senders);
  };

  const showSnackBar = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // TODO: Implement toast notification
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const filteredImages = getFilteredImages();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Selection Mode Header */}
      {isSelectionMode && (
        <div className="bg-blue-600 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={toggleSelectionMode} className="text-white">
            <X size={24} />
          </button>
          <span className="flex-1 text-white font-semibold">
            {selectedImages.size} selected
          </span>
          {selectedImages.size > 0 && (
            <>
              <button
                onClick={handleBulkDeletion}
                disabled={isBulkDeleting}
                className="flex items-center gap-2 px-3 py-1.5 text-white hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={18} />
                )}
                <span>{isBulkDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
              <button
                onClick={handleBulkPayment}
                disabled={isProcessingPayment}
                className="flex items-center gap-2 px-3 py-1.5 bg-white text-blue-600 rounded font-semibold hover:bg-gray-100 disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CreditCard size={18} />
                )}
                <span>
                  {isProcessingPayment ? 'Processing...' : `Pay KSH ${calculateTotalPrice()}`}
                </span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Images</h1>
            <p className="text-sm text-gray-500 mt-1">
              {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadImages}
              className="p-2 hover:bg-gray-200 rounded-full transition"
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={toggleSelectionMode}
              className="p-2 hover:bg-gray-200 rounded-full transition"
            >
              {isSelectionMode ? <CheckSquare size={20} /> : <Square size={20} />}
            </button>
            <button
              onClick={() => setShowFilterDialog(true)}
              className="p-2 hover:bg-gray-200 rounded-full transition"
            >
              <Filter size={20} />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredImages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ImageIcon size={64} />
            <p className="text-lg mt-4">No images match your filters</p>
            <p className="text-sm">Try adjusting your filter settings</p>
          </div>
        )}

        {/* Images Grid */}
        {!isLoading && filteredImages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredImages.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                isSelected={selectedImages.has(image.id)}
                isSelectionMode={isSelectionMode}
                isDeleting={deletingImages.has(image.id)}
                currentPrice={currentPrice}
                onToggleSelection={toggleImageSelection}
                onDelete={handleSingleImageDeletion}
                onPayment={handleSingleImagePayment}
                onDownload={(img) => {
                  setSelectedImageForDownload(img);
                  setShowDownloadDialog(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      {showPaymentDialog && paymentDetails && (
        <Dialog onClose={() => !isProcessingPayment && setShowPaymentDialog(false)}>
          <h2 className="text-xl font-bold mb-4">Complete Payment</h2>
          <p className="mb-2">{paymentDetails.description}</p>
          <p className="text-2xl font-bold text-green-600 mb-4">
            Total: KSH {paymentDetails.totalAmount}
          </p>
          
          {!isProcessingPayment ? (
            <>
              <label className="block mb-2 text-sm font-medium">
                Enter your M-Pesa phone number:
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-4"
                placeholder="0712345678"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowPaymentDialog(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={initiatePayment}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Pay Now
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4 py-4">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="font-medium">Processing payment...</p>
                <p className="text-sm text-gray-600">Check your phone for M-Pesa prompt</p>
              </div>
            </div>
          )}
        </Dialog>
      )}

      {/* Filter Dialog */}
      {showFilterDialog && (
        <Dialog onClose={() => setShowFilterDialog(false)}>
          <h2 className="text-xl font-bold mb-4">Filter Images</h2>
          
          <div className="mb-4">
            <h3 className="font-medium mb-2">Status</h3>
            <div className="flex flex-wrap gap-2">
              {(['all', 'unpaid', 'paid'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-full ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-medium mb-2">Sender</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSenderFilter('all')}
                className={`px-3 py-1.5 rounded-full ${
                  senderFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All
              </button>
              {getAllSenders().map((sender) => (
                <button
                  key={sender}
                  onClick={() => setSenderFilter(sender)}
                  className={`px-3 py-1.5 rounded-full ${
                    senderFilter === sender
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {sender}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setStatusFilter('all');
                setSenderFilter('all');
              }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Clear
            </button>
            <button
              onClick={() => setShowFilterDialog(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </Dialog>
      )}

      {/* Download Dialog */}
      {showDownloadDialog && selectedImageForDownload && (
        <Dialog onClose={() => setShowDownloadDialog(false)}>
          <h2 className="text-xl font-bold mb-4">Image Options</h2>
          <button
            onClick={() => {
              downloadManager.downloadImage(
                selectedImageForDownload.image_url,
                downloadManager.sanitizeFileName(
                  selectedImageForDownload.file_name || 
                  selectedImageForDownload.collection_title || 
                  'Image'
                )
              );
              setShowDownloadDialog(false);
            }}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 rounded"
          >
            <Download className="text-green-600" size={24} />
            <div className="text-left">
              <p className="font-medium">Download Image</p>
              <p className="text-sm text-gray-600">Save to device downloads</p>
            </div>
          </button>
          <button
            onClick={() => {
              downloadManager.shareImage(
                selectedImageForDownload.image_url,
                downloadManager.sanitizeFileName(
                  selectedImageForDownload.file_name || 
                  selectedImageForDownload.collection_title || 
                  'Image'
                )
              );
              setShowDownloadDialog(false);
            }}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 rounded"
          >
            <Share2 className="text-blue-600" size={24} />
            <div className="text-left">
              <p className="font-medium">Share Image</p>
              <p className="text-sm text-gray-600">Share with friends</p>
            </div>
          </button>
        </Dialog>
      )}
    </div>
  );
}

// Image Card Component
function ImageCard({
  image,
  isSelected,
  isSelectionMode,
  isDeleting,
  currentPrice,
  onToggleSelection,
  onDelete,
  onPayment,
  onDownload
}: {
  image: ImageData;
  isSelected: boolean;
  isSelectionMode: boolean;
  isDeleting: boolean;
  currentPrice: number;
  onToggleSelection: (id: string) => void;
  onDelete: (image: ImageData) => void;
  onPayment: (image: ImageData) => void;
  onDownload: (image: ImageData) => void;
}) {
  const isPaid = image.status === 'paid';

  const handleClick = () => {
    if (isSelectionMode && !isPaid) {
      onToggleSelection(image.id);
    } else if (isPaid) {
      onDownload(image);
    } else {
      onPayment(image);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg cursor-pointer group"
    >
      <img
        src={image.image_url}
        alt={image.collection_title || 'Image'}
        className="w-full h-full object-cover"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      
      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(image);
        }}
        className="absolute top-2 left-2 p-1.5 bg-black/30 rounded-full hover:bg-black/50 transition"
      >
        {isDeleting ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Trash2 size={16} className="text-white" />
        )}
      </button>
      
      {/* Selection Checkbox */}
      {isSelectionMode && !isPaid && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center"
             style={{
               backgroundColor: isSelected ? '#2563eb' : 'rgba(255,255,255,0.7)',
               borderColor: isSelected ? '#2563eb' : '#6b7280'
             }}>
          {isSelected && <Check size={16} className="text-white" />}
        </div>
      )}
      
      {/* Status Badge */}
      {(!isSelectionMode || isPaid) && (
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${
          isPaid ? 'bg-green-500' : 'bg-orange-500'
        } text-white`}>
          {isPaid ? 'OWNED' : `KSH ${currentPrice}`}
        </div>
      )}
      
      {/* Image Info */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="text-white font-bold text-sm truncate">
          {image.collection_title || 'Untitled Collection'}
        </h3>
        <p className="text-white/70 text-xs truncate">
          by {image.sender_name || 'Unknown'}
        </p>
      </div>
      
      {/* Action Icon */}
      <div className="absolute bottom-3 right-3 p-1.5 bg-black/50 rounded-full">
        {isPaid ? (
          <Download size={18} className="text-white" />
        ) : isSelectionMode ? (
          <ShoppingCart size={18} className="text-white" />
        ) : (
          <CreditCard size={18} className="text-white" />
        )}
      </div>
    </div>
  );
}

// Dialog Component
function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}