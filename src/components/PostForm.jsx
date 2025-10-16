import React, { useState } from "react";
import axios from "../api/axios";
import { auth } from "../firebase";
import { Image, Video, X, Loader2, Sparkles } from "lucide-react";

export default function PostForm({ onPostCreated }) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const CLOUD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const removeFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
  };

  const uploadFile = async () => {
    if (!file) return null;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUD_PRESET);

      const resourceType = file.type.startsWith("video/") ? "video" : "image";
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Upload failed");

      setUploading(false);
      return { url: data.secure_url, type: resourceType };
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Please try again.");
      setUploading(false);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let uploadedMedia = null;
    if (file) uploadedMedia = await uploadFile();

    if (!content.trim() && !uploadedMedia) {
      alert("Please add text or upload media");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert("Please log in first.");
      return;
    }

    const postData = {
      userId: currentUser.uid,
      content: content.trim(),
      mediaType: uploadedMedia ? uploadedMedia.type : "text",
      imageUrl:
        uploadedMedia && uploadedMedia.type === "image" ? uploadedMedia.url : null,
      videoUrl:
        uploadedMedia && uploadedMedia.type === "video" ? uploadedMedia.url : null,
    };

    try {
      const token = localStorage.getItem("authToken");
      await axios.post("/posts", postData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setContent("");
      setFile(null);
      setPreview("");
      if (onPostCreated) onPostCreated();
    } catch (err) {
      console.error("Error creating post:", err);
      alert("Failed to create post. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Animated Background Gradient */}
      <div className="relative">
        <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-xl transition-opacity duration-500 ${isFocused ? 'opacity-100' : 'opacity-0'}`}></div>
        
        <div className={`relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border transition-all duration-300 ${isFocused ? 'border-blue-200 shadow-2xl' : 'border-gray-100/50 shadow-lg'}`}>
          {/* Header Section */}
          <div className="p-5 sm:p-7">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Avatar with gradient ring */}
              <div className="relative flex-shrink-0 group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full blur-sm opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <img
                  src={`${auth.currentUser?.photoURL}` || "https://via.placeholder.com/40"}
                  alt="You"
                  className="relative w-11 h-11 sm:w-13 sm:h-13 rounded-full object-cover ring-2 ring-white"
                />
                {/* <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full border-2 border-white"></div> */}
              </div>

              {/* Text Area */}
              <div className="flex-1 min-w-0">
                <textarea
                  className="w-full border-none resize-none focus:outline-none text-gray-800 placeholder-gray-400 text-base sm:text-lg leading-relaxed bg-transparent font-light"
                  placeholder="Share something amazing..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  rows={3}
                  disabled={uploading}
                />
                {content.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <Sparkles size={12} className="text-purple-400" />
                    <span>{content.length} characters</span>
                  </div>
                )}
              </div>
            </div>

            {/* Media Preview with glassmorphism */}
            {preview && (
              <div className="relative mt-5 rounded-2xl overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"></div>
                {file?.type.startsWith("image/") ? (
                  <img
                    src={preview}
                    alt="preview"
                    className="w-full h-auto max-h-96 sm:max-h-[500px] object-cover rounded-2xl"
                  />
                ) : (
                  <video
                    src={preview}
                    controls
                    className="w-full h-auto max-h-96 sm:max-h-[500px] rounded-2xl"
                  />
                )}
                {/* Remove button with backdrop */}
                <button
                  type="button"
                  onClick={removeFile}
                  className="absolute top-3 right-3 bg-white/90 backdrop-blur-md rounded-full p-2.5 shadow-lg hover:bg-red-50 transition-all duration-200 group-hover:scale-110"
                  aria-label="Remove media"
                >
                  <X size={18} className="text-gray-700 hover:text-red-600 transition-colors" />
                </button>
                {/* Overlay gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"></div>
              </div>
            )}
          </div>

          {/* Divider with gradient */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>

          {/* Footer Section */}
          <div className="p-4 sm:p-6 bg-gradient-to-br from-gray-50/50 to-transparent backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Media Upload Buttons */}
              <div className="flex items-center gap-2">
                <label className="relative cursor-pointer flex items-center gap-2.5 px-4 py-2.5 rounded-xl hover:bg-white/80 text-gray-700 text-sm font-medium transition-all duration-200 group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 to-green-500/0 group-hover:from-green-500/10 group-hover:to-emerald-500/10 transition-all duration-300"></div>
                  <Image size={20} className="text-green-600 group-hover:scale-110 transition-transform relative z-10" />
                  <span className="relative z-10">Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </label>
                
                <label className="relative cursor-pointer flex items-center gap-2.5 px-4 py-2.5 rounded-xl hover:bg-white/80 text-gray-700 text-sm font-medium transition-all duration-200 group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 to-red-500/0 group-hover:from-red-500/10 group-hover:to-pink-500/10 transition-all duration-300"></div>
                  <Video size={20} className="text-red-600 group-hover:scale-110 transition-transform relative z-10" />
                  <span className="relative z-10">Video</span>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </label>
              </div>

              {/* Post Button with animated gradient */}
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={uploading || (!content.trim() && !file)}
                className={`relative w-full sm:w-auto px-8 py-3 rounded-xl font-semibold text-sm overflow-hidden transition-all duration-300 group ${
                  uploading || (!content.trim() && !file)
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 via-blue-700 to-purple-600 text-white shadow-lg hover:shadow-xl active:scale-95"
                }`}
              >
                {!uploading && !(uploading || (!content.trim() && !file)) && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {uploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
                      <span>Share Post</span>
                    </>
                  )}
                </span>
                {/* Shine effect */}
                {!uploading && !(uploading || (!content.trim() && !file)) && (
                  <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}