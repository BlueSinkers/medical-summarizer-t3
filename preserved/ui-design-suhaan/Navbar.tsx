export default function Navbar() {
  return (
    <nav className='bg-white text-black px-8 py-4 flex justify-between items-center shadow'>
      <div className='flex flex-col items-start'>
        <h1 className='text-2xl font-bold tracking-tight mb-1'>
          Big Think Medical Summarizer
        </h1>
        <div className='flex space-x-6 text-lg font-medium'>
          <a href='/' className='hover:text-gray-600 transition-colors duration-200'>
            Home
          </a>
          <div>
            <a href='/about' className='hover:text-gray-600 transition-colors duration-200'>
            About
          </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
