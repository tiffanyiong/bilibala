import React from 'react';

interface FooterProps {
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

const Footer: React.FC<FooterProps> = ({ onOpenPrivacy, onOpenTerms }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-4 px-6">
      <div className="flex items-center justify-center gap-4 text-xs text-stone-400">
        <span>&copy; {currentYear} Bilibala</span>
        <span>·</span>
        <button
          onClick={onOpenPrivacy}
          className="hover:text-stone-600 transition-colors"
        >
          Privacy
        </button>
        <span>·</span>
        <button
          onClick={onOpenTerms}
          className="hover:text-stone-600 transition-colors"
        >
          Terms
        </button>
      </div>
    </footer>
  );
};

export default Footer;
