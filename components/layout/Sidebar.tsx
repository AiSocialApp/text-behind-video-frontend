import React from 'react';
import { Image as ImageIcon, Video, Library } from 'lucide-react';

type ViewKey = 'image' | 'video' | 'assets';

interface SidebarProps {
    activeView: ViewKey;
    onSelect: (view: ViewKey) => void;
    isMobileOpen?: boolean;
    onCloseMobile?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onSelect, isMobileOpen = false, onCloseMobile }) => {
    const Item = ({ id, icon, label }: { id: ViewKey; icon: React.ReactNode; label: string }) => (
        <button
            onClick={() => {
                onSelect(id);
                if (onCloseMobile) onCloseMobile();
            }}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-md m-2 ${
                activeView === id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
            aria-label={label}
            title={label}
        >
            {icon}
        </button>
    );

    const content = (
        <div className="flex flex-col items-center py-2">
            <Item id="image" icon={<ImageIcon size={18} />} label="Image" />
            <Item id="video" icon={<Video size={18} />} label="Video" />
            <Item id="assets" icon={<Library size={18} />} label="Assets" />
        </div>
    );

    return (
        <>
            <div className="hidden md:flex md:flex-col md:w-16 md:border-r md:border-border">
                {content}
            </div>
            {isMobileOpen && (
                <div className="fixed inset-0 z-40 md:hidden" aria-modal>
                    <div className="absolute inset-0 bg-black/30" onClick={onCloseMobile} />
                    <div className="relative z-50 w-16 h-full bg-background border-r border-border">
                        {content}
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;


