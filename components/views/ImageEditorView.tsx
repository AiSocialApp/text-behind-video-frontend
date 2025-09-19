import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PlusIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion } from '@/components/ui/accordion';
import AdsPlaceholder from '@/components/ads-placeholder';
import { removeBackground } from '@imgly/background-removal';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import TextCustomizer from '@/components/editor/text-customizer';
import { AppApi } from '@/lib/api';

interface ImageEditorViewProps {
  selectedImage: string | null;
  setSelectedImage: React.Dispatch<React.SetStateAction<string | null>>;
  isImageSetupDone: boolean;
  setIsImageSetupDone: React.Dispatch<React.SetStateAction<boolean>>;
  removedBgImageUrl: string | null;
  setRemovedBgImageUrl: React.Dispatch<React.SetStateAction<string | null>>;
  textSets: Array<any>;
  setTextSets: React.Dispatch<React.SetStateAction<Array<any>>>;
  imageNaturalSize: { width: number; height: number};
  setImageNaturalSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
  displayedSize: { width: number; height: number};
  setDisplayedSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
}

const ImageEditorView: React.FC<ImageEditorViewProps> = ({
  selectedImage,
  setSelectedImage,
  isImageSetupDone,
  setIsImageSetupDone,
  removedBgImageUrl,
  setRemovedBgImageUrl,
  textSets,
  setTextSets,
  imageNaturalSize,
  setImageNaturalSize,
  displayedSize,
  setDisplayedSize,
}) => {
  const { tokens, profile, updateRemaining } = useAuth();

  // We'll replicate relevant states that were in page.tsx.
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const removedBgImageRef = useRef<HTMLImageElement | null>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  // We'll replicate logic for user entitlements:
  const remainingImages = useMemo(() => profile?.remaining?.image ?? null, [profile]);
  const isPaid = useMemo(() => (profile ? profile.entitlement !== 'free' : false), [profile]);
  const currentUser = useMemo(() => {
    if (!profile) return null;
    return {
      id: profile.username,
      username: profile.username,
      full_name: `${profile.given_name} ${profile.family_name}`.trim(),
      avatar_url: '',
      images_generated: 0,
      paid: profile.entitlement !== 'starter',
      subscription_id: '',
    };
  }, [profile]);

  // replicate the file handling
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clear old cutout
      removedBgImageRef.current = null;
      setTextSets([])
      setRemovedBgImageUrl(null);
      setIsImageSetupDone(false);

      const imageUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve) => {
        const img = new (window as any).Image();
        img.onload = () => {
          setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
          resolve();
        };
        img.src = imageUrl;
      });
      setSelectedImage(imageUrl);
      await setupImage(imageUrl);
    }
  };

  const setupImage = async (imageUrl: string) => {
    try {
      const imageBlob = await removeBackground(imageUrl);
      const url = URL.createObjectURL(imageBlob);
      setRemovedBgImageUrl(url);
      setIsImageSetupDone(true);
      // Decrement remaining images if not unlimited
      if (remainingImages !== null) {
        // do local decrement or simply rely on page or server for actual usage.
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUploadImage = () => {
    const hasUnlimited = remainingImages === null;
    const hasRemaining = (remainingImages ?? 0) > 0;
    if (!currentUser) {
      toast({ title: 'Not logged in', description: 'Please log in first.' });
      return;
    }
    if (hasUnlimited || hasRemaining) {
      fileInputRef.current?.click();
    } else {
      toast({ title: 'Limit reached', description: 'You have reached your image generation limit.' });
    }
  };

  const updatePreviewScale = () => {
    if (!outerRef.current || imageNaturalSize.width === 0 || imageNaturalSize.height === 0) return;
    const rect = outerRef.current.getBoundingClientRect();
    const maxPreviewHeight = Math.max(1, Math.floor((window.innerHeight || 0) - 200));
    const scale = Math.min(
      rect.width / imageNaturalSize.width,
      maxPreviewHeight / imageNaturalSize.height
    );
    const targetWidth = Math.max(1, Math.floor(imageNaturalSize.width * scale));
    const targetHeight = Math.max(1, Math.floor(imageNaturalSize.height * scale));
    setDisplayedSize({ width: targetWidth, height: targetHeight });
  };

  useEffect(() => {
    const onResize = () => updatePreviewScale();
    window.addEventListener('resize', onResize);
    updatePreviewScale();
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [imageNaturalSize.width, imageNaturalSize.height]);

  // replicate logic for loading the background image
  useEffect(() => {
    if (!selectedImage) return;
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      bgImageRef.current = img;
      if (previewCanvasRef.current && displayedSize.width && displayedSize.height) {
        drawPreview();
      }
    };
    img.src = selectedImage;
  }, [selectedImage]);

  // replicate logic for removed background image
  useEffect(() => {
    if (!removedBgImageUrl) {
      removedBgImageRef.current = null;
      if (previewCanvasRef.current && displayedSize.width && displayedSize.height) {
        drawPreview();
      }
      return;
    }
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      removedBgImageRef.current = img;
      if (previewCanvasRef.current && displayedSize.width && displayedSize.height) {
        drawPreview();
      }
    };
    img.src = removedBgImageUrl;
  }, [removedBgImageUrl]);

  const drawTextSets = (
    ctx: CanvasRenderingContext2D,
    targetWidth: number,
    targetHeight: number,
    scaleForFont: number
  ) => {
    // Return a Promise so callers can await the fonts load
    return Promise.all(
      textSets.map((textSet) => {
        const fontSizePx = textSet.fontSize * scaleForFont;
        const fontStr = `${textSet.fontWeight} ${fontSizePx}px ${textSet.fontFamily}`;
        return document.fonts.load(fontStr);
      })
    ).then(() => {
      textSets.forEach((textSet) => {
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
        lines.forEach((line) => {
          const idx = lines.indexOf(line);
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
    });
  };

  const drawToCanvas = async (canvas: HTMLCanvasElement, targetWidth: number, targetHeight: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = Math.max(1, Math.floor(targetWidth));
    canvas.height = Math.max(1, Math.floor(targetHeight));
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
    }

    // Text
    const scaleForFont = imageNaturalSize.width > 0 ? (canvas.width / imageNaturalSize.width) : 1;
    await drawTextSets(ctx, canvas.width, canvas.height, scaleForFont);

    // Foreground (subject)
    if (removedBgImageRef.current) {
      ctx.drawImage(removedBgImageRef.current, 0, 0, canvas.width, canvas.height);
    }
  };

  const drawPreview = async () => {
    if (!previewCanvasRef.current) return;
    if (!displayedSize.width || !displayedSize.height) return;
    await drawToCanvas(previewCanvasRef.current, displayedSize.width, displayedSize.height);
  };

  useEffect(() => {
    if (!isImageSetupDone) return;
    drawPreview();
    new Promise(resolve => setTimeout(resolve, 1000)).then(
      drawPreview
    );
  }, [isImageSetupDone, displayedSize, JSON.stringify(textSets)]);

  const handleSaveClick = async () => {
    if (!canvasRef.current || !isImageSetupDone) return;
    const hasUnlimited = remainingImages === null;
    const hasRemaining = (remainingImages ?? 0) > 0;
    if (!(hasUnlimited || hasRemaining)) {
      toast({ title: 'Limit reached', description: 'You have no image generations remaining.' });
      return;
    }
    setIsSaving(true);
    try {
      const canvas = canvasRef.current;
      const width = imageNaturalSize.width || 0;
      const height = imageNaturalSize.height || 0;
      if (width === 0 || height === 0) return;
      await drawToCanvas(canvas, width, height);
      const dataUrl = canvas.toDataURL('image/png');

      // Local download
      const link = document.createElement('a');
      link.download = 'text-behind-image.png';
      link.href = dataUrl;
      link.click();

      // Also upload to S3
      if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
        toast({ title: 'Not logged in', description: 'Please log in first.' });
        return;
      }
      const { asset_id, image: { put_url }, remaining } = await AppApi.startImageAsset(
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expires: tokens.expires,
          idToken: tokens.idToken || undefined,
        },
        { extension: 'png' }
      );
      if (remaining) {
        updateRemaining(remaining);
      }
      // convert dataUrl to Blob
      const dataURLtoBlob = (dUrl: string) => {
        const arr = dUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
      };
      const blob = dataURLtoBlob(dataUrl);
      const uploadRes = await fetch(put_url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png',
        },
        body: blob,
      });
      if (!uploadRes.ok) {
        throw new Error('Image upload failed');
      }

      toast({ title: 'Image saved', description: 'Successfully uploaded image to your assets.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error saving image', description: 'Could not save image.' });
    } finally {
      setIsSaving(false);
    }
  };

  const addNewTextSet = () => {
    const newId = Math.max(0, ...textSets.map(set => set.id)) + 1;
    setTextSets(prev => [...prev, {
      id: newId,
      text: 'edit',
      fontFamily: 'Inter',
      top: 0,
      left: 0,
      color: 'white',
      fontSize: 300,
      fontWeight: 800,
      opacity: 1,
      shadowColor: 'rgba(0, 0, 0, 0.8)',
      shadowSize: 4,
      rotation: 0,
      tiltX: 0,
      tiltY: 0,
      letterSpacing: 0,
      boxWidth: 80,
    }]);
  };

  const handleAttributeChange = (id: number, attribute: string, value: any) => {
    setTextSets(prev => prev.map(set => (set.id === id ? { ...set, [attribute]: value } : set)));
  };

  const duplicateTextSet = (textSet: any) => {
    const newId = Math.max(...textSets.map(set => set.id), 0) + 1;
    setTextSets(prev => [...prev, { ...textSet, id: newId }]);
  };

  const removeTextSet = (id: number) => {
    setTextSets(prev => prev.filter(set => set.id !== id));
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept=".jpg, .jpeg, .png"
      />
      <div className='flex flex-col md:flex-row items-start justify-start gap-10 w-full h-[calc(100vh-11rem)] md:h-[calc(100vh-6rem)] px-2 md:px-10 mt-2'>
        <div className="flex flex-col items-start justify-start w-full md:w-1/2 gap-4">
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div ref={outerRef} className='flex items-center gap-2 w-full'>
            <Button onClick={handleUploadImage} variant='secondary'>Upload image</Button>
            <Button onClick={handleSaveClick} disabled={isSaving || !selectedImage}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <div className='block md:hidden'>
              {(remainingImages === null) ? (
                <p className='text-sm'>Unlimited generations</p>
              ) : (
                <div className='flex items-center gap-5'>
                  <p className='text-sm'>
                    {remainingImages} generations left
                  </p>
                  {/* If needed, a button to upgrade could go here */}
                </div>
              )}
            </div>
          <div className="min-h:[400px] w-full border border-border rounded-lg relative overflow-hidden flex items-center justify-center">
            {!selectedImage ? (
              <span className='flex items-center w-full gap-2 p-2'>Upload an image to get started</span>
            ) : !isImageSetupDone ? (
              <span className='flex items-center w-full gap-2'><ReloadIcon className='animate-spin' /> Loading, please wait</span>
            ) : (
              <canvas
                ref={previewCanvasRef}
                width={displayedSize.width}
                height={displayedSize.height}
                style={{ width: `${displayedSize.width}px`, height: `${displayedSize.height}px` }}
              />
            )}
          </div>
        </div>
        <div className='flex flex-col w-full md:w-1/2 h-full min-h-0'>
          <Button variant={'secondary'} onClick={addNewTextSet}><PlusIcon className='mr-2'/> Add New Text Set</Button>
          <ScrollArea className="h-full p-2">
            <Accordion type="single" collapsible className="w-full mt-2">
              {textSets.map(textSet => (
                <TextCustomizer
                  key={textSet.id}
                  textSet={textSet}
                  handleAttributeChange={handleAttributeChange}
                  removeTextSet={removeTextSet}
                  duplicateTextSet={duplicateTextSet}
                  userId={currentUser?.id || ''}
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

export default ImageEditorView;


