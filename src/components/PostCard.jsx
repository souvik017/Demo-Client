import React, { useState, useRef, useEffect, useCallback } from "react";
import { MoreHorizontal, Edit2, Trash2 } from "lucide-react";
import axios from "../api/axios";
import { auth } from "../firebase";

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff";

export default function PostCard({ post, onPostUpdated, onPostDeleted }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  
  const videoRef = useRef(null);
  const menuRef = useRef(null);

  const currentUser = auth.currentUser;
  const isOwner = currentUser?.uid === post.user?.uid;

  // Get avatar URL with fallback
  const getAvatarUrl = useCallback(() => {
    if (avatarError) return DEFAULT_AVATAR;
    if (post.user?.avatar) return post.user.avatar;
    if (post.user?.name) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user.name)}&background=3b82f6&color=fff`;
    }
    return DEFAULT_AVATAR;
  }, [avatarError, post.user?.avatar, post.user?.name]);

  // Handle avatar image error
  const handleAvatarError = useCallback(() => {
    setAvatarError(true);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  // Auto-play video when in viewport with proper attributes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set required attributes for autoplay
    video.muted = true;
    video.playsInline = true;
    video.loop = true;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch((err) => {
              console.warn("Video autoplay failed:", err.message);
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, []);

  // Format time ago
  const timeAgo = useCallback((dateString) => {
    try {
      const diff = (Date.now() - new Date(dateString)) / 1000;
      if (diff < 60) return `${Math.floor(diff)}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Unknown";
    }
  }, []);

  // Edit post with validation
  const handleEdit = async () => {
    const trimmedContent = editContent.trim();
    
    if (!trimmedContent || trimmedContent === post.content) {
      setIsEditing(false);
      setEditContent(post.content || "");
      return;
    }

    if (trimmedContent.length > 5000) {
      alert("Post content is too long (max 5000 characters)");
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("authToken");
      
      if (!token) {
        throw new Error("Authentication required");
      }

      const res = await axios.put(
        `/posts/${post._id}`,
        {
          userId: currentUser.uid,
          content: trimmedContent,
        },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );

      if (onPostUpdated) {
        onPostUpdated(res.data);
      }

      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update post:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to update post";
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete post with confirmation
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("authToken");
      
      if (!token) {
        throw new Error("Authentication required");
      }

      await axios.delete(`/posts/${post._id}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { userId: currentUser.uid },
        timeout: 10000
      });

      if (onPostDeleted) {
        onPostDeleted(post._id);
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to delete post";
      alert(errorMessage);
      setIsDeleting(false);
    }
  };

  // Handle escape key to cancel editing
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isEditing) {
        setIsEditing(false);
        setEditContent(post.content || "");
      }
    };

    if (isEditing) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isEditing, post.content]);

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src={getAvatarUrl()}
            alt={`${post.user?.name || "User"}'s avatar`}
            onError={handleAvatarError}
            className="w-10 h-10 rounded-full border border-gray-200 object-cover"
            loading="lazy"
          />
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {post.user?.name || "Unknown User"}
            </h3>
            <time className="text-xs text-gray-500" dateTime={post.createdAt}>
              {timeAgo(post.createdAt)}
            </time>
          </div>
        </div>

        {isOwner && !isDeleting && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-gray-500 hover:text-blue-600 p-2 rounded-full hover:bg-gray-50 transition-colors"
              aria-label="Post options"
              aria-expanded={showMenu}
            >
              <MoreHorizontal size={20} />
            </button>
            
            {showMenu && (
              <div 
                className="absolute right-0 top-10 bg-white shadow-lg rounded-lg border border-gray-200 w-40 z-20 overflow-hidden"
                role="menu"
              >
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="flex items-center w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                  role="menuitem"
                >
                  <Edit2 size={16} className="mr-2 text-blue-600" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 transition-colors"
                  role="menuitem"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
            maxLength={5000}
            placeholder="What's on your mind?"
            autoFocus
            disabled={isSaving}
            aria-label="Edit post content"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {editContent.length}/5000
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(post.content || "");
                }}
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={isSaving || !editContent.trim() || editContent === post.content}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {post.content && (
            <p className="text-gray-800 text-sm mb-3 whitespace-pre-line break-words">
              {post.content}
            </p>
          )}
          
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt="Post content"
              className="rounded-xl w-full object-cover"
              style={{ maxHeight: "500px" }}
              loading="lazy"
              onError={(e) => {
                e.target.style.display = "none";
                console.error("Failed to load image:", post.imageUrl);
              }}
            />
          )}
          
          {post.videoUrl && (
            <video
              ref={videoRef}
              controls
              playsInline
              loop
              className="w-full rounded-xl bg-black"
              style={{ maxHeight: "500px" }}
              preload="metadata"
              onError={(e) => {
                console.error("Failed to load video:", post.videoUrl);
              }}
            >
              <source src={post.videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}
        </>
      )}

      {/* Deleting overlay */}
      {isDeleting && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-2xl z-30"
          role="alert"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 font-medium">Deleting post...</p>
          </div>
        </div>
      )}
    </article>
  );
}