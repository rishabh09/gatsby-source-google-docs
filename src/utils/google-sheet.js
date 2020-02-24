const {google} = require("googleapis")
const {googleAuth} = require("./google-auth")

function sheetToJSON(data) {
  const keys = data[0]
  data.shift()

  return data.map(arr => {
    return arr.reduce((acc, value, i) => {
      acc[keys[i]] = value
      return acc
    }, {})
  })
}

async function fetchGoogleSpreadSheet({id}) {
  const auth = googleAuth.getAuth()

  return new Promise((resolve, reject) => {
    google.sheets({version: "v4", auth}).spreadsheets.values.get(
      {
        spreadsheetId: id,
        range: "Sheet1!A:Z",
      },
      (err, res) => {
        if (err) {
          return reject(err)
        }

        if (!res.data) {
          return reject("Empty data")
        }
        resolve(sheetToJSON(res.data.values))
      }
    )
  })
}

module.exports = {
  fetchGoogleSpreadSheet,
}
