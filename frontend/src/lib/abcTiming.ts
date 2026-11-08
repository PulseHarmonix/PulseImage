export interface VocalSection {
  label: string
  start: number
  end: number
  vocalStart?: number
  vocalEnd?: number
}

export interface TimedLyricLine {
  text: string
  start: number
  end: number
  section?: string
}

export interface VocalTiming {
  duration: number
  hasVocal: boolean
  sections: VocalSection[]
  lines: TimedLyricLine[]
}

interface ParsedEvent {
  start: number
  end: number
  rest: boolean
}

interface ParsedSection extends VocalSection {
  hasVocal: boolean
  boundaries: number[]
}

interface LyricInputLine {
  text: string
  tag?: string
}

interface LyricGroup {
  tag?: string
  lines: string[]
}

const SECTION_PATTERN = /^(intro|verse|chorus|interlude|bridge|outro|pre[\s-]?chorus|post[\s-]?chorus)\b/i
const EPSILON = 1e-6

function parseLength(text: string, start: number): { factor: number; next: number } {
  let index = start
  let numerator = ''
  while (index < text.length && text[index] >= '0' && text[index] <= '9') {
    numerator += text[index]
    index += 1
  }
  let slashes = 0
  let denominator = ''
  if (text[index] === '/') {
    while (text[index] === '/') {
      slashes += 1
      index += 1
    }
    while (index < text.length && text[index] >= '0' && text[index] <= '9') {
      denominator += text[index]
      index += 1
    }
  }
  let factor = 1
  if (numerator) {
    const value = Number(numerator)
    if (slashes > 0) {
      factor = denominator ? value / Number(denominator) : value / Math.pow(2, slashes)
    } else {
      factor = value
    }
  } else if (slashes > 0) {
    factor = 1 / Math.pow(2, slashes)
  }
  if (!Number.isFinite(factor) || factor <= 0) factor = 1
  return { factor, next: index }
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function namesMatch(sectionName: string, targetName: string): boolean {
  if (!sectionName || !targetName) return false
  if (sectionName === targetName) return true
  return sectionName.startsWith(`${targetName} `) || targetName.startsWith(`${sectionName} `)
}

function snapToBoundary(value: number, boundaries: number[], min: number, max: number): number {
  let best = value
  let bestDistance = Number.POSITIVE_INFINITY
  for (const boundary of boundaries) {
    const distance = Math.abs(boundary - value)
    if (distance < bestDistance) {
      bestDistance = distance
      best = boundary
    }
  }
  return Math.min(max, Math.max(min, best))
}

function allocate(total: number, weights: number[]): number[] {
  const counts = weights.map(() => 0)
  if (total <= 0 || weights.length === 0) return counts
  if (total < weights.length) {
    for (let index = 0; index < total; index += 1) counts[index] = 1
    return counts
  }
  counts.fill(1)
  const remaining = total - weights.length
  if (remaining <= 0) return counts
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)
  const exact = weights.map((weight) =>
    weightSum > 0 ? (weight / weightSum) * remaining : remaining / weights.length,
  )
  const floors = exact.map((value) => Math.floor(value))
  let extra = remaining - floors.reduce((sum, value) => sum + value, 0)
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
  let cursor = 0
  while (extra > 0) {
    floors[order[cursor % order.length].index] += 1
    cursor += 1
    extra -= 1
  }
  for (let index = 0; index < counts.length; index += 1) counts[index] += floors[index]
  return counts
}

function parseLyrics(lyrics?: string): LyricInputLine[] {
  if (!lyrics) return []
  const result: LyricInputLine[] = []
  let tag: string | undefined
  const tagPattern = /\[([^\]]+)\]/g
  for (const raw of lyrics.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    let cursor = 0
    tagPattern.lastIndex = 0
    let match = tagPattern.exec(line)
    while (match) {
      const text = line.slice(cursor, match.index).trim()
      if (text) result.push({ text, tag })
      const nextTag = match[1].trim()
      if (nextTag) tag = nextTag
      cursor = match.index + match[0].length
      match = tagPattern.exec(line)
    }
    const rest = line.slice(cursor).trim()
    if (rest) result.push({ text: rest, tag })
  }
  return result
}

function distributeLines(lines: string[], section: ParsedSection, output: TimedLyricLine[]): void {
  if (lines.length === 0) return
  const rawStart = section.vocalStart ?? section.start
  const rawEnd = section.vocalEnd ?? section.end
  const rangeStart = Math.min(rawStart, rawEnd)
  const rangeEnd = Math.max(rawStart, rawEnd)
  const totalLength = lines.reduce((sum, line) => sum + line.length, 0)
  let cumulative = 0
  for (const line of lines) {
    const weight = totalLength > 0 ? line.length / totalLength : 1 / lines.length
    const nextCumulative = cumulative + weight
    const rawLineStart = rangeStart + (rangeEnd - rangeStart) * cumulative
    const rawLineEnd = rangeStart + (rangeEnd - rangeStart) * nextCumulative
    const start = snapToBoundary(rawLineStart, section.boundaries, rangeStart, rangeEnd)
    let end = snapToBoundary(rawLineEnd, section.boundaries, rangeStart, rangeEnd)
    if (end < start) end = start
    output.push({ text: line, start, end, section: section.label })
    cumulative = nextCumulative
  }
}

export function parseVocalTiming(abc: string, lyrics?: string): VocalTiming {
  const empty: VocalTiming = { duration: 0, hasVocal: false, sections: [], lines: [] }
  if (!abc || typeof abc !== 'string') return empty

  const cursors = new Map<string, number>()
  const voiceOrder: string[] = []
  const events: ParsedEvent[] = []
  const markers: { label: string; time: number }[] = []
  let primaryVocal: string | null = null
  let currentVoice = 'default'
  let defaultLength = 1 / 8
  let measureLength = 1
  let secondsPerWhole = 2

  const ensureCursor = (voice: string) => {
    if (!cursors.has(voice)) cursors.set(voice, 0)
  }

  const addEvent = (rest: boolean, duration: number) => {
    const safeDuration =
      Number.isFinite(duration) && duration > 0 ? duration : Math.max(defaultLength, EPSILON)
    const start = cursors.get(currentVoice) ?? 0
    if (currentVoice === primaryVocal) {
      events.push({ start, end: start + safeDuration, rest })
    }
    cursors.set(currentVoice, start + safeDuration)
  }

  const handleVoice = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    let key = ''
    if (trimmed[0] === '"') {
      const close = trimmed.indexOf('"', 1)
      key = close === -1 ? trimmed.slice(1) : trimmed.slice(1, close)
    } else {
      const token = trimmed.match(/^(\S+)/)
      key = token ? token[1] : ''
    }
    if (!key) key = currentVoice
    const nameMatch =
      trimmed.match(/name\s*=\s*"([^"]*)"/i) || trimmed.match(/name\s*=\s*([^\s]+)/i)
    const name = nameMatch ? nameMatch[1] : ''
    currentVoice = key
    if (!voiceOrder.includes(key)) voiceOrder.push(key)
    ensureCursor(key)
    if (!primaryVocal && (/^vocal/i.test(key) || /^vocal/i.test(name))) primaryVocal = key
  }

  const handleField = (letter: string, value: string) => {
    const field = letter.toUpperCase()
    const trimmed = value.trim()
    if (field === 'M') {
      if (/^C\|?$/i.test(trimmed)) {
        measureLength = 1
        return
      }
      const meter = trimmed.match(/^(\d+)\s*\/\s*(\d+)/)
      if (meter) {
        const numerator = Number(meter[1])
        const denominator = Number(meter[2])
        if (numerator > 0 && denominator > 0) measureLength = numerator / denominator
      }
      return
    }
    if (field === 'L') {
      const length = trimmed.match(/^(\d+)\s*\/\s*(\d+)/)
      if (length) {
        const numerator = Number(length[1])
        const denominator = Number(length[2])
        if (numerator > 0 && denominator > 0) defaultLength = numerator / denominator
      }
      return
    }
    if (field === 'Q') {
      let tempo = trimmed.match(/(\d+)\s*\/\s*(\d+)\s*=\s*(\d+(?:\.\d+)?)/)
      if (tempo) {
        const noteNumerator = Number(tempo[1])
        const noteDenominator = Number(tempo[2])
        const bpm = Number(tempo[3])
        if (noteNumerator > 0 && noteDenominator > 0 && bpm > 0) {
          secondsPerWhole = (60 * noteDenominator) / (bpm * noteNumerator)
        }
        return
      }
      tempo = trimmed.match(/=\s*(\d+(?:\.\d+)?)/)
      if (tempo) {
        const bpm = Number(tempo[1])
        if (bpm > 0) secondsPerWhole = 60 / bpm
        return
      }
      tempo = trimmed.match(/^(\d+(?:\.\d+)?)\s*$/)
      if (tempo) {
        const bpm = Number(tempo[1])
        if (bpm > 0) secondsPerWhole = 60 / bpm
      }
      return
    }
    if (field === 'V') handleVoice(value)
  }

  const handleComment = (line: string) => {
    const trimmed = line.trimStart()
    if (!trimmed.startsWith('%') || trimmed.startsWith('%%')) return
    const comment = trimmed.slice(1).trim()
    if (!SECTION_PATTERN.test(comment)) return
    const time = primaryVocal
      ? (cursors.get(primaryVocal) ?? 0)
      : (cursors.get(currentVoice) ?? 0)
    markers.push({ label: comment, time })
  }

  const parseMusic = (line: string) => {
    let index = 0
    while (index < line.length) {
      const character = line[index]
      if (character === '%') break
      if (/\s/.test(character)) {
        index += 1
        continue
      }
      if (character === '"') {
        const close = line.indexOf('"', index + 1)
        index = close === -1 ? line.length : close + 1
        continue
      }
      if (character === '[') {
        const close = line.indexOf(']', index + 1)
        const content = line.slice(index + 1, close === -1 ? line.length : close)
        if (/^[A-Za-z]\s*:/.test(content)) {
          const colon = content.indexOf(':')
          handleField(content[0], content.slice(colon + 1))
          index = close === -1 ? line.length : close + 1
          continue
        }
        let hasNote = false
        let lastFactor = 1
        let inner = 0
        while (inner < content.length) {
          const innerCharacter = content[inner]
          if (/[A-Ga-g]/.test(innerCharacter)) {
            hasNote = true
            inner += 1
            while (inner < content.length && (content[inner] === "'" || content[inner] === ',')) {
              inner += 1
            }
            const parsed = parseLength(content, inner)
            lastFactor = parsed.factor
            inner = parsed.next
          } else if (
            innerCharacter === 'z' ||
            innerCharacter === 'x' ||
            innerCharacter === 'X'
          ) {
            inner += 1
            const parsed = parseLength(content, inner)
            lastFactor = parsed.factor
            inner = parsed.next
          } else {
            inner += 1
          }
        }
        let after = close === -1 ? line.length : close + 1
        let factor = lastFactor
        if (after < line.length) {
          const parsed = parseLength(line, after)
          if (parsed.next > after) {
            factor = parsed.factor
            after = parsed.next
          }
        }
        addEvent(!hasNote, factor * defaultLength)
        index = after
        continue
      }
      if (character === '{') {
        const close = line.indexOf('}', index + 1)
        index = close === -1 ? line.length : close + 1
        continue
      }
      if (character === '!' || character === '+') {
        const close = line.indexOf(character, index + 1)
        index = close === -1 ? line.length : close + 1
        continue
      }
      if (character === 'Z') {
        let cursor = index + 1
        let count = ''
        while (cursor < line.length && line[cursor] >= '0' && line[cursor] <= '9') {
          count += line[cursor]
          cursor += 1
        }
        addEvent(true, (count ? Number(count) : 1) * measureLength)
        index = cursor
        continue
      }
      if (character === 'z' || character === 'x' || character === 'X') {
        const parsed = parseLength(line, index + 1)
        addEvent(true, parsed.factor * defaultLength)
        index = parsed.next
        continue
      }
      if (/[A-Ga-g]/.test(character)) {
        let cursor = index + 1
        while (cursor < line.length && (line[cursor] === "'" || line[cursor] === ',')) {
          cursor += 1
        }
        const parsed = parseLength(line, cursor)
        addEvent(false, parsed.factor * defaultLength)
        index = parsed.next
        continue
      }
      index += 1
    }
  }

  try {
    for (const raw of abc.split(/\r?\n/)) {
      const trimmedStart = raw.trimStart()
      if (trimmedStart.startsWith('%')) {
        handleComment(raw)
        continue
      }
      const field = raw.match(/^\s*([A-Za-z])\s*:\s*(.*)$/)
      if (field) {
        handleField(field[1], field[2])
        continue
      }
      parseMusic(raw)
    }
  } catch {
    return empty
  }

  const totalUnits = Math.max(0, ...Array.from(cursors.values()))
  const duration = totalUnits * secondsPerWhole
  const internalSections: ParsedSection[] = []

  if (markers.length > 0) {
    for (let index = 0; index < markers.length; index += 1) {
      const marker = markers[index]
      const startUnits = marker.time
      let endUnits = index + 1 < markers.length ? markers[index + 1].time : totalUnits
      if (endUnits < startUnits) endUnits = startUnits
      const isLast = index === markers.length - 1
      const sectionEvents = events.filter(
        (event) =>
          event.start >= startUnits - EPSILON &&
          (isLast ? event.start <= endUnits + EPSILON : event.start < endUnits - EPSILON),
      )
      const notes = sectionEvents.filter((event) => !event.rest)
      let vocalStart: number | undefined
      let vocalEnd: number | undefined
      const boundaries: number[] = []
      if (notes.length > 0) {
        vocalStart = Math.min(...notes.map((event) => event.start))
        vocalEnd = Math.max(...notes.map((event) => Math.min(event.end, endUnits)))
        if ((vocalEnd ?? 0) < (vocalStart ?? 0)) vocalEnd = vocalStart
        for (const note of notes) {
          boundaries.push(note.start * secondsPerWhole)
          boundaries.push(Math.min(note.end, endUnits) * secondsPerWhole)
        }
      }
      internalSections.push({
        label: marker.label,
        start: startUnits * secondsPerWhole,
        end: endUnits * secondsPerWhole,
        vocalStart: vocalStart === undefined ? undefined : vocalStart * secondsPerWhole,
        vocalEnd: vocalEnd === undefined ? undefined : vocalEnd * secondsPerWhole,
        hasVocal: notes.length > 0,
        boundaries: Array.from(new Set(boundaries)).sort((a, b) => a - b),
      })
    }
  } else {
    const notes = events.filter((event) => !event.rest)
    let vocalStart: number | undefined
    let vocalEnd: number | undefined
    const boundaries: number[] = []
    if (notes.length > 0) {
      vocalStart = Math.min(...notes.map((event) => event.start))
      vocalEnd = Math.max(...notes.map((event) => event.end))
      for (const note of notes) {
        boundaries.push(note.start * secondsPerWhole)
        boundaries.push(note.end * secondsPerWhole)
      }
    }
    internalSections.push({
      label: 'Song',
      start: 0,
      end: duration,
      vocalStart: vocalStart === undefined ? undefined : vocalStart * secondsPerWhole,
      vocalEnd: vocalEnd === undefined ? undefined : vocalEnd * secondsPerWhole,
      hasVocal: notes.length > 0,
      boundaries: Array.from(new Set(boundaries)).sort((a, b) => a - b),
    })
  }

  const sections: VocalSection[] = internalSections.map((section) => {
    const item: VocalSection = { label: section.label, start: section.start, end: section.end }
    if (section.vocalStart !== undefined) item.vocalStart = section.vocalStart
    if (section.vocalEnd !== undefined) item.vocalEnd = section.vocalEnd
    return item
  })
  const hasVocal = events.some((event) => !event.rest)
  const output: TimedLyricLine[] = []
  const lyricLines = parseLyrics(lyrics)

  if (lyricLines.length > 0) {
    const tagged = lyricLines.some((line) => line.tag !== undefined)
    if (tagged) {
      const groups: LyricGroup[] = []
      for (const lyric of lyricLines) {
        const text = lyric.text.trim()
        if (!text) continue
        const last = groups[groups.length - 1]
        if (last && last.tag === lyric.tag) last.lines.push(text)
        else groups.push({ tag: lyric.tag, lines: [text] })
      }
      let groupCursor = 0
      for (const group of groups) {
        if (group.lines.length === 0) continue
        const key = group.tag ? normalizeName(group.tag) : ''
        let target = -1
        if (key) {
          for (let index = groupCursor; index < internalSections.length; index += 1) {
            const section = internalSections[index]
            if (namesMatch(normalizeName(section.label), key)) {
              target = index
              break
            }
          }
        }
        if (target === -1) {
          for (let index = groupCursor; index < internalSections.length; index += 1) {
            if (internalSections[index].hasVocal) {
              target = index
              break
            }
          }
        }
        if (target === -1) continue
        if (internalSections[target].hasVocal) {
          distributeLines(group.lines, internalSections[target], output)
        }
        groupCursor = target + 1
      }
    } else {
      const vocalSections = internalSections.filter((section) => section.hasVocal)
      if (vocalSections.length > 0) {
        const weights = vocalSections.map((section) => {
          const start = section.vocalStart ?? section.start
          const end = section.vocalEnd ?? section.end
          return Math.max(end - start, EPSILON)
        })
        const texts = lyricLines.map((line) => line.text.trim()).filter((text) => text.length > 0)
        const counts = allocate(texts.length, weights)
        let offset = 0
        for (let index = 0; index < vocalSections.length; index += 1) {
          const count = counts[index]
          if (count > 0) {
            distributeLines(texts.slice(offset, offset + count), vocalSections[index], output)
          }
          offset += count
        }
      }
    }
  }

  return { duration, hasVocal, sections, lines: output }
}
