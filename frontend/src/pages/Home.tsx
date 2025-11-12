import { useState } from 'react';
import PDFUpload from '../components/PDFUpload';
import PDFTextDisplay from '../components/PDFTextDisplay';
import SummarizeButton from '../components/Button';

export default function Home() {
  const [extractedText, setExtractedText] = useState('');
  const [summary, setSummary] = useState('');
  const [fileId, setFileId] = useState(''); // track a unique file ID per upload

  async function handleSummarize() {
    if (!extractedText) {
      alert('Please upload a PDF first.');
      return;
    }

    try {
      // 1️⃣ Assign a unique ID for the uploaded file
      const newFileId = `file_${Date.now()}`;
      setFileId(newFileId);

      // 2️⃣ Send extracted text to the backend to ingest
      const ingestResponse = await fetch('http://localhost:3001/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: newFileId,
          text: extractedText,
        }),
      });

      if (!ingestResponse.ok) throw new Error('Failed to ingest PDF');
      console.log('PDF ingested successfully.');

      // 3️⃣ Query backend for the summary
      const queryResponse = await fetch('http://localhost:3001/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: newFileId,
          query: 'summarize the patient report',
        }),
      });

      const data = await queryResponse.json();
      setSummary(data.answer || JSON.stringify(data, null, 2));
      console.log('RAG summary:', data);
    } catch (err) {
      console.error('Error summarizing:', err);
      alert('Error connecting to backend.');
    }
  }

  return (
    <div className='min-h-screen w-full bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 flex flex-col items-center justify-center px-6 py-12'>
      <div className='max-w-4xl w-full bg-white text-blue-900 rounded-3xl shadow-2xl p-10'>
        <h2 className='text-4xl font-extrabold mb-4 text-center'>
          Analyze Your <span className='text-blue-600'>Medical Report</span>
        </h2>
        <p className='text-center text-blue-700/80 mb-10'>
          Upload your PDF report and get an AI-generated summary in seconds.
        </p>

        <div className='bg-blue-50 rounded-xl p-6 border border-blue-100 shadow-sm'>
          <PDFUpload onExtract={setExtractedText} />
        </div>

        {extractedText && (
          <div className='mt-10'>
            <h3 className='text-xl font-semibold mb-3 text-blue-800'>
              Extracted Text
            </h3>
            <div className='bg-blue-50 text-blue-900 rounded-xl p-4 shadow-inner max-h-72 overflow-y-auto'>
              <PDFTextDisplay text={extractedText} />
            </div>
          </div>
        )}

        {extractedText && (
          <div className='mt-8 flex justify-center'>
            <SummarizeButton onClick={handleSummarize} />
          </div>
        )}

        {summary && (
          <div className='mt-10 bg-blue-50 rounded-xl p-6 shadow-md border border-blue-100'>
            <h3 className='text-xl font-bold mb-3 text-blue-800'>Summary</h3>
            <p className='whitespace-pre-wrap text-blue-900 leading-relaxed'>
              {summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
