interface QueueItem {
  type: 'vote' | 'vouch' | 'other';
  command: () => Promise<void>;
  priority: number;
}

export class CommandQueue {
  private queue: QueueItem[] = [];
  private isProcessing: boolean = false;
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between messages

  constructor() {
    // Priority levels:
    // vote/vouch: 1 (highest)
    // other commands: 0 (lowest)
  }

  add(type: QueueItem['type'], command: () => Promise<void>) {
    const priority = type === 'other' ? 0 : 1;
    this.queue.push({ type, command, priority });
    
    // Sort queue by priority (highest first)
    this.queue.sort((a, b) => b.priority - a.priority);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.process();
    }
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) continue;

        try {
          await item.command();
        } catch (error) {
          console.error(`Error processing ${item.type} command:`, error);
        }

        // Respect rate limit
        await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Helper method to check queue status
  getQueueStatus() {
    return {
      totalItems: this.queue.length,
      highPriorityItems: this.queue.filter(item => item.priority === 1).length,
      isProcessing: this.isProcessing
    };
  }
}