/**
 * Scale Maker
 * Controller script for Bitwig Studio
 * Generates Scales in the Piano roll or corrects selected notes to the chosen scale
 * @version 0.2
 * @author Polarity
 */

loadAPI(17)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Polarity', 'Scale Maker', '0.2', 'b3f52fc6-e887-4bb6-927a-57b11a60e087', 'Polarity')

// Define the dropdown options for the UI
const listScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const booleanOption = ['No', 'Yes']
let scaleIntervals

// ------------------------------
// Clip length configuration
// ------------------------------
// Bitwig works in steps. In 4/4, 16 steps = 1 bar.
// Increase MAX_BARS if you want the script to cover longer clips.
const STEPS_PER_BAR = 16
const MAX_BARS = 64
const MAX_STEPS = STEPS_PER_BAR * MAX_BARS

// Store the current notes in the clip
const currentNotesInClip = []

// Store which notes are currently selected in the clip.
// Populated by addNoteStepObserver, which fires whenever a NoteStep changes
// (including selection/deselection). Structure mirrors currentNotesInClip:
// selectedNotesInClip[x][y] = true when the note at step x, pitch y is selected.
const selectedNotesInClip = []

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
  const octaveNotes = buildOctaveNotes(rootNote, intervals)
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
    const minOctave = Math.ceil((0 - base) / 12)
    const maxOctave = Math.floor((127 - base) / 12)

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
 * @returns {void}
 */
function generateDirectionalNotes (notes, startNote, intervals, direction) {
  let current = startNote
  let index = 0

  while (true) {
    const interval = intervals[index % intervals.length]
    current = direction === 'ascending' ? current + interval : current - interval

    if (current < 0 || current > 127) break

    notes.add(current)
    index++
  }
}

/**
 * Find closest higher and lower notes in the scale
 * @param {number} y - note to find closest higher and lower notes
 * @param {number[]} scaleNotes - array of notes in the scale
 * @returns {Object} - object with lower and higher notes
 */
function findClosestHigherAndLower (y, scaleNotes) {
  let low = 0
  let high = scaleNotes.length - 1
  let lower = -Infinity
  let higher = Infinity

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const current = scaleNotes[mid]

    if (current === y) {
      return { lower: y, higher: y }
    } else if (current < y) {
      lower = current
      low = mid + 1
    } else {
      higher = current
      high = mid - 1
    }
  }

  return { lower, higher }
}

/**
 * Find nearest scale note
 * @param {number} y - note to find nearest scale note
 * @param {number[]} scaleNotes - array of notes in the scale
 * @returns {number} - nearest scale note
 */
function findNearestScaleNote (y, scaleNotes) {
  let left = 0
  let right = scaleNotes.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (scaleNotes[mid] === y) return y
    else if (scaleNotes[mid] < y) left = mid + 1
    else right = mid - 1
  }

  if (left >= scaleNotes.length) return scaleNotes[right]
  if (right < 0) return scaleNotes[left]
  return (y - scaleNotes[right] <= scaleNotes[left] - y) ? scaleNotes[right] : scaleNotes[left]
}

/**
 * Find the last step (inclusive) occupied by the note that starts at (startX, y).
 *
 * @param {number} startX - onset step of the note
 * @param {number} y - pitch of the note
 * @returns {number} last step the note occupies
 */
function getNoteEndStep (startX, y) {
  let endX = startX

  while (
    endX + 1 < MAX_STEPS &&
    currentNotesInClip[endX + 1] !== undefined &&
    currentNotesInClip[endX + 1][y] === 1
  ) {
    endX++
  }

  return endX
}

/**
 * Walk backwards from a sustained step to find the onset (stat=2) step of a note.
 *
 * @param {number} sustainedAtStep - a step where the note has stat=1
 * @param {number} pitch - pitch of the note
 * @returns {number} the onset step of the note
 */
function getNoteOnsetStep (sustainedAtStep, pitch) {
  let step = sustainedAtStep

  while (step > 0) {
    const prevStat = currentNotesInClip[step - 1] && currentNotesInClip[step - 1][pitch]
    if (!prevStat) break
    step--
    if (prevStat === 2) break
  }

  return step
}

/**
 * Return true if any note (selected or unselected) occupies the given pitch at
 * any step in the closed interval [startX, endX].
 *
 * @param {number} startX - first step to check (inclusive)
 * @param {number} endX - last step to check (inclusive)
 * @param {number} pitch - MIDI pitch to test
 * @returns {boolean}
 */
function isPitchOccupiedInRange (startX, endX, pitch) {
  for (let step = startX; step <= endX; step++) {
    if (currentNotesInClip[step] !== undefined && currentNotesInClip[step][pitch] !== undefined) {
      return true
    }
  }
  return false
}

/**
 * Return true if an UNSELECTED note occupies the given pitch at any step in
 * [startX, endX].
 *
 * @param {number} startX - first step to check (inclusive)
 * @param {number} endX - last step to check (inclusive)
 * @param {number} pitch - MIDI pitch to test
 * @returns {boolean}
 */
function isPitchOccupiedByUnselectedInRange (startX, endX, pitch) {
  for (let step = startX; step <= endX; step++) {
    const stepData = currentNotesInClip[step]
    if (stepData === undefined || stepData[pitch] === undefined) continue

    const stat = stepData[pitch]
    let onsetStep

    if (stat === 2) {
      onsetStep = step
    } else {
      onsetStep = getNoteOnsetStep(step, pitch)
    }

    const isIsSelected = selectedNotesInClip[onsetStep] && selectedNotesInClip[onsetStep][pitch]
    if (!isIsSelected) return true
  }

  return false
}

/**
 * Correct SELECTED notes to the chosen scale.
 *
 * @param {*} cursorClip - cursorClip object (Arranger or Launcher)
 * @param {*} selectedScaleMode - selected scale mode
 * @param {*} selectedScale - selected scale root
 * @returns {void}
 */
function correctNotesToScale (cursorClip, selectedScaleMode, selectedScale) {
  const scaleMode = selectedScaleMode.get()
  const scaleName = selectedScale.get()
  const rootIndex = listScale.indexOf(scaleName)
  if (rootIndex === -1) return

  const rootNote = 60 + rootIndex
  const intervals = scaleIntervals[scaleMode]
  if (!intervals) return

  const scaleNotes = generateScaleNotes(rootNote, intervals)

  for (const xStr in currentNotesInClip) {
    const x = parseInt(xStr)
    const stepNotes = currentNotesInClip[x] || {}

    const allNotesAtStep = Object.keys(stepNotes).map(Number).sort((a, b) => a - b)

    const selectionAtStep = selectedNotesInClip[x] || {}
    const selectedNotes = allNotesAtStep.filter(y => selectionAtStep[y] === true)

    if (selectedNotes.length === 0) continue

    const usedTargets = new Set()
    for (const y of allNotesAtStep) {
      if (!selectionAtStep[y]) {
        usedTargets.add(y)
      } else if (scaleNotes.includes(y)) {
        usedTargets.add(y)
      }
    }

    for (const y of selectedNotes) {
      if (scaleNotes.includes(y)) continue

      const noteEndX = getNoteEndStep(x, y)

      const { lower, higher } = findClosestHigherAndLower(y, scaleNotes)
      const candidates = []

      if (lower !== -Infinity) candidates.push(lower)
      if (higher !== Infinity) candidates.push(higher)
      if (candidates.length === 0) continue

      const availableCandidates = candidates.filter(c =>
        !usedTargets.has(c) && !isPitchOccupiedInRange(x, noteEndX, c)
      )

      let targetY

      if (availableCandidates.length === 0) {
        const possibleCandidates = candidates.filter(c =>
          !usedTargets.has(c) && !isPitchOccupiedByUnselectedInRange(x, noteEndX, c)
        )

        if (possibleCandidates.length === 0) {
          targetY = findNearestScaleNote(y, scaleNotes)
          if (usedTargets.has(targetY)) continue
        } else {
          targetY = possibleCandidates.reduce((prev, curr) =>
            Math.abs(curr - y) < Math.abs(prev - y) ? curr : prev
          )
        }
      } else {
        targetY = availableCandidates.reduce((prev, curr) =>
          Math.abs(curr - y) < Math.abs(prev - y) ? curr : prev
        )
      }

      if (usedTargets.has(targetY)) continue
      usedTargets.add(targetY)

      const dy = targetY - y
      if (dy !== 0) {
        cursorClip.moveStep(x, y, 0, dy)
      }
    }
  }
}

/**
 * Write all notes of the scale to the first step of the cursorClip.
 * This is only for visualization.
 *
 * @param {*} cursorClip
 * @param {*} selectedScaleMode
 * @param {*} selectedScale
 */
function writeAllNotesOfScale (cursorClip, selectedScaleMode, selectedScale) {
  const scaleMode = selectedScaleMode.get()
  const scaleName = selectedScale.get()
  const rootIndex = listScale.indexOf(scaleName)
  if (rootIndex === -1) return

  const rootNote = 60 + rootIndex
  const intervals = scaleIntervals[scaleMode]
  if (!intervals) return

  const scaleNotes = generateScaleNotes(rootNote, intervals)

  cursorClip.clearSteps()

  for (const y of scaleNotes) {
    cursorClip.setStep(0, y, 60, 0.25)

    host.scheduleTask(() => {
      cursorClip.getStep(0, 0, y).setIsMuted(true)
    }, 200)
  }
}

function init () {
  println('-- Scale Maker Go! --')

  const documentState = host.getDocumentState()
  const cursorClipArranger = host.createArrangerCursorClip(MAX_STEPS, 128)
  const cursorClipLauncher = host.createLauncherCursorClip(MAX_STEPS, 128)

  cursorClipArranger.addStepDataObserver(observingNotes)
  cursorClipLauncher.addStepDataObserver(observingNotes)

  cursorClipArranger.scrollToKey(0)
  cursorClipLauncher.scrollToKey(0)

  cursorClipArranger.addNoteStepObserver(observingNoteSteps)
  cursorClipLauncher.addNoteStepObserver(observingNoteSteps)

  function getCursorClip () {
    if (clipType.get() === 'Arranger') {
      return cursorClipArranger
    } else {
      return cursorClipLauncher
    }
  }

  // UI settings
  const selectedScaleMode = documentState.getEnumSetting('Scale Mode', 'Scale Maker', listScaleMode, 'Major')
  const selectedScale = documentState.getEnumSetting('Scale', 'Scale Maker', listScale, 'C')
  const continuousMode = documentState.getEnumSetting('Continuous Mode', 'Scale Maker', booleanOption, 'No')
  const clipType = documentState.getEnumSetting('Clip Type', 'Scale Maker', ['Launcher', 'Arranger'], 'Arranger')

  /**
   * Observing notes
   * @param {*} x - step number
   * @param {*} y - note number
   * @param {*} stat - note status (0, 1, 2)
   */
  function observingNotes (x, y, stat) {
    if (currentNotesInClip[x] === undefined) {
      currentNotesInClip[x] = []
    }

    if (stat === 0) {
      delete currentNotesInClip[x][y]
    } else {
      currentNotesInClip[x][y] = stat
    }

    if (booleanOption.indexOf(continuousMode.get()) === 1) {
      correctNotesToScale(getCursorClip(), selectedScaleMode, selectedScale)
    }
  }

  // Write the Scale & Mode to the title of the clip
  documentState.getSignalSetting('Name the Clip', 'Scale Maker', 'Name Clip').addSignalObserver(() => {
    getCursorClip().setName(selectedScaleMode.get() + '-' + selectedScale.get())
  })

  // Fit to Scale Button observer
  documentState.getSignalSetting('Fit to Scale', 'Scale Maker', 'Fit to Scale').addSignalObserver(() => {
    correctNotesToScale(getCursorClip(), selectedScaleMode, selectedScale)
  })

  // Write all notes of the scale to the first step of the cursorClip
  documentState.getSignalSetting('Write Note Stack', 'Scale Maker', 'Write Note Stack').addSignalObserver(() => {
    writeAllNotesOfScale(getCursorClip(), selectedScaleMode, selectedScale)
  })
}

/**
 * Observer for NoteStep changes (including selection state).
 *
 * @param {NoteStep} noteStep - The changed NoteStep object
 */
function observingNoteSteps (noteStep) {
  const x = noteStep.x()
  const y = noteStep.y()

  if (selectedNotesInClip[x] === undefined) {
    selectedNotesInClip[x] = []
  }

  if (noteStep.isIsSelected()) {
    selectedNotesInClip[x][y] = true
  } else {
    delete selectedNotesInClip[x][y]
  }
}

function flush () {}

function exit () {
  println('-- Scale Maker Bye! --')
}
