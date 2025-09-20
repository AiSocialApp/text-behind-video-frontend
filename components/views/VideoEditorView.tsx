import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PlusIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion } from '@/components/ui/accordion';
import TextCustomizer from '@/components/editor/text-customizer';
import AdsPlaceholder from '@/components/ads-placeholder';
import { useAuth } from '@/hooks/useAuth';
import { AppApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { removeBackground } from '@imgly/background-removal';

const MIN_PART_SIZE_MB = 8;

// Debug logging helper
const DEBUG_LOGGING_ENABLED = false;
const debugLog = (...args: any[]) => {
  if (DEBUG_LOGGING_ENABLED) {
    // eslint-disable-next-line no-console
    console.log('[TBV]', ...args);
  }
};

interface VideoEditorViewProps {
  selectedVideo: File | null;
  setSelectedVideo: React.Dispatch<React.SetStateAction<File | null>>;
  posterUrl: string | null;
  setPosterUrl: React.Dispatch<React.SetStateAction<string | null>>;
  videoDurationSec: number;
  setVideoDurationSec: React.Dispatch<React.SetStateAction<number>>;
  removedFgUrl: string | null;
  setRemovedFgUrl: React.Dispatch<React.SetStateAction<string | null>>;
  naturalSize: { width: number; height: number };
  setNaturalSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
  displayedSize: { width: number; height: number };
  setDisplayedSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
  isReady: boolean;
  setIsReady: React.Dispatch<React.SetStateAction<boolean>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  isUploading: boolean;
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
  textSets: any[];
  setTextSets: React.Dispatch<React.SetStateAction<any[]>>;
  openPayDialog: () => void;
  modelWarningVisible: boolean;
  dismissModelWarning: () => void;
}

const VideoEditorView: React.FC<VideoEditorViewProps> = ({
  selectedVideo,
  setSelectedVideo,
  posterUrl,
  setPosterUrl,
  videoDurationSec,
  setVideoDurationSec,
  removedFgUrl,
  setRemovedFgUrl,
  naturalSize,
  setNaturalSize,
  displayedSize,
  setDisplayedSize,
  isReady,
  setIsReady,
  isGenerating,
  setIsGenerating,
  isUploading,
  setIsUploading,
  textSets,
  setTextSets,
  openPayDialog,
  modelWarningVisible,
  dismissModelWarning,
}) => {
  const { tokens, profile, updateRemaining } = useAuth();

  // Add local state for resolution
  const [selectedResolution, setSelectedResolution] = useState<number>(720);

  const outerRef = useRef<HTMLDivElement>(null);
  const initialUsableWidthRef = useRef<number | null>(null);
  const initialMaxPreviewHeightRef = useRef<number | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const removedFgImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentFileRef = useRef<File | null>(null);

  const remainingVideos = useMemo(() => profile?.remaining?.video ?? null, [profile]);
  const isPaid = useMemo(() => (profile ? profile.entitlement !== 'free' : false), [profile]);
  const isPro = useMemo(() => profile?.entitlement === 'pro', [profile]);
  const userId = profile?.username ?? '';

  // Preview readiness flags
  const [isPosterReady, setIsPosterReady] = useState<boolean>(false);
  const [isFgReady, setIsFgReady] = useState<boolean>(true);
  const isPreviewReady = isPosterReady && isFgReady;

  const canGenerate = useMemo(() => {
    const hasUnlimited = remainingVideos === null;
    const hasRemaining = (remainingVideos ?? 0) > 0;
    // Also ensure remaining is sufficient for the full video length when limited
    const hasEnoughSeconds = hasUnlimited || ((remainingVideos ?? 0) >= Math.max(0, Math.round(videoDurationSec)));
    return Boolean(tokens.accessToken && selectedVideo && isReady && (hasUnlimited || hasRemaining) && hasEnoughSeconds && !isGenerating);
  }, [tokens.accessToken, selectedVideo, isReady, remainingVideos, isGenerating, videoDurationSec]);

  const [canSelect1080, canSelect1440, canSelect2160] = useMemo(() => {

    const minDim = Math.min(naturalSize.width, naturalSize.height);
    if (!selectedVideo || selectedVideo && minDim === 0 ) {
      return [true, true, true]
    }
    const canSelect1080 = minDim >= 1080;
    const canSelect1440 = minDim >= 1440;
    const canSelect2160 = minDim >= 2160;
    if (!canSelect1080) {
      setSelectedResolution(720);
    } else if (!canSelect1440 && selectedResolution > 1080) {
      setSelectedResolution(1080);
    } else if (!canSelect2160 && selectedResolution > 1440) {
      setSelectedResolution(1440);
    }
    return [canSelect1080, canSelect1440, canSelect2160];
  }, [naturalSize, selectedResolution, selectedVideo]);

  useEffect(() => {
    if (!isPro && selectedResolution > 720) {
      setSelectedResolution(720);
    }
  }, [isPro, selectedResolution]);


  const resolutionLimitMsg = useMemo(() => {
    const minDim = Math.min(naturalSize.width, naturalSize.height);
    if (minDim === 0) return null;
    if (minDim < 1080) {
      return `Input video quality limits output to 720p.`;
    } else if (minDim < 1440) {
      return `Input video quality limits output to max 1080p.`;
    } else if (minDim < 2160) {
      return `Input video quality limits output to max 1440p.`;
    }
    return null;
  }, [naturalSize]);

  const addNewTextSet = () => {
    const newId = Math.max(0, ...textSets.map((s: any) => s.id)) + 1;
    setTextSets(prev => [
      ...prev,
      { id: newId, text: 'edit', fontFamily: 'Inter', top: 0, left: 0, color: 'white', fontSize: 300, fontWeight: 800, opacity: 1, shadowColor: 'rgba(0, 0, 0, 0.8)', shadowSize: 4, rotation: 0, tiltX: 0, tiltY: 0, letterSpacing: 0, boxWidth: 80, lineHeight: 1.2 },
    ]);
  };

  const handleAttributeChange = (id: number, attribute: string, value: any) => {
    setTextSets((prev: any[]) => prev.map(set => (set.id === id ? { ...set, [attribute]: value } : set)));
  };

  const duplicateTextSet = (textSet: any) => {
    const newId = Math.max(0, ...textSets.map((s: any) => s.id)) + 1;
    setTextSets(prev => [...prev, { ...textSet, id: newId }]);
  };

  const removeTextSet = (id: number) => {
    setTextSets(prev => prev.filter(set => set.id !== id));
  };

  const updatePreviewScale = () => {
    if (!outerRef.current || naturalSize.width === 0 || naturalSize.height === 0) return;

    // Initialize baseline constraints once (at normal zoom)
    if (initialUsableWidthRef.current === null || initialMaxPreviewHeightRef.current === null) {
      const vv = (window as any).visualViewport as VisualViewport | undefined;
      const baseHeight = Math.max(1, Math.floor(((vv?.height ?? window.innerHeight) || 0) - 220));
      const baseWidth = Math.max(0, Math.floor((outerRef.current.clientWidth || 0) - 16));
      initialUsableWidthRef.current = baseWidth;
      initialMaxPreviewHeightRef.current = baseHeight;
    }

    const usableWidth = initialUsableWidthRef.current as number;
    const maxPreviewHeight = initialMaxPreviewHeightRef.current as number;
    const scale = Math.min(usableWidth / naturalSize.width, maxPreviewHeight / naturalSize.height);
    const targetWidth = Math.max(1, Math.floor(naturalSize.width * scale));
    const targetHeight = Math.max(1, Math.floor(naturalSize.height * scale));
    debugLog('updatePreviewScale', { usableWidth, maxPreviewHeight, scale, targetWidth, targetHeight, naturalSize });
    setDisplayedSize({ width: targetWidth, height: targetHeight });
  };

  useEffect(() => {
    const onResize = () => {
      const vv = (window as any).visualViewport as VisualViewport | undefined;
      const scale = vv?.scale ?? 1;
      // Ignore pinch-zoom resizes; keep preview size stable
      if (Math.abs(scale - 1) > 0.01) return;
      updatePreviewScale();
    };
    const onOrientationChange = () => {
      // Recompute baselines on true orientation changes
      initialUsableWidthRef.current = null;
      initialMaxPreviewHeightRef.current = null;
      requestAnimationFrame(() => updatePreviewScale());
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onOrientationChange);
    // Defer initial scale until container is laid out
    requestAnimationFrame(() => updatePreviewScale());
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientationChange);
    };
  }, [naturalSize.width, naturalSize.height]);


  // Reset poster readiness only when poster changes
  useEffect(() => {
    if (posterUrl) setIsPosterReady(false);
  }, [posterUrl]);

  // Draw background layer (poster)
  useEffect(() => {
    if (!posterUrl) return;
    if (!bgCanvasRef.current) return;
    if (!displayedSize.width || !displayedSize.height) {
      debugLog('BG draw skipped (displayedSize not ready)', displayedSize);
      return;
    }
    (async () => {
      try {
        debugLog('BG draw start', { posterUrl, displayedSize });
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const tempImg = new (window as any).Image();
          tempImg.crossOrigin = 'anonymous';
          tempImg.onload = () => {
            if (tempImg.decode) {
              tempImg.decode().then(() => resolve(tempImg)).catch(reject);
            } else {
              resolve(tempImg);
            }
          };
          tempImg.onerror = reject;
          tempImg.src = posterUrl;
        });
        if (!bgCanvasRef.current) return;
        const canvas = bgCanvasRef.current;
        canvas.width = displayedSize.width || 1;
        canvas.height = displayedSize.height || 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        debugLog('BG draw complete', { canvasWidth: canvas.width, canvasHeight: canvas.height });
        setIsPosterReady(true);
      } catch (err) {
        console.warn('[TBV] Failed to load or decode background image', err);
        // Avoid indefinite loading state on background errors
        setIsPosterReady(true);
      }
    })();
  }, [posterUrl, displayedSize.width, displayedSize.height]);

  // Draw text layer
  useEffect(() => {
    if (!textCanvasRef.current) return;
    if (!displayedSize.width || !displayedSize.height) {
      debugLog('TEXT draw skipped (displayedSize not ready)', displayedSize);
      return;
    }
    const canvas = textCanvasRef.current;
    canvas.width = displayedSize.width || 1;
    canvas.height = displayedSize.height || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleForFont = naturalSize.width > 0 ? canvas.width / naturalSize.width : 1;
    (async () => {
      debugLog('TEXT draw start', { textSetCount: textSets.length, canvasWidth: canvas.width, canvasHeight: canvas.height, scaleForFont });
      await drawTextSets(ctx, canvas.width, canvas.height, scaleForFont);
      debugLog('TEXT draw complete');
    })();
  }, [JSON.stringify(textSets), displayedSize.width, displayedSize.height, naturalSize.width]);

  // Load removed foreground image element when URL ready
  // Draw foreground layer
  useEffect(() => {
    if (!fgCanvasRef.current) return;
    if (!displayedSize.width || !displayedSize.height) {
      debugLog('FG draw skipped (displayedSize not ready)', displayedSize);
      return;
    }
    const canvas = fgCanvasRef.current;
    canvas.width = displayedSize.width || 1;
    canvas.height = displayedSize.height || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!removedFgUrl) {
      removedFgImageRef.current = null;
      debugLog('FG cleared (no removedFgUrl)');
      // No FG to load; treat as ready so preview is not blocked
      setIsFgReady(true);
      return;
    }
    debugLog('FG draw start', { removedFgUrl, canvasWidth: canvas.width, canvasHeight: canvas.height });
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    setIsFgReady(false);
    const timeoutId = window.setTimeout(() => {
      debugLog('FG draw timeout; proceeding without FG');
      setIsFgReady(true);
    }, 5000);
    img.onload = () => {
      clearTimeout(timeoutId);
      removedFgImageRef.current = img;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      debugLog('FG draw complete');
      setIsFgReady(true);
    };
    img.onerror = (e: any) => {
      clearTimeout(timeoutId);
      debugLog('FG draw error', e);
      setIsFgReady(true);
    };
    img.src = removedFgUrl;
    return () => {
      clearTimeout(timeoutId);
    };
  }, [removedFgUrl, displayedSize.width, displayedSize.height]);

  const drawTextSets = async (
    ctx: CanvasRenderingContext2D,
    targetWidth: number,
    targetHeight: number,
    scaleForFont: number
  ) => {
    debugLog('drawTextSets start', { count: textSets.length, targetWidth, targetHeight, scaleForFont });
    await Promise.all(
      textSets.map((textSet) => {
        const fontSizePx = textSet.fontSize * scaleForFont;
        const fontStr = `${textSet.fontWeight} ${fontSizePx}px ${textSet.fontFamily}`;
        return document.fonts.load(fontStr);
      })
    );
    debugLog('Fonts loaded for text sets');
    textSets.forEach((textSet: any, index: number) => {
      debugLog('drawTextSet', { index, id: textSet.id, text: textSet.text });
      ctx.save();
      const fontSizePx = textSet.fontSize * scaleForFont;
      ctx.font = `${textSet.fontWeight} ${fontSizePx}px ${textSet.fontFamily}`;
      ctx.fillStyle = textSet.color;
      ctx.globalAlpha = textSet.opacity;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const x = targetWidth * (textSet.left + 50) / 100;
      const y = targetHeight * (50 - textSet.top) / 100;
      ctx.translate(x, y);

      const tiltXRad = (-textSet.tiltX * Math.PI) / 180;
      const tiltYRad = (-textSet.tiltY * Math.PI) / 180;
      ctx.transform(
        Math.cos(tiltYRad),
        Math.sin(0),
        -Math.sin(0),
        Math.cos(tiltXRad),
        0,
        0
      );
      ctx.rotate((textSet.rotation * Math.PI) / 180);

      const letterSpacingPx = (textSet.letterSpacing || 0) * scaleForFont;
      const maxLineWidthPx = targetWidth * ((textSet.boxWidth ?? 80) / 100);
      const lineHeightPx = fontSizePx * (textSet.lineHeight ?? 1.2);

      const computeLineWidth = (lineText: string) => {
        const metricsWidth = ctx.measureText(lineText).width;
        const extra = Math.max(0, (lineText.length - 1)) * letterSpacingPx;
        return metricsWidth + extra;
      };

      const wrapText = (fullText: string) => {
        const paragraphs: string[] = fullText.split('\n');
        const lines: string[] = [];
        paragraphs.forEach((para) => {
          const words: string[] = para.split(' ');
          let current = '';
          for (let i = 0; i < words.length; i++) {
            const test = current ? current + ' ' + words[i] : words[i];
            if (computeLineWidth(test) <= maxLineWidthPx) {
              current = test;
            } else {
              if (current) lines.push(current);
              if (computeLineWidth(words[i]) > maxLineWidthPx) {
                let chunk = '';
                for (const ch of words[i]) {
                  const testChunk = chunk + ch;
                  if (computeLineWidth(testChunk) <= maxLineWidthPx) {
                    chunk = testChunk;
                  } else {
                    if (chunk) lines.push(chunk);
                    chunk = ch as string;
                  }
                }
                current = chunk;
              } else {
                current = words[i];
              }
            }
          }
          if (current) lines.push(current);
        });
        return lines;
      };

      const lines = wrapText(textSet.text);
      const totalHeight = lines.length * lineHeightPx;
      debugLog('text layout', { id: textSet.id, lines: lines.length, totalHeight });
      lines.forEach((line: string, idx: number) => {
        const lineY = -((totalHeight - lineHeightPx) / 2) + idx * lineHeightPx;
        if (letterSpacingPx === 0) {
          ctx.fillText(line, 0, lineY);
        } else {
          const chars: string[] = line.split('');
          const totalWidth = chars.reduce((width, char, i) => {
            const charWidth = ctx.measureText(char).width;
            return width + charWidth + (i < chars.length - 1 ? letterSpacingPx : 0);
          }, 0);
          let currentX = -totalWidth / 2;
          chars.forEach((char: string) => {
            const charWidth = ctx.measureText(char).width;
            ctx.fillText(char, currentX + charWidth / 2, lineY);
            currentX += charWidth + letterSpacingPx;
          });
        }
      });
      ctx.restore();
    });
    debugLog('drawTextSets complete');
  };

  const drawOverlayCanvas = async () => {
    if (!overlayCanvasRef.current) return null;
    debugLog('drawOverlayCanvas start');
    const canvas = overlayCanvasRef.current;
    const width = naturalSize.width || 0;
    const height = naturalSize.height || 0;
    if (width === 0 || height === 0) return null;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, width, height);
    const scaleForFont = 1;

    // Wait for text drawing to complete
    await drawTextSets(ctx, width, height, scaleForFont);

    debugLog('drawOverlayCanvas complete');
    return canvas;
  };

  const pickVideo = () => {
    const hasUnlimited = remainingVideos === null;
    const hasRemaining = (remainingVideos ?? 0) > 0;
    if (!(hasUnlimited || hasRemaining)) {
      toast({ title: 'Limit reached', description: 'You have reached your video generation limit.' });
      return;
    }
    debugLog('pickVideo clicked', { hasUnlimited, hasRemaining, remainingVideos });
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    debugLog('onFileChange', { name: file.name, size: file.size, type: file.type });

    // Clear old removed foreground references
    removedFgImageRef.current = null;
    setRemovedFgUrl(null);
    setTextSets([]);
    setIsReady(false);
    setIsPosterReady(false);
    setIsFgReady(false);

    // Use a local reference to detect if the file changed mid-processing
    const localFile = file;
    setSelectedVideo(localFile);
    currentFileRef.current = localFile;

    try {
      debugLog('extractPosterAndDuration start');
      const { poster, width, height, duration } = await extractPosterAndDuration(localFile);
      debugLog('extractPosterAndDuration result', { width, height, duration });
      setPosterUrl(poster);
      setNaturalSize({ width, height });
      setVideoDurationSec(Math.max(0, Math.round(duration)));
      setIsReady(true);
      updatePreviewScale();

      // Attempt background removal
      try {
        debugLog('removeBackground start');
        const fgBlob = await removeBackground(poster);
        // Check if user changed the file since we started removal
        if (currentFileRef.current !== localFile) {
          debugLog('removeBackground aborted (file changed via ref)');
          return;
        }
        const url = URL.createObjectURL(fgBlob);
        setRemovedFgUrl(url);

        // Reinitialize the removedFgImageRef to the new image
        const newImage = new Image();
        newImage.src = url;
        removedFgImageRef.current = newImage;
        debugLog('removeBackground complete', { url });
      } catch (e) {
        console.warn('[TBV] Background removal failed', e);
        setRemovedFgUrl(null);
        removedFgImageRef.current = null;
        // Proceed with preview without FG
        setIsFgReady(true);
      }
    } catch (err) {
      console.error('[TBV] extractPosterAndDuration error', err);
      toast({ title: 'Failed to load video', description: 'Could not extract preview from video.' });
    }
  };

  const extractPosterAndDuration = (file: File): Promise<{ poster: string; width: number; height: number; duration: number }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = URL.createObjectURL(file);
      const cleanup = () => URL.revokeObjectURL(video.src);
      video.onloadedmetadata = () => {
        debugLog('video metadata loaded', { videoWidth: video.videoWidth, videoHeight: video.videoHeight, duration: video.duration });
        const width = video.videoWidth;
        const height = video.videoHeight;
        const duration = video.duration || 0;
        const targetTime = Math.min(0.1, Math.max(0, duration - 0.1));
        const capture = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('No 2D context');
            ctx.drawImage(video, 0, 0, width, height);
            const poster = canvas.toDataURL('image/png');
            cleanup();
            debugLog('poster captured');
            // Mark poster as ready as soon as we have the data URL
            setIsPosterReady(true);
            resolve({ poster, width, height, duration });
          } catch (e) {
            cleanup();
            debugLog('poster capture error', e);
            reject(e);
          }
        };
        video.currentTime = targetTime;
        video.onseeked = capture;
        setTimeout(capture, 500);
      };
      video.onerror = () => {
        cleanup();
        const err = new Error('Failed to load video metadata');
        debugLog('video metadata error', err);
        reject(err);
      };
    });
  };

  const uploadOverlay = async (putUrl: string, canvas: HTMLCanvasElement) => {
    debugLog('uploadOverlay start', { putUrl: Boolean(putUrl), canvasWidth: canvas.width, canvasHeight: canvas.height });
    const blob: Blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b as Blob), 'image/png'));
    const resp = await fetch(putUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob });
    if (!resp.ok) throw new Error(`Overlay upload failed: ${resp.status}`);
    debugLog('uploadOverlay complete');
  };

  const signPart = async (assetId: string, uploadId: string, key: string, partNumber: number): Promise<string> => {
    debugLog('signPart', { assetId, uploadId, key, partNumber });
    const safeTokens = {
      accessToken: tokens.accessToken || '',
      refreshToken: tokens.refreshToken || '',
      expires: tokens.expires,
      idToken: tokens.idToken || ''
    };
    const res = await AppApi.signMultipartPart(safeTokens, { asset_id: assetId, s3_upload_id: uploadId, part_number: partNumber, key });
    return (res as any).url;
  };

  const uploadVideoMultipart = async (file: File, assetId: string, key: string, uploadId: string, partSizeMb: number = MIN_PART_SIZE_MB) => {
    const partSize = Math.max(5, partSizeMb) * 1024 * 1024;
    const totalParts = Math.ceil(file.size / partSize);
    debugLog('uploadVideoMultipart start', { fileSize: file.size, partSize, totalParts });
    const parts: Array<{ ETag: string; PartNumber: number }> = [];
    for (let idx = 1; idx <= totalParts; idx++) {
      const start = (idx - 1) * partSize;
      const end = Math.min(file.size, idx * partSize);
      const chunk = file.slice(start, end);
      const url = await signPart(assetId, uploadId, key, idx);
      const putResp = await fetch(url, { method: 'PUT', body: chunk });
      if (!putResp.ok) throw new Error(`Upload part ${idx} failed: ${putResp.status}`);
      const etag = putResp.headers.get('ETag') || putResp.headers.get('etag');
      if (!etag) throw new Error('Missing ETag in upload_part response');
      parts.push({ ETag: etag, PartNumber: idx });
      debugLog('upload part complete', { idx, etag });
    }
    const safeTokens = {
      accessToken: tokens.accessToken || '',
      refreshToken: tokens.refreshToken || '',
      expires: tokens.expires,
      idToken: tokens.idToken || ''
    };
    await AppApi.completeMultipart(safeTokens, { asset_id: assetId, s3_upload_id: uploadId, key, parts });
    debugLog('completeMultipart called', { partsCount: parts.length });
  };

  const pollAsset = async (assetId: string, { intervalMs = 5000, timeoutMs = 30 * 60 * 1000 } = {}) => {
    const start = Date.now();
    while (true) {
      const safeTokens = {
        accessToken: tokens.accessToken || '',
        refreshToken: tokens.refreshToken || '',
        expires: tokens.expires,
        idToken: tokens.idToken || ''
      };
      const res = await AppApi.getAsset(safeTokens, assetId);
      const asset = (res as any).asset || res;
      const status: string | undefined = asset?.status;
      debugLog('pollAsset status', { status });
      if (status === 'COMPLETE' || status === 'FAILED') return asset;
      if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for asset completion');
      await new Promise(r => setTimeout(r, intervalMs));
    }
  };

  const onGenerate = async () => {
    if (!tokens.accessToken || !selectedVideo) return;
    const hasUnlimited = remainingVideos === null;
    const remaining = remainingVideos ?? 0;
    const needed = Math.max(0, Math.round(videoDurationSec));
    if (!hasUnlimited && remaining <= 0) {
      toast({ title: 'Limit reached', description: 'You have no video seconds remaining.' });
      return;
    }
    if (!hasUnlimited && needed > remaining) {
      toast({ title: 'Insufficient remaining seconds', description: `${needed} seconds in selected video, but only ${remaining} seconds left.` });
      return;
    }

    setIsGenerating(true);
    const t = toast({ title: 'Starting...', description: 'Preparing upload session.' });
    try {
      const safeTokens = {
        accessToken: tokens.accessToken || '',
        refreshToken: tokens.refreshToken || '',
        expires: tokens.expires,
        idToken: tokens.idToken || ''
      };
      const ext = (selectedVideo.name.split('.')?.pop() || 'mp4');
      debugLog('startAsset call', { ext, videoDurationSec, selectedResolution });
      const start = await AppApi.startAsset(safeTokens, {
        extension: ext,
        length: videoDurationSec,
        resolution: selectedResolution,
      });
      debugLog('startAsset response', start);
      if ((start as any).remaining) {
        updateRemaining((start as any).remaining);
      }
      t.dismiss();
      setIsGenerating(false);

      const overlayCanvas = await drawOverlayCanvas();
      if (!overlayCanvas) {
        debugLog('overlayCanvas not ready');
        throw new Error('Overlay canvas is not ready');
      }
      toast({ title: 'Uploading overlay', description: 'Uploading text overlay...' });
      setIsUploading(true);
      await uploadOverlay((start as any).overlay.put_url, overlayCanvas);

      toast({ title: 'Uploading video', description: 'Uploading original video...' });
      await uploadVideoMultipart(selectedVideo, (start as any).asset_id, (start as any).video.key, (start as any).video.s3_upload_id, MIN_PART_SIZE_MB);
      setIsUploading(false);

      toast({ title: 'Processing', description: 'Compositing your video. This can take up to 15 minutes. Your video will be in your library when complete.' });
      const finalAsset = await pollAsset((start as any).asset_id);

      if (finalAsset?.status === 'COMPLETE') {
        toast({ title: 'Done', description: 'Your video is ready in your library.' });
      } else if (finalAsset?.status === 'FAILED') {
        toast({ title: 'Failed', description: 'Video processing failed.' });
      }
    } catch (err: any) {
      console.error('[TBV] onGenerate error', err);
      toast({ title: 'Error', description: err?.message || 'Generation failed.' });
      setIsGenerating(false);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={onFileChange} accept="video/*,.mp4,.mov,.webm" />
      <div className='flex flex-col md:flex-row items-start justify-start gap-10 w-full md:h-[calc(100vh-10rem)] px-2 md:px-10 mt-2'>
        <div className="flex flex-col items-start justify-start w-full md:w-1/2 gap-2">
          <canvas ref={overlayCanvasRef} style={{ display: 'none' }} />
          {modelWarningVisible && (
            <div className="w-full rounded-md bg-yellow-100 text-yellow-900 border border-yellow-300 p-2 text-xs flex items-start justify-between">
              <span className="my-auto">Our video model is tuned to select people. Accuracy with other subjects may be degraded.</span>
              <button onClick={dismissModelWarning} className="pl-1 text-yellow-900 hover:opacity-80 text-sm">✕</button>
            </div>
          )}
          <div className='flex items-center gap-2 w-full'>
            <Button onClick={pickVideo} variant='secondary'>Upload video</Button>
            <Button onClick={onGenerate}>{isGenerating ? 'Generating…' : 'Generate'}</Button>
            <Button
              asChild
              className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 h-auto py-1 self-end ml-auto"
            >
              <a
                href="https://www.pexels.com/videos/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-0.5"
              >
                <span className='text-xs'>Free videos</span>
                <svg viewBox="0 0 512 227" className='h-4 w-auto fill-white dark:fill-black'><g><path d="M511.187 131.02C509.164 120.486 506.384 114.524 503.211 107.417C501.187 102.884 499.317 98.6027 498.694 95.7914C497.152 88.8342 497.908 80.1165 498.265 76.9559H479.596L476.451 81.9607C469.281 93.3721 453.608 118.338 453.607 118.339C444.924 131.386 434.121 147.618 418.553 153.758C415.613 154.751 409.393 156.767 404.469 151.122C399.777 145.744 400.185 139.937 400.204 139.692L400.223 139.433L400.235 139.275L400.351 139.165L400.543 138.982C421.115 119.456 440.747 98.0267 450.557 84.3877C461.856 68.6797 467.522 55.7517 471.946 44.8671C474.701 38.0835 480.429 21.0609 474.129 9.53638C471.495 4.71716 467.034 1.44608 461.567 0.325525C460.497 0.106481 459.471 0 458.432 0C446.837 0 433.098 14.565 416.43 44.5274C402.557 69.4604 392.695 90.8751 387.12 108.177C384.235 117.129 382.339 128.47 382.339 128.471C381.714 129.595 370.375 142.671 359.178 150.087C355.43 152.569 349.908 155.638 342.002 155.638C334.841 155.638 328.199 151.258 328.197 151.257C328.2 151.256 339.703 145.052 358.243 126.848C368.262 117.009 372.497 103.566 369.295 91.7638C364.27 73.2637 346.588 71.826 341.288 71.826C326.515 71.8713 314.504 81.4527 308.708 89.6434C294.733 109.381 295.344 125.544 297.439 137.419C298.118 141.257 299.355 145.038 301.115 148.654L301.29 149.012C301.288 149.013 279.271 164.432 266.053 146.596C260.98 139.75 253.158 125.537 253.157 125.534L299.238 76.9613H274.472C258.72 93.2817 243.999 108.701 243.996 108.704C243.995 108.701 233.145 87.9123 227.999 76.9559H207.991C209.743 80.4129 211.508 83.9821 213.435 87.8768C219.788 100.719 230.978 122.349 230.979 122.351C230.978 122.353 226.203 127.339 226.202 127.341C223.675 129.967 215.982 137.958 203.609 145.553C196.697 149.788 189.441 152.685 181.427 154.409C175.157 155.759 167.083 155.908 162.222 154.604C159.442 153.858 154.206 151.303 154.206 151.303C154.208 151.301 168.684 142.237 184.317 126.858C194.327 117.011 198.563 103.568 195.371 91.7732C190.344 73.2768 172.662 71.8395 167.362 71.8395C152.593 71.8845 140.578 81.4614 134.777 89.6491C120.804 109.375 121.416 125.547 123.511 137.432C124.127 140.925 126.491 147.497 126.491 147.497C115.785 153.142 105.638 156.512 93.2508 156.956C92.1763 156.995 87.5926 157.012 86.1204 156.934C85.7569 156.915 84.623 156.763 84.623 156.763C84.6237 156.763 87.2107 155.105 87.8157 154.692C103.092 144.267 109.834 125.528 110.298 108.996C110.682 95.3566 107.46 84.338 101.226 77.974C97.3124 73.9742 92.1345 71.9054 85.8352 71.826H85.5688C74.4682 71.826 61.8243 78.4821 53.018 86.7525C50.955 88.6901 45.1151 95.26 45.1149 95.2603L48.7384 76.9532H29.566L0 226.271H19.1834L36.48 138.885C40.2234 122.447 45.9629 112.029 56.9644 101.665L57.1455 101.51C59.8693 99.1994 62.9849 97.0036 65.918 95.328C70.7655 92.5572 75.1511 91.152 78.9529 91.152C81.208 91.152 83.2428 91.6543 85.0023 92.6447C91.2279 96.1683 91.9858 104.727 92.3933 109.326C93.9896 127.445 80.0006 139.727 78.4002 141.068C73.7991 144.917 68.9992 146.788 63.7256 146.788C56.6649 146.788 51.3729 144.284 48.4039 142.896C48.2907 143.445 47.5469 147.095 47.5469 147.095C46.8113 150.765 45.389 158.138 45.3888 158.139C53.0786 164.721 68.412 172.104 88.6396 173.266C90.28 173.362 91.9431 173.41 93.5821 173.41C108.447 173.41 123.012 169.522 136.873 161.854L137.135 161.71L137.36 161.904C142.623 166.436 147.692 168.647 149.358 169.373C159.042 173.596 169.583 173.335 170.617 173.335C183.411 173.335 195.361 169.647 198.718 168.517C219.995 161.354 232.065 147.959 236.609 142.977L240.074 139.324L242.274 143.381C245.181 148.764 248.476 154.865 254.285 161.506C256.697 164.264 265.809 173.26 281.817 173.26C297.013 173.26 312.644 162.989 312.645 162.988C312.648 162.991 317.775 167.024 323.309 169.632C330.243 172.899 338.323 173.252 341.475 173.252C357.227 173.252 370.233 167.39 383.645 154.243L384.105 153.792C384.106 153.794 386.055 158.429 387.734 160.845C396.363 173.254 407.477 173.294 411.374 173.294C414.976 173.294 421.025 172.67 425.577 170.911C445.916 163.047 461.71 141.167 469.314 128.825C469.315 128.823 475.112 119.634 481.964 105.539L483.494 102.455C483.495 102.456 487.147 111.122 487.148 111.125C489.25 116.226 491.21 121.908 492.143 125.6C494.718 135.576 496.443 144.345 491.431 150.591C488.987 153.607 483.95 156.851 478.666 156.851C475.899 156.851 473.29 155.986 470.912 154.279C470.011 153.616 469.077 152.78 468.125 151.79C464.24 156.638 460.211 161.063 456.139 164.956C459.638 167.489 467.811 173.453 480.048 173.453C483.773 173.453 489.075 172.493 492.539 170.772C506.635 163.769 514.679 149.203 511.187 131.02ZM408.648 103.39L410.031 99.942C415.213 87.0267 422.71 71.8007 432.95 53.394C444.791 32.107 452.665 23.6148 456.304 20.4475L457.405 19.4904L458.066 18.9154L458.107 19.782L458.176 21.2241C458.376 25.5125 456.987 31.7896 454.461 38.0155C450.253 48.3681 445.298 59.6522 435.181 73.718C430.12 80.7499 421.854 90.4729 411.905 101.095L409.353 103.823L407.815 105.467L408.648 103.39ZM145.307 136.878L144.861 137.202C144.861 137.202 144.221 135.9 143.86 134.868C142.402 130.693 141.92 123.862 142.646 118.327C143.928 108.754 148.185 102.304 149.957 99.9748C155.245 93.023 161.306 89.2002 166.955 88.538C168.919 88.3079 172.297 88.586 175.232 91.4015C177.994 94.0512 182.867 103.41 172.359 114.719C169.155 118.165 166.306 120.924 159.623 126.442C154.621 130.592 146.82 135.864 145.307 136.878ZM318.664 137.054L318.177 137.379L318.019 136.821L317.469 134.87C315.935 129.43 315.528 123.861 316.26 118.32C317.524 108.782 321.793 102.31 323.569 99.97C328.853 93.0179 334.89 88.9582 340.567 88.5394C340.936 88.5117 341.323 88.4931 341.723 88.4931C344.486 88.4931 346.816 89.4416 348.844 91.3926C351.605 94.0512 356.469 103.424 345.959 114.718C342.751 118.167 339.902 120.927 333.237 126.446C327.744 130.994 318.754 136.994 318.664 137.054Z"></path></g></svg>
              </a>
            </Button>
          </div>
          {/* Add resolution selection radio buttons here */}
          <div className="flex items-center gap-4 text-sm flex-wrap sm:text-base">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="resolution"
                value="720"
                checked={selectedResolution === 720}
                onChange={() => setSelectedResolution(720)}
              />
              720p
            </label>
            {isPro ? (
              <>
                <label className={`flex items-center gap-1 text-sm sm:text-base ${!canSelect1080 ? 'text-muted-foreground opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name="resolution"
                    value="1080"
                    checked={selectedResolution === 1080}
                    onChange={() => setSelectedResolution(1080)}
                    disabled={!canSelect1080}
                  />
                  1080p
                </label>
                <label className={`flex items-center gap-1 text-sm sm:text-base ${!canSelect1440 ? 'text-muted-foreground opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name="resolution"
                    value="1440"
                    checked={selectedResolution === 1440}
                    onChange={() => setSelectedResolution(1440)}
                    disabled={!canSelect1440}
                  />
                  1440p
                </label>
                <label className={`flex items-center gap-1 text-sm sm:text-base ${!canSelect2160 ? 'text-muted-foreground opacity-60' : ''}`}>
                  <input
                    type="radio"
                    name="resolution"
                    value="2160"
                    checked={selectedResolution === 2160}
                    onChange={() => setSelectedResolution(2160)}
                    disabled={!canSelect2160}
                  />
                  4K
                </label>
              </>
            ) : (
              <div className="flex items-center gap-2 sm:gap-4 rounded-md border border-border bg-muted/40 pl-1 py-0 text-sm sm:text-base sm:pl-2">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1 text-muted-foreground opacity-60 cursor-not-allowed">
                    <input type="radio" name="resolution" value="1080" disabled />
                    1080p
                  </label>
                  <label className="flex items-center gap-1 text-muted-foreground opacity-60 cursor-not-allowed">
                    <input type="radio" name="resolution" value="1440" disabled />
                    1440p
                  </label>
                  <label className="flex items-center gap-1 text-muted-foreground opacity-60 cursor-not-allowed">
                    <input type="radio" name="resolution" value="2160" disabled />
                    4K
                  </label>
                </div>
                <Button size="xs" onClick={openPayDialog}>Upgrade</Button>
              </div>
            )}
          </div>
          {resolutionLimitMsg && (
            <p className="text-sm text-muted-foreground">
              {resolutionLimitMsg}
            </p>
          )}
          {/* resolution selection ends */}
          <div className='block md:hidden'>
            {(remainingVideos === null) ? (
              <p className='text-sm'>Unlimited video seconds</p>
            ) : (
              <div className='flex items-center gap-5'>
                <p className='text-sm'>
                  {remainingVideos} video seconds left
                </p>
              </div>
            )}
          </div>
          <div ref={outerRef} className="min-h-[400px] w-full border border-border rounded-lg relative overflow-hidden flex items-center justify-center">
            {!selectedVideo ? (
              <span className='absolute inset-0 flex items-center justify-center gap-2 p-2 text-center'>Upload a video to get started</span>
            ) : (
              <div style={{ position: 'relative', width: `${displayedSize.width}px`, height: `${displayedSize.height}px` }}>
                <canvas
                  ref={bgCanvasRef}
                  width={displayedSize.width}
                  height={displayedSize.height}
                  style={{ width: `${displayedSize.width}px`, height: `${displayedSize.height}px` }}
                />
                <canvas
                  ref={textCanvasRef}
                  width={displayedSize.width}
                  height={displayedSize.height}
                  style={{ width: `${displayedSize.width}px`, height: `${displayedSize.height}px`, position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none' }}
                />
                <canvas
                  ref={fgCanvasRef}
                  width={displayedSize.width}
                  height={displayedSize.height}
                  style={{ width: `${displayedSize.width}px`, height: `${displayedSize.height}px`, position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }}
                />
                {!isPreviewReady && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                    <span className='flex items-center justify-center gap-2 px-2 py-1 rounded-md text-center'>
                      <ReloadIcon className="h-6 w-6 animate-spin mr-3" />
                      Preview is Loading…
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          {profile && profile.entitlement === 'starter' && (
            <AdsPlaceholder />
          )}
        </div>
        <div className='flex flex-col w-full md:w-1/2 h-full min-h-0'>
          <Button variant={'secondary'} onClick={addNewTextSet}><PlusIcon className='mr-2'/> Add New Text Set</Button>
          <ScrollArea className="h-full py-2">
            <Accordion type="single" collapsible className="w-full mt-2 max-w-[95vw] mx-auto">
              {textSets.map(textSet => (
                <TextCustomizer
                  key={textSet.id}
                  textSet={textSet}
                  handleAttributeChange={handleAttributeChange}
                  removeTextSet={removeTextSet}
                  duplicateTextSet={duplicateTextSet}
                  userId={userId}
                  isPaid={isPaid}
                />
              ))}
            </Accordion>
          </ScrollArea>
        </div>
      </div>
    </>
  );
};

export default VideoEditorView;


