/**
 * Melody Maker
 * controller script for Bitwig Studio
 * Generates random melodies based on the given parameters
 * @version 0.1
 * @author Polarity
 */
loadAPI(17)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Polarity', 'Melody Maker', '0.1', '1f73b4d7-0cfe-49e6-bf70-f7191bdb3a24', 'Polarity')

// define the dropdown options for the ui
const listScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// load in the external scales.js file
try {
  load('scales.js')
} catch (e) {
  println('Error loading scales.js')
}

// check if the scaleIntervals are already defined via the scales.js file
// if not we define them here
if (typeof scaleIntervals === 'undefined') {
  const scaleIntervals = {
    Lydian: [2, 2, 2, 1, 2, 2, 1], // Major scale with raised 4th
    Major: [2, 2, 1, 2, 2, 2, 1], // Major scale
    Mixolydian: [2, 2, 1, 2, 2, 1, 2], // Major scale with lowered 7th
    Dorian: [2, 1, 2, 2, 2, 1, 2], // Major scale with lowered 3rd and 7th
    'Natural Minor': [2, 1, 2, 2, 1, 2, 2], // Major scale with lowered 3rd, 6th and 7th
    Phrygian: [1, 2, 2, 2, 1, 2, 2], // Major scale with lowered 2nd, 3rd, 6th and 7th
    Locrian: [1, 2, 2, 1, 2, 2, 2], // Major scale with lowered 2nd, 3rd, 5th, 6th and 7th
    'Harmonic Minor': [2, 1, 2, 2, 1, 3, 1], // Major scale with lowered 3rd and 6th
    'Melodic Minor': [2, 1, 2, 2, 2, 2, 1], // Major scale with lowered 3rd
    'Double Harmonic Minor': [1, 3, 1, 2, 1, 3, 1], // Major scale with lowered 2nd and 6th
    'Double Harmonic Major': [1, 3, 1, 2, 1, 3, 1], // Major scale with raised 4th and 7th
    'Phrygian Dominant': [1, 3, 1, 2, 1, 2, 2], // Major scale with lowered 2nd and 6th
    'Mixolydian Flat 6': [2, 2, 1, 2, 1, 2, 2], // Major scale with lowered 7th
    'Lydian Dominant': [2, 2, 2, 1, 2, 1, 2], // Major scale with raised 4th and lowered 7th
    'Lydian Diminished': [2, 1, 3, 1, 1, 2, 1], // W-H-3H-H-H-W-H
    'Lydian Augmented': [2, 2, 2, 2, 1, 2, 1], // W-W-W-W-H-W-H
    'Whole Tone': [2, 2, 2, 2, 2, 2],
    'Major Whole Tone': [2, 2, 1, 2, 1, 2, 1],
    'Minor Whole Tone': [2, 1, 2, 1, 2, 2, 2],
    Hirajoshi: [4, 2, 3, 4, 3],
    'Major Pentatonic': [2, 2, 3, 2, 3],
    'Minor Pentatonic': [3, 2, 2, 3, 2],
    Blues: [3, 2, 1, 1, 3, 2],
    Arabic: [2, 1, 3, 1, 2, 2, 1],
    Persian: [1, 3, 1, 1, 2, 3, 1], // H-3H-H-H-W-3H-H
    Prometheus: [2, 2, 2, 3, 1, 2], // W-W-W-3H-H-W
    Pelog: [1, 2, 4, 1, 4],
    Chromatic: [1] // All 12 notes - leave this last
  }
}

// convert the scaleIntervals to semitones
const SCALE_MODES = convertIntervalsToSemitones(scaleIntervals)

// convert scaleIntervals object to an array of names
// we need this for the dropdown in the UI
const listScaleMode = Object.keys(SCALE_MODES)

// store the generated notes in a global variable
let globalNoteData = []

/**
 * Generate a note sequence based on the given parameters
 *
 * @param {*} param0 - object with all the parameters for the note generation
 * @returns {Array} - array of note objects
 */
function generateNoteSequence ({
  scale,
  scaleMode,
  octaveStart,
  octaveRange,
  probability,
  restProbability,
  lengthInBars,
  repetitionChance,
  noteLengthVariation,
  channelNumber,
  allowRepeatNotes = false
}) {
  // Reset global data
  globalNoteData = []

  // Calculate the base note value based on the scale and octave
  const baseNote = (scale - 1) + (octaveStart + 1) * 12

  // Store the last pitch to avoid repeating the same note
  let lastPitch = null

  // Generate a random index based on the given weights
  const weightedRandom = weights => {
    const sum = weights.reduce((a, b) => a + b, 0)
    let rand = Math.random() * sum
    return weights.findIndex(w => (rand -= w) < 0)
  }

  /**
   * Calculate the note length based on the given probability
   * @param {number} noteLengthVariation - note length variation intensity
   * @returns {number} - note length in bars
   */
  const getNoteLength = () => {
    const lengthOptions = [
      { value: 0.25, weight: Math.max(0, 100 - noteLengthVariation) },
      { value: 0.5, weight: noteLengthVariation * 0.6 },
      { value: 1, weight: noteLengthVariation * 0.3 },
      { value: 2, weight: noteLengthVariation * 0.1 }
    ]

    // Normalize weights
    const weights = lengthOptions.map(opt => opt.weight)

    // Return a random length based on the weights
    return lengthOptions[weightedRandom(weights)].value
  }

  /**
   * Calculate the pitch value based on the given probability and scale mode
   * Also handles the octave range and note repetition
   * @returns {number} - pitch value between 0 and 127
   */
  const calculatePitch = () => {
    const degreeIndex = weightedRandom(probability.map(p => p / 100))
    const interval = SCALE_MODES[scaleMode][degreeIndex % SCALE_MODES[scaleMode].length]
    const octaveOffset = Math.floor(Math.random() * octaveRange)
    let pitch = baseNote + interval + (12 * octaveOffset)

    // Avoid repeating the same note
    if (!allowRepeatNotes && lastPitch === pitch) {
      const alternatives = [
        pitch + 7, // Perfect Fifth
        pitch - 7,
        pitch + 5, // Perfect Fourth
        pitch - 5,
        pitch + 12, // Octave up
        pitch - 12 // Octave down
      ].filter(p => p >= 0 && p <= 127)

      // Pick a random alternative if available
      if (alternatives.length > 0) {
        pitch = alternatives[Math.floor(Math.random() * alternatives.length)]
      }
    }

    // Store the last pitch for the next iteration
    lastPitch = pitch

    // Return the pitch value clamped between 0 and 127
    return Math.min(127, Math.max(0, pitch))
  }

  // Initializations
  const totalSteps = lengthInBars * 16
  let currentPosition = 0
  const history = []

  // Main loop
  // Generate notes until the total steps are reached
  // or the history is empty
  while (currentPosition < totalSteps) {
    // Handle repetitions
    if (history.length > 1 && Math.random() * 100 < repetitionChance) {
      const repeatLength = Math.min(history.length, Math.floor(Math.random() * 4) + 1)
      const source = history.slice(-repeatLength)

      // Repeat the last notes
      for (const note of source) {
        // Check if the note fits in the remaining steps
        if (currentPosition >= totalSteps) break
        const stepsNeeded = (note.length / 0.25)

        // Check if the note fits in the remaining steps
        if (Math.random() * 100 > restProbability) {
          // Add the repeated note to the global data
          globalNoteData.push({
            position: currentPosition,
            pitch: note.pitch,
            velocity: note.velocity,
            length: note.length
          })
        }

        // Move the current position
        currentPosition += stepsNeeded
      }
      continue
    }

    // Generate new note
    const noteLength = getNoteLength()
    const stepsNeeded = noteLength / 0.25

    // Check if the note fits in the remaining steps
    if (currentPosition + stepsNeeded > totalSteps) {
      currentPosition = totalSteps
      break
    }

    // Check if the note should be a rest
    if (Math.random() * 100 > restProbability) {
      const velocity = 25 + Math.floor(Math.random() * 70)
      const pitch = calculatePitch()

      // Add the note to the global data
      globalNoteData.push({
        position: currentPosition,
        pitch: pitch,
        velocity: velocity,
        length: noteLength
      })

      // Add the note to the history
      history.push({
        pitch: pitch,
        velocity: velocity,
        length: noteLength
      })
    }
    // Move the current position
    currentPosition += stepsNeeded

    // Remove the oldest note from the history
    if (history.length > 8) history.shift()
  }

  // Return the generated note data
  return globalNoteData
}

/**
 * Write the generated notes to the cursor clip
 * @param {*} channelNumber - channel number of the note
 * @param {*} cursorClip - cursor clip to write the notes to
 */
function writeNotesToClip (channelNumber, cursorClip) {
  globalNoteData.forEach(note => {
    cursorClip.setStep(
      channelNumber,
      note.position,
      note.pitch,
      note.velocity,
      note.length
    )
  })
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

/*
 * init the Bitwig Controller script
 */
function init () {
  println('-- Melody Maker Go! --')

  const documentState = host.getDocumentState()
  const cursorClipArranger = host.createArrangerCursorClip((16 * 8), 128)
  const cursorClipLauncher = host.createLauncherCursorClip((16 * 8), 128)
  cursorClipArranger.scrollToKey(0)
  cursorClipLauncher.scrollToKey(0)

  // define UI elements and their default values
  const selectedScaleMode = documentState.getEnumSetting('Scale Mode', 'Melody Generator', listScaleMode, 'Major')
  const selectedScale = documentState.getEnumSetting('Scale', 'Melody Generator', listScale, 'C')
  const restProbability = documentState.getNumberSetting('Rest Probability', 'Melody Generator', 0, 100, 0.1, '%', 0)
  const repetitionChance = documentState.getNumberSetting('Repetition', 'Melody Generator', 0, 100, 0.1, '%', 0)
  const noteLengthVariation = documentState.getNumberSetting('Note Length Variation', 'Melody Generator', 0, 100, 0.1, '%', 0)
  const octaveStart = documentState.getNumberSetting('Octave Start', 'Melody Generator', 0, 8, 1, 'Octave', 3)
  const octaveRange = documentState.getNumberSetting('Octave Range', 'Melody Generator', 1, 4, 1, 'Octaves', 1)
  const barsToGenerate = documentState.getNumberSetting('How Many Bars?', 'Melody Generator', 1, 8, 1, 'Bar(s)', 1)
  const allowRepeatNotes = documentState.getEnumSetting('Allow Repeating Notes', 'Melody Generator', ['Yes', 'No'], 'No')
  const noteProb1 = documentState.getNumberSetting('1rd Probability Tonic', 'Melody Generator', 0, 100, 0.1, '%', 30)
  const noteProb2 = documentState.getNumberSetting('2nd Probability Supertonic', 'Melody Generator', 0, 100, 0.1, '%', 10)
  const noteProb3 = documentState.getNumberSetting('3rd Probability Mediant', 'Melody Generator', 0, 100, 0.1, '%', 10)
  const noteProb4 = documentState.getNumberSetting('4th Probability Subdominant', 'Melody Generator', 0, 100, 0.1, '%', 20)
  const noteProb5 = documentState.getNumberSetting('5th Probability Dominant', 'Melody Generator', 0, 100, 0.1, '%', 20)
  const noteProb6 = documentState.getNumberSetting('6th Probability Submediant', 'Melody Generator', 0, 100, 0.1, '%', 5)
  const noteProb7 = documentState.getNumberSetting('7th Probability Leading Note ', 'Melody Generator', 0, 100, 0.1, '%', 5)
  const clipType = documentState.getEnumSetting('Clip Type', 'Melody Generator', ['Launcher', 'Arranger'], 'Arranger')

  /**
   * get the correct cursor clip based on the selected clip type
   * @returns {CursorClip} - the cursor clip based on the selected clip type
   */
  function getCursorClip () {
    return clipType.get() === 'Arranger' ? cursorClipArranger : cursorClipLauncher
  }

  /**
   * Generate a new melody based on the given parameters
   * we use this method for the two button actions
   * generating for a launcher clip or arranger clip
   * not sure why this is split up lol (maybe im dumb)
   */
  const generate = () => {
    // generate new notes
    generateNoteSequence({
      scale: parseInt(listScale.indexOf(selectedScale.get())) + 1, // the chosen scale
      scaleMode: selectedScaleMode.get(), // the chosen scale mode
      octaveStart: octaveStart.getRaw(), // in which octave to start
      octaveRange: octaveRange.getRaw(), // how many octaves to use
      probability: [
        (noteProb1.get() * 100), // probability for each note in the scale
        (noteProb2.get() * 100),
        (noteProb3.get() * 100),
        (noteProb4.get() * 100),
        (noteProb5.get() * 100),
        (noteProb6.get() * 100),
        (noteProb7.get() * 100)
      ],
      restProbability: (restProbability.get() * 100), // how likely a rest is
      lengthInBars: barsToGenerate.getRaw(), // how many bars to generate (you need to adust host.createArrangerCursorClip(16, 128) also)
      repetitionChance: (repetitionChance.get() * 100), // how likely a repetition is
      noteLengthVariation: (noteLengthVariation.get() * 100), // how much the note length can vary
      channelNumber: 0, // the channel number to write the notes to (midi channel)
      allowRepeatNotes: (allowRepeatNotes.get() === 'Yes') // allow repeating notes
    })
  }

  // define the generate button for the Arranger
  documentState.getSignalSetting('Generate!!', 'Melody Generator', 'Generate in Arranger!').addSignalObserver(() => {
    // clear all notes from the clip
    getCursorClip().clearSteps()
    // generate new notes
    generate()
    // write the generated notes to the clip
    writeNotesToClip(0, getCursorClip())
  })

  // define the repaint button
  documentState.getSignalSetting('Repaint', 'Melody Generator', 'Repaint Arranger!').addSignalObserver(() => {
    // clear all notes from the clip
    getCursorClip().clearSteps()
    // write the generated notes to the clip
    writeNotesToClip(0, getCursorClip())
  })
}

function flush () {
  // nothing to do here
}

function exit () {
  println('-- Melody Maker Bye! --')
}
