import { useRef, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Define the navigation order for stack navigation
const NAVIGATION_ORDER = ['/', '/pool', '/history', '/profile'];

export const useNavigationDirection = () => {
  const location = useLocation();
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const previousPathRef = useRef<string>('');

  useEffect(() => {
    const currentIndex = NAVIGATION_ORDER.indexOf(location.pathname);
    const previousIndex = NAVIGATION_ORDER.indexOf(previousPathRef.current);

    if (previousIndex !== -1 && currentIndex !== -1) {
      // Determine direction based on navigation order
      if (currentIndex > previousIndex) {
        // Moving forward in navigation (right to left)
        setDirection('right');
      } else if (currentIndex < previousIndex) {
        // Moving backward in navigation (left to right)
        setDirection('left');
      }
      // If same index, keep previous direction
    }

    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  return direction;
};

// Helper function to get navigation direction between two paths
export const getNavigationDirection = (fromPath: string, toPath: string): 'left' | 'right' => {
  const fromIndex = NAVIGATION_ORDER.indexOf(fromPath);
  const toIndex = NAVIGATION_ORDER.indexOf(toPath);

  if (fromIndex === -1 || toIndex === -1) {
    return 'right'; // Default to right if paths not found
  }

  return toIndex > fromIndex ? 'right' : 'left';
};
