import React, { useEffect, useState, useCallback, useMemo, Suspense, lazy } from "react";
import { Loader2, User, AlertCircle } from "lucide-react";
import axios from "../api/axios";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import io from "socket.io-client";
import { PostSkeleton } from "../components/PostSkeleton.jsx";

const PostCard = lazy(() => import("../components/PostCard"));
const PostForm = lazy(() => import("../components/PostForm"));

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?name=User&background=6366f1&color=fff&size=256";

// Socket connection with error handling
let socket = null;

const initializeSocket = () => {
  if (!socket) {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
      console.error("VITE_API_URL is not defined");
      return null;
    }

    socket = io(apiUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      console.log("Socket connected successfully");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });
  }
  return socket;
};

export default function Profile() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Get avatar URL with fallback
  const getAvatarUrl = useCallback(() => {
    if (avatarError) {
      if (user?.displayName) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=6366f1&color=fff&size=256`;
      }
      if (user?.email) {
        const name = user.email.split('@')[0];
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=256`;
      }
      return DEFAULT_AVATAR;
    }

    if (user?.avatar) {
      return user.avatar;
    }

    if (user?.displayName) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=6366f1&color=fff&size=256`;
    }

    if (user?.email) {
      const name = user.email.split('@')[0];
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=256`;
    }

    return DEFAULT_AVATAR;
  }, [user, avatarError]);

  // Handle avatar image error
  const handleAvatarError = useCallback(() => {
    console.warn("Avatar failed to load:", user?.avatar);
    setAvatarError(true);
  }, [user?.avatar]);

  // Fetch user and posts
  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("authToken");
        if (!token) throw new Error("No authentication token found");

        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        const resUser = await axios.get("/users/me", { timeout: 10000 });
        if (!isMounted) return;

        const currentUser = resUser.data.user;
        if (!currentUser) throw new Error("User data not found");

        setUser(currentUser);

        const resPosts = await axios.get(`/posts?userId=${currentUser.uid}`, {
          timeout: 10000,
        });

        if (!isMounted) return;
        const userPosts = resPosts.data.posts || [];
        setPosts(userPosts);
      } catch (err) {
        console.error("Profile fetch error:", err);
        if (!isMounted) return;

        const errorMessage = err.response?.data?.message || err.message || "Failed to load profile";
        setError(errorMessage);

        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem("authToken");
          setTimeout(() => {
            window.location.href = "/login";
          }, 2000);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time socket updates
  useEffect(() => {
    if (!user) return;
    const socketInstance = initializeSocket();
    if (!socketInstance) {
      console.warn("Socket connection could not be established");
      return;
    }

    const handlePostCreated = (post) => {
      if (post.user?.uid === user.uid) {
        setPosts((prev) => (prev.some((p) => p._id === post._id) ? prev : [post, ...prev]));
      }
    };

    const handlePostUpdated = (updatedPost) => {
      if (updatedPost.user?.uid === user.uid) {
        setPosts((prev) => prev.map((p) => (p._id === updatedPost._id ? updatedPost : p)));
      }
    };

    const handlePostDeleted = ({ _id }) => {
      setPosts((prev) => prev.filter((p) => p._id !== _id));
    };

    socketInstance.on("post:created", handlePostCreated);
    socketInstance.on("post:updated", handlePostUpdated);
    socketInstance.on("post:deleted", handlePostDeleted);

    return () => {
      socketInstance.off("post:created", handlePostCreated);
      socketInstance.off("post:updated", handlePostUpdated);
      socketInstance.off("post:deleted", handlePostDeleted);
    };
  }, [user]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      await signOut(auth);
      localStorage.removeItem("authToken");

      if (socket) {
        socket.disconnect();
        socket = null;
      }

      delete axios.defaults.headers.common["Authorization"];
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      alert("Failed to logout. Please try again.");
      setIsLoggingOut(false);
    }
  }, [isLoggingOut]);

  const handlePostUpdated = useCallback((updated) => {
    setPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
  }, []);

  const handlePostDeleted = useCallback((id) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  }, []);

  const emptyState = useMemo(
    () => (
      <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No posts yet</p>
          <p className="text-gray-400 text-sm">Start sharing something amazing!</p>
        </div>
      </div>
    ),
    []
  );

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4 px-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-semibold text-gray-900">Failed to Load Profile</h2>
        <p className="text-gray-600 text-center max-w-md">{error}</p>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
          >
            Retry
          </button>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="px-6 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Logging out...
              </span>
            ) : (
              "Logout"
            )}
          </button>
        </div>
      </div>
    );
  }

  // No user
  if (!user) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <AlertCircle className="w-16 h-16 text-yellow-500" />
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    );
  }

  // Main profile
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-gradient-to-r from-blue-500 via-pink-500 to-red-600 p-6 shadow-lg rounded-b-3xl">
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          <div className="relative">
            <img
              src={getAvatarUrl()}
              alt={`${user.displayName || "User"}'s profile`}
              onError={handleAvatarError}
              className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover"
              loading="eager"
              referrerPolicy="no-referrer"
            />
          </div>

          <h1 className="text-3xl font-bold text-white mt-3">
            {user.displayName || user.email?.split("@")[0] || "User"}
          </h1>

          {user.email && <p className="text-white/80 text-sm mt-1">{user.email}</p>}

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-4 px-6 py-2 bg-white text-purple-600 font-semibold rounded-full shadow hover:shadow-md hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Logout"
          >
            {isLoggingOut ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Logging out...
              </span>
            ) : (
              "Logout"
            )}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto mt-6 px-4">
        <Suspense fallback={<PostSkeleton />}>
          <PostForm />
        </Suspense>
      </div>

      <main className="max-w-3xl mx-auto mt-6 space-y-4 px-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Your Posts ({posts.length})
        </h2>

        {posts.length === 0 ? (
          emptyState
        ) : (
          <Suspense fallback={<PostSkeleton />}>
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onPostUpdated={handlePostUpdated}
                onPostDeleted={handlePostDeleted}
              />
            ))}
          </Suspense>
        )}
      </main>
    </div>
  );
}
