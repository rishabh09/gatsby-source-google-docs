const {google} = require("googleapis")
const {googleAuth} = require("./google-auth")

function sheetToJSON(data) {
  const keys = data[0]
  data.shift()

  return data.map((arr, index) => {
    return arr.reduce(
      (acc, value, i) => {
        acc[keys[i]] = value
        return acc
      },
      {index}
    )
  })
}

async function fetchGoogleSpreadSheet({id}) {
  const auth = googleAuth.getAuth()
  const sheets = await new Promise((resolve, reject) => {
    google.sheets({version: "v4", auth}).spreadsheets.get(
      {
        spreadsheetId: id,
      },
      (err, res) => {
        if (err) {
          return reject(err)
        }

        if (!res.data) {
          return reject("Empty data")
        }
        const titles = res.data.sheets.map(({properties}) => properties.title)
        resolve(titles)
      }
    )
  })
  return new Promise((resolve, reject) => {
    google.sheets({version: "v4", auth}).spreadsheets.values.batchGet(
      {
        spreadsheetId: id,
        ranges: sheets.map(name => `${name}!A:Z`),
      },
      (err, res) => {
        if (err) {
          return reject(err)
        }

        if (!res.data) {
          return reject("Empty data")
        }
        const data = res.data.valueRanges.map(({values}, i) => ({
          name: sheets[i],
          content: sheetToJSON(values),
        }))
        resolve(data)
      }
    )
  })
}

module.exports = {
  fetchGoogleSpreadSheet,
}
