import OpenAI from "openai";

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  console.error("CRITICAL ERROR: VITE_OPENAI_API_KEY is undefined. The environment variable is not being read.");
} else {
  console.log("SUCCESS: VITE_OPENAI_API_KEY found. Starts with:", apiKey.substring(0, 7) + "...");
}

export const openai = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: apiKey, 
  dangerouslyAllowBrowser: true 
});

