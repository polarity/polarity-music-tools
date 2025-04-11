/**
 * Text Maker
 * Controller script for Bitwig Studio
 * Type words in a text field and it will be converted to MIDI notes that show the "words" as notes
 * So you basically can write text with MIDI notes.
 *
 * @version 0.1
 * @author Polarity
 */
loadAPI(17)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Polarity', 'Text Maker', '0.1', 'f7b51a0c-a8d1-44b4-adb4-fb39760f0ef7', 'Polarity')

let scaleIntervals // will be filled in with scales from external file

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

// convert the scaleIntervals to semitones
const SCALE_MODES = convertIntervalsToSemitones(scaleIntervals)

// define the dropdown options for the ui
const listScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// convert scaleIntervals object to an array of names
// we need this for the dropdown in the UI
const listScaleMode = Object.keys(SCALE_MODES)

// store the generated notes in a global variable
const globalNoteData = []

/**
 * This method takes a text and some options and generates
 * notes for the piano roll that visually represent the text.
 * @param {Object} options - Configuration for the text generator
 */
function generate (options) {
  /** options = {
    scale, // the chosen scale
    scaleMode, // the chosen scale mode
    octaveStarts, // in which octave to start
    textField, // the text to convert to notes
    textWidth, // the width of the text
    textHeight, // the height of the text
    textType, // Normal or Italic
    textGap // number of 16th steps between chars
  } */

  // Clear previous note data
  globalNoteData.length = 0

  // Define a simple font where each letter is an array of coordinates
  // Each coordinate is [x, y] where x is horizontal position, y is vertical
  const font = {
    A: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [0, 6], [2, 0], [3, 6], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [1, 3], [2, 3]],
    B: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 0], [1, 3], [1, 6], [2, 0], [2, 3], [2, 6], [3, 1], [3, 2], [3, 4], [3, 5]],
    C: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 6], [2, 0], [2, 6], [3, 0], [3, 6]],
    D: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 0], [1, 6], [2, 0], [2, 6], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]],
    E: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 0], [1, 3], [1, 6], [2, 0], [2, 3], [2, 6], [3, 0], [3, 6]],
    F: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 0], [1, 3], [2, 0], [2, 3], [3, 0]],
    G: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 6], [2, 0], [2, 6], [3, 0], [3, 3], [3, 4], [3, 5], [3, 6], [2, 3]],
    H: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 3], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6]],
    I: [[0, 0], [0, 6], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 0], [2, 6]],
    J: [[0, 5], [1, 6], [2, 0], [2, 6], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]],
    K: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 3], [2, 2], [2, 4], [3, 0], [3, 1], [3, 5], [3, 6]],
    L: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 6], [2, 6], [3, 6]],
    M: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 1], [2, 2], [1, 3], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6]],
    N: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 1], [2, 2], [3, 3], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6]],
    O: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 6], [2, 0], [2, 6], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]],
    P: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 0], [1, 3], [2, 0], [2, 3], [3, 1], [3, 2]],
    Q: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 0], [1, 5], [2, 0], [2, 5], [2, 4], [3, 1], [3, 2], [3, 3], [3, 5], [3, 6]],
    R: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 0], [1, 3], [2, 0], [2, 3], [3, 1], [3, 2], [3, 4], [3, 5], [3, 6]],
    S: [[0, 1], [0, 2], [0, 6], [1, 0], [1, 3], [1, 6], [2, 0], [2, 3], [2, 6], [3, 0], [3, 4], [3, 5]],
    T: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6]],
    U: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 6], [2, 6], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]],
    V: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [2, 5], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]],
    W: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 6], [2, 5], [1, 4], [3, 6], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]],
    X: [[0, 0], [0, 1], [0, 5], [0, 6], [1, 2], [1, 4], [2, 3], [3, 2], [3, 4], [4, 0], [4, 1], [4, 5], [4, 6]],
    Y: [[0, 0], [0, 1], [1, 2], [2, 3], [2, 4], [2, 5], [2, 6], [3, 2], [4, 0], [4, 1]],
    Z: [[0, 0], [0, 6], [1, 0], [1, 5], [1, 6], [2, 0], [2, 4], [2, 6], [3, 0], [3, 3], [3, 6], [4, 0], [4, 1], [4, 2], [4, 6]],
    ' ': [],
    0: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 6], [2, 0], [2, 6], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]],
    1: [[1, 1], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [1, 6], [3, 6]],
    2: [[0, 1], [0, 6], [1, 0], [1, 6], [2, 0], [2, 5], [2, 6], [3, 0], [3, 4], [3, 3], [3, 2], [3, 1]],
    3: [[0, 0], [0, 6], [1, 0], [1, 6], [2, 0], [2, 3], [2, 6], [3, 1], [3, 2], [3, 4], [3, 5]],
    4: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6]],
    5: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 6], [1, 0], [1, 3], [1, 6], [2, 0], [2, 3], [2, 6], [3, 0], [3, 4], [3, 5]],
    6: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 0], [1, 3], [1, 6], [2, 0], [2, 3], [2, 6], [3, 0], [3, 4], [3, 5]],
    7: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [2, 3], [2, 4], [1, 5], [1, 6]],
    8: [[0, 1], [0, 2], [0, 4], [0, 5], [1, 0], [1, 3], [1, 6], [2, 0], [2, 3], [2, 6], [3, 1], [3, 2], [3, 4], [3, 5]],
    9: [[0, 1], [0, 2], [1, 0], [1, 3], [2, 0], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5]],
    '.': [[1, 5], [1, 6], [2, 5], [2, 6]],
    ',': [[1, 5], [1, 6], [1, 7], [2, 6], [2, 7]],
    '!': [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 6]],
    '?': [[0, 1], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [2, 3], [2, 4], [2, 6]],
    '-': [[1, 3], [2, 3], [3, 3]],
    '+': [[1, 3], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3, 3]],
    '=': [[1, 2], [2, 2], [3, 2], [1, 4], [2, 4], [3, 4]],
    ':': [[1, 2], [1, 3], [1, 5], [1, 6]],
    ';': [[1, 2], [1, 3], [1, 5], [1, 6], [1, 7]]
  }

  const rootNote = 24 + options.scale - 1 // MIDI root note
  const octaveStart = options.octaveStart * 12 // Octave offset
  const modeIntervals = SCALE_MODES[options.scaleMode] // Scale intervals

  const text = options.textField.toUpperCase()

  let currentPosition = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const charDef = font[char] || []

    if (charDef.length === 0 && char !== ' ') {
      currentPosition += 4 * options.textWidth
      continue
    }

    if (char === ' ') {
      currentPosition += 4 * options.textWidth
      continue
    }

    for (const [x, y] of charDef) {
      let scaledX = x * options.textWidth
      const invertedY = 6 - y // Invert Y-axis to match MIDI note representation

      // Apply italic slant if enabled
      if (options.textType === 'Italic') {
        const italicOffset = invertedY * (options.textWidth)
        scaledX += italicOffset
      }

      const position = Math.round(currentPosition + scaledX)
      const scaledY = invertedY * options.textHeight

      // Calculate pitch
      const scaleIndex = scaledY % modeIntervals.length
      const octaveOffset = Math.floor(scaledY / modeIntervals.length)
      const pitchOffset = modeIntervals[Math.abs(scaleIndex)]
      const pitch = rootNote + octaveStart + pitchOffset + (octaveOffset * 12)

      // Check if pitch is within MIDI range (0-127)
      if (pitch >= 0 && pitch <= 127) {
        // add notes to array
        globalNoteData.push({
          channel: 0,
          position: position,
          pitch: pitch,
          velocity: 60,
          length: 0.25
        })
      }
    }

    currentPosition += (5 * options.textWidth) + options.textGap // not the best way but hey it works
  }
}

/**
 * this function converts the scale intervals to semitones
 * so we can exchange the scale definitions easily
 * @param {*} scaleIntervals
 * @returns {Object} - converted scale intervals to semitones
 */
function convertIntervalsToSemitones (scaleIntervals) {
  const convertedScales = {}
  for (const [scaleName, intervals] of Object.entries(scaleIntervals)) {
    let current = 0
    const semitones = [current]
    for (const interval of intervals) {
      current += interval
      semitones.push(current)
    }
    semitones.pop() // Remove the octave (12 semitone step (same note lol))
    convertedScales[scaleName] = semitones
  }
  return convertedScales
}

/**
 * Write an array of notes to the specified Bitwig clip.
 * @param {Array} notesToWrite - Array of note objects { position, pitch, velocity, length }.
 * @param {Clip} cursorClip - Bitwig Studio cursor clip object to write the notes into.
 */
function writeNotesToClip (notesToWrite, cursorClip) {
  // Iterate through the notes and add them to the clip
  notesToWrite.forEach(note => {
    // Ensure note properties are valid before setting step
    if (note.position !== undefined && note.pitch !== undefined && note.velocity !== undefined && note.length !== undefined) {
      cursorClip.setStep(
        note.channel, // MIDI Channel
        note.position, // Start time in 16th steps
        note.pitch, // MIDI pitch (0-127)
        note.velocity, // Velocity (1-127)
        note.length // Duration in beats
      )
    }
  })
}

/*
 * init the Bitwig Controller script
 */
function init () {
  log('-- Text Maker Go! --')

  const documentState = host.getDocumentState()
  const cursorClipArranger = host.createArrangerCursorClip((16 * 30), 128)
  const cursorClipLauncher = host.createLauncherCursorClip((16 * 30), 128)
  cursorClipArranger.scrollToKey(0)
  cursorClipLauncher.scrollToKey(0)

  // define UI elements and their default values
  const selectedScaleMode = documentState.getEnumSetting('Scale Mode', 'Text Generator', listScaleMode, 'Major')
  const selectedScale = documentState.getEnumSetting('Scale', 'Text Generator', listScale, 'C')
  const clipType = documentState.getEnumSetting('Clip Type', 'Text Generator', ['Launcher', 'Arranger'], 'Arranger')
  const textType = documentState.getEnumSetting('Text Type', 'Text Generator', ['Normal', 'Italic'], 'Normal')
  const textField = documentState.getStringSetting('Text', 'Text Generator', 20, '')
  const octaveStart = documentState.getNumberSetting('Octave Start', 'Text Generator', 0, 5, 1, 'Oct', 3)
  const textGap = documentState.getNumberSetting('Text Gap', 'Text Generator', 1, 8, 1, 'Step(s)', 3)
  const textWidth = documentState.getNumberSetting('Text Width', 'Text Generator', 1, 8, 1, 'Step(s)', 1)
  const textHeight = documentState.getNumberSetting('Text Height', 'Text Generator', 1, 8, 1, 'Semitones', 1)

  /**
   * get the correct cursor clip based on the selected clip type
   * @returns {CursorClip} - the cursor clip based on the selected clip type
   */
  function getCursorClip () {
    const clip = clipType.get() === 'Arranger' ? cursorClipArranger : cursorClipLauncher
    return clip
  }

  // define the generate button for the Arranger
  documentState.getSignalSetting('Execute', 'Text Generator', 'Write!').addSignalObserver(() => {
    // generate notes
    generate({
      scale: parseInt(listScale.indexOf(selectedScale.get())) + 1, // the chosen scale
      scaleMode: selectedScaleMode.get(), // the chosen scale mode
      octaveStart: octaveStart.getRaw(), // in which octave to start
      textField: textField.get(), // the text to convert to notes
      textWidth: textWidth.getRaw(), // the width of the text
      textHeight: textHeight.getRaw(), // the height of the text
      textType: textType.get(), // Normal or Italic
      textGap: textGap.getRaw() // number of 16th steps between chars
    })

    // write the generated notes to the clip
    writeNotesToClip(globalNoteData, getCursorClip())
  })

  // define the generate button for the Arranger
  documentState.getSignalSetting('Clear', 'Text Generator', 'Clear').addSignalObserver(() => {
    // clear all notes from the clip
    getCursorClip().clearSteps()
  })
}

function log (text, obj) {
  println(text + ' : ' + JSON.stringify(obj), 2)
}

function flush () {
  // nothing to do here
}

function exit () {
  println('-- Melody Maker Bye! --')
}
