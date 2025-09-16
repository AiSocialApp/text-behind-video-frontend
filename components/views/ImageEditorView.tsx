import React from 'react';
import { PlusIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion } from '@/components/ui/accordion';
import TextCustomizer from '@/components/editor/text-customizer';
import AdsPlaceholder from '@/components/ads-placeholder';
import { Profile } from '@/types';

interface ImageEditorViewProps {
    selectedImage: string | null;
    isImageSetupDone: boolean;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    outerRef: React.RefObject<HTMLDivElement>;
    previewCanvasRef: React.RefObject<HTMLCanvasElement>;
    displayedSize: { width: number; height: number };
    remainingImages: number | null;
    saveCompositeImage: () => void;
    onUploadImage: () => void;
    addNewTextSet: () => void;
    textSets: any[];
    handleAttributeChange: (id: number, attribute: string, value: any) => void;
    removeTextSet: (id: number) => void;
    duplicateTextSet: (textSet: any) => void;
    currentUser: Profile;
}

const ImageEditorView: React.FC<ImageEditorViewProps> = ({
    selectedImage,
    isImageSetupDone,
    canvasRef,
    outerRef,
    previewCanvasRef,
    displayedSize,
    remainingImages,
    saveCompositeImage,
    addNewTextSet,
    onUploadImage,
    textSets,
    handleAttributeChange,
    removeTextSet,
    duplicateTextSet,
    currentUser,
}) => {
    return (
        <>
            <div className='flex flex-col md:flex-row items-start justify-start gap-10 w-full h-[calc(100vh-10rem)] md:h-[calc(100vh-5rem)] px-10 mt-2'>
                <div className="flex flex-col items-start justify-start w-full md:w-1/2 gap-4">
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div ref={outerRef} className='flex items-center gap-2 w-full'>
                        <Button onClick={onUploadImage} variant='secondary'>Upload image</Button>
                        <Button 
                            onClick={saveCompositeImage}
                            disabled={!selectedImage || !(remainingImages === null || (remainingImages ?? 0) > 0)}
                        >
                            Save image
                        </Button>
                        <div className='block md:hidden'>
                            {(remainingImages === null) ? (
                                <p className='text-sm'>Unlimited generations</p>
                            ) : (
                                <div className='flex items-center gap-5'>
                                    <p className='text-sm'>
                                        {remainingImages} generations left
                                    </p>
                                    <Button 
                                        variant="link" 
                                        className="p-0 h-auto text-sm text-primary hover:underline"
                                    >
                                        Upgrade
                                    </Button>
                                </div>
                            )}
                        </div>
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
                    {!currentUser.paid && (
                        <AdsPlaceholder />
                    )}
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
                                    userId={currentUser.id}
                                    isPaid={currentUser.paid}
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


