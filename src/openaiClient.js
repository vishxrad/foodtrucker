import OpenAI from "openai";

export const openai = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: import.meta.env.VITE_OPENAI_API_KEY, 
  dangerouslyAllowBrowser: true 
});

