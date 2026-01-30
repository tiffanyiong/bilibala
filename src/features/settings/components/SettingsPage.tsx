import React from 'react';
import { useAuth } from '../../../shared/context/AuthContext';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-2xl font-serif text-stone-800 mb-6">Settings</h1>
        <div className="bg-[#FAF9F6] rounded-xl border border-stone-200 p-8 text-center">
          <p className="text-stone-500 text-sm">Please sign in to access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-12">
      <h1 className="text-2xl font-serif text-stone-800 mb-6">Settings</h1>

      <div className="bg-[#FAF9F6] rounded-xl border border-stone-200 p-8 text-center">
        <p className="text-stone-500 text-sm">More settings coming soon.</p>
      </div>
    </div>
  );
};

export default SettingsPage;
