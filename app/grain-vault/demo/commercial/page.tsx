'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import Link from 'next/link';

// Scene configurations
const scenes = [
  {
    id: 'intro',
    duration: 4000,
    title: 'GRAIN',
    subtitle: 'The Treasury Revolution',
  },
  {
    id: 'problem',
    duration: 5000,
    title: 'Your Money Is Losing Value',
    subtitle: 'Every. Single. Day.',
    stat: { value: '-7%', label: 'Real returns on cash holdings' },
  },
  {
    id: 'inflation',
    duration: 6000,
    title: '$100,000 Today',
    subtitle: 'Becomes $48,000 in 10 years',
    note: 'At current inflation rates',
  },
  {
    id: 'solution',
    duration: 5000,
    title: 'Meet GRAIN',
    subtitle: 'Money That Grows',
  },
  {
    id: 'formula',
    duration: 6000,
    title: 'Backed by Math',
    formula: 'Price = (Reserve + Equity) / Supply',
    note: 'Simple. Transparent. Auditable.',
  },
  {
    id: 'growth',
    duration: 5000,
    title: '$100,000 in GRAIN',
    subtitle: 'Becomes $310,000 in 10 years',
    note: 'At 12% target APY',
  },
  {
    id: 'features',
    duration: 6000,
    title: 'Built for Business',
    features: ['100% Collateralized', '180+ Countries', '24/7 Liquidity', 'Instant Settlement'],
  },
  {
    id: 'partners',
    duration: 4000,
    title: 'Powered By',
    partners: ['Circle', 'Base', 'Coinbase'],
  },
  {
    id: 'cta',
    duration: 6000,
    title: 'Join the Treasury Revolution',
    cta: 'Get Started Today',
  },
];

export default function CommercialPage() {
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate total duration
  const totalDuration = scenes.reduce((acc, scene) => acc + scene.duration, 0);

  const goToNextScene = useCallback(() => {
    if (currentScene < scenes.length - 1) {
      setCurrentScene((prev) => prev + 1);
    } else {
      // Loop back or pause at end
      setIsPlaying(false);
      setCurrentScene(0);
    }
  }, [currentScene]);

  const goToPrevScene = useCallback(() => {
    setCurrentScene((prev) => Math.max(0, prev - 1));
  }, []);

  // Auto-advance scenes
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
      return;
    }

    const scene = scenes[currentScene];
    const startTime = Date.now();

    // Update progress
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const sceneProgress = Math.min(elapsed / scene.duration, 1);
      const previousScenesDuration = scenes
        .slice(0, currentScene)
        .reduce((acc, s) => acc + s.duration, 0);
      const overallProgress =
        ((previousScenesDuration + elapsed) / totalDuration) * 100;
      setProgress(overallProgress);
    }, 50);

    // Advance to next scene
    timerRef.current = setTimeout(goToNextScene, scene.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [currentScene, isPlaying, goToNextScene, totalDuration]);

  // Hide controls after inactivity
  useEffect(() => {
    const resetControlsTimer = () => {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener('mousemove', resetControlsTimer);
    resetControlsTimer();

    return () => {
      window.removeEventListener('mousemove', resetControlsTimer);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // Fullscreen handling
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
        case 'ArrowRight':
          goToNextScene();
          break;
        case 'ArrowLeft':
          goToPrevScene();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          setIsMuted((prev) => !prev);
          break;
        case 'Escape':
          if (isFullscreen) toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextScene, goToPrevScene, isFullscreen]);

  // Share functionality
  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'GRAIN - The Treasury Revolution',
          text: 'Discover how GRAIN is changing treasury management',
          url: shareUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };

  const renderScene = () => {
    const scene = scenes[currentScene];

    const containerVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.5, staggerChildren: 0.15 } },
      exit: { opacity: 0, transition: { duration: 0.3 } },
    };

    const itemVariants = {
      hidden: { opacity: 0, y: 30, scale: 0.95 },
      visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
    };

    switch (scene.id) {
      case 'intro':
        return (
          <motion.div
            key={scene.id}
            className="flex flex-col items-center justify-center h-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              variants={itemVariants}
              className="w-40 h-40 rounded-full bg-gradient-to-br from-emerald-600 to-yellow-500 flex items-center justify-center mb-12"
              animate={{
                boxShadow: ['0 0 60px rgba(16, 185, 129, 0.3)', '0 0 100px rgba(16, 185, 129, 0.6)', '0 0 60px rgba(16, 185, 129, 0.3)']
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-8xl font-bold text-black">G</span>
            </motion.div>
            <motion.h1
              variants={itemVariants}
              className="text-7xl md:text-9xl font-bold text-white tracking-tighter"
            >
              {scene.title}
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-2xl md:text-3xl text-gray-400 mt-6"
            >
              {scene.subtitle}
            </motion.p>
          </motion.div>
        );

      case 'problem':
        return (
          <motion.div
            key={scene.id}
            className="flex flex-col items-center justify-center h-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.h1
              variants={itemVariants}
              className="text-5xl md:text-7xl font-bold text-white text-center mb-4"
            >
              {scene.title}
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-3xl md:text-4xl text-red-400 mb-12"
            >
              {scene.subtitle}
            </motion.p>
            <motion.div
              variants={itemVariants}
              className="text-8xl font-bold text-red-500"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {scene.stat?.value}
            </motion.div>
            <motion.p variants={itemVariants} className="text-xl text-gray-500 mt-4">
              {scene.stat?.label}
            </motion.p>
          </motion.div>
        );

      case 'inflation':
        return (
          <motion.div
            key={scene.id}
            className="flex flex-col items-center justify-center h-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.h1
              variants={itemVariants}
              className="text-5xl md:text-7xl font-bold text-white text-center"
            >
              {scene.title}
            </motion.h1>
            <motion.div
              variants={itemVariants}
              className="my-12 flex items-center gap-8"
            >
              <motion.div
                className="text-6xl"
                animate={{ x: [0, 20, 0], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                &rarr;
              </motion.div>
            </motion.div>
            <motion.p
              variants={itemVariants}
              className="text-4xl md:text-6xl font-bold text-red-400"
            >
              {scene.subtitle}
            </motion.p>
            <motion.p variants={itemVariants} className="text-xl text-gray-500 mt-6">
              {scene.note}
            </motion.p>
          </motion.div>
        );

      case 'solution':
        return (
          <motion.div
            key={scene.id}
            className="flex flex-col items-center justify-center h-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              variants={itemVariants}
              className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-600 to-yellow-500 flex items-center justify-center mb-8"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <span className="text-6xl font-bold text-black">G</span>
            </motion.div>
            <motion.h1
              variants={itemVariants}
              className="text-6xl md:text-8xl font-bold text-white"
            >
              {scene.title}
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-3xl md:text-4xl text-emerald-400 mt-6"
            >
              {scene.subtitle}
            </motion.p>
          </motion.div>
        );

      case 'formula':
        return (
          <motion.div
            key={scene.id}
            className="flex flex-col items-center justify-center h-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.h1
              variants={itemVariants}
              className="text-4xl md:text-6xl font-bold text-white mb-12"
            >
              {scene.title}
            </motion.h1>
            <motion.div
              variants={itemVariants}
              className="text-3xl md:text-5xl font-mono text-emerald-400 p-8 rounded-2xl bg-gray-900/50 border border-emerald-500/30"
            >
              {scene.formula}
            </motion.div>
            <motion.p
              variants={itemVariants}
              className="text-xl text-gray-400 mt-8"
            >
              {scene.note}
            </motion.p>
          </motion.div>
        );

      case 'growth':
        return (
          <motion.div
            key={scene.id}
            className="flex flex-col items-center justify-center h-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.h1
              variants={itemVariants}
              className="text-5xl md:text-7xl font-bold text-white text-center"
            >
              {scene.title}
            </motion.h1>
            <motion.div
              variants={itemVariants}
              className="my-12 flex items-center gap-8"
            >
              <motion.div
                className="text-6xl text-emerald-400"
                animate={{ x: [0, 20, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                &rarr;
              </motion.div>
            </motion.div>
            <motion.p
              variants={itemVariants}
              className="text-4xl md:text-6xl font-bold text-emerald-400"
            >
              {scene.subtitle}
            </motion.p>
            <motion.p variants={itemVariants} className="text-xl text-gray-500 mt-6">
              {scene.note}
            </motion.p>
          </motion.div>
        );

      case 'features':
        return (
          <motion.div
            key={scene.id}
            className="flex flex-col items-center justify-center h-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.h1
              variants={itemVariants}
              className="text-5xl md:text-7xl font-bold text-white mb-16"
            >
              {scene.title}
            </motion.h1>
            <div className="grid grid-cols-2 gap-8">
              {scene.features?.map((feature, i) => (
                <motion.div
                  key={feature}
                  variants={itemVariants}
                  className="p-6 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-emerald-950/30 border border-emerald-500/30 text-center"
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="text-2xl md:text-3xl font-bold text-emerald-400">
                    {feature}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        );

      case 'partners':
        return (
          <motion.div
            key={scene.id}
            className="flex flex-col items-center justify-center h-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.h1
              variants={itemVariants}
              className="text-4xl md:text-6xl font-bold text-gray-400 mb-16"
            >
              {scene.title}
            </motion.h1>
            <div className="flex items-center gap-12">
              {scene.partners?.map((partner) => (
                <motion.div
                  key={partner}
                  variants={itemVariants}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-4xl font-bold text-white">
                    {partner[0]}
                  </div>
                  <span className="text-xl text-white">{partner}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        );

      case 'cta':
        return (
          <motion.div
            key={scene.id}
            className="flex flex-col items-center justify-center h-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.h1
              variants={itemVariants}
              className="text-5xl md:text-7xl font-bold text-white text-center mb-12"
            >
              {scene.title}
            </motion.h1>
            <motion.div
              variants={itemVariants}
              className="px-12 py-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-2xl cursor-pointer"
              whileHover={{ scale: 1.05 }}
              animate={{
                boxShadow: ['0 0 30px rgba(16, 185, 129, 0.3)', '0 0 60px rgba(16, 185, 129, 0.6)', '0 0 30px rgba(16, 185, 129, 0.3)']
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {scene.cta}
            </motion.div>
            <motion.p
              variants={itemVariants}
              className="text-gray-500 mt-8"
            >
              grainvault.com
            </motion.p>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-full bg-black overflow-hidden cursor-none"
      onMouseMove={() => setShowControls(true)}
    >
      {/* Ambient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-emerald-950/10 to-black" />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      {/* Scene content */}
      <div className="relative z-10 h-full">
        <AnimatePresence mode="wait">
          {renderScene()}
        </AnimatePresence>
      </div>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 pointer-events-none"
          >
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between pointer-events-auto">
              <Link
                href="/grain-vault/demo/immersive"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <span>&larr;</span>
                <span>Back to Demo</span>
              </Link>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleShare}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  title="Share"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  title="Fullscreen"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isFullscreen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-auto">
              {/* Progress bar */}
              <div className="mb-4">
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-yellow-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {/* Scene markers */}
                <div className="flex justify-between mt-2">
                  {scenes.map((scene, i) => (
                    <button
                      key={scene.id}
                      onClick={() => setCurrentScene(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentScene
                          ? 'bg-emerald-500 scale-125'
                          : i < currentScene
                          ? 'bg-white/60'
                          : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Playback controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={goToPrevScene}
                  disabled={currentScene === 0}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-4 rounded-full bg-emerald-600 hover:bg-emerald-500 transition-colors"
                >
                  {isPlaying ? (
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={goToNextScene}
                  disabled={currentScene === scenes.length - 1}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Keyboard hints */}
              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
                <span>Space: Play/Pause</span>
                <span>Arrow Keys: Navigate</span>
                <span>F: Fullscreen</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scene indicator (always visible) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-1">
          {scenes.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === currentScene ? 'w-8 bg-emerald-500' : 'w-2 bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
