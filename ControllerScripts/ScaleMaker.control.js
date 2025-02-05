/**
 * Scale Maker
 * Controller script for Bitwig Studio
 * Generates Scales in the Piano roll or corrects selected notes to the chosen scale
 * @version 0.1
 * @author Polarity
 */

loadAPI(17)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Polarity', 'Scale Maker', '0.1', 'b3f52fc6-e887-4bb6-927a-57b11a60e087', 'Polarity')

// Define the dropdown options for the UI
const listScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const booleanOption = ['No', 'Yes']
let scaleIntervals

// load in the external scales.js file
load('scales.js')

// convert scaleIntervals object to an array of names
// we need this for the dropdown in the UI
const listScaleMode = Object.keys(scaleIntervals)

// Store the current notes in the clip
const currentNotesInClip = []

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
 * Find closest higher and lower notes in the scale
 * the problem is that we need multiple options for the same note
 * so we can move to a different note when the target note is already used
 * we dont want overlapping notes. so for example if you try to correct C and C#
 * for C minor, we want to move C# to D, not to C etc.
 * @param {*} y - note to find closest higher and lower notes
 * @param {*} scaleNotes - array of notes in the scale
 * @returns {Object} - object with lower and higher notes
 */
function findClosestHigherAndLower (y, scaleNotes) {
  let low = 0; let high = scaleNotes.length - 1
  // set lower and higher to infinity and -infinity
  let lower = -Infinity; let higher = Infinity

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
 * @param {*} y - note to find nearest scale note
 * @param {*} scaleNotes - array of notes in the scale
 * @returns {number} - nearest scale note
 */
function findNearestScaleNote (y, scaleNotes) {
  let left = 0; let right = scaleNotes.length - 1
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
 * Correct notes to the selected scale
 * @param {*} cursorClip - cursorClip object (Arranger or Launcher)
 * @param {*} selectedScaleMode - selected scale mode
 * @param {*} selectedScale - selected scale
 * @returns {void} - corrects the notes in the clip to the selected scale
 */
function correctNotesToScale (cursorClip, selectedScaleMode, selectedScale) {
  const scaleMode = selectedScaleMode.get()
  const scaleName = selectedScale.get()
  const rootIndex = listScale.indexOf(scaleName)
  if (rootIndex === -1) return
  const rootNote = 60 + rootIndex
  const intervals = scaleIntervals[scaleMode]
  if (!intervals) return

  // generate the notes in the scale and return the array
  const scaleNotes = generateScaleNotes(rootNote, intervals)

  // loop through the currentNotesInClip array and correct the notes to the scale
  for (const xStr in currentNotesInClip) {
    const x = parseInt(xStr)
    const stepNotes = currentNotesInClip[x] || {}

    // get the original notes and sort them by note number
    const originalNotes = Object.keys(stepNotes).map(Number).sort((a, b) => a - b)

    // create a set to store the used targets
    const usedTargets = new Set()

    // loop through the original notes and correct them to the scale
    for (const y of originalNotes) {
      if (scaleNotes.includes(y)) {
        usedTargets.add(y)
        continue
      }

      // find the closest higher and lower notes in the scale
      const { lower, higher } = findClosestHigherAndLower(y, scaleNotes)
      const candidates = []

      // add the lower and higher notes to the candidates array
      // when the note is not already used or in the original notes
      // we basically want to have candidates where we can move the note to
      if (lower !== -Infinity) candidates.push(lower)
      if (higher !== Infinity) candidates.push(higher)
      if (candidates.length === 0) continue

      // filter the candidates array to only have notes that are not used or in the original notes
      const availableCandidates = candidates.filter(c => !usedTargets.has(c) && !originalNotes.includes(c))
      let targetY

      // if there are no available candidates, we want to find the nearest scale note
      if (availableCandidates.length === 0) {
        // filter the candidates array to only have notes that are not used
        const possibleCandidates = candidates.filter(c => !usedTargets.has(c))
        // if there are no possible candidates, find the nearest scale note
        if (possibleCandidates.length === 0) {
          // find the nearest scale note
          targetY = findNearestScaleNote(y, scaleNotes)
          // if the target note is already used, continue
          if (usedTargets.has(targetY)) continue
        } else {
          // if there are possible candidates, find the closest one to the original note
          targetY = possibleCandidates.reduce((prev, curr) => Math.abs(curr - y) < Math.abs(prev - y) ? curr : prev)
        }
      } else {
        // if there are available candidates, find the closest one to the original note
        targetY = availableCandidates.reduce((prev, curr) => Math.abs(curr - y) < Math.abs(prev - y) ? curr : prev)
      }

      // if the target note is already used, continue
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
 * this method writes a big stack of notes on the first step of the cursorClip
 * to show which notes are in the scale and mode. we set the velocity to 0 to
 * mute the notes, its just for visualisation!
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

  // generate the notes in the scale and return the array
  const scaleNotes = generateScaleNotes(rootNote, intervals)

  // clear all steps in the cursorClip
  cursorClip.clearSteps()

  // loop through the scaleNotes array and write all notes to the first step
  for (const y of scaleNotes) {
    cursorClip.setStep(0, y, 60, 0.25)

    // wait for a few ms to not stress the cpu too much
    // Bitwig, Y U setStep NO return a "Note Step" object?
    host.scheduleTask(() => {
      cursorClip.getStep(0, 0, y).setIsMuted(true)
    }, 200)
  }
}

function init () {
  println('-- Scale Maker Go! --')

  const documentState = host.getDocumentState()
  const cursorClipArranger = host.createArrangerCursorClip((16 * 8), 128)
  const cursorClipLauncher = host.createLauncherCursorClip((16 * 8), 128)
  cursorClipArranger.addStepDataObserver(observingNotes)
  cursorClipLauncher.addStepDataObserver(observingNotes)
  cursorClipArranger.scrollToKey(0)
  cursorClipLauncher.scrollToKey(0)

  /**
   * get the correct cursor clip based on the selected clip type
   * @returns {CursorClip} - the cursor clip based on the selected clip type
   */
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
   * This method is called when a note is added or removed in the clip
   * It stores the notes in the global currentNotesInClip array
   * and corrects the notes to the scale when continuousMode is on
   * @param {*} x - step number
   * @param {*} y - note number
   * @param {*} stat - note status (0, 1, 2)
   */
  function observingNotes (x, y, stat) {
    // x is the step number (16 for each bar)
    // y is the note number (128) 60 = C3
    // stat gives info about 0 = no note,
    // 1 = continuous note (from the previous step),
    // 2 = note starts playing

    // ok i want to store the note data in a multidimensional array,
    // when stat is 0 i want to remove all data from x and y
    // when there is a note like stat 1 or 2 i want to store the note data in the array
    // I want to use currentNotesInClip[x][y] = stat
    // so we need to check first if the array exists, if not create it
    // then we can store the note data in the array or remove it when stat is 0
    // then we can use this array to generate the notes in the correct scale

    // check if the array exists, if not create it
    if (currentNotesInClip[x] === undefined) {
      // create the array
      currentNotesInClip[x] = []
    }

    // check if the note is on or off
    if (stat === 0) {
      // remove the note from the array
      delete currentNotesInClip[x][y]
    } else {
      // store the note in the array
      currentNotesInClip[x][y] = stat
    }

    // continuous Mode corrects the notes on the fly
    // can maybe stress the cpu too much, so you can decide to turn it off
    if (booleanOption.indexOf(continuousMode.get()) === 1) {
      correctNotesToScale(getCursorClip(), selectedScaleMode, selectedScale)
    }
  }

  // Write the Scale & Mode to the title of the clip
  documentState.getSignalSetting('Name the Clip', 'Scale Maker', 'Name Clip').addSignalObserver(() => {
    getCursorClip().setName(selectedScaleMode.get() + '-' + selectedScale.get())
  })

  // Fit to Scale Button observer, when user clicks the button
  documentState.getSignalSetting('Fit to Scale', 'Scale Maker', 'Fit to Scale').addSignalObserver(() => {
    correctNotesToScale(getCursorClip(), selectedScaleMode, selectedScale)
  })

  // Write all notes of the scale to the first step of the cursorClip
  documentState.getSignalSetting('Write Note Stack', 'Scale Maker', 'Write Note Stack').addSignalObserver(() => {
    writeAllNotesOfScale(getCursorClip(), selectedScaleMode, selectedScale)
  })
}

function flush () {}
function exit () {
  println('-- Scale Maker Bye! --')
}
