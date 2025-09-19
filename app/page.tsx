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

{/* 


            <div className="flex space-x-4">
                <a href="https://www.producthunt.com/posts/text-behind-image?embed=true&utm_source=badge-top-post-topic-badge&utm_medium=badge&utm_souce=badge-text&#0045;behind&#0045;image" target="_blank">
                    <img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-topic-badge.svg?post_id=494264&theme=light&period=monthly&topic_id=164" alt="Text&#0032;Behind&#0032;Image - Create&#0032;stunning&#0032;text&#0045;behind&#0045;image&#0032;designs&#0032;easily | Product Hunt" width="250" height="54" />
                </a>
                <a href="https://www.producthunt.com/posts/text-behind-image?embed=true&utm_source=badge-top-post-badge&utm_medium=badge&utm_souce=badge-text&#0045;behind&#0045;image" target="_blank">
                    <img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=494264&theme=light&period=daily" alt="Text&#0032;Behind&#0032;Image - Create&#0032;stunning&#0032;text&#0045;behind&#0045;image&#0032;designs&#0032;easily | Product Hunt" width="250" height="54" />
                </a>
                <a href="https://www.producthunt.com/posts/text-behind-image?embed=true&utm_source=badge-top-post-topic-badge&utm_medium=badge&utm_souce=badge-text&#0045;behind&#0045;image" target="_blank">
                    <img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-topic-badge.svg?post_id=494264&theme=light&period=monthly&topic_id=44" alt="Text&#0032;Behind&#0032;Image - Create&#0032;stunning&#0032;text&#0045;behind&#0045;image&#0032;designs&#0032;easily | Product Hunt" width="250" height="54" />
                </a>
            </div> */}
            
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