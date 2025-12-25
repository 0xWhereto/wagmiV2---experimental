"use client";

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DustTransitionProps {
  isActive: boolean;
  onComplete?: () => void;
  duration?: number; // in ms
}

export function DustTransition({ isActive, onComplete, duration = 600 }: DustTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Detect theme and set background color
    const isLightMode = document.documentElement.classList.contains('light');
    // Dark: zinc-950 (#09090b), Light: cream (#f5f5f0)
    const bgColor = isLightMode 
      ? { r: 245, g: 245, b: 240 } // #f5f5f0
      : { r: 9, g: 9, b: 11 }; // #09090b

    // Create pixel grid - using larger "pixels" for performance
    const pixelSize = 8; // Size of each "dust particle"
    const cols = Math.ceil(canvas.width / pixelSize);
    const rows = Math.ceil(canvas.height / pixelSize);
    const totalPixels = cols * rows;

    // Create array of pixel indices and shuffle them
    const pixels: number[] = [];
    for (let i = 0; i < totalPixels; i++) {
      pixels.push(i);
    }
    
    // Fisher-Yates shuffle for random order
    for (let i = pixels.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pixels[i], pixels[j]] = [pixels[j], pixels[i]];
    }

    // Track which pixels are still visible
    const pixelAlpha = new Float32Array(totalPixels).fill(1);

    // Fill canvas with background color initially
    ctx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startTime = performance.now();
    let currentPixelIndex = 0;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Calculate how many pixels should be dissolved by now
      const targetPixels = Math.floor(progress * totalPixels);
      
      // Dissolve pixels up to target
      while (currentPixelIndex < targetPixels && currentPixelIndex < totalPixels) {
        const pixelIdx = pixels[currentPixelIndex];
        const col = pixelIdx % cols;
        const row = Math.floor(pixelIdx / cols);
        const x = col * pixelSize;
        const y = row * pixelSize;
        
        // Clear this pixel (make transparent)
        ctx.clearRect(x, y, pixelSize, pixelSize);
        pixelAlpha[pixelIdx] = 0;
        
        currentPixelIndex++;
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        setIsVisible(false);
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, duration, onComplete]);

  if (!isVisible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[10000] pointer-events-none"
      style={{ 
        imageRendering: 'pixelated',
      }}
    />
  );
}

// Wrapper component that triggers on page changes
export function PageTransitionWrapper({ 
  children, 
  pageKey 
}: { 
  children: React.ReactNode; 
  pageKey: string;
}) {
  const [showTransition, setShowTransition] = useState(false);
  const [displayedKey, setDisplayedKey] = useState(pageKey);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Page is changing - show transition
    setShowTransition(true);
  }, [pageKey]);

  const handleTransitionComplete = () => {
    setShowTransition(false);
    setDisplayedKey(pageKey);
  };

  return (
    <>
      <DustTransition 
        isActive={showTransition} 
        onComplete={handleTransitionComplete}
        duration={500}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={displayedKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

