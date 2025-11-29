import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../App.css"
//import { chatWithAgent } from "../api";

export default function Home() {
  const [dataset, setDataset] = useState("ecommerce");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  async function handleSend() {
    if (!message.trim()) return;
    
    setIsLoading(true);
    // const res = await chatWithAgent(message, dataset);
    // setChat([...chat, { user: message }, { ai: res.reply }]);
    
    // Simulated response for demo
    setChat([...chat, { user: message }, { ai: "This is a sample AI response. Connect your backend to see real results." }]);
    setMessage("");
    setIsLoading(false);
  }

  function handleKeyPress(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🗃️</span>
            <h1>SQL Agent</h1>
          </div>
        </div>
        
        <div className="database-selector">
          <label htmlFor="dataset">Select Database</label>
          <select 
            id="dataset"
            value={dataset} 
            onChange={(e) => setDataset(e.target.value)}
          >
            <option value="ecommerce">📦 E-commerce DB</option>
            <option value="HR">👥 HR Database</option>
            <option value="students">🎓 Student Records</option>
          </select>
        </div>

        <div className="sidebar-info">
          <div className="info-card">
            <h3>💡 Tips</h3>
            <ul>
              <li>Ask natural language questions</li>
              <li>Request specific data insights</li>
              <li>Generate complex SQL queries</li>
            </ul>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="main-content">
        <header className="chat-header">
          <h2>Chat with AI SQL Agent</h2>
          <div className="header-right">
            <span className="status-badge">
              <span className="status-dot"></span>
              Connected to {dataset}
            </span>
            
            {/* User Menu */}
            <div className="user-menu-container">
              <button 
                className="user-menu-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <span className="user-avatar">👤</span>
                <span className="user-name">{user?.name || "User"}</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <span className="user-avatar-large">👤</span>
                    <div className="user-info">
                      <span className="user-name-large">{user?.name || "User"}</span>
                      <span className="user-email">{user?.email || ""}</span>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item" onClick={() => navigate("/profile")}>
                    <span>⚙️</span> Profile Settings
                  </button>
                  <button className="dropdown-item logout-button" onClick={handleLogout}>
                    <span>🚪</span> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="chat-container">
          {chat.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3>Start a conversation</h3>
              <p>Ask me anything about your {dataset} database!</p>
              <div className="example-queries">
                <p>Try asking:</p>
                <button onClick={() => setMessage("Show me the top 10 customers by revenue")}>
                  "Show me the top 10 customers by revenue"
                </button>
                <button onClick={() => setMessage("What are the total sales this month?")}>
                  "What are the total sales this month?"
                </button>
                <button onClick={() => setMessage("List all tables in the database")}>
                  "List all tables in the database"
                </button>
              </div>
            </div>
          ) : (
            <div className="messages">
              {chat.map((m, i) => (
                <div key={i} className={`message ${m.user ? "user-message" : "ai-message"}`}>
                  <div className="message-avatar">
                    {m.user ? "👤" : "🤖"}
                  </div>
                  <div className="message-content">
                    <span className="message-sender">{m.user ? "You" : "SQL Agent"}</span>
                    <p>{m.user || m.ai}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message ai-message">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <span className="message-sender">SQL Agent</span>
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="input-container">
          <div className="input-wrapper">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your database..."
              disabled={isLoading}
            />
            <button 
              onClick={handleSend} 
              disabled={isLoading || !message.trim()}
              className="send-button"
            >
              {isLoading ? "..." : "Send →"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
