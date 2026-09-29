import { useEffect } from 'react';

export default function LandingPage() {
  useEffect(() => {
    // Forward title from landing page
    document.title = 'DATAPILOT // Web Intelligence';
  }, []);

  return (
    <iframe
      src="/landing.html"
      title="DataPilot Landing Page"
      className="w-screen h-screen border-none m-0 p-0 block overflow-x-hidden"
      style={{ width: '100vw', height: '100vh', border: 'none' }}
    />
  );
}
