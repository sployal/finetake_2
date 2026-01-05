'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Trash2, 
  Download, 
  Share2, 
  Check, 
  Image as ImageIcon, 
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Types
interface ImageData {
  id: string;
  image_url: string;
  title?: string;
  collection_title?: string;
  sender_name?: string;
  file_name?: string;
}

interface UserType {
  type: 'photographer' | 'admin' | 'user' | null;
  displayName: string;
  color: string;
}

// Mock services - replace with your actual API calls
const getUserType = async (): Promise<UserType> => {
  // Replace with actual API call
  return {
    type: 'photographer',
    displayName: 'Photographer',
    color: '#3b82f6'
  };
};

const fetchPaidImages = async (): Promise<ImageData[]> => {
  // Replace with actual API call
  return [];
};

const deleteImage = async (imageId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  // Replace with actual API call
  return { success: true, message: 'Image deleted successfully' };
};

export default function CollectionsPage() {
  const [activeTab, setActiveTab] = useState<'collection' | 'marketplace' | 'send'>('marketplace');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [paidImages, setPaidImages] = useState<ImageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<{ image: ImageData; index: number } | null>(null);
  const [showAppBar, setShowAppBar] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    loadUserTypeAndImages();
  }, []);

  const loadUserTypeAndImages = async () => {
    try {
      setIsLoading(true);
      const [user, images] = await Promise.all([
        getUserType(),
        fetchPaidImages()
      ]);
      setUserType(user);
      setPaidImages(images);
      setHasError(false);
    } catch (error) {
      setHasError(true);
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteImage = async (image: ImageData) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    setDeletingImages(prev => new Set(prev).add(image.id));

    try {
      const result = await deleteImage(image.id);
      
      if (result.success) {
        setPaidImages(prev => prev.filter(img => img.id !== image.id));
        showNotification(result.message || 'Image deleted successfully', 'success');
        
        // Close viewer if last image
        if (selectedImage && paidImages.length === 1) {
          setSelectedImage(null);
        }
      } else {
        showNotification(result.error || 'Failed to delete image', 'error');
      }
    } catch (error) {
      showNotification('Error deleting image', 'error');
    } finally {
      setDeletingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(image.id);
        return newSet;
      });
    }
  };

  const handleDownloadImage = (image: ImageData) => {
    const fileName = image.file_name || image.title || image.collection_title || 'image';
    const link = document.createElement('a');
    link.href = image.image_url;
    link.download = fileName;
    link.click();
    showNotification('Download started', 'success');
  };

  const handleShareImage = async (image: ImageData) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: image.title || 'Shared Image',
          url: image.image_url
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(image.image_url);
      showNotification('Link copied to clipboard', 'success');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    // Implement your notification system here
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const canSendImages = userType?.type === 'photographer' || userType?.type === 'admin';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-4">Failed to load user data</h2>
          <button
            onClick={loadUserTypeAndImages}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold">Collections</h1>
            
            {userType && (
              <div 
                className="px-3 py-1.5 rounded-xl border text-sm font-semibold"
                style={{ 
                  backgroundColor: `${userType.color}1A`,
                  borderColor: `${userType.color}4D`,
                  color: userType.color
                }}
              >
                {userType.displayName}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('collection')}
              className={`flex-1 px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'collection'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              My Collection
            </button>
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`flex-1 px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'marketplace'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Marketplace
            </button>
            {canSendImages && (
              <button
                onClick={() => setActiveTab('send')}
                className={`flex-1 px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === 'send'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Send Images
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'collection' && (
          <MyCollectionTab
            paidImages={paidImages}
            deletingImages={deletingImages}
            onDeleteImage={handleDeleteImage}
            onDownloadImage={handleDownloadImage}
            onShareImage={handleShareImage}
            onImageClick={(image, index) => setSelectedImage({ image, index })}
            onRefresh={loadUserTypeAndImages}
            onSwitchToMarketplace={() => setActiveTab('marketplace')}
          />
        )}

        {activeTab === 'marketplace' && (
          <div className="text-center py-12 text-gray-500">
            Marketplace content goes here
          </div>
        )}

        {activeTab === 'send' && canSendImages && (
          <div className="text-center py-12 text-gray-500">
            Send images content goes here
          </div>
        )}
      </main>

      {/* Full Screen Viewer */}
      {selectedImage && (
        <FullScreenViewer
          images={paidImages}
          currentIndex={selectedImage.index}
          showAppBar={showAppBar}
          onClose={() => setSelectedImage(null)}
          onToggleAppBar={() => setShowAppBar(!showAppBar)}
          onDelete={handleDeleteImage}
          onDownload={handleDownloadImage}
          onShare={handleShareImage}
          onNavigate={(newIndex) => setSelectedImage({ image: paidImages[newIndex], index: newIndex })}
        />
      )}
    </div>
  );
}

// My Collection Tab Component
function MyCollectionTab({
  paidImages,
  deletingImages,
  onDeleteImage,
  onDownloadImage,
  onShareImage,
  onImageClick,
  onRefresh,
  onSwitchToMarketplace
}: {
  paidImages: ImageData[];
  deletingImages: Set<string>;
  onDeleteImage: (image: ImageData) => void;
  onDownloadImage: (image: ImageData) => void;
  onShareImage: (image: ImageData) => void;
  onImageClick: (image: ImageData, index: number) => void;
  onRefresh: () => void;
  onSwitchToMarketplace: () => void;
}) {
  const [showOptions, setShowOptions] = useState<string | null>(null);

  if (paidImages.length === 0) {
    return (
      <div className="text-center py-20">
        <ImageIcon className="w-20 h-20 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-medium text-gray-600 mb-2">No purchased images yet</h3>
        <p className="text-gray-500 mb-6">Images you purchase will appear here</p>
        <button
          onClick={onSwitchToMarketplace}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Browse Marketplace
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {paidImages.map((image, index) => (
          <div
            key={image.id}
            className="relative group rounded-xl overflow-hidden shadow-lg cursor-pointer aspect-[3/4]"
            onClick={() => onImageClick(image, index)}
          >
            <img
              src={image.image_url}
              alt={image.title || 'Collection image'}
              className="w-full h-full object-cover"
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteImage(image);
              }}
              className="absolute top-2 left-2 p-1.5 bg-black/30 rounded-full hover:bg-black/50 transition-colors"
            >
              {deletingImages.has(image.id) ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 text-white" />
              )}
            </button>

            {/* Purchased Badge */}
            <div className="absolute top-2 right-2 p-1 bg-green-500 rounded-full">
              <Check className="w-4 h-4 text-white" />
            </div>

            {/* Download Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowOptions(showOptions === image.id ? null : image.id);
              }}
              className="absolute bottom-3 right-3 p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
            >
              <Download className="w-4 h-4 text-white" />
            </button>

            {/* Image Info */}
            <div className="absolute bottom-3 left-3 right-16 text-white">
              <h3 className="font-bold text-sm truncate">
                {image.title || image.collection_title || 'Untitled'}
              </h3>
              <p className="text-xs text-white/70 truncate">
                by {image.sender_name || 'Unknown'}
              </p>
            </div>

            {/* Options Menu */}
            {showOptions === image.id && (
              <div
                className="absolute bottom-14 right-3 bg-white rounded-lg shadow-xl py-2 min-w-[200px] z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadImage(image);
                    setShowOptions(null);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm"
                >
                  <Download className="w-4 h-4 text-green-600" />
                  <div>
                    <div className="font-medium">Download Image</div>
                    <div className="text-xs text-gray-500">Save to device</div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareImage(image);
                    setShowOptions(null);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm"
                >
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="font-medium">Share Image</div>
                    <div className="text-xs text-gray-500">Share with friends</div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteImage(image);
                    setShowOptions(null);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <div>
                    <div className="font-medium">Delete Image</div>
                    <div className="text-xs text-gray-500">Remove from collection</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Full Screen Viewer Component
function FullScreenViewer({
  images,
  currentIndex,
  showAppBar,
  onClose,
  onToggleAppBar,
  onDelete,
  onDownload,
  onShare,
  onNavigate
}: {
  images: ImageData[];
  currentIndex: number;
  showAppBar: boolean;
  onClose: () => void;
  onToggleAppBar: () => void;
  onDelete: (image: ImageData) => void;
  onDownload: (image: ImageData) => void;
  onShare: (image: ImageData) => void;
  onNavigate: (index: number) => void;
}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const currentImage = images[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
      setZoomLevel(1);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1);
      setZoomLevel(1);
    }
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* App Bar */}
      {showAppBar && (
        <div className="absolute top-0 left-0 right-0 bg-black/50 backdrop-blur-sm z-10">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            <span className="text-white font-medium">
              {currentIndex + 1} of {images.length}
            </span>

            <div className="flex gap-2">
              <button
                onClick={() => onDownload(currentImage)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => onShare(currentImage)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Share2 className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => onDelete(currentImage)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Container */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        onClick={onToggleAppBar}
      >
        <img
          src={currentImage.image_url}
          alt={currentImage.title || 'Full screen image'}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})` }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Navigation Arrows */}
      {currentIndex > 0 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}

      {currentIndex < images.length - 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Zoom Controls */}
      {showAppBar && zoomLevel !== 1 && (
        <div className="absolute bottom-24 right-4 flex flex-col gap-2">
          <button
            onClick={handleResetZoom}
            className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
          >
            <ZoomOut className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          className="p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Image Info */}
      {showAppBar && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-white text-xl font-bold mb-1">
              {currentImage.title || currentImage.collection_title || 'Untitled'}
            </h2>
            <p className="text-white/70 text-sm mb-3">
              by {currentImage.sender_name || 'Unknown'}
            </p>
            <span className="inline-block px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
              Purchased
            </span>
          </div>
        </div>
      )}
    </div>
  );
}