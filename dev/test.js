const path = require("path");

const { DOMParser } = require("xmldom");
const xpath = require("xpath");
const JsZip = require("jszip");
const fs = require("fs");

//need to add declare:
let docxInputPath = path.resolve("test.docx");

load(docxInputPath);

async function load(docxInputPath) {
  // Read the docx internal xdocument
  wSelect = xpath.useNamespaces({
    w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  });
  let docxFile = fs.readFileSync(docxInputPath);
  await JsZip.loadAsync(docxFile).then(async (zip) => {
    await zip
      .file("word/document.xml")
      .async("string")
      .then((docx_str) => {
        let docx = new DOMParser().parseFromString(docx_str);
        let outputString = "";
        let paragraphElements = wSelect("//w:p", docx);
        console.log(paragraphElements);
        paragraphElements.forEach((paragraphElement) => {
          let textElements = this.wSelect(".//w:t", paragraphElement);
          textElements.forEach(
            (textElement) => (outputString += textElement.textContent)
          );
          if (textElements.length > 0) outputString += "\n";
        });
        console.log(outputString);
      });
  });
}
// let docText;
// textract.fromFileWithPath(filePath, function( error, text ) {
//     if (error) {
//         console.log(error);
//     }
//     docText = text;
//     console.log(docText);
// })
