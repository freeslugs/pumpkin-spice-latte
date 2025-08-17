import React from 'react';
import { motion } from 'framer-motion';
import {
  cardVariants,
  buttonVariants,
  modalVariants,
  slideInLeft,
  slideInRight,
  slideInUp,
  scaleIn,
  fadeIn,
  pulseVariants,
  bounceVariants,
  shakeVariants,
  floatingVariants,
  glowVariants,
  loadingVariants,
} from '../lib/animations';

const AnimationShowcase = () => {
  return (
    <div className='p-6 space-y-8'>
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className='text-3xl font-bold text-center mb-8'
      >
        🎬 Animation Showcase
      </motion.h1>

      {/* Card Animations */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Card Animations</h2>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              variants={cardVariants}
              initial='hidden'
              animate='visible'
              whileHover='hover'
              className='p-6 bg-white rounded-lg shadow-md border'
            >
              <h3 className='font-semibold mb-2'>Card {i}</h3>
              <p className='text-sm text-gray-600'>
                Hover me to see the effect!
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Button Animations */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Button Animations</h2>
        <div className='flex gap-4 flex-wrap'>
          <motion.button
            variants={buttonVariants}
            whileHover='hover'
            whileTap='tap'
            className='px-6 py-3 bg-orange-500 text-white rounded-lg'
          >
            Hover & Tap Me
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9, rotate: -5 }}
            className='px-6 py-3 bg-blue-500 text-white rounded-lg'
          >
            Rotate on Hover
          </motion.button>
        </div>
      </section>

      {/* Slide Animations */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Slide Animations</h2>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <motion.div
            variants={slideInLeft}
            initial='hidden'
            animate='visible'
            className='p-4 bg-green-100 rounded-lg'
          >
            Slide In Left
          </motion.div>
          <motion.div
            variants={slideInUp}
            initial='hidden'
            animate='visible'
            className='p-4 bg-blue-100 rounded-lg'
          >
            Slide In Up
          </motion.div>
          <motion.div
            variants={slideInRight}
            initial='hidden'
            animate='visible'
            className='p-4 bg-purple-100 rounded-lg'
          >
            Slide In Right
          </motion.div>
        </div>
      </section>

      {/* Special Effects */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Special Effects</h2>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <motion.div
            variants={pulseVariants}
            animate='animate'
            className='p-4 bg-yellow-100 rounded-lg text-center'
          >
            Pulse
          </motion.div>
          <motion.div
            variants={bounceVariants}
            animate='animate'
            className='p-4 bg-red-100 rounded-lg text-center'
          >
            Bounce
          </motion.div>
          <motion.div
            variants={shakeVariants}
            animate='animate'
            className='p-4 bg-pink-100 rounded-lg text-center'
          >
            Shake
          </motion.div>
          <motion.div
            variants={floatingVariants}
            animate='animate'
            className='p-4 bg-indigo-100 rounded-lg text-center'
          >
            Float
          </motion.div>
        </div>
      </section>

      {/* Glow Effect */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Glow Effect</h2>
        <motion.div
          variants={glowVariants}
          animate='animate'
          className='p-6 bg-orange-100 rounded-lg text-center border-2 border-orange-300'
        >
          ✨ Glowing Element ✨
        </motion.div>
      </section>

      {/* Loading Animation */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Loading Animation</h2>
        <motion.div
          variants={loadingVariants}
          animate='animate'
          className='w-16 h-16 bg-orange-500 rounded-full mx-auto'
        />
      </section>

      {/* Scale In */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Scale In</h2>
        <motion.div
          variants={scaleIn}
          initial='hidden'
          animate='visible'
          className='p-6 bg-gradient-to-r from-orange-400 to-red-400 rounded-lg text-white text-center'
        >
          🎯 Scaled In Element
        </motion.div>
      </section>

      {/* Fade In */}
      <section className='space-y-4'>
        <h2 className='text-xl font-semibold'>Fade In</h2>
        <motion.div
          variants={fadeIn}
          initial='hidden'
          animate='visible'
          className='p-6 bg-gray-100 rounded-lg text-center'
        >
          🌟 Faded In Element
        </motion.div>
      </section>
    </div>
  );
};

export default AnimationShowcase;
