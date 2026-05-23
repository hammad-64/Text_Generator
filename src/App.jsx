import { useState, useEffect, useRef } from "react"
import "./App.css"

function App() {
  const modelName = "google/flan-t5-large"
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([])
  const [chatHistory, setChatHistory] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [historyVisible, setHistoryVisible] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deletePopupPosition, setDeletePopupPosition] = useState({ top: 0, left: 0 })
  const [loading, setLoading] = useState(false)
  const chatBoxRef = useRef(null)
  const inputRef = useRef(null)
  const scrollTimeoutRef = useRef(null)

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
    }
  }, [messages])

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
  }, [])

  // Focus input on new chat
  useEffect(() => {
    if (activeChatId === null && messages.length === 0) {
      const t = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(t)
    }
  }, [activeChatId, messages.length])

  const handleScroll = () => {
    const chatBox = chatBoxRef.current
    if (!chatBox) return
    chatBox.classList.add("scrolling")
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      chatBox.classList.remove("scrolling")
    }, 600)
  }

  const newChat = () => {
    setMessages([])
    setInput("")
    setActiveChatId(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const selectHistoryItem = (id) => {
    const session = chatHistory.find((s) => s.id === id)
    if (!session) return
    setActiveChatId(id)
    setMessages(session.messages)
    setHistoryVisible(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const openDeleteConfirm = (id, event) => {
    if (deleteConfirmId === id) {
      setDeleteConfirmId(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const popupWidth = 150
    const spaceOnRight = window.innerWidth - rect.right - 8
    const left = spaceOnRight >= popupWidth
      ? rect.right + 8
      : Math.max(rect.right - popupWidth, 8)
    setDeletePopupPosition({ top: rect.top, left })
    setDeleteConfirmId(id)
  }

  const closeDeleteConfirm = () => setDeleteConfirmId(null)

  const deleteHistoryItem = (id) => {
    setChatHistory((prev) => prev.filter((item) => item.id !== id))
    setDeleteConfirmId(null)
    if (activeChatId === id) {
      setActiveChatId(null)
      setMessages([])
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  useEffect(() => {
    if (!deleteConfirmId) return
    const handleOutsideClick = (event) => {
      if (
        event.target.closest(".delete-popup") ||
        event.target.closest(".history-item-dot")
      ) return
      setDeleteConfirmId(null)
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [deleteConfirmId])

  const sendMessage = async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || loading) return

    if (!historyVisible) setHistoryVisible(true)

    const userMessage = { role: "user", text: trimmedInput }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput("")
    setLoading(true)

    let sessionId = activeChatId

    if (!sessionId) {
      sessionId = Date.now()
      setActiveChatId(sessionId)
      setChatHistory((prev) => [
        {
          id: sessionId,
          title: trimmedInput.slice(0, 30) + (trimmedInput.length > 30 ? "..." : ""),
          messages: nextMessages,
        },
        ...prev,
      ])
    } else {
      setChatHistory((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messages: nextMessages } : s
        )
      )
    }

    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${modelName}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: trimmedInput,
            options: { wait_for_model: true },
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "API error")
      }

      await new Promise((resolve) => setTimeout(resolve, 700))

      const aiText =
        data[0]?.generated_text ||
        data?.generated_text ||
        "No response received."

      const aiMessage = { role: "ai", text: aiText }
      const finalMessages = [...nextMessages, aiMessage]
      setMessages(finalMessages)
      setChatHistory((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messages: finalMessages } : s
        )
      )
    } catch (err) {
      console.error("API Error:", err)

      let errorText = "Something went wrong. Check your API key."
      if (err.message?.includes("quota") || err.message?.includes("RESOURCE_EXHAUSTED")) {
        errorText = "Quota exceeded. Check your Hugging Face plan."
      } else if (err.message?.toLowerCase().includes("api key")) {
        errorText = "API key error. Check your VITE_HF_API_KEY in .env file."
      }

      await new Promise((resolve) => setTimeout(resolve, 700))
      const errMessage = { role: "ai", text: errorText }
      const finalMessages = [...nextMessages, errMessage]
      setMessages(finalMessages)
      setChatHistory((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messages: finalMessages } : s
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) sendMessage()
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="new-chat-button" onClick={newChat}>
          + New Chat
        </button>
        <div className="divider" />
        {historyVisible && (
          <section className="history-section">
            <div className="history-list">
              {chatHistory.map((history) => (
                <div key={history.id} className="history-item-shell">
                  <div className="history-item" onClick={() => selectHistoryItem(history.id)}>
                    <span className="history-item-title">{history.title}</span>
                    <button
                      type="button"
                      className="history-item-dot"
                      onClick={(event) => {
                        event.stopPropagation()
                        openDeleteConfirm(history.id, event)
                      }}
                      aria-label="Open delete menu"
                    >
                      ⋯
                    </button>
                  </div>
                  {deleteConfirmId === history.id && (
                    <div
                      className="delete-popup"
                      style={{
                        top: deletePopupPosition.top,
                        left: deletePopupPosition.left,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="delete-popup-button"
                        onClick={() => deleteHistoryItem(history.id)}
                      >
                        🗑 Delete
                      </button>
                      <button
                        type="button"
                        className="delete-popup-cancel"
                        onClick={closeDeleteConfirm}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

      <div className="split-divider" />

      <main className="main-content">
        <div className="chat-panel">
          {messages.length === 0 && !loading ? (
            <div className="empty-state">
              <div className="welcome-panel">
                <h1>Welcome to Text Generator</h1>
                <p>Start a conversation, ask a question, or generate new ideas with AI.</p>
                <div className="model-label">Using model: {modelName}</div>
              </div>
              <div className="input-row centered">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                />
                <button onClick={sendMessage} disabled={loading}>
                  Send
                </button>
              </div>
              <div className="input-disclaimer">
                AI can make mistakes, so don't rely on it completely.
              </div>
            </div>
          ) : (
            <>
              <div
                className={`chat-box ${messages.length === 0 ? "empty" : ""}`}
                ref={chatBoxRef}
                onScroll={handleScroll}
              >
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    <p>{msg.text}</p>
                  </div>
                ))}
                {loading && (
                  <div className="message ai loading">
                    <p>AI is thinking...</p>
                  </div>
                )}
              </div>
              <div className="input-row">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                />
                <button onClick={sendMessage} disabled={loading}>
                  Send
                </button>
              </div>
              <div className="model-label inline">Using model: {modelName}</div>
              <div className="input-disclaimer">
                AI can make mistakes, so don't rely on it completely.
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App