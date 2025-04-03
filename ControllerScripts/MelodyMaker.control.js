/**
 * Melody Maker
 * controller script for Bitwig Studio
 * Generates random melodies based on the given parameters
 * @version 0.3
 * @author Polarity
 * @todo: increase weight of the tonic (1st note) on important rhythmical positions
 * @todo: add a way to limit interval jumps
 * @todo: melody contour shape (up, down, up-down, down-up, random, legacy)
 * @todo: motive development (repeat, invert, retrograde, etc.)
 */
loadAPI(17)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Polarity', 'Melody Maker', '0.3', '1f73b4d7-0cfe-49e6-bf70-f7191bdb3a24', 'Polarity')

// define the dropdown options for the ui
const listScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
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
  velocityRandomness,
  channelNumber,
  allowRepeatNotes = false,
  rhythmicEmphasis = 0
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
   * @param {number} position - Current position in 16th notes
   * @returns {number} - pitch value between 0 and 127
   */
  const calculatePitch = (position) => {
    // Create a copy of the probabilities so we can modify them
    const adjustedProbability = [...probability]

    // Check if current position is a rhythmically important position (1st beat of bar or every 4th 16th note)
    const isImportantBeat = position % 4 === 0

    // If this is an important beat and rhythmic emphasis is enabled, adjust probabilities
    if (isImportantBeat && rhythmicEmphasis > 0) {
      // Find the tonic, fifth, and fourth scale degrees
      const tonicIndex = 0 // First scale degree (tonic) is always index 0

      // Find the fifth (typically index 4 in diatonic scales) and fourth (typically index 3)
      let fifthIndex = -1
      let fourthIndex = -1

      // Get the scale semitones
      const scaleNotes = SCALE_MODES[scaleMode]

      // Find fifth (7 semitones from tonic) and fourth (5 semitones from tonic)
      for (let i = 0; i < scaleNotes.length; i++) {
        if (scaleNotes[i] === 7) fifthIndex = i
        if (scaleNotes[i] === 5) fourthIndex = i
      }

      // Calculate emphasis factor (0-1)
      const emphasisFactor = rhythmicEmphasis / 100

      // Adjust probabilities - increase tonic, fifth, and fourth
      if (tonicIndex >= 0) adjustedProbability[tonicIndex] += 50 * emphasisFactor
      if (fifthIndex >= 0) adjustedProbability[fifthIndex] += 30 * emphasisFactor
      if (fourthIndex >= 0) adjustedProbability[fourthIndex] += 20 * emphasisFactor
    }

    // Use the adjusted probabilities for note selection
    const degreeIndex = weightedRandom(adjustedProbability.map(p => p / 100))
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
      const baseVelocity = 64 // Base velocity (default value)
      const randomRange = 70 // Random range for velocity
      const originalRandomVelocity = 25 + Math.floor(Math.random() * randomRange)
      const randomnessFactor = velocityRandomness / 100 // Slider value between 0 and 1

      // Calculate the new velocity based on the randomness factor
      const calculatedVelocity = baseVelocity * (1 - randomnessFactor) + originalRandomVelocity * randomnessFactor
      // Clamp the velocity to the range of 1 to 127
      const velocity = Math.max(1, Math.min(127, Math.round(calculatedVelocity)))

      // Pass the current position to calculatePitch for rhythmic emphasis
      const pitch = calculatePitch(currentPosition)

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
 * Generates a variation of a given melody by changing some notes
 * to adjacent notes within the specified scale.
 * @param {Array} originalNotes - The original array of note objects.
 * @param {string} scaleMode - The name of the scale mode (e.g., 'Major').
 * @param {string} scaleKey - The root note of the scale (e.g., 'C').
 * @param {number} changeProbability - Probability (0-1) of changing any given note.
 * @returns {Array} - A new array of note objects representing the variation.
 */
function generateAlternativeMelody (originalNotes, scaleMode, scaleKey, changeProbability = 0.25) {
  const scaleSemitones = SCALE_MODES[scaleMode]
  const scaleKeyIndex = listScale.indexOf(scaleKey) // 0 for C, 1 for C#, etc.
  const alternativeNotes = []

  // Validate scale data
  if (!scaleSemitones || scaleSemitones.length === 0) {
    println('Error in generateAlternativeMelody: Scale mode not found or empty: ' + scaleMode)
    return originalNotes // Return original if scale is invalid
  }

  // Iterate through each note of the original melody
  for (const note of originalNotes) {
    // Decide randomly whether to change this note
    if (Math.random() < changeProbability && scaleSemitones.length > 1) {
      // Find the scale degree index of the current note
      // Calculate the note's semitone value relative to the scale's root note (0-11)
      const noteSemitoneRelativeToKey = (note.pitch - scaleKeyIndex + 120) % 12 // Use +120 to handle negative results correctly
      let currentDegreeIndex = -1
      let minDiff = Infinity

      // Find the closest degree in the scale definition (semitones array)
      for (let i = 0; i < scaleSemitones.length; i++) {
        let diff = Math.abs(noteSemitoneRelativeToKey - scaleSemitones[i])
        diff = Math.min(diff, 12 - diff) // Account for wrap-around distance (e.g., diff between 11 and 0 is 1)
        if (diff < minDiff) {
          minDiff = diff
          currentDegreeIndex = i
        }
      }

      // If no matching degree found (shouldn't happen with generated notes), keep original
      if (currentDegreeIndex === -1) {
        alternativeNotes.push(note)
        continue
      }

      // Choose a new scale degree (adjacent) ---
      const offset = (Math.random() < 0.5) ? -1 : 1 // Move one step up or down the scale degrees
      // Calculate the new index, wrapping around the scale size
      const newDegreeIndex = (currentDegreeIndex + offset + scaleSemitones.length) % scaleSemitones.length

      // Calculate the new pitch
      const newSemitoneOffset = scaleSemitones[newDegreeIndex] // Semitone offset from the key root for the new degree
      const originalOctave = Math.floor(note.pitch / 12) // Get the octave of the original note

      // Calculate the potential new pitch: start with the key in the original octave, then add the new scale degree offset
      let newPitch = (originalOctave * 12) + scaleKeyIndex + newSemitoneOffset

      // Adjust octave to keep the new note close to the original
      // Calculate pitch differences with potential octave shifts
      const pitchDiffSameOctave = newPitch - note.pitch
      const pitchDiffOctaveUp = (newPitch + 12) - note.pitch
      const pitchDiffOctaveDown = (newPitch - 12) - note.pitch

      // Choose the octave that results in the smallest absolute pitch change
      if (Math.abs(pitchDiffOctaveUp) < Math.abs(pitchDiffSameOctave) && (newPitch + 12) <= 127) {
        newPitch += 12
      } else if (Math.abs(pitchDiffOctaveDown) < Math.abs(pitchDiffSameOctave) && (newPitch - 12) >= 0) {
        newPitch -= 12
      }

      // Clamp the final pitch to the valid MIDI range (0-127)
      newPitch = Math.max(0, Math.min(127, newPitch))

      // Add the modified note (keeping original position, velocity, length)
      alternativeNotes.push({ ...note, pitch: newPitch })
    } else {
      // Keep the original note if not changing it
      alternativeNotes.push(note)
    }
  }
  return alternativeNotes // Return the array with potentially modified notes
}

/**
 * Write an array of notes to the specified Bitwig clip.
 * @param {Array} notesToWrite - Array of note objects { position, pitch, velocity, length }.
 * @param {number} channelNumber - MIDI channel number to write to.
 * @param {Clip} cursorClip - Bitwig Studio cursor clip object to write the notes into.
 */
function writeNotesToClip (notesToWrite, channelNumber, cursorClip) {
  // Iterate through the notes and add them to the clip
  notesToWrite.forEach(note => {
    // Ensure note properties are valid before setting step
    if (note.position !== undefined && note.pitch !== undefined && note.velocity !== undefined && note.length !== undefined) {
      cursorClip.setStep(
        channelNumber, // MIDI Channel
        note.position, // Start time in 16th steps
        note.pitch, // MIDI pitch (0-127)
        note.velocity, // Velocity (1-127)
        note.length // Duration in beats
      )
    }
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
  const velocityRandomnessSetting = documentState.getNumberSetting('Velocity Randomness', 'Melody Generator', 0, 100, 1, '%', 100)
  const octaveStart = documentState.getNumberSetting('Octave Start', 'Melody Generator', 0, 8, 1, 'Octave', 3)
  const octaveRange = documentState.getNumberSetting('Octave Range', 'Melody Generator', 1, 4, 1, 'Octaves', 1)
  const barsToGenerate = documentState.getNumberSetting('How Many Bars?', 'Melody Generator', 1, 8, 1, 'Bar(s)', 1)
  const allowRepeatNotes = documentState.getEnumSetting('Allow Repeating Notes', 'Melody Generator', ['Yes', 'No'], 'No')
  const rhythmicEmphasis = documentState.getNumberSetting('Rhythmic Emphasis', 'Melody Generator', 0, 100, 1, '%', 0)
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
    const clip = clipType.get() === 'Arranger' ? cursorClipArranger : cursorClipLauncher
    // Heh! this is better, because it makes the clip length the same as the clip length in the UI
    // Set the loop length of the clip based on the barsToGenerate setting
    // Loop length is in beats. 1 bar = 4 beats.
    const loopLengthBeats = barsToGenerate.getRaw() * 4.0
    clip.getLoopLength().setRaw(loopLengthBeats)
    clip.getPlayStop().setRaw(loopLengthBeats)
    return clip
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
      velocityRandomness: velocityRandomnessSetting.getRaw(), // how much the velocity can vary
      channelNumber: 0, // the channel number to write the notes to (midi channel)
      allowRepeatNotes: (allowRepeatNotes.get() === 'Yes'), // allow repeating notes
      rhythmicEmphasis: rhythmicEmphasis.getRaw() // Pass the rhythmic emphasis parameter
    })
  }

  // Write the Scale & Mode to the title of the clip
  documentState.getSignalSetting('Name the Clip', 'Melody Generator', 'Name Clip').addSignalObserver(() => {
    getCursorClip().setName(selectedScaleMode.get() + '-' + selectedScale.get())
  })

  // define the generate button for the Arranger
  documentState.getSignalSetting('Generate!!', 'Melody Generator', 'Generate New Sequence').addSignalObserver(() => {
    // clear all notes from the clip
    getCursorClip().clearSteps()
    // generate new notes
    generate()
    // write the generated notes to the clip
    writeNotesToClip(globalNoteData, 0, getCursorClip())
  })

  // define the repaint button
  documentState.getSignalSetting('Repaint', 'Melody Generator', 'Repaint Sequence!').addSignalObserver(() => {
    // clear all notes from the clip
    getCursorClip().clearSteps()
    // write the generated notes to the clip
    writeNotesToClip(globalNoteData, 0, getCursorClip())
  })

  // Alternative 1 Button: Generates variation of the last generated melody
  documentState.getSignalSetting('Alternative 1', 'Melody Generator', 'Generate Alternative').addSignalObserver(() => {
    // Check if a base melody exists in globalNoteData
    if (globalNoteData.length === 0) {
      return // Do nothing if no base melody exists
    }

    // Get current scale settings needed for variation logic
    const currentScaleMode = selectedScaleMode.get()
    const currentScaleKey = selectedScale.get()
    const changeProb = 0.25 // 25% chance to change each note (can be adjusted)

    // Generate the alternative melody based on the current globalNoteData
    const alternativeNotes = generateAlternativeMelody(
      globalNoteData,
      currentScaleMode,
      currentScaleKey,
      changeProb
    )

    const clip = getCursorClip()
    clip.clearSteps() // Clear the clip before writing the variation
    // Uses modified writeNotesToClip:
    writeNotesToClip(alternativeNotes, 0, clip) // Write the alternative notes
  })

  // Added "Init Values" button to reset parameters thx @Terranoise
  documentState.getSignalSetting('Init Values', 'Melody Generator', 'Reset values to defaults').addSignalObserver(() => {
    // Reset enum settings with .set()
    selectedScaleMode.set('Ionian')
    selectedScale.set('C')
    allowRepeatNotes.set('No')
    clipType.set('Arranger')
    // Reset number settings using .setRaw() to provide raw (actual) values
    restProbability.setRaw(0)
    repetitionChance.setRaw(0)
    noteLengthVariation.setRaw(0)
    velocityRandomnessSetting.setRaw(100)
    octaveStart.setRaw(3)
    octaveRange.setRaw(1)
    barsToGenerate.setRaw(1)
    rhythmicEmphasis.setRaw(0) // Reset the new parameter
    noteProb1.setRaw(30)
    noteProb2.setRaw(10)
    noteProb3.setRaw(10)
    noteProb4.setRaw(20)
    noteProb5.setRaw(20)
    noteProb6.setRaw(5)
    noteProb7.setRaw(5)
    host.showPopupNotification('Values reset to defaults')
  })
}

function flush () {
  // nothing to do here
}

function exit () {
  println('-- Melody Maker Bye! --')
}
