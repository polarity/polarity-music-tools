/*
 * Chord Maker
 * controller script for Bitwig Studio
 * Generates harmonic progressions with voice leading
 * @version 0.2
 */
loadAPI(17)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Polarity', 'Chord Maker', '0.5', '665f84ae-1958-4f24-af31-52faa071b528', 'Polarity')

const listScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

let scaleIntervals
load('scales.js')

if (!scaleIntervals || Object.keys(scaleIntervals).length === 0) {
  scaleIntervals = {
    Lydian: [2, 2, 2, 1, 2, 2, 1],
    Major: [2, 2, 1, 2, 2, 2, 1],
    Mixolydian: [2, 2, 1, 2, 2, 1, 2],
    Dorian: [2, 1, 2, 2, 2, 1, 2],
    'Natural Minor': [2, 1, 2, 2, 1, 2, 2],
    Phrygian: [1, 2, 2, 2, 1, 2, 2],
    Locrian: [1, 2, 2, 1, 2, 2, 2],
    Chromatic: [1],
    Ionian: [2, 2, 1, 2, 2, 2, 1],
    Aeolian: [2, 1, 2, 2, 1, 2, 2]
  }
}

// convert all offsets to semitones for easier use
const scaleIntervalsSemitones = convertIntervalsToSemitones(scaleIntervals)

// get an array of the scale names (strings)
const listScaleMode = Object.keys(scaleIntervalsSemitones)

let Progression = []

/**
 * Converts the scale intervals to arrays of semitone offsets.
 * @param {object} scaleIntervals - An object of modes, each an array of intervals.
 * @returns {object} - An object with the same keys but semitone arrays as values.
 */
function convertIntervalsToSemitones (scaleIntervals) {
  const convertedScales = {}
  for (const [name, intervals] of Object.entries(scaleIntervals)) {
    let current = 0
    const semitones = [0]
    for (const step of intervals) {
      current += step
      semitones.push(current)
    }
    // Remove the final step which is typically the octave jump.
    semitones.pop()
    convertedScales[name] = semitones
  }
  return convertedScales
}

/**
 * Generate a simple diatonic chord progression based on a scale, mode, and length.
 *
 * @param {number} scale - The root note (0 = C, 1 = C#, 2 = D, 3 = D#, etc.).
 * @param {number[]} mode - Array of semitone steps that define the scale mode (e.g. [2,2,1,2,2,2,1] for a major scale).
 * @param {number} [length=4] - How many chords to generate.
 * @returns {Object[]} An array of chord objects. Each object has note info for each chord tone.
 *
 * Example usage:
 * generateChordProgression(0, [2,2,1,2,2,2,1], 4);
 */
function generateChordProgression (scale, mode, length = 4) {
  // clean the global progression array
  const progression = []

  // We pick a base octave to avoid very low or very high notes.
  // You can adjust this if you want higher or lower chords.
  const baseOctave = 60 // Middle C is 60 in MIDI terms. So scale + 60 means C is 60 if scale=0.

  // 1) Build a scale array for two octaves (or at least enough notes to pick triads).
  // This helps us index triad tones easily.
  const scaleNotes = buildScaleNotes(baseOctave + scale, mode, 4)

  // 2) Define chord flow with probabilities. Each possible next chord has a weight.
  // Higher numbers mean more likely transitions.
  const chordFlow = {
    0: [[1, 15], [2, 10], [3, 30], [4, 35], [5, 10]], // I -> strong tendency to V and IV
    1: [[4, 80], [0, 20]], // ii -> very strong tendency to V
    2: [[5, 70], [3, 30]], // iii -> strong tendency to vi
    3: [[0, 20], [4, 50], [1, 30]], // IV -> strong tendency to V
    4: [[0, 80], [5, 20]], // V -> very strong tendency to I
    5: [[1, 30], [3, 30], [4, 40]], // vi -> roughly equal chances
    6: [[0, 90], [4, 10]] // vii° -> very strong tendency to I
  }

  // 3) Pick chords using weighted probabilities. Start at I (index 0).
  let currentChordIndex = 0
  const chordIndices = [currentChordIndex]

  // Build the progression with probabilities
  // We'll use a Markov chain to pick the next chord based on the current chord.
  for (let i = 1; i < length; i++) {
    // Get possible next chords and reduce weight if chord already exists in progression
    // This helps avoid repeating the same chord too often.
    const possibleNext = chordFlow[currentChordIndex].map(([chord, weight]) => {
      // Reduce weight by 70% if chord already exists in progression
      const reduction = chordIndices.includes(chord) ? 0.3 : 1
      return [chord, weight * reduction]
    })

    // Calculate total weight of possible next chords
    const totalWeight = possibleNext.reduce((sum, [_, weight]) => sum + weight, 0)
    let random = Math.random() * totalWeight

    // Pick next chord based on probability weights
    for (const [nextChord, weight] of possibleNext) {
      // Subtract weight from random until we find the next chord
      random -= weight
      // If we reach zero or less, pick this chord
      if (random <= 0) {
        currentChordIndex = nextChord
        break
      }
    }

    // Add the chord to the progression
    chordIndices.push(currentChordIndex)
  }

  // Build an array of chord note objects. Each chord is one bar long:
  // - One bar in quarter notes is length=4.
  // - Start is measured in 16th notes. So each chord starts 16 ticks later.
  // We'll build triads: root (channel 1), third (channel 2), fifth (channel 5).
  // We'll use velocity=64.
  // chordStart16th = (chordNumber * 16) + 1 (so the first chord starts at 1).
  chordIndices.forEach((chordIndex, i) => {
    // triad: scaleNotes[chordIndex], scaleNotes[chordIndex+2], scaleNotes[chordIndex+4]
    // we need to ensure we have enough notes in scaleNotes, so we built 2 octaves to be safe.
    const rootNote = scaleNotes[chordIndex]
    const thirdNote = scaleNotes[chordIndex + 2]
    const fifthNote = scaleNotes[chordIndex + 4]

    const chordStart16th = i * 16 // each chord is one bar, each bar is 16 sixteenth-notes
    const noteLengthInQuarters = 4 // 4 quarter notes = one bar
    const velocity = 64

    // Create note objects for the triad
    const chordNotes = [
      {
        pitch: rootNote,
        position: chordStart16th,
        length: noteLengthInQuarters,
        velocity: velocity,
        channelNumber: 0 // root
      },
      {
        pitch: thirdNote,
        position: chordStart16th,
        length: noteLengthInQuarters,
        velocity: velocity,
        channelNumber: 2 // third
      },
      {
        pitch: fifthNote,
        position: chordStart16th,
        length: noteLengthInQuarters,
        velocity: velocity,
        channelNumber: 4 // fifth
      }
    ]

    // Add the chord to the progression
    progression.push({
      chordIndex: chordIndex, // which diatonic chord (0=I,1=ii,...)
      notes: chordNotes
    })
  })

  return progression
}

/**
 * Build an array of scale notes across multiple octaves using
 * a starting MIDI note and a mode array of semitone steps.
 *
 * @param {number} rootNote - MIDI note number of the root.
 * @param {number[]} mode - Array of semitone steps in the scale.
 * @param {number} octaves - How many octaves to build.
 * @returns {number[]} An array of MIDI note numbers.
 */
function buildScaleNotes (rootNote, mode, octaves = 4) {
  const notes = [] // Start with root note

  // For each octave
  for (let o = 0; o < octaves; o++) {
    // Add notes based on semitone steps
    for (const step of mode) {
      notes.push(rootNote + step + (o * 12))
    }
  }

  // Add root note of last octave
  notes.push(rootNote + (octaves * 12))

  return notes
}

/**
 * Add a bass note one octave below the root note in each chord.
 * @param {*} progression
 * @returns
 */
function addBassNote (progression) {
  // Map over each chord in the progression
  return progression.map(chord => {
    // Find the root note in each chord (channel 1)
    const rootNote = chord.notes.find(note => note.channelNumber === 0)
    if (!rootNote) return chord

    // Create bass note one octave below root
    const bassNote = {
      ...rootNote,
      pitch: rootNote.pitch - 24,
      channelNumber: 15 // Use channel 0 for bass
    }

    // Return chord with bass note added
    return {
      ...chord,
      notes: [...chord.notes, bassNote]
    }
  })
}

/**
 * Add a seventh note to each chord based on the third note.
 * This function adds the seventh note by shifting the third note by 7 semitones.
 * Note: This approach assumes that stacking thirds applies.
 * It may not be suitable for suspended chords (e.g., sus2).
 *
 * @param {Array} progression - Array of chord objects.
 * @returns {Array} A new progression with added seventh notes.
 */
function addSeventhNoteFromThird (progression) {
  return progression.map(chord => {
    // Find the third note in each chord (channel 2)
    const thirdNote = chord.notes.find(note => note.channelNumber === 2)
    if (!thirdNote) return chord

    // Create the seventh note by shifting the third note by 7 semitones
    const seventhNote = {
      ...thirdNote,
      pitch: thirdNote.pitch + 7,
      channelNumber: 6
    }

    // Return chord with the seventh note added
    return {
      ...chord,
      notes: [...chord.notes, seventhNote]
    }
  })
}

/**
 * Add a tenth note to each chord based on the root note.
 * This function adds the tenth note by shifting the third note by 14 semitones.
 * @param {Array} progression - Array of chord objects.
 * @returns {Array} A new progression with added seventh notes.
 */
function addTenthNoteFromRoot (progression) {
  return progression.map(chord => {
    // Find the third note in each chord (channel 2)
    const rootNote = chord.notes.find(note => note.channelNumber === 0)
    if (!rootNote) return chord

    // Create the seventh note by shifting the third note by 7 semitones
    const tenthNote = {
      ...rootNote,
      pitch: rootNote.pitch + 14,
      channelNumber: 9
    }

    // Return chord with the tenth note added
    return {
      ...chord,
      notes: [...chord.notes, tenthNote]
    }
  })
}

/**
 * Revoice chords to minimize the distance between successive chord tones,
 * creating smoother voice leading. Additional options allow for enforcing a
 * minimum interval between voices (using only octave shifts) and aligning a
 * specific pedal voice.
 *
 * @param {Object[]} chords - Array of chord objects, each containing a notes array.
 * @param {Object} [options={}] - Options to affect voicing.
 * @param {number} [options.minInterval=1] - Minimum interval (in semitones) allowed between voices.
 *        Note: Adjustments are made only in full octave (12 semitone) steps.
 * @param {number|null} [options.pedalChannel=null] - Channel number to use as the pedal tone.
 * @returns {Object[]} New array of chords with optimized voice leading.
 */
function revoiceChords (chords, options = {}) {
  if (chords.length === 0) return chords

  const minInterval = options.minInterval !== undefined ? options.minInterval : 1
  const pedalChannel = options.pedalChannel !== 0 ? options.pedalChannel - 1 : null

  // The first chord remains unchanged.
  const newChords = [chords[0]]

  // Process every subsequent chord.
  for (let i = 1; i < chords.length; i++) {
    const previousChord = newChords[i - 1]
    const currentChord = chords[i]

    const newNotes = currentChord.notes.map(note => {
      let bestPitch = note.pitch
      let minDiff = Infinity

      // If the note is the designated pedal tone, compare only to the same channel in the previous chord.
      if (pedalChannel !== null && note.channelNumber === pedalChannel) {
        const prevPedalNote = previousChord.notes.find(n => n.channelNumber === pedalChannel)
        if (prevPedalNote) {
          for (let k = -2; k <= 2; k++) {
            const candidatePitch = note.pitch + 12 * k
            const diff = Math.abs(candidatePitch - prevPedalNote.pitch)
            if (diff < minDiff) {
              minDiff = diff
              bestPitch = candidatePitch
            }
          }
        }
      } else {
        // Otherwise, compare the note with every note of the previous chord.
        for (const prevNote of previousChord.notes) {
          const refPitch = prevNote.pitch
          // Try various octave shifts (12 semitones steps)
          for (let k = -2; k <= 2; k++) {
            const candidatePitch = note.pitch + 12 * k
            const diff = Math.abs(candidatePitch - refPitch)
            if (diff < minDiff) {
              minDiff = diff
              bestPitch = candidatePitch
            }
          }
        }
      }

      return { ...note, pitch: bestPitch }
    })

    // Enforce a minimum interval between voices using only full octave shifts.
    for (let j = 0; j < newNotes.length; j++) {
      for (let k = j + 1; k < newNotes.length; k++) {
        const diff = Math.abs(newNotes[j].pitch - newNotes[k].pitch)
        if (diff < minInterval) {
          // If one note is the pedal tone, adjust the other.
          if (pedalChannel !== null) {
            if (newNotes[j].channelNumber === pedalChannel) {
              if (newNotes[k].pitch >= newNotes[j].pitch) {
                newNotes[k].pitch += 12
              } else {
                newNotes[k].pitch -= 12
              }
            } else if (newNotes[k].channelNumber === pedalChannel) {
              if (newNotes[j].pitch >= newNotes[k].pitch) {
                newNotes[j].pitch += 12
              } else {
                newNotes[j].pitch -= 12
              }
            } else {
              // Neither note is the pedal tone: adjust the lower note downward.
              if (newNotes[j].pitch < newNotes[k].pitch) {
                newNotes[j].pitch -= 12
              } else {
                newNotes[k].pitch += 12
              }
            }
          } else {
            // No pedal tone is set: adjust the lower note downward.
            if (newNotes[j].pitch < newNotes[k].pitch) {
              newNotes[j].pitch -= 12
            } else {
              newNotes[k].pitch += 12
            }
          }
        }
      }
    }

    // Ensure that no two notes land exactly on the same pitch.
    let overlapResolved = false
    while (!overlapResolved) {
      overlapResolved = true
      for (let a = 0; a < newNotes.length; a++) {
        for (let b = a + 1; b < newNotes.length; b++) {
          if (newNotes[a].pitch === newNotes[b].pitch) {
            // If one note is the pedal tone, adjust the other.
            if (pedalChannel !== null) {
              if (newNotes[a].channelNumber === pedalChannel) {
                newNotes[b].pitch += 12
              } else if (newNotes[b].channelNumber === pedalChannel) {
                newNotes[a].pitch -= 12
              } else {
                // Otherwise, adjust the second note upward.
                newNotes[b].pitch += 12
              }
            } else {
              // If no pedal tone is set, adjust the second note upward.
              newNotes[b].pitch += 12
            }
            overlapResolved = false
          }
        }
      }
    }

    // If any non-root note overlaps with the root note (channelNumber 0),
    // adjust the root note by shifting it one octave down.
    const rootIndex = newNotes.findIndex(n => n.channelNumber === 0)
    if (rootIndex !== -1) {
      const rootPitch = newNotes[rootIndex].pitch
      const hasOverlap = newNotes.some((n, idx) => idx !== rootIndex && n.pitch === rootPitch)
      if (hasOverlap) {
        newNotes[rootIndex] = { ...newNotes[rootIndex], pitch: rootPitch - 12 }
      }
    }

    newChords.push({ ...currentChord, notes: newNotes })
  }

  return newChords
}

/**
 * Write the generated notes to the cursor clip
 * @param {*} channelNumber - channel number of the note
 * @param {*} cursorClip - cursor clip to write the notes to
 */
function writeNotesToClip (progression, cursorClip) {
  progression.forEach(chord => {
    chord.notes.forEach(note => {
      cursorClip.setStep(
        note.channelNumber, // use the note's channel
        note.position,
        note.pitch,
        note.velocity,
        note.length
      )
    })
  })
}

function init () {
  println('Chord Maker ready!')
  const documentState = host.getDocumentState()
  const cursorClipArranger = host.createArrangerCursorClip((16 * 8), 128)
  const cursorClipLauncher = host.createLauncherCursorClip((16 * 8), 128)
  cursorClipArranger.scrollToKey(0)
  cursorClipLauncher.scrollToKey(0)

  // creates the UI elements for the script
  const chordScaleMode = documentState.getEnumSetting('Mode', 'Chord Maker', listScaleMode, 'Major')
  const chordScale = documentState.getEnumSetting('Scale', 'Chord Maker', listScale, 'C')
  const chordBars = documentState.getNumberSetting('Chord Bars', 'Chord Maker', 1, 8, 1, 'bar(s)', 4)
  const clipType = documentState.getEnumSetting('Clip Type', 'Chord Maker', ['Launcher', 'Arranger'], 'Arranger')
  const revoice = documentState.getEnumSetting('Revoice?', 'Chord Maker', ['Yes', 'No'], 'No')
  const revoiceMinInterval = documentState.getNumberSetting('Revoice Min Interval', 'Chord Maker', 1, 3, 1, 'sem', 2)
  const revoicePedalChannel = documentState.getNumberSetting('Revoice Pedal Channel', 'Chord Maker', 0, 16, 1, 'channel', 0)
  const addBass = documentState.getEnumSetting('Add Bass?', 'Chord Maker', ['Yes', 'No'], 'No')
  const addSeventh = documentState.getEnumSetting('Add Seventh?', 'Chord Maker', ['Yes', 'No'], 'No')
  const addTenth = documentState.getEnumSetting('Add Tenth?', 'Chord Maker', ['Yes', 'No'], 'No')

  /**
   * Get the cursor clip based on the selected clip type
   * @returns the cursor clip based on the selected clip type
   */
  function getCursorClip () {
    return clipType.get() === 'Arranger' ? cursorClipArranger : cursorClipLauncher
  }

  /**
   * Repaint the notes in the clip based on the current progression.
   * This function is called when the user wants to repaint the notes
   * it uses the same global Progression variable to repaint the notes.
   * but adds the bass note and revoices the chords if necessary.
   */
  function repaint () {
    // create a copy of the global progression
    let currentProgression = Progression

    // clear all notes from the clip
    getCursorClip().clearSteps()

    if (addSeventh.get() === 'Yes') {
      currentProgression = addSeventhNoteFromThird(currentProgression)
    }
    if (addTenth.get() === 'Yes') {
      currentProgression = addTenthNoteFromRoot(currentProgression)
    }

    // revoice the chords to minimize the distance between successive chord tones
    if (revoice.get() === 'Yes') {
      currentProgression = revoiceChords(currentProgression, { minInterval: revoiceMinInterval.getRaw(), pedalChannel: revoicePedalChannel.getRaw() })
    }

    // add a bass note one octave below the root note
    if (addBass.get() === 'Yes') {
      currentProgression = addBassNote(currentProgression)
    }

    // revoice and then write the notes to the clip
    writeNotesToClip(currentProgression, getCursorClip())
  }

  /**
   * Signal observer to generate a new chord progression.
   * This function is called when the user wants to generate a new chord progression.
   */
  documentState.getSignalSetting('Generate new Chords', 'Chord Maker', 'Generate!').addSignalObserver(() => {
    // create a chord progression and save it to the global variable
    Progression = generateChordProgression(
      parseInt(listScale.indexOf(chordScale.get())), // 0 = C
      scaleIntervalsSemitones[chordScaleMode.get()], // semitone steps for the mode
      chordBars.getRaw() // get the Number of chords from the ui element
    )
    repaint()
  })

  /**
   * Signal observer to repaint the current chord progression.
   * This function is called when the user wants to repaint the current chord progression
   */
  documentState.getSignalSetting('Repaint current Chords', 'Chord Maker', 'repaint!').addSignalObserver(() => {
    repaint()
  })
}

function log (text, obj) {
  println(text + ' : ' + JSON.stringify(obj), 2)
}
function flush () {}
function exit () {
  println('-- Chord Maker Bye! --')
}
