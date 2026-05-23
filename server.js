import express from "express"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const port = process.env.PORT || 3000
const hfKey = process.env.HUGGINGFACE_API_KEY || process.env.VITE_HUGGINGFACE_API_KEY
const hfModel = "mistralai/Mistral-7B-Instruct-v0.3"

if (hfKey && process.env.VITE_HUGGINGFACE_API_KEY && !process.env.HUGGINGFACE_API_KEY) {
  console.warn("Using VITE_HUGGINGFACE_API_KEY on the backend. For security, rename this to HUGGINGFACE_API_KEY.")
}

if (!hfKey) {
  console.error("Missing HUGGINGFACE_API_KEY. Set this in your .env file or environment.")
}

app.use(express.json())

const extractHuggingFaceText = (data) => {
  if (typeof data === "string") return data
  if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text
  if (data?.generated_text) return data.generated_text
  if (data?.error) return ""
  return ""
}

app.post("/api/chat", async (req, res) => {
  const { message } = req.body
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required and must be a string." })
  }

  if (!hfKey) {
    return res.status(500).json({ error: "Server is missing HUGGINGFACE_API_KEY." })
  }

  try {
    const hfHosts = [
      "api-inference.huggingface.co",
      "api-inference.hf.co",
    ]

    let lastError = null
    let text = ""

    for (const host of hfHosts) {
      try {
        const response = await fetch(`https://${host}/models/${hfModel}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${hfKey}`,
          },
          body: JSON.stringify({
            inputs: message,
            parameters: {
              max_new_tokens: 400,
              temperature: 0.7,
              top_p: 0.9,
            },
          }),
        })

        const data = await response.json().catch(() => null)
        if (!response.ok) {
          const errorMessage = data?.error || data?.message || response.statusText || `HTTP ${response.status}`
          throw new Error(errorMessage)
        }

        text = extractHuggingFaceText(data)
        if (!text) {
          throw new Error("The Hugging Face model returned an empty response.")
        }

        break
      } catch (error) {
        lastError = error
        console.error(`Hugging Face host ${host} failed:`, error)
      }
    }

    if (!text) {
      throw lastError || new Error("Failed to call the Hugging Face API.")
    }

    res.json({ text })
  } catch (error) {
    console.error("Hugging Face API error:", error)
    const message = error?.message || String(error) || "Failed to call the Hugging Face API."
    res.status(500).json({ error: message })
  }
})

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
