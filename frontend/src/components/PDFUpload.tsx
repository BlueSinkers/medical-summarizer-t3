import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PDFUploadProps {
  onExtract: (text: string) => void;
}

export default function PDFUpload({ onExtract }: PDFUploadProps) {
  const [loading, setLoading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    setLoading(true);
    let allText = '';

    for (const file of Array.from(files)) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        allText += `\n\n--- Page ${i} (${file.name}) ---\n${pageText}`;
      }
    }

    onExtract(allText);
    setLoading(false);
  }

  return (
    <div className='border-2 border-dashed border-gray-400 rounded-lg p-6 text-center'>
      <input
        type='file'
        accept='application/pdf'
        multiple
        onChange={handleFileChange}
        className='hidden'
        id='pdfInput'
      />
      <label htmlFor='pdfInput' className='cursor-pointer text-blue-600 font-semibold'>
        {loading ? 'Extracting text...' : 'Click to upload PDF(s)'}
      </label>
    </div>
  );
}
