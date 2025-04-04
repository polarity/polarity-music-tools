/**
 * Melody Maker
 * controller script for Bitwig Studio
 * Generates random melodies based on the given parameters
 * @version 0.4.1
 * @author Polarity
 */
loadAPI(17)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Polarity', 'Melody Maker', '0.4.1', '1f73b4d7-0cfe-49e6-bf70-f7191bdb3a24', 'Polarity')

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
 * Calculate the pitch value based on the given probability and scale mode
 * Also handles the octave range and note repetition
 * refactoring of the original code, moved outside of generateNoteSequence()
 * @param {number} position - Current position in 16th notes
 * @param {array} recentPitches - Array of recently used pitches to avoid repetition
 * @returns {number} - pitch value between 0 and 127
 */
const calculatePitch = (position, probability, rhythmicEmphasis, scaleMode, octaveRange, weightedRandom, allowRepeatNotes, baseNote, recentPitches = []) => {
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
  // Try multiple times to find a pitch that's not too repetitive
  let pitch = null
  let attempts = 0
  const maxAttempts = 10 // Limit attempts to prevent infinite loops

  // If we're explicitly allowing repeat notes, we'll skip the repetition avoidance
  if (allowRepeatNotes) {
    // Use standard note selection
    const degreeIndex = weightedRandom(adjustedProbability.map(p => p / 100))
    const interval = SCALE_MODES[scaleMode][degreeIndex % SCALE_MODES[scaleMode].length]
    const octaveOffset = Math.floor(Math.random() * octaveRange)
    pitch = baseNote + interval + (12 * octaveOffset)
  } else {
    // Try to find a non-repeating pitch
    while (attempts < maxAttempts) {
      const degreeIndex = weightedRandom(adjustedProbability.map(p => p / 100))
      const interval = SCALE_MODES[scaleMode][degreeIndex % SCALE_MODES[scaleMode].length]
      const octaveOffset = Math.floor(Math.random() * octaveRange)
      const candidatePitch = baseNote + interval + (12 * octaveOffset)

      // Check if this pitch is too similar to recent pitches
      // Get the last pitch (if any) from the recentPitches array
      const lastPitch = recentPitches.length > 0 ? recentPitches[recentPitches.length - 1] : null
      const isTooSimilar = lastPitch === candidatePitch ||
                           recentPitches.includes(candidatePitch)

      if (!isTooSimilar) {
        pitch = candidatePitch
        break
      }

      // Increase weights for unused notes to favor diversity
      if (attempts > 3) {
        // After a few tries, start boosting other scale degrees
        for (let i = 0; i < adjustedProbability.length; i++) {
          if (i !== degreeIndex) {
            adjustedProbability[i] *= 1.2 // Boost other scale degrees
          }
        }
      }

      attempts++
    }

    // If all attempts failed, just pick one
    if (pitch === null) {
      const degreeIndex = weightedRandom(adjustedProbability.map(p => p / 100))
      const interval = SCALE_MODES[scaleMode][degreeIndex % SCALE_MODES[scaleMode].length]
      const octaveOffset = Math.floor(Math.random() * octaveRange)
      pitch = baseNote + interval + (12 * octaveOffset)
    }
  }

  // If we still end up with the same pitch as the last one (despite our attempts)
  // and we're not allowing repeats, try alternative notes
  if (!allowRepeatNotes && recentPitches.length > 0 && recentPitches[recentPitches.length - 1] === pitch) {
    const alternatives = [
      pitch + 7, // Perfect Fifth
      pitch - 7,
      pitch + 5, // Perfect Fourth
      pitch - 5,
      pitch + 12, // Octave up
      pitch - 12 // Octave down
    ].filter(p => p >= 0 && p <= 127 && !recentPitches.includes(p))

    // Pick a random alternative if available
    if (alternatives.length > 0) {
      pitch = alternatives[Math.floor(Math.random() * alternatives.length)]
    }
  }

  // Return the pitch value clamped between 0 and 127
  return Math.min(127, Math.max(0, pitch))
}

/**
 * Transform a motif in various ways to create musical development
 * @param {Array} motif - Array of note objects to transform
 * @param {number} baseNote - Base note for the selected scale/octave
 * @param {number} octaveStart - Starting octave
 * @param {number} octaveRange - Range of octaves to use
 * @param {string} scaleMode - Selected scale mode
 * @returns {Array} - Transformed motif
 */
const transformMotif = (motif, baseNote, octaveStart, octaveRange, scaleMode) => {
  // Define octave boundaries for consistent enforcement
  const minOctave = octaveStart
  const maxOctave = octaveStart + octaveRange - 1
  const minPitch = (minOctave + 1) * 12
  const maxPitch = (maxOctave + 2) * 12 - 1

  // Get the scale steps for ensuring scale compliance
  const scaleSteps = SCALE_MODES[scaleMode]

  /**
   * Ensures a pitch stays within octave range and within scale
   * @param {number} pitch - MIDI pitch to constrain
   * @returns {number} - Scale-compliant pitch within range
   */
  const constrainPitch = (pitch) => {
    // First, constrain to octave range
    let constrained = pitch

    // If pitch is too low, shift up by octaves
    while (constrained < minPitch) constrained += 12

    // If pitch is too high, shift down by octaves
    while (constrained > maxPitch) constrained -= 12

    // Now ensure the note is in the scale
    // Calculate the pitch class (0-11) relative to the key
    const rootNote = baseNote % 12
    const pitchClass = (constrained - rootNote + 12000) % 12

    // Find the closest scale step
    let bestStep = null
    let smallestDistance = Infinity

    for (const step of scaleSteps) {
      const distance = Math.min(
        Math.abs(pitchClass - step),
        Math.abs(pitchClass - (step + 12))
      )

      if (distance < smallestDistance) {
        smallestDistance = distance
        bestStep = step
      }
    }

    // Adjust the pitch to the closest scale step
    if (bestStep !== null) {
      const correction = bestStep - pitchClass
      constrained += correction

      // Ensure we're still in range after scale correction
      if (constrained < minPitch) constrained += 12
      if (constrained > maxPitch) constrained -= 12
    }

    return constrained
  }

  // Choose a transformation type (0: transpose, 1: invert, 2: retrograde/reverse, 3: octave shift)
  const transformationType = Math.floor(Math.random() * 4)

  // Create a deep copy of the motif to avoid modifying the original
  const transformedMotif = JSON.parse(JSON.stringify(motif))

  switch (transformationType) {
    case 0: // Transpose
      // Shift all notes up or down by a scale step (2-3 semitones)
      const transposeInterval = Math.floor(Math.random() * 5) - 2 // -2 to +2 steps
      for (const note of transformedMotif) {
        note.pitch = constrainPitch(note.pitch + transposeInterval)
      }
      break

    case 1: // Invert
      // Invert the melodic contour around the first note
      if (transformedMotif.length > 1) {
        const pivotPitch = transformedMotif[0].pitch
        for (let i = 1; i < transformedMotif.length; i++) {
          // Calculate distance from pivot and invert
          const distance = transformedMotif[i].pitch - pivotPitch
          transformedMotif[i].pitch = constrainPitch(pivotPitch - distance)
        }
      }
      break

    case 2: // Retrograde (reverse)
      // Play the motif backwards (reverse the array)
      transformedMotif.reverse()
      break

    case 3: // Octave shift
      // Only attempt octave shift if it keeps all notes in range
      // First check if all notes would stay in range after shift
      const canShiftUp = transformedMotif.every(note => note.pitch + 12 <= maxPitch)
      const canShiftDown = transformedMotif.every(note => note.pitch - 12 >= minPitch)

      // Only shift if we can keep all notes in range
      if (canShiftUp && Math.random() < 0.5) {
        for (const note of transformedMotif) {
          note.pitch += 12
        }
      } else if (canShiftDown) {
        for (const note of transformedMotif) {
          note.pitch -= 12
        }
      }
      // If we can't shift safely, don't modify the pitches
      break
  }

  return transformedMotif
}

/**
 * Generate a random index based on weighted probabilities
 * @param {array} weights - array of weights for each note in the scale
 * @returns {number} - index of the selected note in the scale
 */
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
const getNoteLength = (noteLengthVariation) => {
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
  allowRepeatNotes = false,
  rhythmicEmphasis = 0,
  motifDevelopment = 0,
  countChannels = false
}) {
  // Reset global data
  globalNoteData = []

  // Channel number for MIDI output
  let channelNumber = 0

  // Calculate the base note value based on the scale and octave
  const baseNote = (scale - 1) + (octaveStart + 1) * 12

  // Keep track of recently used pitches (last 3-5 notes) to avoid repetition
  const recentPitches = []
  const maxRecentPitches = 4 // How many recent pitches to remember

  // Initializations
  const totalSteps = lengthInBars * 16
  let currentPosition = 0

  // Store the generated notes in a global variable
  // to store the last 8 notes to be able to repeat them
  // this is used for the repetition chance
  const history = []

  // Main loop
  // Generate notes until the total steps are reached
  // or the history is empty
  while (currentPosition < totalSteps) {
    // Check if we should use motif development
    if (history.length > 2 && Math.random() * 100 < motifDevelopment) {
      // Extract a motif (3-5 notes) from history
      const motifLength = Math.min(history.length, Math.floor(Math.random() * 3) + 3)
      const motif = history.slice(-motifLength)

      // Transform the motif to create development - passing scale parameters
      const transformedMotif = transformMotif(
        motif,
        baseNote,
        octaveStart,
        octaveRange,
        scaleMode
      )

      // Use the transformed motif
      for (const note of transformedMotif) {
        // Check if the note fits in the remaining steps
        if (currentPosition >= totalSteps) break
        const stepsNeeded = (note.length / 0.25)

        // Check if this note should be a rest
        if (Math.random() * 100 > restProbability) {
          // Add the transformed note to the global data
          globalNoteData.push({
            channel: channelNumber,
            position: currentPosition,
            pitch: note.pitch,
            velocity: note.velocity,
            length: note.length,
            releaseVelocity: note.releaseVelocity,
            pressure: note.pressure,
            timbre: note.timbre
          })

          // Also add to history for potential future development
          history.push({
            channel: channelNumber,
            pitch: note.pitch,
            velocity: note.velocity,
            length: note.length,
            releaseVelocity: note.releaseVelocity,
            pressure: note.pressure,
            timbre: note.timbre
          })
        }

        // Move the current position
        currentPosition += stepsNeeded
      }

      // After using motif, continue to next iteration
      continue
    }

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
            channel: channelNumber,
            position: currentPosition,
            pitch: note.pitch,
            velocity: note.velocity,
            releaseVelocity: note.releaseVelocity,
            length: note.length,
            pressure: note.pressure,
            timbre: note.timbre
          })
        }

        // Move the current position
        currentPosition += stepsNeeded
      }
      continue
    }

    // Generate new note
    const noteLength = getNoteLength(noteLengthVariation) // Get the note length based on the variation
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

      // Release Velocity:
      // use randomnessFactor to scale the randomness
      // values are between 0 and 1
      // base pressure is 0
      const baseRVel = 0 // Base pressure (default value)
      const randomRVel = Math.random() // Random pressure between 0 and 1
      // Calculate the new pressure based on the randomness factor
      const calculatedRvel = baseRVel * (1 - randomnessFactor) + randomRVel * randomnessFactor
      // Clamp the pressure to the range of 0 to 1
      const releaseVelocity = Math.max(0, Math.min(1, calculatedRvel))

      // Timbre:
      // use randomnessFactor to scale the randomness
      // values are between -1 and 1
      // base timbre is 0
      const baseTimbre = 0 // Base timbre (default value)
      const randomTimbre = Math.random() * 2 - 1
      // Calculate the new timbre based on the randomness factor
      const calculatedTimbre = baseTimbre * (1 - randomnessFactor) + randomTimbre * randomnessFactor
      // Clamp the timbre to the range of -1 to 1
      const timbre = Math.max(-1, Math.min(1, calculatedTimbre))

      // Pressure:
      // use randomnessFactor to scale the randomness
      // values are between 0 and 1
      // base pressure is 0
      const basePressure = 0 // Base pressure (default value)
      const randomPressure = Math.random() // Random pressure between 0 and 1
      // Calculate the new pressure based on the randomness factor
      const calculatedPressure = basePressure * (1 - randomnessFactor) + randomPressure * randomnessFactor
      // Clamp the pressure to the range of 0 to 1
      const pressure = Math.max(0, Math.min(1, calculatedPressure))

      // Pass the current position and recent pitches to calculatePitch
      const pitch = calculatePitch(
        currentPosition,
        probability,
        rhythmicEmphasis,
        scaleMode,
        octaveRange,
        weightedRandom,
        allowRepeatNotes,
        baseNote,
        recentPitches
      )

      // Add to recent pitches and keep the list at fixed length
      recentPitches.push(pitch)
      if (recentPitches.length > maxRecentPitches) {
        recentPitches.shift() // Remove the oldest pitch
      }

      // Add the note to the global data
      globalNoteData.push({
        channel: channelNumber,
        position: currentPosition,
        pitch: pitch,
        velocity: velocity,
        releaseVelocity: releaseVelocity,
        length: noteLength,
        pressure: pressure,
        timbre: timbre
      })

      // Add the note to the history
      history.push({
        channel: channelNumber,
        pitch: pitch,
        velocity: velocity,
        releaseVelocity: releaseVelocity,
        length: noteLength,
        pressure: pressure,
        timbre: timbre
      })
    }

    // Move the current position
    currentPosition += stepsNeeded

    // Check if the note channel is based on a counter
    // if so, count the channels from 0 to 15 and then start over
    // if not, use the channelNumber 0
    if (countChannels) {
      if (channelNumber >= 15) {
        channelNumber = 0
      } else {
        channelNumber++
      }
    }

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

  // delay the clearing of the notes to ensure they are written to the clip
  host.scheduleTask(() => {
    // Clear the global note data after writing to the clip
    modifyNotesInClip(notesToWrite, cursorClip)
  }, 100) // Delay to ensure the notes are written before clearing
}

/**
 * Change the MPE of the notes in the specified Bitwig clip.
 * @param {Array} notesToWrite - Array of note objects { position, pitch, velocity, length }.
 * @param {Clip} cursorClip - Bitwig Studio cursor clip object to write the notes into.
 */
function modifyNotesInClip (notesToWrite, cursorClip) {
  // Iterate through the notes and add them to the clip
  notesToWrite.forEach(note => {
    // Ensure note properties are valid before setting step
    if (note.position !== undefined && note.pitch !== undefined && note.velocity !== undefined && note.length !== undefined) {
      // get the noteStep object to set the length of the note
      // @bug: getStep() does return the right notesteps but channel is always 0
      const step = cursorClip.getStep(note.channel, note.position, note.pitch)
      // this fails when ch is not 0
      step.setTimbre(note.timbre)
      step.setPressure(note.pressure)
      step.setReleaseVelocity(note.releaseVelocity)
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
  log('-- Melody Maker Go! --')

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
  const motifDevelopment = documentState.getNumberSetting('Motif Development', 'Melody Generator', 0, 100, 1, '%', 0)
  const noteLengthVariation = documentState.getNumberSetting('Note Length Variation', 'Melody Generator', 0, 100, 0.1, '%', 0)
  const velocityRandomnessSetting = documentState.getNumberSetting('Vel/Timb/Pres Rnd', 'Melody Generator', 0, 100, 1, '%', 100)
  const octaveStart = documentState.getNumberSetting('Octave Start', 'Melody Generator', 0, 8, 1, 'Octave', 3)
  const octaveRange = documentState.getNumberSetting('Octave Range', 'Melody Generator', 1, 4, 1, 'Octaves', 1)
  const barsToGenerate = documentState.getNumberSetting('How Many Bars?', 'Melody Generator', 1, 8, 1, 'Bar(s)', 1)
  const allowRepeatNotes = documentState.getEnumSetting('Allow Repeating Notes', 'Melody Generator', ['Yes', 'No'], 'No')
  const countChannels = documentState.getEnumSetting('Note Channel Count', 'Melody Generator', ['Yes', 'No'], 'No')
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
      rhythmicEmphasis: rhythmicEmphasis.getRaw(), // Pass the rhythmic emphasis parameter
      motifDevelopment: motifDevelopment.getRaw(), // Pass the motif development parameter
      countChannels: (countChannels.get() === 'Yes') // count the channels from 1 to 16
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
    writeNotesToClip(globalNoteData, getCursorClip())
  })

  // define the repaint button
  documentState.getSignalSetting('Repaint', 'Melody Generator', 'Repaint Sequence!').addSignalObserver(() => {
    // clear all notes from the clip
    getCursorClip().clearSteps()
    // write the generated notes to the clip
    writeNotesToClip(globalNoteData, getCursorClip())
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
    writeNotesToClip(alternativeNotes, clip) // Write the alternative notes
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
    motifDevelopment.setRaw(0) // Reset the new motif development parameter
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

function log (text, obj) {
  println(text + ' : ' + JSON.stringify(obj), 2)
}

function flush () {
  // nothing to do here
}

function exit () {
  println('-- Melody Maker Bye! --')
}
