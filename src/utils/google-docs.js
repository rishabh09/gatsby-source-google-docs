const {google} = require("googleapis")

const {
  convertGoogleDocumentToJson,
  convertJsonToMarkdown,
} = require("./converters")
const {googleAuth} = require("./google-auth")
const {
  fetchGoogleDriveFiles,
  MIME_TYPE_DOCUMENT,
  MIME_TYPE_SHEET,
} = require("./google-drive")

async function fetchGoogleDocsContent({id}) {
  const auth = googleAuth.getAuth()

  return new Promise((resolve, reject) => {
    google.docs({version: "v1", auth}).documents.get(
      {
        documentId: id,
      },
      (err, res) => {
        if (err) {
          return reject(err)
        }

        if (!res.data) {
          return reject("Empty data")
        }

        resolve(convertGoogleDocumentToJson(res.data))
      }
    )
  })
}

async function fetchGoogleSpreadSheet({id}) {
  const auth = googleAuth.getAuth()

  return new Promise((resolve, reject) => {
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
        resolve(res.data)
      }
    )
  })
}

async function fetchGoogleDocsDocuments(pluginOptions) {
  const googleDriveFiles = await fetchGoogleDriveFiles(pluginOptions)

  return Promise.all(
    googleDriveFiles.map(async file => {
      if (file.mimeType === MIME_TYPE_DOCUMENT) {
        const content = await fetchGoogleDocsContent({
          id: file.id,
        })

        const markdown = convertJsonToMarkdown({file, content})

        const document = {
          ...file,
          content,
          markdown,
        }

        return document
      } else if (file.mimeType === MIME_TYPE_SHEET) {
        const content = await fetchGoogleSpreadSheet({
          id: file.id,
        })
        return file
      } else {
        console.log("type :", file.mimeType)
      }
    })
  )
}

module.exports = {
  fetchGoogleDocsDocuments,
}
