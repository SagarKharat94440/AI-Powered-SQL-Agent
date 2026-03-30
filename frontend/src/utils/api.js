// api.js - Utility functions for API calls with JWT

const API_BASE_URL = "http://localhost:8080";

// Get token from localStorage
export const getToken = () => {
  return localStorage.getItem("accessToken");
};

// Get refresh token from localStorage
export const getRefreshToken = () => {
  return localStorage.getItem("refreshToken");
};

// Save tokens to localStorage
export const saveTokens = (accessToken, refreshToken) => {
  localStorage.setItem("accessToken", accessToken);
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }
};

// Remove tokens from localStorage (logout)
export const clearTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getToken();
};

// Get user data from localStorage
export const getUser = () => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

// Make authenticated API request
export const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  
  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  // Add Authorization header if token exists
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    // Handle token expiration (401 Unauthorized)
    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await refreshAccessToken();
      
      if (refreshed) {
        // Retry the original request with new token
        config.headers.Authorization = `Bearer ${getToken()}`;
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, config);
        return retryResponse.json();
      } else {
        // Refresh failed, logout user
        clearTokens();
        window.location.href = "/login";
        throw new Error("Session expired. Please login again.");
      }
    }

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  } catch (error) {
    console.error("API Request Error:", error);
    throw error;
  }
};

// Refresh access token using refresh token
export const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    // Backend sends 'token', not 'accessToken'
    saveTokens(data.token, data.refreshToken);
    return true;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
};

// Login function
export const login = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  // Save tokens and user data (backend sends 'token', not 'accessToken')
  saveTokens(data.token, data.refreshToken);
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
  }

  return data;
};

// Logout function
export const logout = async () => {
  const token = getToken();
  
  if (token) {
    try {
      // Optional: Call logout endpoint on backend
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  // Clear local storage
  clearTokens();
};

// Example: Get protected data
export const getUserProfile = async () => {
  return apiRequest("/user/profile", {
    method: "GET",
  });
};

// Example: Update user data
export const updateUserProfile = async (userData) => {
  return apiRequest("/user/profile", {
    method: "PUT",
    body: JSON.stringify(userData),
  });
};

// Upload a file for querying
export const uploadFile = async (file) => {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/ai/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Upload failed");
  }
  return data;
};

// Get schema for a dataset
export const getSchemaInfo = async (dataset) => {
  return apiRequest(`/api/ai/schema/${dataset}`, {
    method: "GET",
  });
};

// Get a user's conversations
export const getConversations = async () => {
  return apiRequest("/api/ai/conversations", {
    method: "GET",
  });
};

// Get a specific conversation by ID
export const getConversation = async (id) => {
  return apiRequest(`/api/ai/conversations/${id}`, {
    method: "GET",
  });
};

// Delete a conversation
export const deleteConversation = async (id) => {
  return apiRequest(`/api/ai/conversations/${id}`, {
    method: "DELETE",
  });
};