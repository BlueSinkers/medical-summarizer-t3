import { useState } from 'react';

interface ButtonProps {
  onClick: () => Promise<void> | void;
}

export default function Button({ onClick }: ButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSummarize() {
    try {
      setLoading(true);
      await onClick(); // call the parent-provided handler
    } catch (err) {
      console.error('Error in Button onClick:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='mt-4 text-center'>
      <button
        onClick={handleSummarize}
        disabled={loading}
        className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded'
      >
        {loading ? 'Summarizing...' : 'Summarize PDF'}
      </button>

      {result && (
        <div className='mt-4 border rounded p-3 text-gray-800 bg-gray-50'>
          <strong>Summary:</strong>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
}
