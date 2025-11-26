/**
 * Render Scheduler
 *
 * Phase 5: Advanced Map Optimization
 * Utilities for scheduling heavy operations:
 * - requestIdleCallback with fallback
 * - Batched updates
 * - Priority-based scheduling
 */

// ============================================
// IDLE CALLBACK
// ============================================

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void

/**
 * Cross-browser requestIdleCallback with fallback
 */
export function requestIdleCallbackPolyfill(
  callback: IdleCallback,
  options?: { timeout?: number }
): number {
  if (typeof window === 'undefined') {
    return 0
  }

  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options)
  }

  // Fallback for Safari and older browsers
  const start = Date.now()
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    })
  }, options?.timeout || 100) as unknown as number
}

/**
 * Cancel idle callback
 */
export function cancelIdleCallbackPolyfill(id: number): void {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(id)
  } else {
    clearTimeout(id)
  }
}

/**
 * Schedule a function to run when browser is idle
 *
 * @param fn - Function to execute
 * @param timeout - Maximum wait time in ms (default: 1000)
 * @returns Cancel function
 */
export function scheduleWhenIdle(
  fn: () => void,
  timeout: number = 1000
): () => void {
  const id = requestIdleCallbackPolyfill(
    (deadline) => {
      // If we have time remaining or hit timeout, execute
      if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
        fn()
      }
    },
    { timeout }
  )

  return () => cancelIdleCallbackPolyfill(id)
}

// ============================================
// ANIMATION FRAME SCHEDULER
// ============================================

/**
 * Schedule for next animation frame
 *
 * @param fn - Function to execute
 * @returns Cancel function
 */
export function scheduleFrame(fn: () => void): () => void {
  const id = requestAnimationFrame(fn)
  return () => cancelAnimationFrame(id)
}

/**
 * Schedule for after paint (double rAF)
 * Useful for measuring after render
 */
export function scheduleAfterPaint(fn: () => void): () => void {
  let id1: number
  let id2: number

  id1 = requestAnimationFrame(() => {
    id2 = requestAnimationFrame(fn)
  })

  return () => {
    cancelAnimationFrame(id1)
    cancelAnimationFrame(id2)
  }
}

// ============================================
// BATCHED UPDATES
// ============================================

type BatchedUpdate<T> = {
  key: string
  data: T
  timestamp: number
}

/**
 * Create a batched update scheduler
 * Collects updates and processes them in batches
 *
 * @param processBatch - Function to process a batch of updates
 * @param batchDelay - Delay before processing batch (default: 100ms)
 * @param maxBatchSize - Maximum items in a batch (default: 50)
 */
export function createBatchScheduler<T>(
  processBatch: (updates: BatchedUpdate<T>[]) => void,
  batchDelay: number = 100,
  maxBatchSize: number = 50
): {
  add: (key: string, data: T) => void
  flush: () => void
  clear: () => void
} {
  let pendingUpdates: BatchedUpdate<T>[] = []
  let timeoutId: NodeJS.Timeout | null = null

  const flush = () => {
    if (pendingUpdates.length === 0) return

    const batch = pendingUpdates.slice(0, maxBatchSize)
    pendingUpdates = pendingUpdates.slice(maxBatchSize)

    // Process using idle callback
    scheduleWhenIdle(() => {
      processBatch(batch)

      // If more updates pending, schedule next flush
      if (pendingUpdates.length > 0) {
        timeoutId = setTimeout(flush, batchDelay)
      }
    })
  }

  const add = (key: string, data: T) => {
    // Remove existing update with same key (keep latest)
    pendingUpdates = pendingUpdates.filter((u) => u.key !== key)

    pendingUpdates.push({
      key,
      data,
      timestamp: Date.now(),
    })

    // Schedule flush if not already scheduled
    if (!timeoutId) {
      timeoutId = setTimeout(flush, batchDelay)
    }

    // Force flush if batch is full
    if (pendingUpdates.length >= maxBatchSize) {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      flush()
    }
  }

  const clear = () => {
    pendingUpdates = []
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return { add, flush, clear }
}

// ============================================
// PRIORITY SCHEDULER
// ============================================

type Priority = 'high' | 'normal' | 'low'

interface PriorityTask {
  id: string
  priority: Priority
  fn: () => void
}

/**
 * Create a priority-based task scheduler
 * Higher priority tasks are executed first
 */
export function createPriorityScheduler(): {
  schedule: (id: string, priority: Priority, fn: () => void) => void
  cancel: (id: string) => void
  flush: () => void
} {
  const tasks: Map<string, PriorityTask> = new Map()
  let isProcessing = false

  const priorityOrder: Record<Priority, number> = {
    high: 0,
    normal: 1,
    low: 2,
  }

  const process = () => {
    if (isProcessing || tasks.size === 0) return
    isProcessing = true

    // Sort tasks by priority
    const sortedTasks = Array.from(tasks.values()).sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    )

    // Process high priority immediately
    const highPriority = sortedTasks.filter((t) => t.priority === 'high')
    highPriority.forEach((task) => {
      task.fn()
      tasks.delete(task.id)
    })

    // Process normal priority on next frame
    const normalPriority = sortedTasks.filter((t) => t.priority === 'normal')
    if (normalPriority.length > 0) {
      scheduleFrame(() => {
        normalPriority.forEach((task) => {
          if (tasks.has(task.id)) {
            task.fn()
            tasks.delete(task.id)
          }
        })
      })
    }

    // Process low priority when idle
    const lowPriority = sortedTasks.filter((t) => t.priority === 'low')
    if (lowPriority.length > 0) {
      scheduleWhenIdle(() => {
        lowPriority.forEach((task) => {
          if (tasks.has(task.id)) {
            task.fn()
            tasks.delete(task.id)
          }
        })
      })
    }

    isProcessing = false
  }

  const schedule = (id: string, priority: Priority, fn: () => void) => {
    tasks.set(id, { id, priority, fn })
    scheduleFrame(process)
  }

  const cancel = (id: string) => {
    tasks.delete(id)
  }

  const flush = () => {
    tasks.forEach((task) => task.fn())
    tasks.clear()
  }

  return { schedule, cancel, flush }
}

// ============================================
// DEBOUNCE & THROTTLE
// ============================================

/**
 * Debounce a function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}
