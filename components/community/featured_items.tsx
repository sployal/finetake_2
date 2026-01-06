'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';

interface FeaturedItem {
  id: string;
  image_url: string;
  title: string;
  author: string;
  category: string;
  likes: number;
  is_active: boolean;
  created_at: string;
}

interface FeaturedItemsProps {
  onEditClick?: () => void;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FeaturedItems({ onEditClick }: FeaturedItemsProps) {
  
  const [featuredItem, setFeaturedItem] = useState<FeaturedItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);

  useEffect(() => {
    loadFeaturedItem();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.is_admin || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const loadFeaturedItem = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('featured_items')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error) throw error;

      setFeaturedItem(data);
    } catch (error) {
      console.error('Error loading featured item:', error);
      setFeaturedItem(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = () => {
    if (onEditClick) {
      onEditClick();
    }
  };

  return (
    <div className="relative">
      {/* Section Header */}
      <div className="px-4 py-2 flex items-center">
        <div className="bg-purple-600 p-2 rounded-lg">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
        <h2 className="ml-3 text-lg font-bold text-gray-900 dark:text-white">
          Image of the Day
        </h2>
        <div className="ml-auto px-3 py-1 bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl">
          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
            Featured
          </span>
        </div>
      </div>

      {/* Featured Item Content */}
      <div className="px-4 mt-2">
        {isLoading ? (
          <LoadingState />
        ) : featuredItem ? (
          <FeaturedCard 
            item={featuredItem} 
            onImageClick={() => setShowFullScreen(true)}
          />
        ) : (
          <EmptyState isAdmin={isAdmin} />
        )}
      </div>

      {/* Admin Edit Button */}
      {isAdmin && (
        <button
          onClick={handleEditClick}
          className="absolute top-14 right-4 w-10 h-10 bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-10"
          aria-label="Edit featured item"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}

      {/* Full Screen Image Viewer */}
      {showFullScreen && featuredItem && (
        <FullScreenViewer
          imageUrl={featuredItem.image_url}
          onClose={() => setShowFullScreen(false)}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-64 rounded-2xl bg-gray-300 dark:bg-slate-700 animate-pulse flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="h-64 rounded-2xl border-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 flex flex-col items-center justify-center">
      <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-gray-600 dark:text-gray-400 font-medium text-base">
        No featured item available
      </p>
      {isAdmin && (
        <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">
          Tap the edit button to add one
        </p>
      )}
    </div>
  );
}

interface FeaturedCardProps {
  item: FeaturedItem;
  onImageClick: () => void;
}

function FeaturedCard({ item, onImageClick }: FeaturedCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div 
      className="relative rounded-2xl overflow-hidden shadow-lg cursor-pointer group"
      onClick={onImageClick}
    >
      {/* Image Container */}
      <div className="relative h-64 w-full">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gray-300 dark:bg-slate-700 animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {imageError ? (
          <div className="absolute inset-0 bg-gradient-to-b from-orange-300 to-orange-600 flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          </div>
        ) : (
          <img
            src={item.image_url}
            alt={item.title || 'Featured image'}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />

        {/* Category Tag */}
        <div className="absolute top-3 left-3">
          <span className="px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded">
            {item.category || 'Uncategorized'}
          </span>
        </div>

        {/* Content Overlay */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white text-lg font-bold mb-1 line-clamp-2">
            {item.title || 'Untitled'}
          </h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-white/70 text-xs">
                by {item.author || 'Unknown'}
              </span>
            </div>

            <div className="flex items-center gap-1 px-2 py-1 bg-black/30 rounded-full">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              <span className="text-white text-xs font-medium">
                {item.likes || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FullScreenViewerProps {
  imageUrl: string;
  onClose: () => void;
}

function FullScreenViewer({ imageUrl, onClose }: FullScreenViewerProps) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-10"
        aria-label="Close"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Image */}
      <div className="relative max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={imageUrl}
          alt="Full screen view"
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
        />
      </div>

      {/* Tap to close hint */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-sm">
        Tap anywhere to close
      </div>
    </div>
  );
}