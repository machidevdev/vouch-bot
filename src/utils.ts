import { PrismaClient } from "@prisma/client";
import fetch from 'node-fetch';
import { unfurl } from "unfurl.js";
import { z } from "zod";

export const prisma = new PrismaClient();

const FALLBACK_IMAGE = 'https://res.cloudinary.com/dqhw3jubx/image/upload/v1740100690/photo_2025-02-21_02-18-00_mbnnj9.jpg';

// URL schema for validation
const urlSchema = z.string().url();

export async function getProfileImage(username: string): Promise<string> {
  // First try unavatar.io
  try {
    const response = await fetch(`https://unavatar.io/twitter/${username}?json`, {
      timeout: 3000
    });
    const data = await response.json() as { url: string };
    
    // If we got a real image (not fallback), return it
    if (!data.url.includes('fallback.png')) {
      try {
        urlSchema.parse(data.url);
        console.log(`[Image Fetch] Got image from unavatar.io: ${data.url}`);
        return data.url;
      } catch (urlError) {
        console.error('[Image Fetch] Invalid URL from unavatar:', data.url);
      }
    }
    
    console.log('[Image Fetch] Unavatar returned fallback, trying unfurl...');
    
    // If we got a fallback, try unfurl
    try {
      const metadata = await unfurl(`https://x.com/${username}`, {
        timeout: 5000
      });
      console.log(metadata);
      console.log(metadata.open_graph?.images?.[0]);
      
      if (metadata.open_graph?.images?.[0]?.url) {
        const imageUrl = metadata.open_graph.images[0].url;
        try {
          urlSchema.parse(imageUrl);
          console.log(`[Image Fetch] Got image from unfurl: ${imageUrl}`);
          return imageUrl.includes("200x200") ? imageUrl.replace("200x200", "400x400") : imageUrl;
        } catch (urlError) {
          console.error('[Image Fetch] Invalid URL from unfurl:', imageUrl);
        }
      }
    } catch (unfurlError) {
      console.error('[Image Fetch] Unfurl error:', unfurlError);
    }
    
    // If both methods failed, return fallback
    console.log('[Image Fetch] Both methods failed, using fallback image');
    return FALLBACK_IMAGE;
    
  } catch (error) {
    console.error('[Image Fetch] Unavatar error:', error);
    
    // If unavatar fails, try unfurl before giving up
    try {
      const metadata = await unfurl(`https://x.com/${username}`);
      if (metadata.open_graph?.images?.[0]?.url) {
        const imageUrl = metadata.open_graph.images[0].url;
        try {
          urlSchema.parse(imageUrl);
          console.log(`[Image Fetch] Got image from unfurl: ${metadata.open_graph.images[0].url}`);
          return metadata.open_graph.images[0].url;
        } catch (urlError) {
          console.error('[Image Fetch] Invalid URL from unfurl:', imageUrl);
        }
      }
    } catch (unfurlError) {
      console.error('[Image Fetch] Unfurl error:', unfurlError);
    }
    
    return FALLBACK_IMAGE;
  }
}

export const formatVoteMessage = (twitterUsername: string, upvotes: number, downvotes: number, createdBy: string, status: string, description?: string): string => {
  let statusMessage = '';
  
  switch (status) {
    case 'approved':
      statusMessage = '\n\n<b>Status: ✅</b>\n';
      break;
    case 'rejected':
      statusMessage = '\n\n<b>Status: ❌</b>';
      break;
    default:
      statusMessage = `\n\n<b>Status: ⏳</b>`;
  }

  const descriptionText = description ? `\n\n<b>Description:</b>\n${description}` : '';

  return `
Voting for: <a href="https://x.com/${twitterUsername}">@${twitterUsername}</a>
Vouched by: @${createdBy}${descriptionText}

<b>Current votes:</b>
✅: <b>${upvotes}</b>
❌: <b>${downvotes}</b>${statusMessage}`;
}