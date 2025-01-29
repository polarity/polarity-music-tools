loadAPI(17)

// Remove this if you want to be able to use deprecated methods without causing script to stop.
// This is useful during development.
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Polarity', 'Filename Generator', '0.1', 'ba6e60e8-990d-4975-a727-5db5896e4204', 'Polarity')
const listGenre = ['DNB', 'AMB', 'MTE', 'TFS', 'TST', 'PST']

/**
 * generates a string based on the current date
 * @returns {string}
 */
function generateDate () {
  const date = new Date()
  return date.toISOString().split('T')[0]
}

/*
 * init the Bitwig Controller script
 */
function init () {
  var documentState = host.getDocumentState()

  // TODO: Perform further initialization here.
  println('Filename Generator Go! ----------------------------')

  // create a dropdown field with a default value of 'DNB'
  const selectedGenre = documentState.getEnumSetting('Genre', 'Filename Generator', listGenre, 'DNB')

  // create a text input field
  const inputFilename = documentState.getStringSetting('Filename', 'Filename Generator', 50, '')
  // create a button that will generate a random name based on the current date and the selected genre
  documentState.getSignalSetting(' ', 'Filename Generator', 'Generate Name').addSignalObserver(() => {
    inputFilename.set(generateDate() + '_' + selectedGenre.get())
    return 'test'
  })
}

function flush () {
  // TODO: Flush any output to your controller here.
}

function exit () {

}
