import React, { useEffect, useState, useRef, useCallback, Suspense, lazy } from "react";
import { PostSkeleton } from "../components/PostSkeleton.jsx";
import axios from "../api/axios";
import io from "socket.io-client";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

const PostCard = lazy(() => import("../components/PostCard"));
const PostForm = lazy(() => import("../components/PostForm"));

// Socket configuration with error handling
let socket = null;

const initializeSocket = () => {
  if (!socket) {
    const apiUrl = import.meta.env.VITE_API_URL || "https://demo-server-0dwf.onrender.com";
    
    socket = io(apiUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("Socket reconnected after", attemptNumber, "attempts");
    });
  }
  
  return socket;
};

export default function Dashboard() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const lastPostRef = useRef(null);
  const observerRef = useRef(null);
  const isMountedRef = useRef(true);
  const fetchingRef = useRef(false);

  // Fetch posts with comprehensive error handling
  const fetchPosts = useCallback(async (pageNum = 1, shouldAppend = true) => {
    // Prevent duplicate requests
    if (fetchingRef.current) {
      console.log("Fetch already in progress, skipping...");
      return;
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.get(`/posts?page=${pageNum}&limit=10`, {
        headers,
        timeout: 15000,
      });

      if (!isMountedRef.current) return;

      const newPosts = res.data.posts || [];

      if (shouldAppend && pageNum > 1) {
        setPosts((prev) => {
          // Remove duplicates
          const existingIds = new Set(prev.map((p) => p._id));
          const uniqueNewPosts = newPosts.filter((p) => !existingIds.has(p._id));
          return [...prev, ...uniqueNewPosts];
        });
      } else {
        setPosts(newPosts);
      }

      setHasMore(newPosts.length >= 10);
      setInitialLoad(false);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      console.error("Error fetching posts:", err);
      
      if (!isMountedRef.current) return;

      const errorMessage = err.response?.data?.message || err.message || "Failed to load posts";
      setError(errorMessage);
      setHasMore(false);

      // If authentication error, redirect to login
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("authToken");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        fetchingRef.current = false;
      }
    }
  }, []);

  // Retry fetch with exponential backoff
  const handleRetry = useCallback(() => {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    setRetryCount((prev) => prev + 1);
    
    setTimeout(() => {
      setPage(1);
      setHasMore(true);
      fetchPosts(1, false);
    }, delay);
  }, [retryCount, fetchPosts]);

  // Infinite scroll observer with cleanup
  useEffect(() => {
    if (loading || !hasMore || initialLoad || !lastPostRef.current) return;

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !fetchingRef.current) {
          setPage((prev) => prev + 1);
        }
      },
      { 
        threshold: 0.5, 
        rootMargin: "200px" 
      }
    );

    observerRef.current.observe(lastPostRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, initialLoad, posts.length]);

  // Initial fetch
  useEffect(() => {
    fetchPosts(1, false);
  }, [fetchPosts]);

  // Fetch next pages
  useEffect(() => {
    if (page > 1) {
      fetchPosts(page, true);
    }
  }, [page, fetchPosts]);

  // Real-time post updates via Socket.IO with error handling
  useEffect(() => {
    const socketInstance = initializeSocket();

    if (!socketInstance) {
      console.warn("Socket connection could not be established");
      return;
    }

    const handlePostCreated = (post) => {
      try {
        if (!post || !post._id) {
          console.warn("Invalid post data received:", post);
          return;
        }

        setPosts((prev) => {
          // Prevent duplicates
          if (prev.some((p) => p._id === post._id)) {
            return prev;
          }
          return [post, ...prev];
        });
      } catch (error) {
        console.error("Error handling post:created:", error);
      }
    };

    const handlePostUpdated = (updatedPost) => {
      try {
        if (!updatedPost || !updatedPost._id) {
          console.warn("Invalid updated post data:", updatedPost);
          return;
        }

        setPosts((prev) =>
          prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
        );
      } catch (error) {
        console.error("Error handling post:updated:", error);
      }
    };

    const handlePostDeleted = (data) => {
      try {
        const postId = data?._id || data;
        
        if (!postId) {
          console.warn("Invalid post deletion data:", data);
          return;
        }

        setPosts((prev) => prev.filter((p) => p._id !== postId));
      } catch (error) {
        console.error("Error handling post:deleted:", error);
      }
    };

    socketInstance.on("post:created", handlePostCreated);
    socketInstance.on("post:updated", handlePostUpdated);
    socketInstance.on("post:deleted", handlePostDeleted);

    return () => {
      socketInstance.off("post:created", handlePostCreated);
      socketInstance.off("post:updated", handlePostUpdated);
      socketInstance.off("post:deleted", handlePostDeleted);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Handle post updates from child components
  const handlePostUpdated = useCallback((updatedPost) => {
    setPosts((prev) =>
      prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
    );
  }, []);

  const handlePostDeleted = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId));
  }, []);

  // Error state
  if (error && posts.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to Load Posts
          </h2>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <button
            onClick={handleRetry}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Retrying...' : 'Retry'}
          </button>
          {retryCount > 0 && (
            <p className="text-gray-400 text-xs mt-3">
              Retry attempt {retryCount}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-2xl mx-auto py-6 px-4">
        {/* Post Form */}
        <Suspense fallback={<PostSkeleton />}>
          <PostForm />
        </Suspense>

        {/* Posts Feed */}
        <div className="mt-6 space-y-4">
          {/* Empty state */}
          {posts.length === 0 && !loading && !initialLoad && !error ? (
            <div className="text-center py-12">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
                <div className="text-6xl mb-4" role="img" aria-label="Empty state">
                  📝
                </div>
                <p className="text-gray-500 text-lg font-medium">
                  No posts yet
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Be the first to share something amazing!
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Posts list */}
              {posts.length > 0 && (
                <Suspense fallback={<PostSkeleton />}>
                  {posts.map((post, index) => {
                    const isLastPost = index === posts.length - 1;
                    return (
                      <div 
                        key={post._id} 
                        ref={isLastPost ? lastPostRef : null}
                      >
                        <PostCard 
                          post={post}
                          onPostUpdated={handlePostUpdated}
                          onPostDeleted={handlePostDeleted}
                        />
                      </div>
                    );
                  })}
                </Suspense>
              )}

              {/* Loading indicator for pagination */}
              {loading && posts.length > 0 && (
                <div className="flex justify-center py-8">
                  <div className="bg-white rounded-full p-4 shadow-lg">
                    <Loader2 
                      className="w-6 h-6 animate-spin text-blue-600" 
                      aria-label="Loading more posts"
                    />
                  </div>
                </div>
              )}

              {/* Initial loading skeletons */}
              {loading && posts.length === 0 && (
                <div className="space-y-4">
                  <PostSkeleton />
                  <PostSkeleton />
                  <PostSkeleton />
                </div>
              )}

              {/* End of feed message */}
              {!hasMore && posts.length > 0 && !loading && (
                <div className="text-center py-8">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <div className="text-4xl mb-3" role="img" aria-label="Celebration">
                      🎉
                    </div>
                    <p className="text-gray-600 font-medium">
                      You're all caught up!
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      Check back later for new posts
                    </p>
                  </div>
                </div>
              )}

              {/* Error message during pagination */}
              {error && posts.length > 0 && (
                <div className="text-center py-6">
                  <div className="bg-red-50 rounded-2xl border border-red-100 p-6">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-600 text-sm font-medium mb-3">
                      Failed to load more posts
                    </p>
                    <button
                      onClick={handleRetry}
                      disabled={loading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-full hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}