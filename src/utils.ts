import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
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