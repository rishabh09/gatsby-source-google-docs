function slugGenerate(heading) {
  return heading
    .split(" ")
    .join("-")
    .toLowerCase()
}
function getToc(obj) {
  const toc = {}
  let currentHeading = ""
  obj.content.forEach(({paragraph}) => {
    const {elements, paragraphStyle} = paragraph
    const {indentStart} = paragraphStyle
    const text = elements[0].textRun.content

    const headingId =
      elements[0].textRun.textStyle.link &&
      elements[0].textRun.textStyle.link.headingId
    let slug = slugGenerate(text)
    if (indentStart && indentStart.magnitude === undefined) {
      currentHeading = text
      toc[text] = {
        headingId,
        slug,
        items: [],
      }
    } else if (
      indentStart &&
      indentStart.magnitude === 18 &&
      toc[currentHeading]
    ) {
      toc[currentHeading].items.push({
        text,
        headingId,
        slug,
      })
    }
  })

  return Object.keys(toc).map(title => {
    return {
      title,
      ...toc[title],
    }
  })
}
module.exports = {getToc, slugGenerate}
