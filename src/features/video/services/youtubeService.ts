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
        if (data.error === "401 Unauthorized" || (typeof data.error === 'string' && data.error.includes("Unauthorized"))) {
             // This is a restricted video, but we still want to try to let the user proceed if possible,
             // or at least give a specific message.
             throw new Error("Restricted Video");
        }
        // Other errors (private, deleted)
        throw new Error("Video Metadata Error");
    }
    
    if (!data.title) {
       throw new Error("No title found");
    }

    return { 
      title: data.title 
    };
  } catch (error) {
    console.error("Failed to fetch video metadata:", error);
    
    // FALLBACK: Return a generic title or the URL so the app doesn't crash.
    // This allows the user to proceed to the dashboard even if we can't get the perfect title.
    // The AI might struggle slightly with context, but it's better than a hard block.
    return { title: "YouTube Video" };
  }
};