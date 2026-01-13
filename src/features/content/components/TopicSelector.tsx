import React from 'react';
import { PracticeTopic } from '../../../shared/types';

interface TopicSelectorProps {
  topics: PracticeTopic[];
  selectedTopics: string[];
  onTopicToggle: (topic: string) => void;
  isLoading?: boolean;
  onStartPractice?: (topic: PracticeTopic) => void;
}

const TopicSelector: React.FC<TopicSelectorProps> = ({ 
  topics, 
  selectedTopics, 
  onTopicToggle, 
  isLoading = false,
  onStartPractice 
}) => {
  // Render if loading OR if there are topics
  if (!isLoading && (!topics || topics.length === 0)) return null;

  const handleStartClick = () => {
    if (selectedTopics.length > 0 && onStartPractice) {
      const selectedTopicObj = topics.find(t => t.topic === selectedTopics[0]);
      if (selectedTopicObj) {
        onStartPractice(selectedTopicObj);
      }
    } else {
        alert("Please select a topic first.");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-stone-800 uppercase tracking-wide mb-1">
            Practice Topics
        </h3>
        <p className="text-[13px] text-stone-500 font-light">
            Select a topic to start speaking practice with your AI tutor.
        </p>
      </div>
      
      {isLoading ? (
        <div className="flex flex-wrap gap-2 animate-pulse mb-6">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-8 bg-gray-100 rounded-full border border-gray-200" style={{ width: 80 + Math.random() * 60 }}></div>
            ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-6">
            {topics.map((item, index) => {
            const isSelected = selectedTopics.includes(item.topic);
            return (
                <button
                key={index}
                onClick={() => onTopicToggle(item.topic)}
                className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-all border text-left
                    ${isSelected 
                    ? 'bg-stone-800 text-white border-stone-800 shadow-sm' 
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:border-stone-300'
                    }
                `}
                >
                {item.topic}
                </button>
            );
            })}
        </div>
      )}

      {/* Start Speaking Practice Button */}
      <button 
        onClick={handleStartClick}
        disabled={isLoading || selectedTopics.length === 0}
        className={`w-full text-sm font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all
            ${isLoading || selectedTopics.length === 0 
                ? 'bg-stone-100 text-stone-400 border border-stone-200 border-dashed cursor-not-allowed'
                : 'bg-stone-800 text-white shadow-md hover:bg-stone-900 hover:shadow-lg hover:-translate-y-0.5'
            }
        `}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 18.5C15.5899 18.5 18.5 15.5899 18.5 12C18.5 8.41015 15.5899 5.5 12 5.5C8.41015 5.5 5.5 8.41015 5.5 12C5.5 15.5899 8.41015 18.5 12 18.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19.5 12H21.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2.5 12H4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 19.5V21.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 2.5V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {selectedTopics.length > 0 ? "Start Speaking Practice" : "Select a topic to start"}
      </button>
    </div>
  );
};

export default TopicSelector;
