export default function PDFTextDisplay({ text }: { text: string }) {
  if (!text) {
    return <p className='text-gray-500 italic text-center'>No PDF text extracted yet.</p>;
  }

  return (
    <div className='mt-6 bg-gray-100 rounded-lg p-4 overflow-auto max-h-[70vh]'>
      <pre className='whitespace-pre-wrap text-sm'>{text}</pre>
    </div>
  );
}
