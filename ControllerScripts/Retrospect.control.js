/*
 * Retrospective Recording v0.1
 * Fixed timestamp handling and position calculation
 */
loadAPI(17)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Polarity', 'Retrospect', '0.1', 'bad8f3f8-3bf2-4d4d-a4fb-2a6a64b4222c', 'Polarity')
host.defineMidiPorts(1, 0)

// Define the dropdown options for the UI
const listScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const booleanOption = ['No', 'Yes']
let scaleIntervals

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

let currentTempo = 120
let currentBuffer = []
let lastMidiUpdateTime = Date.now()

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
 * @param {*} channelNumber - channel number of the note
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
  host.getMidiInPort(0).createNoteInput('Keyboard').setShouldConsumeEvents(false)

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

  /**
   * Signal observer to repaint the current chord progression.
   * This function is called when the user wants to repaint the current chord progression
   */
  documentState.getSignalSetting('Paint Notes', 'Retrospect', 'repaint!').addSignalObserver(() => {
    // log('Paint Notes', currentBuffer)
    writeNotesToClip(currentBuffer, getCursorClip())
  })
}

function log (text, obj) {
  println(text + ' : ' + JSON.stringify(obj), 2)
}
function flush () {}
function exit () {
  println('-- Chord Maker Bye! --')
}
