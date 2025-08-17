import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useNavigationDirection } from '../hooks/use-navigation-direction';
import { stackNavigationVariants, getPageVariants } from '../lib/animations';
import { useIsMobile } from '../hooks/use-mobile';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = '',
}) => {
  const location = useLocation();
  const direction = useNavigationDirection();
  const isMobile = useIsMobile();
  const pageVariants = getPageVariants(direction);

  // On desktop, just render children without animations
  if (!isMobile) {
    return <div className={`w-full ${className}`}>{children}</div>;
  }

  // On mobile, apply stack navigation animations
  return (
    <div className='relative w-full overflow-hidden'>
      <AnimatePresence mode='wait' initial={false}>
        <motion.div
          key={location.pathname}
          variants={stackNavigationVariants}
          initial={pageVariants.initial}
          animate={pageVariants.animate}
          exit={pageVariants.exit}
          className={`w-full ${className}`}
          transition={{
            duration: 0.1,
            ease: 'easeInOut',
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PageTransition;
