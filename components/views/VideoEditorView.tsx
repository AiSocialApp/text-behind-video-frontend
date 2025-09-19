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
}) => {
  const { tokens, profile, updateRemaining } = useAuth();

  // Add local state for resolution
  const [selectedResolution, setSelectedResolution] = useState<number>(720);

  const outerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const removedFgImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentFileRef = useRef<File | null>(null);

  const remainingVideos = useMemo(() => profile?.remaining?.video ?? null, [profile]);
  const isPaid = useMemo(() => (profile ? profile.entitlement !== 'starter' : false), [profile]);
  const isPro = useMemo(() => profile?.entitlement === 'pro', [profile]);
  const userId = profile?.username ?? '';

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
    const rect = outerRef.current.getBoundingClientRect();
    const maxPreviewHeight = Math.max(1, Math.floor((window.innerHeight || 0) - 220));
    const scale = Math.min(rect.width / naturalSize.width, maxPreviewHeight / naturalSize.height);
    const targetWidth = Math.max(1, Math.floor(naturalSize.width * scale));
    const targetHeight = Math.max(1, Math.floor(naturalSize.height * scale));
    debugLog('updatePreviewScale', { rectWidth: rect.width, rectHeight: rect.height, maxPreviewHeight, scale, targetWidth, targetHeight, naturalSize });
    setDisplayedSize({ width: targetWidth, height: targetHeight });
  };

  useEffect(() => {
    const onResize = () => updatePreviewScale();
    window.addEventListener('resize', onResize);
    // Defer initial scale until container is laid out
    requestAnimationFrame(() => updatePreviewScale());
    return () => window.removeEventListener('resize', onResize);
  }, [naturalSize.width, naturalSize.height]);

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
      } catch (err) {
        console.warn('[TBV] Failed to load or decode background image', err);
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
      return;
    }
    debugLog('FG draw start', { removedFgUrl, canvasWidth: canvas.width, canvasHeight: canvas.height });
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      removedFgImageRef.current = img;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      debugLog('FG draw complete');
    };
    img.src = removedFgUrl;
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

      toast({ title: 'Uploading video', description: 'Uploading video in parts...' });
      await uploadVideoMultipart(selectedVideo, (start as any).asset_id, (start as any).video.key, (start as any).video.s3_upload_id, MIN_PART_SIZE_MB);
      setIsUploading(false);

      toast({ title: 'Processing', description: 'Compositing your video. This may take a while.' });
      const finalAsset = await pollAsset((start as any).asset_id);

      if (finalAsset?.status === 'COMPLETE') {
        toast({ title: 'Done', description: 'Your video is ready in Assets.' });
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
      <div className='flex flex-col md:flex-row items-start justify-start gap-10 w-full md:h-[calc(100vh-9rem)] px-2 md:px-10 mt-2'>
        <div className="flex flex-col items-start justify-start w-full md:w-1/2 gap-2">
          <canvas ref={overlayCanvasRef} style={{ display: 'none' }} />
          <div className='flex items-center gap-2 w-full'>
            <Button onClick={pickVideo} variant='secondary'>Upload video</Button>
            <Button onClick={onGenerate}>{isGenerating ? 'Generating…' : 'Generate'}</Button>
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
          <div ref={outerRef} className="min-h:[400px] w-full border border-border rounded-lg relative overflow-hidden flex items-center justify-center">
            {!isReady || !posterUrl ? (
              <span className='flex items-center w-full gap-2 p-2'>{selectedVideo ? 'Preparing preview…' : 'Upload a video to get started'}</span>
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
              </div>
            )}
          </div>
          {profile && profile.entitlement === 'starter' && (
            <AdsPlaceholder />
          )}
        </div>
        <div className='flex flex-col w-full md:w-1/2 h-full min-h-0'>
          <Button variant={'secondary'} onClick={addNewTextSet}><PlusIcon className='mr-2'/> Add New Text Set</Button>
          <ScrollArea className="h-full p-2">
            <Accordion type="single" collapsible className="w-full mt-2 max-w-[80vw] mx-auto">
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


