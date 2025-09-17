"use client";
import React, { useRef, useState, useEffect } from "react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  return isMobile;
}

const verticalAssets = [
  { name: "heelflip" },
  { name: "snap" },
  { name: "justplay" },
  { name: "skip" },
];
const landscapeAssets = [
  { name: "academy" },
  { name: "enjoy" },
  { name: "surfcamp" },
  { name: "dance" },
  { name: "run" },
  { name: "skate" },
  { name: "relax" },
  { name: "sunshine" },
];

const layout = [
  // [left, right, leftType, rightType]
  [landscapeAssets[0], verticalAssets[0], "landscape", "vertical"], // academy | heelflip
  [landscapeAssets[1], landscapeAssets[2], "landscape", "landscape"], // enjoy | surfcamp
  [verticalAssets[1], landscapeAssets[3], "vertical", "landscape"], // snap | dance
  [landscapeAssets[4], verticalAssets[2], "landscape", "vertical"], // run | justplay
  [landscapeAssets[5], landscapeAssets[6], "landscape", "landscape"], // skate | relax
  [landscapeAssets[7], verticalAssets[3], "landscape", "vertical"], // sunshine | skip
];

// Mobile layout: L, VV, L, L, VV, L, ...
const mobileLayout = [
  [landscapeAssets[0], null, "landscape", null], // academy
  [verticalAssets[0], verticalAssets[1], "vertical", "vertical"], // heelflip, snap
  [landscapeAssets[1], null, "landscape", null], // enjoy
  [landscapeAssets[2], null, "landscape", null], // surfcamp
  [verticalAssets[2], verticalAssets[3], "vertical", "vertical"], // justplay, skip
  [landscapeAssets[4], null, "landscape", null], // run
  [landscapeAssets[3], null, "landscape", null], // dance
  [landscapeAssets[5], null, "landscape", null], // skate
  [landscapeAssets[6], null, "landscape", null], // relax
  [landscapeAssets[7], null, "landscape", null], // sunshine
];

const isTouchDevice = () => {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  );
};

export default function HeroVideoGallery() {
  const isMobile = useIsMobile();
  const rows = isMobile ? mobileLayout : layout;
  return (
    <div className="w-full max-w-5xl mx-auto p-6 flex flex-col gap-6">
      {rows.map(([left, right, leftType, rightType], idx) => {
        if (isMobile) {
          // Mobile: single landscape or pair of verticals per row
          if (leftType === "landscape" && !right) {
            return (
              <div key={idx} className="w-full flex justify-center">
                <VideoThumbCard asset={left as { name: string }} type={leftType} className="w-full" />
              </div>
            );
          }
          if (leftType === "vertical" && rightType === "vertical") {
            return (
              <div key={idx} className="w-full grid grid-cols-2 gap-6">
                <VideoThumbCard asset={left as { name: string }} type={leftType} className="w-full" />
                <VideoThumbCard asset={right as { name: string }} type={rightType} className="w-full" />
              </div>
            );
          }
          return null;
        }
        // Desktop: original layout
        if (
          (leftType === "landscape" && rightType === "vertical") ||
          (leftType === "vertical" && rightType === "landscape")
        ) {
          return (
            <div key={idx} className="w-full grid grid-cols-1 md:grid-cols-4 gap-6 md:h-[380px]">
              {leftType === "landscape" ? (
                <VideoThumbCard asset={left as { name: string }} type={leftType} className="md:col-span-3 w-full h-full" />
              ) : (
                <VideoThumbCard asset={left as { name: string }} type={leftType} className="md:col-span-1 w-full h-full" />
              )}
              {rightType === "vertical" ? (
                <VideoThumbCard asset={right as { name: string }} type={rightType} className="md:col-span-1 w-full h-full" />
              ) : (
                <VideoThumbCard asset={right as { name: string }} type={rightType} className="md:col-span-3 w-full h-full" />
              )}
            </div>
          );
        }
        if (leftType === "landscape" && rightType === "landscape") {
          return (
            <div key={idx} className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:h-[380px]">
              <VideoThumbCard asset={left as { name: string }} type={leftType} className="w-full h-full" />
              <VideoThumbCard asset={right as { name: string }} type={rightType} className="w-full h-full" />
            </div>
          );
        }
        if (leftType === "landscape" && !right) {
          return (
            <div key={idx} className="w-full flex justify-center md:h-[380px]">
              <VideoThumbCard asset={left as { name: string }} type={leftType} className="w-full h-full" />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function VideoThumbCard({ asset, type, className }: { asset: { name: string } | null, type: "vertical" | "landscape" | null, className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [playing, setPlaying] = useState(false);
  const [touchTimeout, setTouchTimeout] = useState<NodeJS.Timeout | null>(null);

  if (!asset) return null;

  // Responsive aspect ratio: portrait for vertical, landscape for landscape, only on mobile
  const aspect = type === "vertical"
    ? "aspect-[9/16] md:h-full md:aspect-auto"
    : "aspect-[16/9] md:h-full md:aspect-auto";

  // Intersection Observer for mobile auto-play
  useEffect(() => {
    if (!isTouchDevice()) return;
    const img = imgRef.current;
    if (!img) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlaying(true);
          videoRef.current?.play();
        } else {
          setPlaying(false);
          videoRef.current?.pause();
          if (videoRef.current) videoRef.current.currentTime = 0;
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(img);
    return () => observer.disconnect();
  }, []);

  const handleMouseEnter = () => {
    if (!isTouchDevice()) {
      setPlaying(true);
      videoRef.current?.play();
    }
  };
  const handleMouseLeave = () => {
    if (!isTouchDevice()) {
      setPlaying(false);
      videoRef.current?.pause();
      videoRef.current && (videoRef.current.currentTime = 0);
    }
  };
  const handleTouchStart = () => {
    if (isTouchDevice()) {
      const timeout = setTimeout(() => {
        setPlaying(true);
        videoRef.current?.play();
      }, 350);
      setTouchTimeout(timeout);
    }
  };
  const handleTouchEnd = () => {
    if (isTouchDevice()) {
      if (touchTimeout) clearTimeout(touchTimeout);
      setPlaying(false);
      videoRef.current?.pause();
      videoRef.current && (videoRef.current.currentTime = 0);
    }
  };

  return (
    <div
      className={`relative rounded-xl overflow-hidden shadow-lg bg-neutral-900 group cursor-pointer ${aspect} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <img
        ref={imgRef}
        src={`/${asset.name}-thumb.webp`}
        alt={asset.name}
        className={`object-cover h-full w-full absolute inset-0 transition-opacity duration-200 ${playing ? "opacity-0" : "opacity-100"}`}
        loading="lazy"
        draggable={false}
        onContextMenu={e => e.preventDefault()}
      />
      <video
        ref={videoRef}
        src={`/${asset.name}-480.mp4`}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${playing ? "opacity-100" : "opacity-0"}`}
        loop
        muted
        playsInline
        preload="none"
        tabIndex={-1}
        style={{ pointerEvents: "none" }}
      />
    </div>
  );
}
