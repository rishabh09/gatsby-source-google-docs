const json2md = require("json2md")
const YAML = require("yamljs")
const _last = require("lodash/last")
const _get = require("lodash/get")
const _repeat = require("lodash/repeat")
const {getToc, slugGenerate} = require("./toc")
const _cloneDeep = require("lodash/cloneDeep")

function getParagraphTag(p) {
  const tags = {
    NORMAL_TEXT: "p",
    SUBTITLE: "blockquote",
    HEADING_1: "h1",
    HEADING_2: "h2",
    HEADING_3: "h3",
    HEADING_4: "h4",
    HEADING_5: "h5",
  }

  return tags[p.paragraphStyle.namedStyleType]
}

function getListTag(list) {
  const glyphType = _get(list, [
    "listProperties",
    "nestingLevels",
    0,
    "glyphType",
  ])
  return glyphType !== undefined ? "ol" : "ul"
}

function cleanText(text, ignoreLineBreak = false) {
  return ignoreLineBreak
    ? text.replace(/\n/g, "<br/>").trim()
    : text.replace(/\n/g, "").trim()
}

function getNestedListIndent(level, listTag) {
  const indentType = listTag === "ol" ? "1." : "-"
  return `${_repeat("  ", level)}${indentType} `
}

function getTextFromParagraph(p, ignoreLineBreak = false) {
  return p.elements
    ? p.elements
        .map(el => (el.textRun ? getText(el, {ignoreLineBreak}) : ""))
        .join(" ")
        .replace(" .", ".")
        .replace(" ,", ",")
    : ""
}

function getTableCellContent(content) {
  if (!content.length === 0) return ""
  return content
    .map(({paragraph}) => getTextFromParagraph(paragraph, true))
    .join("")
}

function getImage(inlineObjects, element) {
  const embeddedObject =
    inlineObjects[element.inlineObjectElement.inlineObjectId]
      .inlineObjectProperties.embeddedObject

  if (embeddedObject && embeddedObject.imageProperties) {
    return {
      source: embeddedObject.imageProperties.contentUri,
      title: embeddedObject.title || "",
      description: embeddedObject.description || "",
    }
  }

  return null
}

function getBulletContent(inlineObjects, element) {
  if (element.inlineObjectElement) {
    const image = getImage(inlineObjects, element)
    const text = `![${image.description}](${image.source} "${image.title}")`
    return {text, image}
  }
  const text = getText(element)
  return {text}
}

function getText(element, {isHeader = false, ignoreLineBreak = false} = {}) {
  let text = element.textRun.content

  const {link, strikethrough, bold, italic} = element.textRun.textStyle

  const tickRegex = /(?<=`)(.*?)/g
  const isLineQuoute = tickRegex.test(text)
  if (isLineQuoute) {
    console.log(text)
  }
  text = isLineQuoute ? text : text.replace(/_/g, "\\_")
  text = isLineQuoute ? text : text.replace(/<(?![<br/>])/g, "&lt;")
  text = isLineQuoute ? text : text.replace(/>/g, "&gt;")
  text = cleanText(text, ignoreLineBreak)

  const isEmptyString = text.length === 0

  if (italic && !isEmptyString && !isLineQuoute) {
    text = `_${text}_`
  }

  // Set bold unless it's a header
  if (bold & !isHeader && !isEmptyString && !isLineQuoute) {
    text = `**${text}**`
  }

  if (strikethrough && !isEmptyString && !isLineQuoute) {
    text = `~~${text}~~`
  }

  if (link && !isEmptyString && !isLineQuoute) {
    return `[${text}](${link.url})`
  }

  return text
}

function checkHeadingId(curHeadingId, toc) {
  if (!curHeadingId) return false
  return !!toc.find(({headingId, items}) => {
    return (
      items.find(({headingId}) => curHeadingId === headingId) ||
      headingId === curHeadingId
    )
  })
}

function convertGoogleDocumentToJson(data, breadcrumb = []) {
  const {body, inlineObjects, lists} = data
  const pages = []
  let content = []
  let images = []
  let toc = []
  let currentTitle = ""

  body.content.forEach(({paragraph, table, tableOfContents}, i) => {
    if (tableOfContents && breadcrumb.length < 2) {
      // page is nested
      toc = getToc(tableOfContents)
    } else if (paragraph) {
      // Paragraph
      const tag = getParagraphTag(paragraph)

      // Lists
      if (paragraph.bullet) {
        const listId = paragraph.bullet.listId
        const listTag = getListTag(lists[listId])

        const items = paragraph.elements.map(el =>
          getBulletContent(inlineObjects, el)
        )
        const bulletContent = items
          .map(({text}) => text)
          .filter(text => text.length > 0)
          .join(" ")
          .replace(" .", ".")
          .replace(" ,", ",")
        const imgs = items.map(({image}) => image).filter(img => !!img)
        images = images.concat(imgs)
        const prev = body.content[i - 1]
        const prevListId = _get(prev, "paragraph.bullet.listId")

        if (prevListId === listId) {
          const list = _last(content)[listTag]
          const {nestingLevel} = paragraph.bullet

          if (nestingLevel !== undefined) {
            // mimic nested lists
            const lastIndex = list.length - 1
            const indent = getNestedListIndent(nestingLevel, listTag)

            list[lastIndex] += `\n${indent} ${bulletContent}`
          } else {
            list.push(bulletContent)
          }
        } else {
          content.push({[listTag]: [bulletContent]})
        }
      }

      // Headings, Images, Texts
      else if (tag) {
        let tagContent = []

        paragraph.elements.forEach(el => {
          // EmbeddedObject
          if (el.inlineObjectElement) {
            const image = getImage(inlineObjects, el)

            if (image) {
              tagContent.push({
                img: image,
              })
              images.push({
                img: image,
              })
            }
          }

          // Headings, Texts
          else if (el.textRun && el.textRun.content !== "\n") {
            const headingId = paragraph.paragraphStyle.headingId
            const isInToc = checkHeadingId(headingId, toc)
            const text = getText(el, {isHeader: tag !== "p"})
            tagContent.push({
              [tag]: text,
            })
            if (!currentTitle && isInToc) {
              content = []
              currentTitle = text
            } else if (isInToc) {
              pages.push({
                slug: slugGenerate(currentTitle),
                title: currentTitle,
                content: _cloneDeep(content),
                images: _cloneDeep(images),
              })
              content = []
              images = []
              currentTitle = text
            }
          }
        })

        if (tagContent.every(el => el[tag] !== undefined)) {
          content.push({
            [tag]: tagContent
              .map(el => el[tag])
              .join(" ")
              .replace(" .", ".")
              .replace(" ,", ","),
          })
        } else {
          content.push(...tagContent)
        }
      }
    }

    // Table
    else if (table && table.tableRows.length > 0) {
      const isCodeBlock = table.rows === 1 && table.columns === 1
      if (isCodeBlock) {
        const cell = table.tableRows[0].tableCells[0]
        if (cell) {
          const codeArr = cell.content.reduce((acc, {paragraph}) => {
            const code = paragraph.elements.map(
              el => (el.textRun && el.textRun.content) || ""
            )
            acc = acc.concat(code)
            return acc
          }, [])
          const code = codeArr.join("").split("\u000b")
          content.push({
            code: {
              lang: "sh", //set default to sh
              content: code,
            },
          })
        }
      } else {
        const [thead, ...tbody] = table.tableRows
        content.push({
          table: {
            headers: thead.tableCells.map(({content}) =>
              getTableCellContent(content)
            ),
            rows: tbody.map(row =>
              row.tableCells.map(({content}) => getTableCellContent(content))
            ),
          },
        })
      }
    }

    if (i === body.content.length - 1) {
      const isTocEmpty = toc.length === 0
      let title = isTocEmpty ? data.title : currentTitle
      let headingTitle = breadcrumb.length > 1 ? breadcrumb[1] : title
      if (isTocEmpty) {
        toc.push({
          title: headingTitle,
          slug: slugGenerate(headingTitle),
          items: [
            {
              text: title,
              slug: slugGenerate(title),
            },
          ],
        })
      }
      pages.push({
        slug: slugGenerate(title),
        title: title,
        content: _cloneDeep(content),
        images,
      })
    }
  })

  return {pages, toc}
}

function convertJsonToMarkdown({content, file}) {
  // Do NOT move the formatting of the following lines
  // to prevent markdown parsing errors
  return `---
${YAML.stringify(file)}
---

${json2md(content)}`
}

module.exports = {
  convertGoogleDocumentToJson,
  convertJsonToMarkdown,
}
