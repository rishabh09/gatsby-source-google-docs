const {google} = require("googleapis")
const _kebabCase = require("lodash/kebabCase")
const _cloneDeep = require("lodash/cloneDeep")

const {googleAuth} = require("./google-auth")

const MIME_TYPE_DOCUMENT = "application/vnd.google-apps.document"
const MIME_TYPE_FOLDER = "application/vnd.google-apps.folder"

const enhanceDocument = ({
  document,
  fieldsDefault,
  fieldsMapper,
  breadcrumb,
}) => {
  const enhancedDocument = _cloneDeep(document)

  // Default values
  if (fieldsDefault) {
    Object.keys(fieldsDefault).forEach(key => {
      Object.assign(enhancedDocument, {
        [key]: fieldsDefault[key],
      })
    })
  }

  // Fields transformation
  if (fieldsMapper) {
    Object.keys(fieldsMapper).forEach(oldKey => {
      const newKey = fieldsMapper[oldKey]

      Object.assign(enhancedDocument, {
        [newKey]: document[oldKey],
      })

      delete enhancedDocument[oldKey]
    })
  }

  // Breadcrumb
  Object.assign(enhancedDocument, {
    breadcrumb,
  })

  // Transform description into metadata if description is JSON object
  if (document.description) {
    try {
      const description = JSON.parse(document.description)

      Object.assign(enhancedDocument, description)

      delete enhancedDocument.description
    } catch (e) {
      // Description field is not a JSON
      // Do not throw an error if JSON.parse fail
    }
  }

  return enhancedDocument
}

async function fetchTree({
  debug,
  breadcrumb,
  folderId,
  fields,
  fieldsDefault,
  fieldsMapper,
}) {
  const auth = googleAuth.getAuth()

  return new Promise((resolve, reject) => {
    google.drive({version: "v3", auth}).files.list(
      {
        includeTeamDriveItems: true,
        supportsAllDrives: true,
        q: `${
          folderId ? `'${folderId}' in parents and ` : ""
        }(mimeType='${MIME_TYPE_FOLDER}' or mimeType='${MIME_TYPE_DOCUMENT}') and trashed = false`,
        fields: `files(id, mimeType, name, description, createdTime, modifiedTime, starred${
          fields ? `, ${fields.join(", ")}` : ""
        })`,
      },
      async (err, res) => {
        if (err) {
          return reject(err)
        }

        const rawDocuments = res.data.files.filter(
          file => file.mimeType === MIME_TYPE_DOCUMENT
        )
        const rawFolders = res.data.files.filter(
          file => file.mimeType === MIME_TYPE_FOLDER
        )

        const documents = rawDocuments.map(document =>
          enhanceDocument({
            document,
            fieldsDefault,
            fieldsMapper,
            breadcrumb,
          })
        )

        let folders = []
        for (const folder of rawFolders) {
          if (debug) {
            const breadCrumbString =
              breadcrumb.length > 0 ? breadcrumb.join("/") + "/" : ""
            // eslint-disable-next-line no-console
            console.info(
              `source-google-docs: Fetching ${breadCrumbString}${folder.name}`
            )
          }

          const files = await fetchTree({
            debug,
            breadcrumb: [...breadcrumb, folder.name],
            folderId: folder.id,
            fields,
            fieldsMapper,
            rootFolderId: folderId,
          })

          folders.push({
            id: folder.id,
            name: folder.name,
            mimeType: folder.mimeType,
            files,
            folderId,
          })
        }

        resolve([...documents, ...folders])
      }
    )
  })
}

async function fetchGoogleDriveFiles({folders = [null], ...options}) {
  const googleDriveFiles = []

  await Promise.all(
    folders.map(async folderId => {
      const googleDriveTree = await fetchTree({
        breadcrumb: [],
        folderId,
        ...options,
      })

      const flattenGoogleDriveFiles = flattenTree({
        path: "",
        files: googleDriveTree,
        ...options,
      })

      googleDriveFiles.push(...flattenGoogleDriveFiles)
    })
  )

  return googleDriveFiles
}

function flattenTree({path, files, fieldsMapper, rootFolderId}) {
  const documents = files
    .filter(file => file.mimeType === MIME_TYPE_DOCUMENT)
    .map(file => {
      const fileName = fieldsMapper["name"]
        ? file[fieldsMapper["name"]]
        : file.name

      return {...file, path: `${path}/${_kebabCase(fileName)}`, rootFolderId}
    })

  const documentsInFolders = files
    .filter(file => file.mimeType === MIME_TYPE_FOLDER)
    .reduce((acc, folder) => {
      const folderFiles = flattenTree({
        path: `${path}/${_kebabCase(folder.name)}`,
        files: folder.files,
        fieldsMapper,
        rootFolderId,
      })

      acc.push(...folderFiles)

      return acc
    }, [])

  return [...documents, ...documentsInFolders]
}

module.exports = {
  fetchGoogleDriveFiles,
}
