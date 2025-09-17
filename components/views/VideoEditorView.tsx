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
}) => {
  const { tokens, profile } = useAuth();

  const outerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const removedFgImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingVideos = useMemo(() => profile?.remaining?.video ?? null, [profile]);
  const isPaid = useMemo(() => (profile ? profile.entitlement !== 'starter' : false), [profile]);
  const userId = profile?.username ?? '';

  const canGenerate = useMemo(() => {
    const hasUnlimited = remainingVideos === null;
    const hasRemaining = (remainingVideos ?? 0) > 0;
    return Boolean(tokens.accessToken && selectedVideo && isReady && (hasUnlimited || hasRemaining) && !isGenerating);
  }, [tokens.accessToken, selectedVideo, isReady, remainingVideos, isGenerating]);

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
    const maxPreviewHeight = Math.max(1, Math.floor((window.innerHeight || 0) - 200));
    const scale = Math.min(rect.width / naturalSize.width, maxPreviewHeight / naturalSize.height);
    const targetWidth = Math.max(1, Math.floor(naturalSize.width * scale));
    const targetHeight = Math.max(1, Math.floor(naturalSize.height * scale));
    setDisplayedSize({ width: targetWidth, height: targetHeight });
  };

  useEffect(() => {
    const onResize = () => updatePreviewScale();
    window.addEventListener('resize', onResize);
    updatePreviewScale();
    return () => window.removeEventListener('resize', onResize);
  }, [naturalSize.width, naturalSize.height]);

  useEffect(() => {
    if (!posterUrl) return;
    if (!previewCanvasRef.current) return;
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!previewCanvasRef.current) return;
      const canvas = previewCanvasRef.current;
      canvas.width = displayedSize.width || 1;
      canvas.height = displayedSize.height || 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const scaleForFont = naturalSize.width > 0 ? canvas.width / naturalSize.width : 1;
      drawTextSets(ctx, canvas.width, canvas.height, scaleForFont);
      // Foreground (subject) on top
      if (removedFgImageRef.current) {
        ctx.drawImage(removedFgImageRef.current, 0, 0, canvas.width, canvas.height);
      }
    };
    img.src = posterUrl;
  }, [posterUrl, displayedSize.width, displayedSize.height, JSON.stringify(textSets)]);

  // Load removed foreground image element when URL ready
  useEffect(() => {
    if (!removedFgUrl) {
      removedFgImageRef.current = null;
      // trigger redraw without foreground
      if (previewCanvasRef.current && displayedSize.width && displayedSize.height && posterUrl) {
        const img = new (window as any).Image();
        img.onload = () => {
          const canvas = previewCanvasRef.current!;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const scaleForFont = naturalSize.width > 0 ? canvas.width / naturalSize.width : 1;
          drawTextSets(ctx, canvas.width, canvas.height, scaleForFont);
        };
        img.src = posterUrl;
      }
      return;
    }
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      removedFgImageRef.current = img;
      // redraw to include foreground
      if (previewCanvasRef.current && displayedSize.width && displayedSize.height && posterUrl) {
        const bg = new (window as any).Image();
        bg.onload = () => {
          const canvas = previewCanvasRef.current!;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
          const scaleForFont = naturalSize.width > 0 ? canvas.width / naturalSize.width : 1;
          drawTextSets(ctx, canvas.width, canvas.height, scaleForFont);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        bg.src = posterUrl;
      }
    };
    img.src = removedFgUrl;
  }, [removedFgUrl, posterUrl, displayedSize.width, displayedSize.height, naturalSize.width]);

  const drawTextSets = (ctx: CanvasRenderingContext2D, targetWidth: number, targetHeight: number, scaleForFont: number) => {
    Promise.all(
      textSets.map((textSet) => {
        const fontSizePx = textSet.fontSize * scaleForFont;
        const fontStr = `${textSet.fontWeight} ${fontSizePx}px ${textSet.fontFamily}`;
        return document.fonts.load(fontStr);
      })
    ).then(() => {
      textSets.forEach((textSet: any) => {
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
    })
  };

  const drawOverlayCanvas = () => {
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
    drawTextSets(ctx, width, height, scaleForFont);
    return canvas;
  };

  const pickVideo = () => {
    const hasUnlimited = remainingVideos === null;
    const hasRemaining = (remainingVideos ?? 0) > 0;
    if (!(hasUnlimited || hasRemaining)) {
      toast({ title: 'Limit reached', description: 'You have reached your video generation limit.' });
      return;
    }
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Clear any previously removed foreground immediately
    removedFgImageRef.current = null;
    setTextSets([])
    setRemovedFgUrl(null);
    setIsReady(false);
    setSelectedVideo(file);
    try {
      const { poster, width, height, duration } = await extractPosterAndDuration(file);
      setPosterUrl(poster);
      setNaturalSize({ width, height });
      setVideoDurationSec(Math.max(0, Math.round(duration)));
      setIsReady(true);
      updatePreviewScale();
      // Kick off background removal of poster to get foreground cutout
      try {
        const fgBlob = await removeBackground(poster);
        const url = URL.createObjectURL(fgBlob);
        setRemovedFgUrl(url);
      } catch (e) {
        console.warn('Background removal failed', e);
        setRemovedFgUrl(null);
      }
    } catch (err) {
      console.error(err);
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
            resolve({ poster, width, height, duration });
          } catch (e) {
            cleanup();
            reject(e);
          }
        };
        video.currentTime = targetTime;
        video.onseeked = capture;
        setTimeout(capture, 500);
      };
      video.onerror = () => {
        cleanup();
        reject(new Error('Failed to load video metadata'));
      };
    });
  };

  const uploadOverlay = async (putUrl: string, canvas: HTMLCanvasElement) => {
    const blob: Blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b as Blob), 'image/png'));
    const resp = await fetch(putUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob });
    if (!resp.ok) throw new Error(`Overlay upload failed: ${resp.status}`);
  };

  const signPart = async (assetId: string, uploadId: string, key: string, partNumber: number): Promise<string> => {
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
    }
    const safeTokens = {
      accessToken: tokens.accessToken || '',
      refreshToken: tokens.refreshToken || '',
      expires: tokens.expires,
      idToken: tokens.idToken || ''
    };
    await AppApi.completeMultipart(safeTokens, { asset_id: assetId, s3_upload_id: uploadId, key, parts });
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
      if (status === 'COMPLETE' || status === 'FAILED') return asset;
      if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for asset completion');
      await new Promise(r => setTimeout(r, intervalMs));
    }
  };

  const onGenerate = async () => {
    if (!tokens.accessToken || !selectedVideo) return;

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
      const start = await AppApi.startAsset(safeTokens, { extension: ext, length: videoDurationSec });
      t.dismiss();
      setIsGenerating(false);

      const overlayCanvas = drawOverlayCanvas();
      if (!overlayCanvas) {
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
      console.error(err);
      toast({ title: 'Error', description: err?.message || 'Generation failed.' });
      setIsGenerating(false);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={onFileChange} accept="video/*,.mp4,.mov,.webm" />
      <div className='flex flex-col md:flex-row items-start justify-start gap-10 w-full h-[calc(100vh-10rem)] md:h-[calc(100vh-5rem)] px-10 mt-2'>
        <div className="flex flex-col items-start justify-start w-full md:w-1/2 gap-4">
          <canvas ref={overlayCanvasRef} style={{ display: 'none' }} />
          <div ref={outerRef} className='flex items-center gap-2 w-full'>
            <Button onClick={pickVideo} variant='secondary'>Upload video</Button>
            <Button onClick={onGenerate} disabled={!canGenerate}>{isGenerating ? 'Generating…' : 'Generate'}</Button>
          </div>
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
          <div className="min-h:[400px] w-full border border-border rounded-lg relative overflow-hidden flex items-center justify-center">
            {!isReady || !posterUrl ? (
              <span className='flex items-center w-full gap-2 p-2'>{selectedVideo ? 'Preparing preview…' : 'Upload a video to get started'}</span>
            ) : (
              <canvas ref={previewCanvasRef} width={displayedSize.width} height={displayedSize.height} style={{ width: `${displayedSize.width}px`, height: `${displayedSize.height}px` }} />
            )}
          </div>
          {profile && profile.entitlement === 'starter' && (
            <AdsPlaceholder />
          )}
        </div>
        <div className='flex flex-col w-full md:w-1/2 h-full min-h-0'>
          <Button variant={'secondary'} onClick={addNewTextSet}><PlusIcon className='mr-2'/> Add New Text Set</Button>
          <ScrollArea className="h-full p-2">
            <Accordion type="single" collapsible className="w-full mt-2">
              {textSets.map(textSet => (
                <TextCustomizer key={textSet.id} textSet={textSet} handleAttributeChange={handleAttributeChange} removeTextSet={removeTextSet} duplicateTextSet={duplicateTextSet} userId={userId} isPaid={isPaid} />
              ))}
            </Accordion>
          </ScrollArea>
        </div>
      </div>
    </>
  );
};

export default VideoEditorView;


