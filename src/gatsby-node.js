const {fetchGoogleDocsDocuments} = require("./utils/google-docs")
const {fetchAndReplaceGoogleImages} = require("./utils/images")
const {MIME_TYPE_SHEET} = require("./utils/google-drive")

exports.sourceNodes = async (
  {
    actions: {createNode},
    createNodeId,
    createContentDigest,
    store,
    cache,
    reporter,
  },
  pluginOptions
) => {
  try {
    const googleDocsDocuments = await fetchGoogleDocsDocuments(pluginOptions)

    for (const document of googleDocsDocuments) {
      if (document && document.mimeType === MIME_TYPE_SHEET) {
        const documentNodeId =
          document && createNodeId(`GoogleSheet-${document.id}`)
        createNode({
          document,
          id: documentNodeId,
          internal: {
            type: "GoogleSheet",
            contentDigest: createContentDigest(document.content),
          },
          dir: process.cwd(),
        })
      } else {
        const documentNodeId =
          document && createNodeId(`GoogleDocs-${document.id}`)

        if (pluginOptions.replaceGoogleImages !== false) {
          document.markdown = await fetchAndReplaceGoogleImages({
            documentNodeId,
            document,
            store,
            cache,
            createNode,
            createNodeId,
          })
        }

        createNode({
          document,
          id: documentNodeId,
          internal: {
            type: "GoogleDocs",
            mediaType: "text/markdown",
            content: document.markdown,
            contentDigest: createContentDigest(document.markdown),
          },
          dir: process.cwd(),
        })
      }
    }
  } catch (e) {
    console.log(e)
    if (pluginOptions.debug) {
      reporter.panic(`source-google-docs: `, e)
    } else {
      reporter.panic(`source-google-docs: ${e.message}`)
    }
  }
}
