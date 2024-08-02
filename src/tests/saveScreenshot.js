const { validate } = require("doc-detective-common");
const { log } = require("../utils");
const path = require("path");
const fs = require("fs");
const PNG = require("pngjs").PNG;
const pixelmatch = require("pixelmatch");

exports.saveScreenshot = saveScreenshot;

async function saveScreenshot(config, step, driver) {
  let result = {
    status: "PASS",
    description: "Saved screenshot.",
  };

  // Validate step payload
  isValidStep = validate("saveScreenshot_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Set file name
  if (!step.path) {
    step.path = `${step.id}.png`;
    if (step.directory) { step.path = path.join(step.directory, step.path); }
  }
  let filePath = step.path;

  // Set path directory
  const dir = path.dirname(step.path);
  // If `dir` doesn't exist, create it
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
    
  // Check if file already exists
  let existFilePath;
  if (fs.existsSync(filePath)) {
    if (step.overwrite == "false") {
      // File already exists
      result.status = "SKIPPED";
      result.description = `File already exists: ${filePath}`;
      return result;
    } else {
      // Set temp file path
      existFilePath = filePath;
      filePath = path.join(dir, `${step.id}_${Date.now()}.png`);
    }
  }

  try {
    // If recording is true, hide cursor
    if (config.recording) {
      await driver.execute(() => {
        document.querySelector("dd-mouse-pointer").style.display = "none";
      });
    }
    // Save screenshot
    await driver.saveScreenshot(filePath);
    // If recording is true, show cursor
    if (config.recording) {
      await driver.execute(() => {
        document.querySelector("dd-mouse-pointer").style.display = "block";
      });
    }
  } catch (error) {
    // Couldn't save screenshot
    result.status = "FAIL";
    result.description = `Couldn't save screenshot. ${error}`;
    return result;
  }

  // If file already exists
  // If overwrite is true, replace old file with new file
  // If overwrite is byVariance, compare files and replace if variance is greater than threshold
  if (existFilePath) {
    let percentDiff;

    // Perform numerical pixel diff with pixelmatch
    if (step.maxVariation) {
      const img1 = PNG.sync.read(fs.readFileSync(existFilePath));
      const img2 = PNG.sync.read(fs.readFileSync(filePath));

      // Compare wight and height of images
      if (img1.height !== img2.height || img1.width !== img2.width) {
        result.status = "FAIL";
        result.description = `Couldn't compare images. Images are not the same size.`;
        return result;
      }

      const { width, height } = img1;
      const numDiffPixels = pixelmatch(
        img1.data,
        img2.data,
        null,
        width,
        height,
        { threshold: 0.0005 }
      );
      percentDiff = (numDiffPixels / (width * height)) * 100;

      log(config, "debug", {
        totalPixels: width * height,
        numDiffPixels,
        percentDiff,
      });

      if (percentDiff > step.maxVariation) {
        if (step.overwrite == "byVariation") {
          // Replace old file with new file
          // TODO: Not working
          fs.unlinkSync(existFilePath);
          fs.renameSync(filePath, existFilePath);
        }
        result.status = "FAIL";
        result.description = `Screenshots are beyond maximum accepted variation: ${percentDiff.toFixed(
          2
        )}%.`;
        return result;
      } else {
        result.description = `Screenshots are within maximum accepted variation: ${percentDiff.toFixed(
          2
        )}%.`;
        fs.unlinkSync(filePath);
      }
    }

    if (step.overwrite == "true") {
      // Replace old file with new file
      fs.unlinkSync(existFilePath);
      fs.renameSync(filePath, existFilePath);
    }
  }

  // PASS
  return result;
}
