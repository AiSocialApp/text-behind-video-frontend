// app/app/page.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { useAuth } from '@/hooks/useAuth';
import { Highlight } from '@/components/ui/hero-highlight';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from '@/components/ui/separator';
import { ModeToggle } from '@/components/mode-toggle';
import { Profile } from '@/types';
import Authenticate from '@/components/authenticate';
import Sidebar from '@/components/layout/Sidebar';
import ImageEditorView from '@/components/views/ImageEditorView';
import VideoEditorView from '@/components/views/VideoEditorView';
import AssetsView from '@/components/views/AssetsView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Menu } from 'lucide-react'

import '@/app/fonts.css';
import PayDialog from '@/components/pay-dialog';
import TufaAdBanner from '@/components/TufaAdBanner';

const Page = () => {
    const { isAuthenticated, tokens, profile, logout, isLoading } = useAuth();
    const [currentUser, setCurrentUser] = useState<Profile>()
    const [isPayDialogOpen, setIsPayDialogOpen] = useState<boolean>(false); 
    const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
    const [isModelWarningVisible, setIsModelWarningVisible] = useState<boolean>(true);

    const [activeView, setActiveView] = useState<'image' | 'video' | 'assets'>('video');
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    const [imageSelectedImage, setImageSelectedImage] = useState<string | null>(null);
    const [imageIsSetupDone, setImageIsSetupDone] = useState<boolean>(false);
    const [imageRemovedBgImageUrl, setImageRemovedBgImageUrl] = useState<string | null>(null);
    const [imageTextSets, setImageTextSets] = useState<Array<any>>([]);
    const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [imageDisplayedSize, setImageDisplayedSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    const [videoSelectedVideo, setVideoSelectedVideo] = useState<File | null>(null);
    const [videoPosterUrl, setVideoPosterUrl] = useState<string | null>(null);
    const [videoDurationSec, setVideoDurationSec] = useState<number>(0);
    const [videoRemovedFgUrl, setVideoRemovedFgUrl] = useState<string | null>(null);
    const [videoNaturalSize, setVideoNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [videoDisplayedSize, setVideoDisplayedSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [videoIsReady, setVideoIsReady] = useState<boolean>(false);
    const [videoIsGenerating, setVideoIsGenerating] = useState<boolean>(false);
    const [videoIsUploading, setVideoIsUploading] = useState<boolean>(false);
    const [videoTextSets, setVideoTextSets] = useState<any[]>([]);

    const getCurrentUser = async () => {
        if (!profile) return;
        // Map MeResponse to local Profile shape; minimal fields used here
        setCurrentUser({
            id: profile.username,
            username: profile.username,
            full_name: `${profile.given_name} ${profile.family_name}`.trim(),
            avatar_url: '',
            images_generated: 0,
            paid: profile.entitlement !== 'free',
            entitlement: profile.entitlement,
            subscription_id: '',
        });
        console.log(currentUser)
    };

    useEffect(() => {
      if (isAuthenticated) {
        getCurrentUser();
      }
    }, [isAuthenticated, profile])
    console.log(currentUser)

    return (
        <>
            {!isLoading && isAuthenticated && currentUser ? (
                <div className='flex flex-col h-screen'>
                    <TufaAdBanner variant="narrow" />
                    {!currentUser.paid && null}
                    <header className='flex flex-row items-center justify-between p-5 md:px-10'>
                         <Button className='md:hidden' variant='secondary' onClick={() => setIsMobileSidebarOpen(true)}>
  <Menu className='h-5 w-5' />
</Button>

                        <h2 className="text-4xl md:text-2xl font-semibold tracking-tight flex flex-row items-center">
                            

                        <div className='hidden md:block'>
                            <Highlight className='text-white block'>
                                textbehindvideo.io
                            </Highlight>
                        </div>
                        </h2>
                        <div className='flex gap-2 items-center'>
                            <div className='flex items-center gap-5'>
                                <Button
                                    variant="link"
                                    className="block lg:hidden p-0 h-auto text-sm text-primary hover:underline"
                                    onClick={() => setIsPlanDialogOpen(true)}
                                >
                                    My Plan
                                </Button>
                                <div className='hidden lg:block font-semibold'>
                                    {(profile?.entitlement &&
                                        <div className='flex items-center gap-2'>
                                            <p className='text-sm'>
                                                Plan: {profile?.entitlement[0].toLocaleUpperCase()}{profile?.entitlement.slice(1)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className='hidden lg:block font-semibold'>
                                    {(profile?.remaining?.image === null) ? (
                                        <p className='text-sm'>Unlimited images</p>
                                    ) : (
                                        <div className='flex items-center gap-2'>
                                            <p className='text-sm'>
                                                {profile?.remaining?.image} images left
                                            </p>

                                        </div>
                                    )}
                                </div>
                                <div className='hidden lg:block font-semibold'>

                                    {(profile?.remaining?.video === null) ? (
                                        <p className='text-sm'>Unlimited video seconds</p>
                                    ) : (
                                        <div className='flex items-center gap-2'>
                                            <p className='text-sm'>
                                                {profile?.remaining?.video} video seconds left
                                            </p>

                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="link"
                                    className="p-0 h-auto text-sm text-primary hover:underline hidden lg:block"
                                    onClick={() => setIsPayDialogOpen(true)}
                                >
                                    {profile?.entitlement === 'free' ? 'Upgrade' : 'Your Plan'}
                                </Button>
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
                                    selectedImage={imageSelectedImage}
                                    setSelectedImage={setImageSelectedImage}
                                    isImageSetupDone={imageIsSetupDone}
                                    setIsImageSetupDone={setImageIsSetupDone}
                                    removedBgImageUrl={imageRemovedBgImageUrl}
                                    setRemovedBgImageUrl={setImageRemovedBgImageUrl}
                                    textSets={imageTextSets}
                                    setTextSets={setImageTextSets}
                                    imageNaturalSize={imageNaturalSize}
                                    setImageNaturalSize={setImageNaturalSize}
                                    displayedSize={imageDisplayedSize}
                                    setDisplayedSize={setImageDisplayedSize}
                                />
                            )}
                            {activeView === 'video' && (
                                <VideoEditorView
                                    selectedVideo={videoSelectedVideo}
                                    setSelectedVideo={setVideoSelectedVideo}
                                    posterUrl={videoPosterUrl}
                                    setPosterUrl={setVideoPosterUrl}
                                    videoDurationSec={videoDurationSec}
                                    setVideoDurationSec={setVideoDurationSec}
                                    removedFgUrl={videoRemovedFgUrl}
                                    setRemovedFgUrl={setVideoRemovedFgUrl}
                                    naturalSize={videoNaturalSize}
                                    setNaturalSize={setVideoNaturalSize}
                                    displayedSize={videoDisplayedSize}
                                    setDisplayedSize={setVideoDisplayedSize}
                                    isReady={videoIsReady}
                                    setIsReady={setVideoIsReady}
                                    isGenerating={videoIsGenerating}
                                    setIsGenerating={setVideoIsGenerating}
                                    isUploading={videoIsUploading}
                                    setIsUploading={setVideoIsUploading}
                                    textSets={videoTextSets}
                                    setTextSets={setVideoTextSets}
                                    openPayDialog={() => setIsPayDialogOpen(true)}
                                    modelWarningVisible={isModelWarningVisible}
                                    dismissModelWarning={() => setIsModelWarningVisible(false)}
                                />
                            )}
                            {activeView === 'assets' && (
                                <AssetsView />
                            )}
                        </div>
                    </div>
                    <PayDialog userDetails={currentUser as any} userEmail={profile?.email || ''} isOpen={isPayDialogOpen} onClose={() => setIsPayDialogOpen(false)} />
                    <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Your Plan</DialogTitle>
                                <DialogDescription>
                                    Quotas are calculated on a rolling 30-day basis.
                                </DialogDescription>
                            </DialogHeader>
                            <div className='space-y-2 text-sm'>
                                <p>Plan: {profile?.entitlement ? profile.entitlement[0].toUpperCase() + profile.entitlement.slice(1) : 'N/A'}</p>
                                {(profile?.remaining?.image === null) ? (
                                    <p>Unlimited images</p>
                                ) : (
                                    <p>{profile?.remaining?.image} images left</p>
                                )}
                                {(profile?.remaining?.video === null) ? (
                                    <p>Unlimited video seconds</p>
                                ) : (
                                    <p>{profile?.remaining?.video} video seconds left</p>
                                )}
                            </div>
                            <DialogFooter>
                                <Button onClick={() => setIsPayDialogOpen(true)}>
                                    Upgrade
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            ) : (
                <Authenticate />
            )}
        </>
    );
}

export default Page;