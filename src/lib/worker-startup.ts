import { startAllWorkers, initializeScheduledJobs } from './worker'

let workersStarted = false

export async function ensureWorkersStarted() {
  if (workersStarted) return

  try {
    startAllWorkers()
    await initializeScheduledJobs()
    workersStarted = true
    console.log('Background workers initialized')
  } catch (err) {
    console.error('Failed to start workers:', err)
  }
}
