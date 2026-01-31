export const extractVideoId = (input: string): string | null => {
  const cleanInput = input.trim();

  // Must be a YouTube URL - reject empty input or non-YouTube URLs
  if (!cleanInput) {
    return null;
  }

  // Check if it looks like a YouTube URL
  const isYouTubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(cleanInput);
  if (!isYouTubeUrl) {
    return null;
  }

  // Extract video ID from YouTube URL
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = cleanInput.match(regExp);

  if (match && match[2].length === 11) {
    const videoId = match[2];

    // Security: Validate video ID contains only valid YouTube ID characters
    // YouTube IDs are alphanumeric with hyphens and underscores only
    const isValidId = /^[a-zA-Z0-9_-]+$/.test(videoId);
    if (!isValidId) {
      return null;
    }

    return videoId;
  }

  return null;
};

export const fetchVideoMetadata = async (input: string): Promise<{ title: string }> => {
  try {
    // URL encode the input to prevent injection attacks
    const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(input)}`);
    
    // Check if the response is OK before parsing JSON
    if (!response.ok) {
       console.warn("Noembed service returned non-OK status");
       // Throw to catch block for fallback
       throw new Error("Service Unavailable");
    }

    const data = await response.json();

    // Catch specific error messages from the API
    if (data.error) {
        const errStr = String(data.error).toLowerCase();
        // Check for common restriction/embed errors
        if (errStr.includes("unauthorized") || 
            errStr.includes("restricted") || 
            errStr.includes("private") || 
            errStr.includes("401") || 
            errStr.includes("403")) {
             throw new Error("This video cannot be played (Embedding disabled by owner). Please try another video.");
        }
        // Other errors
        throw new Error("Video unavailable");
    }
    
    if (!data.title) {
       throw new Error("No title found");
    }

    return { 
      title: data.title 
    };
  } catch (error: any) {
    console.error("Failed to fetch video metadata:", error);

    // Re-throw all errors to stop the flow - don't save invalid videos to database
    throw new Error(error.message || "Could not verify this video. Please check the URL and try again.");
  }
};