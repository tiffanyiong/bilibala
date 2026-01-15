export const extractVideoId = (input: string): string | null => {
  const cleanInput = input.trim();
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = cleanInput.match(regExp);

  if (match && match[2].length === 11) {
    return match[2];
  }

  // Handle Title Inputs
  if (cleanInput.length > 3 && !cleanInput.startsWith('http')) {
      return cleanInput;
  }

  return null;
};

export const fetchVideoMetadata = async (input: string): Promise<{ title: string }> => {
  // 1. If input is just a title, return it immediately
  if (!input.includes("http") && !input.includes("youtu")) {
      return { title: input };
  }

  try {
    const response = await fetch(`https://noembed.com/embed?url=${input}`);
    
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
    
    // If it's a specific restriction error, re-throw it to stop the flow
    if (error.message && error.message.includes("Embedding disabled")) {
        throw error;
    }
    
    // For other errors (e.g. network glitch), fallback to generic title
    return { title: "YouTube Video" };
  }
};