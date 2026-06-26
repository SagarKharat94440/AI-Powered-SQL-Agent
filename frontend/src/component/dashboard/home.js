import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest, uploadFile, getConversations, getConversation, getUploadedFiles } from "../../utils/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ReactMarkdown from "react-markdown";
import "../../App.css";

const CHART_COLORS = ["#667eea", "#764ba2", "#11998e", "#38ef7d", "#f093fb", "#f5576c", "#4facfe", "#00f2fe"];

const EXAMPLE_QUESTIONS = {
  ecommerce: [
    "Show me top 10 customers by total order amount",
    "What are the best-selling product categories?",
    "How many orders were delivered vs cancelled?",
    "Show average product rating by category",
  ],
  HR: [
    "What is the average salary per department?",
    "Show me employees hired in the last year",
    "Which department has the most leave requests?",
    "List top 5 highest paid employees",
  ],
  students: [
    "What is the average GPA by major?",
    "Show courses with the most enrollments",
    "Which students have a GPA above 3.5?",
    "Show grade distribution across all courses",
  ],
};

export default function Home() {
  const [dataset, setDataset] = useState("ecommerce");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expandedSQL, setExpandedSQL] = useState({});
  const [chartMode, setChartMode] = useState({});
  const [conversations, setConversations] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    fetchConversations();
    fetchUploadedFiles();
  }, [conversationId, showUpload]); // Refresh list when a new conversation starts or upload tab is clicked

  const fetchConversations = async () => {
    try {
      const res = await getConversations();
      if (res.success) setConversations(res.data);
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  };

  const fetchUploadedFiles = async () => {
    try {
      const res = await getUploadedFiles();
      if (res.success) setUploadedFiles(res.data);
    } catch (e) {
      console.error("Failed to load uploaded files:", e);
    }
  };

  const handleLoadFile = (file) => {
    setDataset(file.fileId);
    setUploadInfo({
      sessionId: file.fileId,
      fileName: file.fileName,
      rowCount: file.rowCount,
      columns: file.fileSchema?.headers || []
    });
    
    // Check if there's a conversation for this file
    const fileConversations = conversations.filter(c => c.dataset === file.fileId);
    if (fileConversations.length > 0) {
      // Load the most recent conversation for this file
      loadConversation(fileConversations[0]._id);
    } else {
      // Start fresh chat
      setChat([]);
      setConversationId(null);
    }
  };

  const loadConversation = async (id) => {
    try {
      const res = await getConversation(id);
      if (res.success) {
        setConversationId(res.data._id);
        setDataset(res.data.dataset);
        
        const isUpload = res.data.dataset.startsWith("upload_");
        setShowUpload(isUpload);
        
        if (isUpload) {
          // Find the file in uploadedFiles to populate uploadInfo
          let fileObj = uploadedFiles.find(f => f.fileId === res.data.dataset);
          if (fileObj) {
            setUploadInfo({
              sessionId: fileObj.fileId,
              fileName: fileObj.fileName,
              rowCount: fileObj.rowCount,
              columns: fileObj.fileSchema?.headers || []
            });
          }
        } else {
          setUploadInfo(null);
        }

        const mappedChat = res.data.messages.map(m => {
          if (m.role === "user") return { user: m.content };
          return { ai: m.content, sqlQuery: m.sqlQuery, queryResult: m.queryResult };
        });
        setChat(mappedChat);
      }
    } catch (err) {
      console.error("Error loading conversation:", err);
    }
  };

  // Close user menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest(".user-menu-container")) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleDatasetChange = (e) => {
    const newDataset = e.target.value;
    setDataset(newDataset);
    setChat([]);
    setConversationId(null);
    setShowUpload(false);
    setUploadInfo(null);
  };

  const switchToUpload = () => {
    setShowUpload(true);
    setChat([]);
    setConversationId(null);
    setUploadInfo(null);
  };

  const switchToSample = () => {
    setShowUpload(false);
    setUploadInfo(null);
    setChat([]);
    setConversationId(null);
  };

  // File upload handlers
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const response = await uploadFile(file);
      if (response.success) {
        setUploadInfo(response.data);
        setDataset(response.data.sessionId);
        setChat([{
          ai: response.data.message,
          type: "system"
        }]);
      }
    } catch (error) {
      setChat([{ ai: error.message || "Failed to upload file. Please try again.", type: "error" }]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    handleFileUpload(file);
  };

  // Chat send
  async function handleSend() {
    if (!message.trim()) return;

    const userMessage = message;
    setMessage("");
    setChat(prev => [...prev, { user: userMessage }]);
    setIsLoading(true);

    try {
      const response = await apiRequest("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message: userMessage, dataset, conversationId }),
      });

      if (response.success) {
        setConversationId(response.data.conversationId);
        const aiMsg = {
          ai: response.data.response,
          sqlQuery: response.data.sqlQuery,
          queryResult: response.data.queryResult,
        };
        setChat(prev => [...prev, aiMsg]);

        // Add to history
        setQueryHistory(prev => {
          const updated = [{ question: userMessage, ...aiMsg, timestamp: new Date() }, ...prev];
          return updated.slice(0, 5);
        });
      } else {
        setChat(prev => [...prev, { ai: response.message || "I couldn't understand that question — try rephrasing it.", type: "error" }]);
      }
    } catch (error) {
      setChat(prev => [...prev, { ai: "I couldn't connect to the server. Please check your connection and try again.", type: "error" }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyPress(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const toggleSQL = (index) => {
    setExpandedSQL(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleChart = (index) => {
    setChartMode(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const isChartable = (queryResult) => {
    if (!queryResult?.data || queryResult.data.length === 0) return false;
    const keys = Object.keys(queryResult.data[0]);
    return keys.some(k => typeof queryResult.data[0][k] === "number");
  };

  const getChartData = (queryResult) => {
    if (!queryResult?.data) return [];
    const keys = Object.keys(queryResult.data[0]);
    const labelKey = keys.find(k => typeof queryResult.data[0][k] === "string") || keys[0];
    const valueKeys = keys.filter(k => typeof queryResult.data[0][k] === "number");
    return queryResult.data.slice(0, 20).map(row => ({
      name: String(row[labelKey]).substring(0, 20),
      ...Object.fromEntries(valueKeys.map(k => [k, row[k]])),
    }));
  };

  const currentExamples = EXAMPLE_QUESTIONS[dataset] || EXAMPLE_QUESTIONS.ecommerce;

  const renderResultsTable = (queryResult, msgIndex) => {
    if (!queryResult?.data || queryResult.data.length === 0) return null;
    const headers = Object.keys(queryResult.data[0]);
    const showChart = chartMode[msgIndex] && isChartable(queryResult);

    return (
      <div className="results-section">
        <div className="results-header">
          <span className="results-count">
            📊 {queryResult.rowCount} row{queryResult.rowCount !== 1 ? "s" : ""} returned
          </span>
          {isChartable(queryResult) && (
            <button className="chart-toggle-btn" onClick={() => toggleChart(msgIndex)}>
              {chartMode[msgIndex] ? "📋 Table" : "📈 Chart"}
            </button>
          )}
        </div>

        {showChart ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getChartData(queryResult)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="name" tick={{ fill: "#8888aa", fontSize: 11 }} angle={-30} textAnchor="end" height={70} />
                <YAxis tick={{ fill: "#8888aa", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #3a3a5a", borderRadius: "8px", color: "#fff" }} />
                {Object.keys(queryResult.data[0]).filter(k => typeof queryResult.data[0][k] === "number").map((key, i) => (
                  <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="results-table-wrapper">
            <table className="results-table">
              <thead>
                <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {queryResult.data.slice(0, 100).map((row, ri) => (
                  <tr key={ri}>
                    {headers.map(h => (
                      <td key={h}>{row[h] === null ? <span className="null-value">NULL</span> : String(row[h])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const filteredConversations = conversations.filter(c => c.dataset === dataset);

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

        <div className="sidebar-section">
          <div className="sidebar-tabs">
            <button className={`tab-btn ${!showUpload ? "active" : ""}`} onClick={switchToSample}>📦 Sample DB</button>
            <button className={`tab-btn ${showUpload ? "active" : ""}`} onClick={switchToUpload}>📁 Upload File</button>
          </div>
        </div>

        {!showUpload ? (
          <div className="database-selector">
            <label htmlFor="dataset">Select Database</label>
            <select id="dataset" value={dataset} onChange={handleDatasetChange}>
              <option value="ecommerce">📦 E-commerce DB</option>
              <option value="HR">👥 HR Database</option>
              <option value="students">🎓 Student Records</option>
            </select>
          </div>
        ) : (
          <div className="upload-section-sidebar">
            {uploadInfo ? (
              <div className="upload-success-card">
                <span className="upload-success-icon">✅</span>
                <p className="upload-filename">{uploadInfo.fileName}</p>
                <p className="upload-meta">{uploadInfo.rowCount} rows • {uploadInfo.columns?.length} columns</p>
              </div>
            ) : (
              <p className="upload-hint">Upload a CSV or Excel file to query with AI</p>
            )}
          </div>
        )}

        {/* Sidebar dynamic list */}
        {(showUpload ? uploadedFiles.length > 0 : filteredConversations.length > 0) && (
          <div className="query-history">
            <h3>{showUpload ? "📁 Your Uploaded Files" : "📜 Past Conversations"}</h3>
            <div className="history-list">
              {showUpload ? (
                uploadedFiles.map((file) => (
                  <button 
                    key={file.fileId} 
                    className={`history-item ${dataset === file.fileId ? "active" : ""}`} 
                    onClick={() => handleLoadFile(file)}
                    title={file.fileName}
                  >
                    <span className="history-q">
                      {file.fileName}
                    </span>
                    <span className="history-date" style={{ fontSize: "10px", color: "#6666aa", display: "block", marginTop: "4px" }}>
                      {new Date(file.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))
              ) : (
                filteredConversations.map((conv) => (
                  <button 
                    key={conv._id} 
                    className={`history-item ${conversationId === conv._id ? "active" : ""}`} 
                    onClick={() => loadConversation(conv._id)}
                    title={conv.title || "New Conversation"}
                  >
                    <span className="history-q">
                      {conv.title || "New Conversation"}
                    </span>
                    <span className="history-date" style={{ fontSize: "10px", color: "#6666aa", display: "block", marginTop: "4px" }}>
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                ))
              )}
            </div>
            {!showUpload && (
              <button 
                className="new-chat-btn" 
                onClick={switchToSample} 
                style={{ marginTop: "12px", width: "100%", padding: "8px", borderRadius: "8px", background: "rgba(102, 126, 234, 0.1)", border: "1px dashed #667eea", color: "#e0e0f0", cursor: "pointer" }}
              >
                + New Chat
              </button>
            )}
          </div>
        )}

        <div className="sidebar-info">
          <div className="info-card">
            <h3>💡 Tips</h3>
            <ul>
              <li>Ask natural language questions</li>
              <li>Upload CSV/Excel to query your data</li>
              <li>Click 📈 to see charts</li>
              <li>Click SQL to expand/collapse</li>
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
              {uploadInfo ? `📁 ${uploadInfo.fileName}` : `Connected to ${dataset}`}
            </span>
            <div className="user-menu-container">
              <button className="user-menu-button" onClick={() => setShowUserMenu(!showUserMenu)}>
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
                  <button className="dropdown-item" onClick={() => navigate("/profile")}><span>⚙️</span> Profile Settings</button>
                  <button className="dropdown-item logout-button" onClick={handleLogout}><span>🚪</span> Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="chat-container">
          {showUpload && !uploadInfo && chat.length === 0 ? (
            /* File Upload Zone */
            <div className="upload-zone-wrapper">
              <div className={`upload-zone ${dragOver ? "drag-over" : ""}`} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onClick={() => fileInputRef.current?.click()}>
                {isUploading ? (
                  <div className="upload-loading">
                    <div className="loader"></div>
                    <p>Processing your file...</p>
                  </div>
                ) : (
                  <>
                    <div className="upload-icon">📁</div>
                    <h3>Drop your file here</h3>
                    <p>or click to browse</p>
                    <p className="upload-formats">Supports CSV and Excel (.xlsx, .xls)</p>
                  </>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".csv,.xlsx,.xls" style={{ display: "none" }} />
              </div>
            </div>
          ) : chat.length === 0 ? (
            /* Empty State */
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3>Start a conversation</h3>
              <p>Ask me anything about your {uploadInfo ? "uploaded" : dataset} data!</p>
              <div className="example-queries">
                <p>Try asking:</p>
                {currentExamples.map((q, i) => (
                  <button key={i} onClick={() => setMessage(q)}>"{q}"</button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat Messages */
            <div className="messages">
              {chat.map((m, i) => (
                <div key={i} className={`message ${m.user ? "user-message" : "ai-message"} ${m.type === "error" ? "error-message" : ""}`}>
                  <div className="message-avatar">{m.user ? "👤" : m.type === "error" ? "⚠️" : "🤖"}</div>
                  <div className="message-content">
                    <span className="message-sender">{m.user ? "You" : "SQL Agent"}</span>
                    <div className="message-text">
                      {m.user ? m.user : <ReactMarkdown>{m.ai}</ReactMarkdown>}
                    </div>

                    {/* Collapsible SQL Display */}
                    {m.sqlQuery && (
                      <div className="sql-query-section">
                        <button className="sql-toggle-btn" onClick={() => toggleSQL(i)}>
                          <span>{expandedSQL[i] ? "▼" : "▶"}</span>
                          <span className="sql-toggle-label">SQL Query</span>
                          <span className="sql-badge">SELECT</span>
                        </button>
                        {expandedSQL[i] && (
                          <div className="sql-query-display">
                            <code>{m.sqlQuery}</code>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Results Table + Chart */}
                    {m.queryResult && renderResultsTable(m.queryResult, i)}
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="message ai-message">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <span className="message-sender">SQL Agent</span>
                    <div className="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {(!showUpload || uploadInfo) && (
          <div className="input-container">
            <div className="input-wrapper">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={uploadInfo ? "Ask about your uploaded data..." : `Ask about your ${dataset} database...`}
                disabled={isLoading}
              />
              <button onClick={handleSend} disabled={isLoading || !message.trim()} className="send-button">
                {isLoading ? "⏳" : "Send →"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
