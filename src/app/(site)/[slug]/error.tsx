'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    logger.error('Game page error', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Oops! Something went wrong
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            We're having trouble loading this game. The error has been logged and our team has been notified.
          </p>
          
          <div className="mt-6 space-y-4">
            <Button
              onClick={() => reset()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Try again
            </Button>
            
            <div className="text-sm">
              <Link 
                href="/" 
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                ← Back to home
              </Link>
            </div>
          </div>
          
          {/* Only show error details in development */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-6 text-left text-sm text-gray-500">
              <summary className="cursor-pointer font-medium">Error details (development only)</summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded-md overflow-auto">
                {error.message}
                <br />
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
