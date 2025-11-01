import { useState } from 'react';
import PDFUpload from '../components/PDFUpload.tsx';
import PDFTextDisplay from '../components/PDFTextDisplay';

export default function Home() {
  const [extractedText, setExtractedText] = useState('');

  return (
    <div className='p-8'>
      <h2 className='text-2xl font-semibold mb-4'>Analyze Your Medical Report</h2>
      <PDFUpload onExtract={setExtractedText} />
      <PDFTextDisplay text={extractedText} />
    </div>
  );
}
