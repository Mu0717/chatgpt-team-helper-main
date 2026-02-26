// Simple in-memory keyed async lock.
// NOTE: This protects against concurrent requests within a single Node.js process.
// If you run multiple replicas, you need a distributed lock (e.g. Redis).

const queues = new Map()

async function acquire(key) {
  const previous = queues.get(key) || Promise.resolve()
  let release
  const current = new Promise(resolve => {
    release = resolve
  })
  const tail = previous.then(() => current)
  queues.set(key, tail)
  await previous

  return () => {
    try {
      release()
    } finally {
      // Cleanup when no longer needed
      if (queues.get(key) === tail) {
        queues.delete(key)
      }
    }
  }
}

export async function withLocks(keys, fn) {
  const uniqueKeys = Array.from(new Set((keys || []).filter(Boolean))).map(String)
  uniqueKeys.sort()

  const releases = []
  try {
    for (const key of uniqueKeys) {
      // Acquire sequentially in sorted order to avoid deadlocks
      const release = await acquire(key)
      releases.push(release)
    }
    return await fn()
  } finally {
    // Release in reverse order
    for (let i = releases.length - 1; i >= 0; i -= 1) {
      try {
        releases[i]()
      } catch {
        // ignore
      }
    }
  }
}
