import React from 'react';

const DuckAvatar: React.FC = () => {
    return (
        <div className="relative w-full h-full flex items-center justify-center animate-float">
             {/* Glow effect behind */}
            <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-3xl transform scale-105"></div>
            
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" className="w-full h-full relative z-10 drop-shadow-xl">
                {/* Body */}
                <circle cx="100" cy="100" r="80" fill="#FCD34D"></circle>
                
                {/* Hair Tuft */}
                <path d="M90 30 Q100 10 110 30" stroke="#FCD34D" strokeWidth="8" fill="none" strokeLinecap="round"></path>
                
                {/* Eyes */}
                <g>
                    <circle cx="75" cy="85" r="10" fill="#1F2937"></circle>
                    <circle cx="78" cy="82" r="3" fill="white"></circle>
                    <circle cx="125" cy="85" r="10" fill="#1F2937"></circle>
                    <circle cx="128" cy="82" r="3" fill="white"></circle>
                </g>
                
                {/* Cheeks */}
                <ellipse cx="60" cy="105" rx="10" ry="6" fill="#FBCFE8" opacity="0.8"></ellipse>
                <ellipse cx="140" cy="105" rx="10" ry="6" fill="#FBCFE8" opacity="0.8"></ellipse>
                
                {/* Beak */}
                <g>
                    <path d="M85 110 Q100 135 115 110" fill="#F97316"></path> 
                    <ellipse cx="100" cy="110" rx="25" ry="12" fill="#FB923C"></ellipse> 
                    <path d="M92 106 Q100 102 108 106" stroke="#C2410C" strokeWidth="2" fill="none" opacity="0.5"></path> 
                </g>
            </svg>
        </div>
    );
};

export default DuckAvatar;
