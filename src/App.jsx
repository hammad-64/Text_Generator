

import { useState } from "react"
import "./App.css"

function App() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

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
      <h1>AI Chat App</h1>
      <div className="chat-box">
        {messages.length === 0 && <p className="placeholder">Ask me anything...</p>}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <span className="label">{msg.role === "user" ? "You" : "AI"}</span>
            <p>{msg.text}</p>
          </div>
        ))}
        {loading && <p className="loading">AI is thinking...</p>}
      </div>
      <div className="input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type anything and press Enter..."
        />
        <button onClick={sendMessage} disabled={loading}>Send</button>
      </div>
    </div>
  )
}

export default App