// routes/pdfRoutes.js
import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { summarizeWithOllama } from '../ollamaClient.js';

const router = express.Router();
const upload = multer();

router.post('/summarize-pdf', upload.single('file'), async function (req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF uploaded' });
    }

    // Extract text from the PDF
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    // Summarize using Ollama
    const summary = await summarizeWithOllama(text);

    res.json({ summary });
  } catch (err) {
    console.error('PDF summarize error:', err);
    res.status(500).json({ error: 'Failed to summarize PDF.' });
  }
});

export default router;
