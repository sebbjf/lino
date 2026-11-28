interface Window {
  launchQueue?: {
    setConsumer(consumer: (params: { files: import('./data/fileLink.ts').DiskHandle[] }) => void): void
  }
}
