import React from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';
import {
  floatingVariants,
  pulseVariants,
  glowVariants,
  scaleIn,
} from '../lib/animations';

interface PumpkinLoaderProps {
  isLoading: boolean;
}

const PumpkinLoader: React.FC<PumpkinLoaderProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-orange-100'
    >
      <div className='text-center'>
        {/* Coffee Logo with Brewing Bouncing Animation */}
        <motion.div
          variants={floatingVariants}
          animate='animate'
          className='mb-6'
        >
          <motion.div
            animate={{
              x: [0, 8, -8, 0],
              rotate: [0, 3, -3, 0],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className='mx-auto'
          >
            <Logo size={96} iconSize={48} />
          </motion.div>
        </motion.div>

        {/* Loading Text with Scale In Animation */}
        <motion.h2
          variants={scaleIn}
          initial='hidden'
          animate='visible'
          className='text-2xl font-bold text-orange-800 mb-4'
        >
          Pumpkin Spice Latte
        </motion.h2>

        {/* Loading Dots with Staggered Animation */}
        <div className='flex justify-center space-x-2 mb-4'>
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: index * 0.2,
                duration: 0.5,
                ease: 'backOut',
              }}
              className='w-3 h-3 bg-orange-500 rounded-full'
            />
          ))}
        </div>

        {/* Loading Message with Fade In */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className='text-orange-600 text-lg'
        >
          Brewing your perfect latte...
        </motion.p>

        {/* Decorative Elements */}
        <div className='absolute inset-0 pointer-events-none overflow-hidden'>
          {/* Floating Coffee Beans */}
          {['☕', '🍂', '🌰'].map((emoji, index) => (
            <motion.div
              key={index}
              initial={{
                opacity: 0,
                x: Math.random() * 200 - 100,
                y: Math.random() * 200 - 100,
              }}
              animate={{
                opacity: [0, 1, 0],
                x: Math.random() * 400 - 200,
                y: Math.random() * 400 - 200,
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: index * 0.5,
                ease: 'easeInOut',
              }}
              className='absolute text-2xl text-orange-300'
              style={{
                left: `${20 + index * 30}%`,
                top: `${30 + index * 20}%`,
              }}
            >
              {emoji}
            </motion.div>
          ))}
        </div>

        {/* Glowing Border Effect */}
        <motion.div
          variants={glowVariants}
          animate='animate'
          className='absolute inset-0 rounded-3xl border-2 border-orange-300'
        />
      </div>
    </motion.div>
  );
};

export default PumpkinLoader;
