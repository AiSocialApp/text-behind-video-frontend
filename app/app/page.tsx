// app/app/page.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { useAuth } from '@/hooks/useAuth';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from '@/components/ui/separator';
import { Accordion } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModeToggle } from '@/components/mode-toggle';
import { Profile } from '@/types';
import Authenticate from '@/components/authenticate';
import TextCustomizer from '@/components/editor/text-customizer';
import Sidebar from '@/components/layout/Sidebar';
import ImageEditorView from '@/components/views/ImageEditorView';
import VideoEditorView from '@/components/views/VideoEditorView';
import AssetsView from '@/components/views/AssetsView';

import { PlusIcon, ReloadIcon } from '@radix-ui/react-icons';

import { removeBackground } from "@imgly/background-removal";

import '@/app/fonts.css';
import PayDialog from '@/components/pay-dialog';
import AdsPlaceholder from '@/components/ads-placeholder';

const Page = () => {
    const { isAuthenticated, tokens, profile, logout, isLoading } = useAuth();
    const [currentUser, setCurrentUser] = useState<Profile>()
    const [remainingImages, setRemainingImages] = useState<number | null>(null)

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isImageSetupDone, setIsImageSetupDone] = useState<boolean>(false);
    const [removedBgImageUrl, setRemovedBgImageUrl] = useState<string | null>(null);
    const [textSets, setTextSets] = useState<Array<any>>([]);
    const [isPayDialogOpen, setIsPayDialogOpen] = useState<boolean>(false); 
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const removedBgImageRef = useRef<HTMLImageElement | null>(null);
    const outerRef = useRef<HTMLDivElement>(null);

    const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [displayedSize, setDisplayedSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [activeView, setActiveView] = useState<'image' | 'video' | 'assets'>('image');
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    const getCurrentUser = async () => {
        if (!profile) return;
        // Map MeResponse to local Profile shape; minimal fields used here
        setCurrentUser({
            id: profile.username,
            username: profile.username,
            full_name: `${profile.given_name} ${profile.family_name}`.trim(),
            avatar_url: '',
            images_generated: 0,
            paid: profile.entitlement !== 'starter',
            subscription_id: '',
        });
        setRemainingImages(profile.remaining?.image ?? null)
    };

    const handleUploadImage = () => {
        const hasUnlimited = remainingImages === null;
        const hasRemaining = (remainingImages ?? 0) > 0;
        if (currentUser && (hasUnlimited || hasRemaining)) {
            if (fileInputRef.current) {
                fileInputRef.current.click();
            }
        } else {
            alert("You have reached your image generation limit.");
            setIsPayDialogOpen(true);
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Clear foreground cutout immediately
            removedBgImageRef.current = null;
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

            // Decrement remaining locally if finite
            setRemainingImages(prev => (prev === null ? null : Math.max(0, (prev || 0) - 1)))
            
        } catch (error) {
            console.error(error);
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

    // Load background image element
    useEffect(() => {
        if (!selectedImage) return;
        const img = new (window as any).Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            bgImageRef.current = img;
            // Redraw after image load
            if (previewCanvasRef.current && displayedSize.width && displayedSize.height) {
                drawPreview();
            }
        };
        img.src = selectedImage;
        return () => {
            // no special cleanup
        };
    }, [selectedImage]);

    // Load removed background image element
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
        return () => {
            // no special cleanup
        };
    }, [removedBgImageUrl]);

    const drawTextSets = (ctx: CanvasRenderingContext2D, targetWidth: number, targetHeight: number, scaleForFont: number) => {
        textSets.forEach(textSet => {
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
    };

    const drawToCanvas = (canvas: HTMLCanvasElement, targetWidth: number, targetHeight: number) => {
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
        drawTextSets(ctx, canvas.width, canvas.height, scaleForFont);
        // Foreground (subject)
        if (removedBgImageRef.current) {
            ctx.drawImage(removedBgImageRef.current, 0, 0, canvas.width, canvas.height);
        }
    };

    const drawPreview = () => {
        if (!previewCanvasRef.current) return;
        if (!displayedSize.width || !displayedSize.height) return;
        drawToCanvas(previewCanvasRef.current, displayedSize.width, displayedSize.height);
    };

    useEffect(() => {
        if (!isImageSetupDone) return;
        drawPreview();
    }, [isImageSetupDone, displayedSize.width, displayedSize.height, JSON.stringify(textSets)]);

    const addNewTextSet = () => {
        const newId = Math.max(...textSets.map(set => set.id), 0) + 1;
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
            boxWidth: 80
        }]);
    };

    const handleAttributeChange = (id: number, attribute: string, value: any) => {
        setTextSets(prev => prev.map(set => 
            set.id === id ? { ...set, [attribute]: value } : set
        ));
    };

    const duplicateTextSet = (textSet: any) => {
        const newId = Math.max(...textSets.map(set => set.id), 0) + 1;
        setTextSets(prev => [...prev, { ...textSet, id: newId }]);
    };

    const removeTextSet = (id: number) => {
        setTextSets(prev => prev.filter(set => set.id !== id));
    };

    const saveCompositeImage = () => {
        if (!canvasRef.current || !isImageSetupDone) return;

        const canvas = canvasRef.current;
        const width = imageNaturalSize.width || 0;
        const height = imageNaturalSize.height || 0;
        if (width === 0 || height === 0) return;

        drawToCanvas(canvas, width, height);

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'text-behind-image.png';
        link.href = dataUrl;
        link.click();
    };

    useEffect(() => {
      if (isAuthenticated) {
        getCurrentUser();
      }
    }, [isAuthenticated, profile])
    
    return (
        <>
            {/* Ads script removed */}
            {!isLoading && isAuthenticated && currentUser ? (
                <div className='flex flex-col h-screen'>
                    {!currentUser.paid && null}
                    <header className='flex flex-row items-center justify-between p-5 px-10'>
                        <h2 className="text-4xl md:text-2xl font-semibold tracking-tight">
                            <span className="block md:hidden">TBI</span>
                            <span className="hidden md:block">Text behind image editor</span>
                        </h2>
                        <div className='flex gap-4 items-center'>
                            <Button className='md:hidden' variant='secondary' onClick={() => setIsMobileSidebarOpen(true)}>Menu</Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                                accept=".jpg, .jpeg, .png"
                            />
                            <div className='flex items-center gap-5'>
                                <div className='hidden md:block font-semibold'>
                                    {(remainingImages === null) ? (
                                        <p className='text-sm'>Unlimited generations</p>
                                    ) : (
                                        <div className='flex items-center gap-2'>
                                            <p className='text-sm'>
                                                {remainingImages} generations left
                                            </p>
                                            <Button 
                                                variant="link" 
                                                className="p-0 h-auto text-sm text-primary hover:underline"
                                                onClick={() => setIsPayDialogOpen(true)}
                                            >
                                                Upgrade
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className='flex gap-2'>
                                    <Button onClick={handleUploadImage}>
                                        Upload image
                                    </Button>
                                    {selectedImage && (
                                        <Button 
                                            onClick={saveCompositeImage} 
                                            className='hidden md:flex'
                                            disabled={!(remainingImages === null || (remainingImages ?? 0) > 0)}
                                        >
                                            Save image
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <ModeToggle />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Avatar className="cursor-pointer">
                                        <AvatarImage src={currentUser?.avatar_url} /> 
                                        <AvatarFallback>TBI</AvatarFallback>
                                    </Avatar>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end">
                                    <DropdownMenuLabel>
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{currentUser?.full_name}</p>
                                            <p className="text-xs leading-none text-muted-foreground">{profile?.email}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setIsPayDialogOpen(true)}>
                                        <button>{currentUser?.paid ? 'View Plan' : 'Upgrade to Pro'}</button>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => logout()}>
                                        <button>Log out</button>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>
                    <Separator />
                    <div className='flex w-full h-full'>
                        <Sidebar
                            activeView={activeView}
                            onSelect={(v) => setActiveView(v)}
                            isMobileOpen={isMobileSidebarOpen}
                            onCloseMobile={() => setIsMobileSidebarOpen(false)}
                        />
                        <div className='flex-1'>
                            {activeView === 'image' && (
                                <ImageEditorView
                                    selectedImage={selectedImage}
                                    isImageSetupDone={isImageSetupDone}
                                    canvasRef={canvasRef}
                                    outerRef={outerRef}
                                    previewCanvasRef={previewCanvasRef}
                                    displayedSize={displayedSize}
                                    remainingImages={remainingImages}
                                    saveCompositeImage={saveCompositeImage}
                                    addNewTextSet={addNewTextSet}
                                    textSets={textSets}
                                    handleAttributeChange={handleAttributeChange}
                                    removeTextSet={removeTextSet}
                                    duplicateTextSet={duplicateTextSet}
                                    currentUser={currentUser}
                                />
                            )}
                            {activeView === 'video' && (
                                <VideoEditorView>
                                    <div className='flex items-center justify-center min-h-screen w-full'>
                                        <h2 className="text-xl font-semibold">Video view (coming soon)</h2>
                                    </div>
                                </VideoEditorView>
                            )}
                            {activeView === 'assets' && (
                                <AssetsView />
                            )}
                        </div>
                    </div>
                    <PayDialog userDetails={currentUser as any} userEmail={profile?.email || ''} isOpen={isPayDialogOpen} onClose={() => setIsPayDialogOpen(false)} />
                </div>
            ) : (
                <Authenticate />
            )}
        </>
    );
}

export default Page;