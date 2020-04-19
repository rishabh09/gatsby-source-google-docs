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
const {fetchGoogleSpreadSheet} = require("./google-sheet")

async function fetchGoogleDocsContent({id, breadcrumb = []}) {
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

        resolve(convertGoogleDocumentToJson(res.data, breadcrumb))
      }
    )
  })
}

async function fetchGoogleDocsDocuments(pluginOptions) {
  const googleDriveFiles =
    pluginOptions.files && pluginOptions.files.length
      ? pluginOptions.files.map(id => ({id, mimeType: MIME_TYPE_DOCUMENT}))
      : await fetchGoogleDriveFiles(pluginOptions)

  let files = []
  for (let file of googleDriveFiles) {
    if (file.mimeType === MIME_TYPE_DOCUMENT) {
      const {pages, toc} = await fetchGoogleDocsContent({
        id: file.id,
        breadcrumb: file.breadcrumb,
      })

      const docs = pages.map(({content, slug, title, images}) => {
        const newFile = {
          ...file,
          id: file.id + "-" + slug,
          slug,
          toc,
          title,
          images,
          collection: pluginOptions.name,
        }
        const markdown = convertJsonToMarkdown({file: newFile, content})
        const document = {
          ...newFile,
          content,
          markdown,
        }
        return document
      })
      files = files.concat(docs)
    } else if (file.mimeType === MIME_TYPE_SHEET) {
      const sheets = await fetchGoogleSpreadSheet({
        id: file.id,
      })

      sheets.forEach(({name, content}) => {
        files.push({
          ...file,
          id: file.id + "-" + name,
          collection: pluginOptions.name,
          name,
          content,
        })
      })
    } else {
      console.log("type :", file.mimeType)
    }
  }
  return Promise.all(files)
}

module.exports = {
  fetchGoogleDocsDocuments,
}
