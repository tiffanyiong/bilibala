import React from 'react';
import { PracticeTopic, TopicQuestion } from '../../../shared/types';

interface TopicSelectorProps {
  topics: PracticeTopic[];
  selectedTopics: string[];
  onTopicToggle: (topic: string) => void;
  isLoading?: boolean;
  onStartPractice?: (topic: PracticeTopic, question: TopicQuestion) => void;
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

  // Get the currently selected topic object
  const selectedTopic = selectedTopics.length > 0
    ? topics.find(t => t.topic === selectedTopics[0])
    : null;

  const handleStartClick = () => {
    if (!selectedTopic || !onStartPractice) {
      alert("Please select a topic first.");
      return;
    }

    // Use the topic's default question
    const defaultQuestion: TopicQuestion = {
      questionId: selectedTopic.questionId || '',
      question: selectedTopic.question,
      sourceType: 'video_generated',
      useCount: 0,
      videoTitle: null,
      analysisId: null
    };
    onStartPractice(selectedTopic, defaultQuestion);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-stone-800 uppercase tracking-wide mb-1">
            Practice Topics
        </h3>
        <p className="text-[13px] text-stone-500 font-light">
            Select a topic to start speaking practice and get your personalized feedback.
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
      <style>
        {`
          @keyframes color-fade {
            0%, 100% { background-color: #fbbf24; }
            50% { background-color: #1c1917; }
          }
          .btn-color-fade {
            animation: color-fade 4s ease-in-out infinite;
          }
        `}
      </style>
      <button
        onClick={handleStartClick}
        disabled={isLoading || selectedTopics.length === 0}
        className={`px-5 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all
            ${isLoading || selectedTopics.length === 0
                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                : 'btn-color-fade text-white'
            }
        `}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="currentColor"/>
            <path d="M12 18.5C15.5899 18.5 18.5 15.5899 18.5 12C18.5 8.41015 15.5899 5.5 12 5.5C8.41015 5.5 5.5 8.41015 5.5 12C5.5 15.5899 8.41015 18.5 12 18.5Z" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        {selectedTopics.length > 0 ? "Start Practice" : "Select a topic"}
      </button>
    </div>
  );
};

export default TopicSelector;
