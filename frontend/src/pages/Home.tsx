import { useState } from 'react';
import PDFUpload from '../components/PDFUpload';
import PDFTextDisplay from '../components/PDFTextDisplay';
import SummarizeButton from '../components/Button'; // new summarize button

export default function Home() {
  const [extractedText, setExtractedText] = useState('');
  const [summary, setSummary] = useState('');

  async function handleSummarize() {
    if (!extractedText) {
      alert('Please upload a PDF first.');
      return;
    }

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: 'mock_file',
          query: 'summarize',
          content: extractedText,
        }),
      });

      const data = await response.json();
      setSummary(data.answer || JSON.stringify(data, null, 2));
      console.log('Mock RAG response:', data);
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend.');
    }
  }

  return (
    <div className='p-8'>
      <h2 className='text-2xl font-semibold mb-4'>
        Analyze Your Medical Report
      </h2>

      {/* Upload and Extract */}
      <PDFUpload onExtract={setExtractedText} />

      {/* Show Extracted Text */}
      {extractedText && (
        <div className='mt-6'>
          <PDFTextDisplay text={extractedText} />
        </div>
      )}

      {/* Summarize Button */}
      {extractedText && (
        <div className='mt-6'>
          <SummarizeButton onClick={handleSummarize} />
        </div>
      )}

      {/* Display Summary */}
      {summary && (
        <div className='mt-6 bg-gray-100 rounded-lg p-4 shadow'>
          <h3 className='text-lg font-semibold mb-2'>Summary</h3>
          <p className='whitespace-pre-wrap'>{summary}</p>
        </div>
      )}
    </div>
  );
}
