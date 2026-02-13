export interface TutorRole {
  id: string;
  title: string;
  icon: string;
  description: string;
  capabilities: string[];
}

export const TUTOR_ROLES: TutorRole[] = [
  {
    id: 'video-expert',
    title: 'Video Content Expert',
    icon: 'video',
    description: 'Your primary expert on this video',
    capabilities: [
      'Answer any question about the video with confidence',
      'Explain scenes, concepts, or moments you didn\'t understand',
      'Clarify cultural references or context from the video',
    ]
  },
  {
    id: 'vocabulary-teacher',
    title: 'Vocabulary Teacher',
    icon: 'vocabulary',
    description: 'Learn how to use words in context',
    capabilities: [
      'Teach words with clear examples from the video',
      'Show when and how to use each word',
      'Help you practice with new vocabulary',
    ]
  },
  {
    id: 'grammar-coach',
    title: 'Grammar Coach',
    icon: 'grammar',
    description: 'Master sentence construction',
    capabilities: [
      'Explain grammar patterns from the video',
      'Show different ways to construct ideas',
      'Gently correct your grammar with explanations',
    ]
  },
  {
    id: 'conversation-partner',
    title: 'Conversation Partner',
    icon: 'conversation',
    description: 'Practice speaking naturally',
    capabilities: [
      'Ask questions to get you talking about the video',
      'Encourage you to share opinions and thoughts',
      'Create a comfortable space for making mistakes',
    ]
  },
];
