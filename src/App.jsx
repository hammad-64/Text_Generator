

import { useState, useEffect, useRef } from "react"
import "./App.css"

function App() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const chatBoxRef = useRef(null)
  const scrollTimeoutRef = useRef(null)

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

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage = { role: "user", text: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Server error")
      }

      await new Promise((resolve) => setTimeout(resolve, 700))
      const aiMessage = { role: "ai", text: data.text }
      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error(error)
      const errMsg = error?.message || ""
      let message = "Something went wrong. Check your server logs or API key settings."

      if (errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        message = "Quota exceeded. Check your Google Cloud billing and API usage."
      } else if (errMsg.toLowerCase().includes("api key")) {
        message = "API key error. Verify GEMINI_API_KEY on the backend server."
      }

      await new Promise((resolve) => setTimeout(resolve, 700))
      setMessages((prev) => [...prev, { role: "ai", text: message }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) sendMessage()
  }

  return (
    <div className="app">
      <div className="chat-box" ref={chatBoxRef} onScroll={handleScroll}>
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
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
        />
        <button onClick={sendMessage} disabled={loading}>Send</button>
      </div>
    </div>
  )
}

export default App