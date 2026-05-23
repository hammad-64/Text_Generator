

import { useState, useEffect, useRef } from "react"
import "./App.css"

function App() {
  const modelName = "mistralai/Mistral-7B-Instruct-v0.3"
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

  const updateSession = (id, updater) => {
    setChatHistory((prev) =>
      prev.map((session) => {
        if (session.id !== id) return session
        return typeof updater === "function" ? updater(session) : { ...session, ...updater }
      })
    )
  }

  const selectHistoryItem = (id) => {
    const session = chatHistory.find((history) => history.id === id)
    if (!session) return

    setActiveChatId(id)
    setMessages(session.messages ?? [])
    setHistoryVisible(true)
    // focus input after selecting a history item
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  const handleScroll = () => {
    const chatBox = chatBoxRef.current
    if (!chatBox) return

    chatBox.classList.add("scrolling")
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      chatBox.classList.remove("scrolling")
    }, 600)
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

    setDeletePopupPosition({
      top: rect.top,
      left,
    })
    setDeleteConfirmId(id)
  }

  const closeDeleteConfirm = () => {
    setDeleteConfirmId(null)
  }

  const deleteHistoryItem = (id) => {
    setChatHistory((prev) => prev.filter((item) => item.id !== id))
    if (deleteConfirmId === id) {
      setDeleteConfirmId(null)
    }

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
        event.target.closest('.delete-popup') ||
        event.target.closest('.history-item-dot')
      ) {
        return
      }
      setDeleteConfirmId(null)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [deleteConfirmId])

  const newChat = () => {
    setMessages([])
    setInput("")
    setActiveChatId(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Ensure the input is focused when entering the empty/new-chat state.
  useEffect(() => {
    if (activeChatId === null && messages.length === 0) {
      const t = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(t)
    }
  }, [activeChatId, messages.length])

  // Keep `messages` in sync with `chatHistory` when sessions update.
  useEffect(() => {
    if (activeChatId == null) return
    const session = chatHistory.find((s) => s.id === activeChatId)
    if (!session) return
    // Only update if the session has different messages (e.g. AI reply appended)
    const sessionMsgs = session.messages ?? []
    if (JSON.stringify(sessionMsgs) !== JSON.stringify(messages)) {
      setMessages(sessionMsgs)
    }
  }, [chatHistory, activeChatId])

  const sendMessage = async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput) return

    if (!historyVisible) {
      setHistoryVisible(true)
    }

    const userMessage = { role: "user", text: trimmedInput }
    const nextMessages = [...messages, userMessage]
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
      updateSession(sessionId, (session) => ({
        ...session,
        messages: nextMessages,
      }))
    }

    setMessages(nextMessages)
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedInput }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Server error")
      }

      await new Promise((resolve) => setTimeout(resolve, 700))
      const aiMessage = { role: "ai", text: data.text }
      const nextMessagesWithAi = [...nextMessages, aiMessage]
      setMessages(nextMessagesWithAi)
      if (sessionId) {
        updateSession(sessionId, (session) => ({
          ...session,
          messages: nextMessagesWithAi,
        }))
      }
    } catch (error) {
      console.error(error)
      const errMsg = error?.message || ""
      let message = "Something went wrong. Check your server logs or API key settings."

      if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        message = "Quota exceeded. Check your plan and billing details."
      } else if (errMsg.toLowerCase().includes("api key")) {
        message = "API key error. Verify HUGGINGFACE_API_KEY on the backend server."
      }

      const errorMessage = { role: "ai", text: message }
      const nextMessagesWithError = [...nextMessages, errorMessage]
      await new Promise((resolve) => setTimeout(resolve, 700))
      setMessages(nextMessagesWithError)
      if (activeChatId) {
        updateSession(activeChatId, (session) => ({
          ...session,
          messages: nextMessagesWithError,
        }))
      }
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
                      style={{ top: deletePopupPosition.top, left: deletePopupPosition.left }}
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
                <button onClick={sendMessage} disabled={loading}>Send</button>
              </div>

              <div className="input-disclaimer">AI can make mistakes, so don't rely on it completely.</div>
            </div>
          ) : (
            <>
              <div className={`chat-box ${messages.length === 0 ? "empty" : ""}`} ref={chatBoxRef} onScroll={handleScroll}>
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
                <button onClick={sendMessage} disabled={loading}>Send</button>
              </div>
              <div className="model-label inline">Using model: {modelName}</div>

              <div className="input-disclaimer">AI can make mistakes, so don't rely on it completely.</div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App