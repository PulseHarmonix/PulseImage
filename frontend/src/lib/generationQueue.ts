let generationTail: Promise<unknown> = Promise.resolve()

export function runSerializedGeneration<T>(task: () => Promise<T>): Promise<T> {
  const result = generationTail.then(task, task)
  generationTail = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
