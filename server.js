import express from "express"
import dotenv from "dotenv"
import { GoogleGenerativeAI } from "@google/generative-ai"

dotenv.config()

const app = express()
const port = process.env.PORT || 3000
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY

if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
  console.warn("Using VITE_GEMINI_API_KEY on the backend. For security, rename this to GEMINI_API_KEY.")
}

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY. Set this in your .env file or environment.")
}

const genAI = new GoogleGenerativeAI(apiKey)

app.use(express.json())

app.post("/api/chat", async (req, res) => {
  const { message } = req.body
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required and must be a string." })
  }

  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY." })
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
    const result = await model.generateContent(message)
    const text = result.response.text()
    res.json({ text })
  } catch (error) {
    console.error("Gemini API error:", error)
    const message = error?.message || "Failed to call Gemini API."
    res.status(500).json({ error: message })
  }
})

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
