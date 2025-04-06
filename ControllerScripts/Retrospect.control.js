/**
 * Retrospective Recording v0.2
 * - added support for key filtering to specific scales
 * @version 0.2
 * @author Polarity
 **/

loadAPI(17)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Polarity', 'Retrospect', '0.1', 'bad8f3f8-3bf2-4d4d-a4fb-2a6a64b4222c', 'Polarity')
host.defineMidiPorts(1, 0)

// Define the dropdown options for the UI
const listScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const booleanOption = ['No', 'Yes']

/**
 * will be filled in with scales from external file
 * @type {{[key: string]: number[]}}
 */
let scaleIntervals = {}

/**
 * @type {API.NoteInput | null}
 */
let bitwigNoteInput = null

// load in the external scales.js file
load('scales.js')

// check if scaleIntervals is defined and not empty
// make sure to load the scales.js file before this script
if (!scaleIntervals || Object.keys(scaleIntervals).length === 0) {
  scaleIntervals = {
    Lydian: [2, 2, 2, 1, 2, 2, 1], // Major scale with raised 4th
    Major: [2, 2, 1, 2, 2, 2, 1], // Major scale
    Mixolydian: [2, 2, 1, 2, 2, 1, 2], // Major scale with lowered 7th
    Dorian: [2, 1, 2, 2, 2, 1, 2], // Major scale with lowered 3rd and 7th
    'Natural Minor': [2, 1, 2, 2, 1, 2, 2], // Major scale with lowered 3rd, 6th and 7th
    Phrygian: [1, 2, 2, 2, 1, 2, 2], // Major scale with lowered 2nd, 3rd, 6th and 7th
    Locrian: [1, 2, 2, 1, 2, 2, 2], // Major scale with lowered 2nd, 3rd, 5th, 6th and 7th
    Chromatic: [1], // All 12 notes - leave this last
    Ionian: [2, 2, 1, 2, 2, 2, 1], // Major scale (legacy)
    Aeolian: [2, 1, 2, 2, 1, 2, 2] // Minor (legacy)
  }
}

// convert scaleIntervals object to an array of names
// we need this for the dropdown in the UI
const listScaleMode = Object.keys(scaleIntervals)

/**
 * hold the generated scale notes globally
 * @type {number[]}
 */
let scaleNotes = []

/**
 * @type {boolean | null}
 */
let FilterKeys = null

let currentTempo = 120

/**
 * @typedef {Object} Event
 * @property {string} type
 * @property {string} state
 * @property {number} channel
 * @property {number} pitch
 * @property {number} velocity
 * @property {number} timestamp
 * @property {boolean} paired
 * @property {number} [duration]
 */

/**
 * @type {Array<Event>}
 */
let currentBuffer = []

let lastMidiUpdateTime = Date.now()

/**
 * Generate notes in the scale
 * @param {number} rootNote - Root note of the scale (0-127)
 * @param {number[]} intervals - Array of intervals for the scale
 * @returns {number[]} Array of note numbers in ascending order
 */
function generateScaleNotes (rootNote, intervals) {
  const sumIntervals = intervals.reduce((a, b) => a + b, 0)
  const isOctaveRepeating = sumIntervals === 12

  return isOctaveRepeating
    ? generateOctaveRepeatingScale(rootNote, intervals)
    : generateNonOctaveRepeatingScale(rootNote, intervals)
}

/**
 * Generate notes for octave-repeating scales (e.g., major, minor, chromatic)
 * @param {number} rootNote - Root note of the scale (0-127)
 * @param {number[]} intervals - Array of intervals for the scale
 * @returns {number[]} Array of note numbers in ascending order
 */
function generateOctaveRepeatingScale (rootNote, intervals) {
  // Generate scale notes within one octave
  const octaveNotes = buildOctaveNotes(rootNote, intervals)

  // Create all octave variations of these notes within MIDI range
  return expandToAllOctaves(octaveNotes)
}

/**
 * Generate notes for non-octave-repeating scales (e.g., whole-tone, exotic scales)
 * @param {number} rootNote - Root note of the scale (0-127)
 * @param {number[]} intervals - Array of intervals for the scale
 * @returns {number[]} Array of note numbers in ascending order
 */
function generateNonOctaveRepeatingScale (rootNote, intervals) {
  const notes = new Set([rootNote])

  // Generate notes in both directions from root
  generateDirectionalNotes(notes, rootNote, intervals, 'ascending')
  generateDirectionalNotes(notes, rootNote, [...intervals].reverse(), 'descending')

  return Array.from(notes).sort((a, b) => a - b)
}

/**
 * Build base notes within one octave
 * @param {number} rootNote - Root note of the scale (0-127)
 * @param {number[]} intervals - Array of intervals for the scale
 * @returns {number[]} Array of note numbers in ascending order
 */
function buildOctaveNotes (rootNote, intervals) {
  const notes = [rootNote]
  let current = rootNote

  for (const interval of intervals) {
    current += interval
    notes.push(current)
  }
  return notes
}

/**
 * Expand octave notes to all MIDI octaves
 * @param {number[]} notes - Array of note numbers in one octave
 * @returns {number[]} Array of note numbers in ascending order
 */
function expandToAllOctaves (notes) {
  const allNotes = new Set()

  for (const note of notes) {
    const base = note % 12
    // Calculate valid octaves for this note
    const minOctave = Math.ceil((0 - base) / 12)
    const maxOctave = Math.floor((127 - base) / 12)

    // Add all valid octave variations
    for (let octave = minOctave; octave <= maxOctave; octave++) {
      const midiNote = base + octave * 12
      if (midiNote >= 0 && midiNote <= 127) {
        allNotes.add(midiNote)
      }
    }
  }

  return Array.from(allNotes).sort((a, b) => a - b)
}

/**
 * Generate notes in one direction (ascending/descending)
 * @param {Set<number>} notes - Set of note numbers
 * @param {number} startNote - Starting note number
 * @param {number[]} intervals - Array of intervals for the scale
 * @param {string} direction - 'ascending' or 'descending'
 * @returns {void} - adds notes to the set
 */
function generateDirectionalNotes (notes, startNote, intervals, direction) {
  let current = startNote
  let index = 0

  while (true) {
    const interval = intervals[index % intervals.length]
    current = direction === 'ascending' ? current + interval : current - interval

    // Stop when out of MIDI range
    if (current < 0 || current > 127) break

    notes.add(current)
    index++
  }
}

/**
 * Calculate the current buffer window in ms
 * @returns the current buffer window in ms
 */
function getCurrentBufferWindow () {
  return 16 * 4 * (60000 / currentTempo) // 8 bars in ms
}

/**
 * onMidi Event handler for incoming midi messages from the midi controller
 * @param {*} status - status of the midi message
 * @param {*} data1 - note number (0-127) 60 is middle C
 * @param {*} data2 - velocity (0-127)
 */
function onMidi (status, data1, data2) {
  const channel = status & 0xF
  const messageType = status & 0xF0
  const now = Date.now()

  // we do have all the notes of the selected scale
  // in the scaleNotes array. So we can check if the note
  // is in the scale or not. If not we can move to the next
  // note in the scale.
  if (FilterKeys && scaleNotes.length > 0) {
    if (scaleNotes.length > 0) {
    // if the note is not in the scale, move to the next note in the scale
      if (!scaleNotes.includes(data1)) {
      // find the next bigger note number in the array
        const nextNote = scaleNotes.find(note => note > data1)
        // if the next note is found, use it
        if (nextNote) {
          data1 = nextNote
        } else {
        // if the next note is not found, use the first note in the scale
          data1 = scaleNotes[0]
        }
      }
    }
  }

  // send notes to Bitwig note input!
  // because we blocked the passthrough with setKeyTranslationTable()
  bitwigNoteInput?.sendRawMidiEvent(status, data1, data2)

  // Update buffer window
  const cutoffTime = now - getCurrentBufferWindow()

  // process note events
  if (messageType === 0x90 && data2 > 0) {
    // Note On Events - store with timestamp
    currentBuffer.push({
      type: 'note',
      state: 'on',
      channel,
      pitch: data1,
      velocity: data2,
      timestamp: now,
      paired: false
    })
  } else if (messageType === 0x80 || (messageType === 0x90 && data2 === 0)) {
    // Note Off Events - find matching Note On (compatible version)
    // remember the time of this update
    lastMidiUpdateTime = now
    let noteOn = null

    // find the note on event that matches the note off event
    // user released the key, find the note on event and calculate the duration
    for (let i = currentBuffer.length - 1; i >= 0; i--) {
      const event = currentBuffer[i]
      if (event.type === 'note' && event.state === 'on' && event.pitch === data1 && event.channel === channel && !event.paired) {
        noteOn = event
        break // found the note on event, break the loop
      }
    }
    // if we found the note on event, calculate the duration
    if (noteOn) {
      // mark the note on event as paired
      noteOn.paired = true
      // calculate the duration of the note
      noteOn.duration = now - noteOn.timestamp
    }
  }

  // Cleanup: Remove old/unpaired events
  currentBuffer = currentBuffer.filter(event => {
    if (event.timestamp < cutoffTime) return false
    if (event.state === 'on' && !event.paired) return true
    return event.duration !== undefined
  })
}

/**
 * Write the generated notes to the cursor clip
 * @param {Array<Event>} notes - array of note objects
 * @param {*} cursorClip - cursor clip to write the notes to
 */
function writeNotesToClip (notes, cursorClip) {
  cursorClip.clearSteps()

  // if there are no notes, return
  if (notes.length === 0) return

  // get the start of the buffer window
  const bufferStart = lastMidiUpdateTime - getCurrentBufferWindow()

  // calculate the ms per 16th note with the current tempo
  // of the project (in bpm)
  const msPer16th = (60000 / currentTempo) / 4

  notes.forEach(note => {
    if (!note.duration) return

    const position = (note.timestamp - bufferStart) / msPer16th

    // when position is negative, it means the note was played before the buffer window
    // so make it start at 0 and make the length shorter by the ammount of the negative position.
    // or nah, lets skip it
    if (position < 0) return

    // if the note duration is longer than the buffer window, truncate it
    if (note.duration > getCurrentBufferWindow()) {
      note.duration = getCurrentBufferWindow()
    }

    // if the note duration is shorter that 0, skip it
    if (note.duration <= 0) return

    // calculate the length of the note in 16th notes
    const length = note.duration / (60000 / currentTempo)

    // write the note in the cursor clip
    cursorClip.setStep(
      note.channel,
      Math.floor(position),
      note.pitch,
      note.velocity,
      length
    )
  })
}

function init () {
  println('Retrospective Rec ready!')

  // Creates a note input that appears in the track input choosers in Bitwig Studio.
  // dont consume the events so that setMidiCallback can still receive the events
  bitwigNoteInput = host.getMidiInPort(0).createNoteInput('Keyboard')
  bitwigNoteInput.setShouldConsumeEvents(false)

  // block all notes (0-127) by default (set to -1 to filter them out)
  bitwigNoteInput.setKeyTranslationTable(Array(128).fill(-1))

  // Registers a callback that is called when a MIDI message is received on the MIDI input port.
  host.getMidiInPort(0).setMidiCallback(onMidi)

  const documentState = host.getDocumentState()
  const transport = host.createTransport()
  const cursorClipArranger = host.createArrangerCursorClip((16 * 16), 128)
  const cursorClipLauncher = host.createLauncherCursorClip((16 * 16), 128)

  const selectedScaleMode = documentState.getEnumSetting('Scale Mode', 'Retrospect', listScaleMode, 'Major')
  const selectedScale = documentState.getEnumSetting('Scale', 'Retrospect', listScale, 'C')
  const keyFilter = documentState.getEnumSetting('Key Filter', 'Retrospect', booleanOption, 'No')
  const clipType = documentState.getEnumSetting('Clip Type', 'Retrospect', ['Launcher', 'Arranger'], 'Arranger')

  // grab the bpm from the transport
  // @ts-ignore
  transport.tempo().value().addValueObserver((tempo) => {
    // get the tempo in raw format. the thing is tempo is from 0 to 1
    // 0 represents 20 bpm and 1 represents 666 bpm
    const actualBpm = Math.round((20 + (tempo * 646)) * 100) / 100 // round to 2 decimal places
    currentTempo = actualBpm
  })

  /**
   * Get the cursor clip based on the selected clip type
   * @returns the cursor clip based on the selected clip type
   */
  function getCursorClip () {
    return clipType.get() === 'Arranger' ? cursorClipArranger : cursorClipLauncher
  }

  // add observers to the selected key filter
  keyFilter.addValueObserver((filter) => {
    FilterKeys = filter === 'Yes'
  })

  // add observers to the selected scale mode
  selectedScaleMode.addValueObserver((scaleMode) => {
    // get root note as midi note number
    const rootIndex = listScale.indexOf(selectedScale.get())
    const rootNote = 60 + rootIndex

    // generate scale notes based on the root note and scale intervals as an array
    // hold it globally
    scaleNotes = generateScaleNotes(rootNote, scaleIntervals[scaleMode])
  })

  // add observers to the selected scale and scale mode
  selectedScale.addValueObserver((_scale) => {
    // get root note as midi note number
    const rootIndex = listScale.indexOf(selectedScale.get())
    const rootNote = 60 + rootIndex

    // generate scale notes based on the root note and scale intervals as an array
    // hold it globally
    scaleNotes = generateScaleNotes(rootNote, scaleIntervals[selectedScaleMode.get()])
  })

  /**
   * Signal observer to repaint the current chord progression.
   * This function is called when the user wants to repaint the current chord progression
   */
  documentState.getSignalSetting('Paint Notes', 'Retrospect', 'repaint!').addSignalObserver(() => {
    writeNotesToClip(currentBuffer, getCursorClip())
  })
}

/**
 * @param {String} text
 * @param {Object} [obj]
 */
function log (text, obj) {
  println(text + ' : ' + JSON.stringify(obj))
}
function flush () {}
function exit () {
  println('-- Retrospective Rec Bye! --')
}
