export class Queue {
  private queue: (() => Promise<void>)[] = [];
  private isProcessing: boolean = false;

  add(task: () => Promise<void>) {
    this.queue.push(task);
    if (!this.isProcessing) {
      this.process();
    }
  }

  private async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('Error processing task:', error);
        }
      }
    }

    this.isProcessing = false;
  }

  getStatus() {
    return {
      pendingTasks: this.queue.length,
      isProcessing: this.isProcessing
    };
  }
}