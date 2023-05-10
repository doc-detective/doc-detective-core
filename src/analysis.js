const { log } = require("./utils");
const uuid = require("uuid");
const path = require("path");
const { exit } = require("process");
const fs = require("fs");

exports.checkTestCoverage = checkTestCoverage;
exports.checkMarkupCoverage = checkMarkupCoverage;

// Parse files for covered/uncovered lines
function checkTestCoverage(config, files) {
  let testCoverage = {
    files: [],
    errors: [],
  };

  // Loop through files
  for (const file of files) {
    log(config, "debug", `file: ${file}`);
    // Gather file/filetype metadata
    const extension = path.extname(file);
    fileType = config.fileTypes.find((fileType) =>
      fileType.extensions.includes(extension)
    );
    // Skip JSON files
    if (extension === ".json") {
      log(
        config,
        "info",
        `Skipping ${file}. JSON files are invalid targets for coverage analysis.`
      );
      continue;
    }
    // Set file parsing defaults
    let coveredByTest = false;
    let lineNumber = 0;
    fileJSON = {
      file,
      coveredLines: [],
      uncoveredLines: [],
      fileType,
    };
    // Gather content
    let content = fs.readFileSync(file).toString();
    content = content.split("\n");

    // Loop through lines of content to identify if each line is covered or not
    for (const line of content) {
      lineNumber++;
      let ignoreLine = false;
      if (line.includes(fileType.testStartStatementOpen)) {
        // Test start statement
        startStatementOpen =
          line.indexOf(fileType.testStartStatementOpen) +
          fileType.testStartStatementOpen.length;
        if (line.includes(fileType.testStartStatementClose)) {
          startStatementClose = line.lastIndexOf(
            fileType.testStartStatementClose
          );
        } else {
          startStatementClose = line.length;
        }
        startStatement = line.substring(
          startStatementOpen,
          startStatementClose
        );
        // Parse JSON
        statementJson = JSON.parse(startStatement);
        // Set following lines to covered
        coveredByTest = true;
        ignoreLine = true;
        // Check if test is defined externally
        if (statementJson.file) {
          referencePath = path.resolve(path.dirname(file), statementJson.file);
          // Check to make sure file exists
          if (fs.existsSync(referencePath)) {
          // Make sure test `id` exists in the referenced file
            if (statementJson.id) {
              remoteJSON = fs.readFileSync(referencePath).toString();
              remoteJSON = JSON.parse(remoteJSON);
              let idMatch = false;
              remoteJSON.forEach((spec) => {
                spec.tests.forEach((test) => {
                  if (test.id && test.id === statementJson.id) idMatch = true;
                });
              });
            }
          } else {
            // log error
            testCoverage.errors.push({
              file,
              lineNumber,
              description: `Referenced test spec missing: ${referencePath}.`,
            });
          }
        }
      } else if (line.includes(fileType.testIgnoreStatement)) {
        // Consider ignored lines as covered
        coveredByTest = true;
        ignoreLine = true;
      } else if (line.includes(fileType.testEndStatement)) {
        // Consider following lines uncovered
        coveredByTest = false;
        ignoreLine = true;
      } else if (
        line.includes(fileType.stepStatementOpen) &&
        line.includes(fileType.stepStatementClose)
      ) {
        ignoreLine = true;
      }

      // Evaluate coverage status for line
      if (coveredByTest && !ignoreLine) {
        fileJSON.coveredLines.push(lineNumber);
      } else if (!coveredByTest && !ignoreLine) {
        fileJSON.uncoveredLines.push(lineNumber);
      }
    }
    testCoverage.files.push(fileJSON);
  }
  return testCoverage;
}

// Detect markup on uncovered lines
function checkMarkupCoverage(config, testCoverage) {
  let markupCoverage = {
    summary: {
      covered: 0,
      uncovered: 0,
      markup: {}
    },
    files: [],
    errors: []
  }

  for (const i in testCoverage.files){
    const file = testCoverage.files[i];
  let fileCoverage = {
      file: file.file,
      covered: file.coveredLines.length,
      uncovered: file.uncoveredLines.length,
      markup: {}
    }
    markupCoverage.summary.covered = file.coveredLines.length;
    markupCoverage.summary.uncovered = file.uncoveredLines.length;

    let content = fs.readFileSync(file.file).toString();

    console.log(fileCoverage)
    process.exit()
    for (const i in file.fileType.markup) {
      const mark = file.fileType.markup[i];
        
    }

    // Only keep marks that have a truthy (>0) length
    Object.keys(markup).forEach((mark) => {
      markCoverage = {
        includeInCoverage: markup[mark].includeInCoverage,
        includeInSuggestions: markup[mark].includeInSuggestions,
        coveredLines: [],
        coveredMatches: [],
        uncoveredLines: [],
        uncoveredMatches: [],
      };

      markup[mark].regex.forEach((matcher) => {
        // Run a match
        regex = new RegExp(matcher, "g");
        matches = fileBody.match(regex);
        if (matches != null) {
          matches.forEach((match) => {
            // Check for duplicates and handle lines separately
            matchEscaped = match.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
            start = 0;
            occuranceRegex = new RegExp(matchEscaped, "g");
            occurances = fileBody.match(occuranceRegex).length;
            for (i = 0; i < occurances; i++) {
              index = fileBody.slice(start).match(matchEscaped).index;
              line = fileBody
                .slice(0, start + index)
                .split(/\r\n|\r|\n/).length;
              start = start + index + 1;
              matchObject = {
                line,
                indexInFile: start + index,
                text: match,
              };
              isCovered = file.coveredLines.includes(line);
              isUncovered = file.uncoveredLines.includes(line);
              inCoveredMatches = markCoverage.coveredMatches.some(
                (object) =>
                  object.line === matchObject.line &&
                  object.text === matchObject.text &&
                  object.indexInFile === matchObject.indexInFile
              );
              inUncoveredMatches = markCoverage.uncoveredMatches.some(
                (object) =>
                  object.line === matchObject.line &&
                  object.text === matchObject.text &&
                  object.indexInFile === matchObject.indexInFile
              );
              inCoveredLines = markCoverage.coveredLines.includes(line);
              inUncoveredLines = markCoverage.uncoveredLines.includes(line);
              // console.log({
              //   mark,
              //   matchObject,
              //   isCovered,
              //   isUncovered,
              //   inCoveredLines,
              //   inCoveredMatches,
              //   inUncoveredLines,
              //   inUncoveredMatches,
              // });
              if (isCovered) {
                if (!inCoveredLines) markCoverage.coveredLines.push(line);
                if (!inCoveredMatches)
                  markCoverage.coveredMatches.push(matchObject);
              } else if (isUncovered) {
                if (!inUncoveredLines) markCoverage.uncoveredLines.push(line);
                if (!inUncoveredMatches)
                  markCoverage.uncoveredMatches.push(matchObject);
              }
            }
          });
        }
      });
      file.markup[mark] = markCoverage;
    });
  }
  return markupCoverage;
}
