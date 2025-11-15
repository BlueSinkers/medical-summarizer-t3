import express from 'express'
import { readFileSync } from 'fs'
import ollama from 'ollama'

const router = express.Router()

// POST /api/query
router.post('/', async (req, res) => {
  try {
    const { content } = req.body

    if (!content) {
      return res.status(400).json({ error: 'No content provided' })
    }

    console.log('Received PDF text length:', content.length)

    // ---- Build your prompt ----
    const prompt = `
You are a medical assistant AI.
Summarize the following patient report in clear bullet points.

Patient Report:
${content}
    `

    // ---- Call Ollama (non-streaming!) ----
    const response = await ollama.generate({
      model: 'llama3',
      prompt,
      stream: false       // 👈 THIS MAKES IT NON-STREAMING
    })

    // response looks like:
    // { response: "The summary...", ... }

    return res.json({
      answer: response.response
    })

  } catch (error) {
    console.error('Error in /api/query:', error)
    res.status(500).json({ error: 'Backend error' })
  }
})

export default router
