import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?name=User&background=6366f1&color=fff";

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  // Get profile image URL with fallback logic
  const getProfileImageUrl = useCallback(() => {
    // If image failed to load, use default
    if (imageError) {
      return DEFAULT_AVATAR;
    }

    // If user has photoURL, use it
    if (user?.photoURL) {
      // Handle Google Photos URLs that might expire or have issues
      const photoURL = user.photoURL;
      
      // Ensure proper URL format
      if (photoURL.startsWith('http://') || photoURL.startsWith('https://')) {
        return photoURL;
      }
      
      // If it's a relative path, construct full URL (adjust based on your setup)
      return photoURL;
    }

    // Generate avatar from user's display name or email
    if (user?.displayName) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=6366f1&color=fff&size=128`;
    }

    if (user?.email) {
      const name = user.email.split('@')[0];
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128`;
    }

    return DEFAULT_AVATAR;
  }, [user, imageError]);

  // Handle image loading error
  const handleImageError = useCallback((e) => {
    console.warn('Profile image failed to load:', user?.photoURL);
    setImageError(true);
  }, [user?.photoURL]);

  // Handle navigation with error boundary
  const handleNavigation = useCallback((path) => {
    try {
      navigate(path);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [navigate]);

  // Handle logo click
  const handleLogoClick = useCallback(() => {
    handleNavigation('/dashboard');
  }, [handleNavigation]);

  // Handle profile click
  const handleProfileClick = useCallback(() => {
    handleNavigation('/profile');
  }, [handleNavigation]);

  return (
    <nav 
      className="bg-gradient-to-r from-blue-500 via-pink-500 to-red-600 shadow-md px-6 py-3 flex justify-between items-center sticky top-0 z-50"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <button
        onClick={handleLogoClick}
        className="text-white font-extrabold text-2xl cursor-pointer hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-500 rounded-lg px-2"
        aria-label="Go to dashboard"
      >
        App
      </button>

      {/* Profile Icon */}
      {user && (
        <button
          onClick={handleProfileClick}
          className="flex items-center gap-2 cursor-pointer hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-pink-500 rounded-full"
          aria-label={`View profile ${user.displayName || user.email || ''}`}
        >
          {user.photoURL && !imageError ? (
            <img
              src={getProfileImageUrl()}
              alt={`${user.displayName || 'User'}'s profile`}
              onError={handleImageError}
              className="w-10 h-10 rounded-full border-2 border-white shadow-lg object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="relative">
              {/* Fallback: Try generated avatar first, then icon */}
              {user.displayName || user.email ? (
                <img
                  src={getProfileImageUrl()}
                  alt={`${user.displayName || 'User'}'s profile`}
                  className="w-10 h-10 rounded-full border-2 border-white shadow-lg object-cover"
                  loading="lazy"
                  onError={() => {
                    // If even the generated avatar fails, component will remount with icon
                    console.warn('Generated avatar also failed');
                  }}
                />
              ) : (
                <User 
                  className="w-10 h-10 text-white p-1 bg-indigo-600 rounded-full shadow-lg" 
                  aria-hidden="true"
                />
              )}
            </div>
          )}
        </button>
      )}
    </nav>
  );
}