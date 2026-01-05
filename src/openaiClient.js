import OpenAI from "openai";

export const openai = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: "v1.CmMKHHN0YXRpY2tleS1lMDBtZ3JjOTRiYzh3NXFmYmcSIXNlcnZpY2VhY2NvdW50LWUwMGEyOWhnMXhwMmo1OWt2ZDILCMHG7soGENuVjxw6DAjAyYaWBxDAno_BAUACWgNlMDA.AAAAAAAAAAG0GkKuZHrCTb1c4Bn7_VaoVx7K4_vOKHNyP1G76UJTsmqQrsM4QogomtsAV34ygq0OrZSFHRpD-P-zQPDk-6YG", 
  dangerouslyAllowBrowser: true 
});
