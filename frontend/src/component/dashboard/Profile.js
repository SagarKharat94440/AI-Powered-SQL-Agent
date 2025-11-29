import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../utils/api";
import "./Profile.css";

export default function Profile() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();

  // Profile form state
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Handle profile update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileLoading(true);

    try {
      const response = await apiRequest("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: profileData.name,
          email: profileData.email,
        }),
      });

      if (response.success) {
        updateUser(response.user);
        setProfileSuccess("Profile updated successfully!");
      }
    } catch (error) {
      setProfileError(error.message || "Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle password update
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await apiRequest("/auth/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (response.success) {
        setPasswordSuccess("Password updated successfully!");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (error) {
      setPasswordError(error.message || "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="profile-container">
      {/* Sidebar */}
      <aside className="profile-sidebar">
        <div className="sidebar-header">
          <button className="back-button" onClick={() => navigate("/")}>
            ← Back to Chat
          </button>
        </div>

        <div className="profile-avatar-section">
          <div className="profile-avatar-large">👤</div>
          <h2>{user?.name || "User"}</h2>
          <p>{user?.email || ""}</p>
        </div>

        <nav className="profile-nav">
          <a href="#profile" className="nav-item active">
            <span>👤</span> Profile Settings
          </a>
          <a href="#password" className="nav-item">
            <span>🔐</span> Change Password
          </a>
          <button className="nav-item logout" onClick={handleLogout}>
            <span>🚪</span> Logout
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="profile-main">
        {/* Profile Section */}
        <section id="profile" className="settings-section">
          <div className="section-header">
            <h2>👤 Profile Settings</h2>
            <p>Update your personal information</p>
          </div>

          <form onSubmit={handleProfileUpdate} className="settings-form">
            {profileError && <div className="alert alert-error">{profileError}</div>}
            {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}

            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                placeholder="Enter your email"
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={profileLoading}>
              {profileLoading ? "Updating..." : "Update Profile"}
            </button>
          </form>
        </section>

        {/* Password Section */}
        <section id="password" className="settings-section">
          <div className="section-header">
            <h2>🔐 Change Password</h2>
            <p>Update your password to keep your account secure</p>
          </div>

          <form onSubmit={handlePasswordUpdate} className="settings-form">
            {passwordError && <div className="alert alert-error">{passwordError}</div>}
            {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}

            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPasswords.current ? "text" : "password"}
                  id="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                >
                  {showPasswords.current ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPasswords.new ? "text" : "password"}
                  id="newPassword"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password (min 8 characters)"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                >
                  {showPasswords.new ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPasswords.confirm ? "text" : "password"}
                  id="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                >
                  {showPasswords.confirm ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                <span className="error-text">Passwords do not match</span>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={passwordLoading}>
              {passwordLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
