'use client';

import React from 'react';
import { motion } from "framer-motion";
import { HeroHighlight, Highlight } from '@/components/ui/hero-highlight';

import HeroVideoGallery from '@/components/HeroVideoGallery';
import Link from 'next/link';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Badge } from '@/components/ui/badge';
import TufaAdBanner from '@/components/TufaAdBanner';

const page = () => {
    return ( 
        <div className='flex flex-col min-h-screen items-center w-full'>
            {/* <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1609710199882100" crossOrigin="anonymous"></script> */}
            <HeroHighlight>
                <motion.h1
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: [20, -5, 0] }} 
                    transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
                    className="items-center text-2xl md:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-bold text-black dark:text-white"
                >
                    Create {" "}
                    <Highlight className='text-white m-2'>
                        text behind video
                    </Highlight>
                    {" "} designs easily
                </motion.h1>
                <div className="max-w-5xl w-full mx-auto flex justify-center md:justify-end mt-5 md:mt-2">
                    <Link href={'https://tufa.io'} target='_blank'>
                        <Badge variant="brand" className="gap-1 px-3 py-0.5 text-sm">
                            <span>a</span>
                            <img src="/tufa.svg" alt="Tufa" className="h-6 w-25" />
                            <span>product</span>
                        </Badge>
                    </Link>
                </div>
            </HeroHighlight>
            <Link href={'/app'} className='mb-10'>
                <HoverBorderGradient containerClassName="rounded-full" as="button" className="dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2">
                    Open the app
                </HoverBorderGradient>
            </Link>
            <div className='flex flex-col gap-2 sm:flex-row'>
                <a href="https://www.producthunt.com/products/textbehindvideo-io?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-textbehindvideo&#0045;io" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1020076&theme=light&t=1758818861334" alt="textbehindvideo&#0046;io - Create&#0032;cinematic&#0032;text&#0032;behind&#0032;video&#0032;designs&#0032;easily | Product Hunt" style={{width: 225, height: 49}} width="225" height="49" /></a>
                <a href="https://www.producthunt.com/products/textbehindvideo-io?embed=true&utm_source=badge-top-post-badge&utm_medium=badge&utm_source=badge-textbehindvideo&#0045;io" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=1020076&theme=light&period=daily&t=1758977543075" alt="textbehindvideo&#0046;io - Create&#0032;cinematic&#0032;text&#0032;behind&#0032;video&#0032;designs&#0032;easily | Product Hunt" style={{width: 225, height: 49}} width="225" height="49" /></a>
            </div>
            <div className='w-full h-full mt-2'>
                <HeroVideoGallery />
            </div>
            {/* Footer Ad - large, non-closable, always purple */}
            <div className='w-full mt-8'>
                <TufaAdBanner variant="large" />
            </div>
        </div>
    );
}

export default page;