import React, { useEffect } from 'react';
import { TUTOR_ROLES } from '../constants/tutorCapabilities';
import { ROLE_ICONS } from './TutorRoleIcons';

interface TutorCapabilitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DuckIcon = () => (
  <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M25 55C25 40 35 25 55 25C70 25 80 35 80 45C80 50 85 50 90 45C95 40 98 45 95 55C92 65 85 85 55 85C35 85 25 75 25 55Z" fill="#FCD34D" />
    <path d="M45 60C45 60 55 50 70 60" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <path d="M25 45H15C10 45 10 55 15 55H25" fill="#F97316"/>
    <circle cx="45" cy="40" r="4" fill="#1F2937"/>
  </svg>
);

const TutorCapabilitiesModal: React.FC<TutorCapabilitiesModalProps> = ({ isOpen, onClose }) => {
  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Role icon colors
  const iconColors = {
    'video-expert': { bg: 'bg-blue-100', text: 'text-blue-600' },
    'vocabulary-teacher': { bg: 'bg-green-100', text: 'text-green-600' },
    'grammar-coach': { bg: 'bg-purple-100', text: 'text-purple-600' },
    'conversation-partner': { bg: 'bg-orange-100', text: 'text-orange-600' },
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF9F6] border border-stone-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-[fadeScaleIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#FAF9F6] border-b border-stone-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8">
              <DuckIcon />
            </div>
            <h2 className="text-lg font-semibold text-stone-800">AI Tutor Capabilities</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-200/50 transition-colors text-stone-600 hover:text-stone-800"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-stone-600 text-sm mb-6">
            Bilibala is your expert language tutor with deep knowledge of the video content. Here's how it can help you learn:
          </p>

          {/* Roles Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {TUTOR_ROLES.map((role) => {
              const IconComponent = ROLE_ICONS[role.icon as keyof typeof ROLE_ICONS];
              const colors = iconColors[role.id as keyof typeof iconColors];

              return (
                <div
                  key={role.id}
                  className="bg-white border border-stone-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  {/* Icon and Title */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`${colors.bg} ${colors.text} p-2.5 rounded-lg shrink-0`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-stone-800 text-sm mb-0.5">{role.title}</h3>
                      <p className="text-xs text-stone-500">{role.description}</p>
                    </div>
                  </div>

                  {/* Capabilities */}
                  <ul className="space-y-2">
                    {role.capabilities.map((capability, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-stone-600">
                        <span className="text-stone-400 mt-0.5 shrink-0">•</span>
                        <span>{capability}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-stone-200">
            <p className="text-center text-sm text-stone-500">
              Tap <span className="font-semibold text-stone-700">Start</span> to begin your session and start learning!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorCapabilitiesModal;
