"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface EditProfilePageProps {
  currentUsername: string;
  currentDisplayName: string;
  currentAvatarUrl?: string;
}

export default function EditProfilePage({
  currentUsername,
  currentDisplayName,
  currentAvatarUrl,
}: EditProfilePageProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(currentUsername);
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newAvatarUrl, setNewAvatarUrl] = useState<string | null>(
    currentAvatarUrl || null
  );
  const [avatarDeleted, setAvatarDeleted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [errors, setErrors] = useState<{
    username?: string;
    displayName?: string;
  }>({});

  const baseUrl = "https://fine-back2.onrender.com/api/profile";

  useEffect(() => {
    // Cleanup preview URL on unmount
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const getAuthToken = () => {
    // Replace this with your actual auth token retrieval logic
    // For example, from localStorage, cookies, or auth context
    return localStorage.getItem("authToken");
  };

  const validateForm = () => {
    const newErrors: { username?: string; displayName?: string } = {};

    if (!username.trim()) {
      newErrors.username = "Please enter a username";
    } else if (username.trim().length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (username.trim().length > 30) {
      newErrors.username = "Username must be less than 30 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      newErrors.username =
        "Username can only contain letters, numbers, and underscores";
    }

    if (!displayName.trim()) {
      newErrors.displayName = "Please enter a display name";
    } else if (displayName.trim().length > 50) {
      newErrors.displayName = "Display name must be less than 50 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const showSuccessToast = (message: string) => {
    // You can replace this with your preferred toast library (react-hot-toast, sonner, etc.)
    alert(message);
  };

  const showErrorToast = (message: string) => {
    alert(message);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        showErrorToast("Please select an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showErrorToast("Image size must be less than 5MB");
        return;
      }

      setSelectedImage(file);
      setAvatarDeleted(false);

      // Create preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Auto-upload the image
      uploadImage(file);
    }
  };

  const uploadImage = async (file: File) => {
    setIsUploading(true);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const formData = new FormData();
      formData.append("profileImage", file);

      const response = await fetch(`${baseUrl}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success && data.avatarUrl) {
        setNewAvatarUrl(data.avatarUrl);
        setAvatarDeleted(false);
        showSuccessToast(data.message || "Image uploaded successfully!");
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      showErrorToast(`Failed to upload image: ${error}`);
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

 const removeImage = async () => {
    setIsDeleting(true);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(`${baseUrl}/avatar`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSelectedImage(null);
        setNewAvatarUrl(null);
        setAvatarDeleted(true);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        showSuccessToast("Profile image removed successfully!");
      } else {
        throw new Error(data.error || "Delete failed");
      }
    } catch (error) {
      showErrorToast(`Failed to remove image: ${error}`);
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const saveProfile = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(`${baseUrl}/update`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          display_name: displayName.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showSuccessToast(data.message || "Profile updated successfully!");
        router.back();
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      showErrorToast(`Failed to update profile: ${error}`);
      console.error("Profile update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAvatarDisplay = () => {
    if (previewUrl) {
      return (
        <Image
          src={previewUrl}
          alt="Profile preview"
          fill
          className="object-cover"
        />
      );
    } else if (newAvatarUrl && !avatarDeleted) {
      return (
        <Image
          src={newAvatarUrl}
          alt="Profile avatar"
          fill
          className="object-cover"
        />
      );
    } else if (currentAvatarUrl && !avatarDeleted) {
      return (
        <Image
          src={currentAvatarUrl}
          alt="Current avatar"
          fill
          className="object-cover"
        />
      );
    } else {
      return (
        <span className="text-4xl font-bold text-indigo-600">
          {currentUsername ? currentUsername[0].toUpperCase() : "U"}
        </span>
      );
    }
  };

  const hasAvatar =
    previewUrl ||
    (newAvatarUrl && !avatarDeleted) ||
    (currentAvatarUrl && !avatarDeleted);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-indigo-600 text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-indigo-700 rounded-full transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <h1 className="text-xl font-semibold">Edit Profile</h1>

          <button
            onClick={saveProfile}
            disabled={isLoading || isUploading || isDeleting}
            className="px-4 py-2 font-semibold hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading || isUploading || isDeleting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Save"
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-5 py-8">
        <div className="space-y-10">
          {/* Avatar Section */}
          <div className="flex justify-center pt-5">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-3 border-indigo-600 shadow-lg bg-gray-200 relative overflow-hidden flex items-center justify-center">
                {getAvatarDisplay()}
              </div>

              {/* Camera Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isDeleting}
                className="absolute bottom-0 right-0 bg-indigo-600 text-white p-3 rounded-full border-2 border-white shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading || isDeleting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />

              {/* Remove button */}
              {hasAvatar && (
                <button
                  onClick={removeImage}
                  disabled={isDeleting}
                  className="absolute top-0 right-0 bg-red-500 text-white p-2 rounded-full border-2 border-white shadow-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Username Field */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className={`w-full pl-10 pr-4 py-3 bg-white border ${
                  errors.username ? "border-red-500" : "border-gray-300"
                } rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username}</p>
            )}
          </div>

          {/* Display Name Field */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-2">
              Display Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className={`w-full pl-10 pr-4 py-3 bg-white border ${
                  errors.displayName ? "border-red-500" : "border-gray-300"
                } rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
              />
            </div>
            {errors.displayName && (
              <p className="mt-1 text-sm text-red-600">{errors.displayName}</p>
            )}
          </div>

          {/* Tips Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center mb-2">
              <svg
                className="w-5 h-5 text-blue-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="font-semibold text-blue-700">Tips</h3>
            </div>
            <ul className="text-sm text-blue-600 space-y-1 leading-relaxed">
              <li>
                • Username must be unique and can only contain letters, numbers,
                and underscores
              </li>
              <li>• Display name should be your actual name</li>
              <li>
                • Profile photo will be automatically resized and optimized
              </li>
              <li>• Only one profile image is allowed at a time</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
