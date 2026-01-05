'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { Camera, Upload, MapPin, Tag, Settings, X, Edit2, Check } from 'lucide-react';

export default function PostScreen() {
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [allowLikes, setAllowLikes] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableTags = [
    'nature', 'landscape', 'portrait', 'street', 'architecture',
    'sunset', 'photography', 'art', 'travel', 'urban',
    'macro', 'wildlife', 'blackandwhite', 'colors', 'abstract'
  ];

  const canPublish = () => {
    return selectedImage && caption.trim().length > 0;
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else if (selectedTags.length < 10) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handlePublish = async () => {
    if (!canPublish()) return;

    setIsPosting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsPosting(false);
    setShowSuccessModal(true);
  };

  const resetForm = () => {
    setSelectedImage(null);
    setCaption('');
    setLocation('');
    setSelectedTags([]);
    setShowSuccessModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Create Post</h1>
          <button
            onClick={handlePublish}
            disabled={!canPublish() || isPosting}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              canPublish() && !isPosting
                ? 'bg-white text-indigo-600 hover:shadow-lg'
                : 'bg-white/30 text-white/50 cursor-not-allowed'
            }`}
          >
            {isPosting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Posting...
              </div>
            ) : (
              'Share'
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Auth Status */}
        <div className="bg-green-50 border border-green-500 rounded-xl p-4 flex items-center gap-3">
          <Check className="text-green-600" size={24} />
          <div>
            <p className="font-bold text-green-700">Authenticated</p>
            <p className="text-sm text-green-600">Logged in as user@example.com</p>
          </div>
        </div>

        {/* Image Selection */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
              <Upload className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-700">Select Photo</h2>
          </div>

          {selectedImage ? (
            <div className="relative h-80 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50">
              <img
                src={selectedImage}
                alt="Selected"
                className="w-full h-full object-cover"
              />
              <button
                onClick={removeImage}
                className="absolute top-3 right-3 bg-black/70 p-2 rounded-full hover:bg-black transition"
              >
                <X className="text-white" size={20} />
              </button>
              <button
                onClick={() => setShowImageModal(true)}
                className="absolute bottom-3 right-3 bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 rounded-full text-white flex items-center gap-2 hover:shadow-lg transition"
              >
                <Edit2 size={16} />
                Change
              </button>
            </div>
          ) : (
            <div className="h-52 rounded-2xl border-2 border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 flex flex-col items-center justify-center gap-4">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-full">
                <Upload className="text-white" size={32} />
              </div>
              <p className="text-slate-500 font-medium">Select a photo to share</p>
              <div className="flex gap-4">
                <label className="cursor-pointer">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition flex items-center gap-2">
                    <Upload size={18} />
                    Gallery
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
                <button className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition flex items-center gap-2">
                  <Camera size={18} />
                  Camera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2 rounded-lg">
              <Edit2 className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-700">
              Caption <span className="text-red-500">*</span>
            </h2>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            rows={4}
            placeholder="Write a caption..."
            className="w-full p-4 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:outline-none transition resize-none"
          />
          <p className="text-sm text-slate-400 mt-2">{caption.length}/2200</p>
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-2 rounded-lg">
              <MapPin className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-700">Location</h2>
          </div>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-gradient-to-br from-pink-500 to-pink-600 p-2 rounded-lg">
              <MapPin className="text-white" size={16} />
            </div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location..."
              className="w-full pl-14 pr-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-pink-500 focus:outline-none transition"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-2 rounded-lg">
              <Tag className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-700">Tags</h2>
          </div>

          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedTags.map(tag => (
                <div
                  key={tag}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-2 rounded-full flex items-center gap-2"
                >
                  <span className="font-medium">#{tag}</span>
                  <button
                    onClick={() => toggleTag(tag)}
                    className="hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="bg-gradient-to-br from-amber-50 to-amber-50/50 border border-amber-200 rounded-xl p-4">
            <p className="font-semibold text-slate-600 mb-3">Popular Tags</p>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    selectedTags.includes(tag)
                      ? 'bg-amber-100 text-amber-600 border-2 border-amber-500'
                      : 'bg-slate-100 text-slate-600 border-2 border-slate-300 hover:border-amber-400'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-violet-500 to-violet-600 p-2 rounded-lg">
              <Settings className="text-white" size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-700">Advanced Options</h2>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-violet-50/50 border border-violet-200 rounded-xl overflow-hidden">
            <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-violet-100/50 transition">
              <div>
                <p className="font-semibold text-slate-700">Allow comments</p>
                <p className="text-sm text-slate-500">People can comment on your post</p>
              </div>
              <input
                type="checkbox"
                checked={allowComments}
                onChange={(e) => setAllowComments(e.target.checked)}
                className="w-12 h-6 appearance-none bg-slate-300 rounded-full relative cursor-pointer transition checked:bg-violet-500 before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-all checked:before:left-6"
              />
            </label>
            <div className="border-t border-violet-200" />
            <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-violet-100/50 transition">
              <div>
                <p className="font-semibold text-slate-700">Allow likes</p>
                <p className="text-sm text-slate-500">People can like your post</p>
              </div>
              <input
                type="checkbox"
                checked={allowLikes}
                onChange={(e) => setAllowLikes(e.target.checked)}
                className="w-12 h-6 appearance-none bg-slate-300 rounded-full relative cursor-pointer transition checked:bg-violet-500 before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-all checked:before:left-6"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="text-white" size={48} />
              </div>
              <h3 className="text-3xl font-bold text-slate-700 mb-3">Post Published!</h3>
              <p className="text-slate-500 mb-6">Your post has been published successfully!</p>
              
              {selectedTags.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-3 mb-6">
                  <p className="text-amber-600 font-medium text-sm">
                    Tags: {selectedTags.map(tag => `#${tag}`).join(' ')}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetForm}
                  className="flex-1 border-2 border-indigo-500 text-indigo-600 py-3 rounded-full font-semibold hover:bg-indigo-50 transition"
                >
                  Create Another
                </button>
                <button
                  onClick={resetForm}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-full font-semibold hover:shadow-lg transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Selection Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 max-w-md w-full">
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-6" />
            <h3 className="text-xl font-bold text-slate-700 text-center mb-6">Select Photo Source</h3>
            
            <div className="space-y-3">
              <label className="cursor-pointer">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-4 flex items-center gap-4 hover:border-indigo-400 transition">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
                    <Upload className="text-white" size={20} />
                  </div>
                  <span className="font-semibold text-indigo-600">Choose from Gallery</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    handleImageSelect(e);
                    setShowImageModal(false);
                  }}
                  className="hidden"
                />
              </label>

              <button className="w-full bg-gradient-to-br from-emerald-50 to-emerald-50 border-2 border-emerald-200 rounded-xl p-4 flex items-center gap-4 hover:border-emerald-400 transition">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2 rounded-lg">
                  <Camera className="text-white" size={20} />
                </div>
                <span className="font-semibold text-emerald-600">Take Photo</span>
              </button>

              <button
                onClick={() => {
                  removeImage();
                  setShowImageModal(false);
                }}
                className="w-full bg-gradient-to-br from-red-50 to-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-4 hover:border-red-400 transition"
              >
                <div className="bg-gradient-to-br from-red-500 to-red-600 p-2 rounded-lg">
                  <X className="text-white" size={20} />
                </div>
                <span className="font-semibold text-red-600">Remove Photo</span>
              </button>
            </div>

            <button
              onClick={() => setShowImageModal(false)}
              className="w-full mt-4 py-3 text-slate-500 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}