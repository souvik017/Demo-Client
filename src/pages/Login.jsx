import React from "react";
import { signInWithGoogle } from "../firebase";
import { setAuthToken } from "../api/axios"; // your Axios helper to set Authorization header
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const { user, token } = await signInWithGoogle();

      // Save token in localStorage (or secure storage)
      localStorage.setItem("authToken", token);
      console.log(user)

      // Optional: set Axios default Authorization header
      setAuthToken(token);

      // Redirect to dashboard/news feed
      navigate("/dashboard");
    } catch (err) {
      console.error("Google Sign-In Error:", err);
      alert("Failed to sign in. Please try again.");
    }
  };

  return (
    <div className="h-screen flex justify-center items-center bg-gray-100">
      <button
        onClick={handleLogin}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 shadow-md transition duration-200"
      >
        Sign in with Google
      </button>
    </div>
  );
}
