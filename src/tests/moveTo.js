const { validate } = require("doc-detective-common");

exports.moveTo = moveTo;
exports.instantiateCursor = instantiateCursor;

async function instantiateCursor(driver) {
  // Detect if cursor is instantiated
  const cursor = await driver.$("dd-mouse-pointer");

  if (!cursor.elementId) {
    // Get viewport size
    const viewportSize = await driver.execute(() => {
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      };
    });
    viewportSize.centerX = Math.round(viewportSize.innerWidth / 2);
    viewportSize.centerY = Math.round(viewportSize.innerHeight / 2);

    // Instantiate cursor
    await driver.execute(() => {
      const cursor = document.createElement("dd-mouse-pointer");
      const styleElement = document.createElement("style");
      styleElement.innerHTML = `
      dd-mouse-pointer {
        pointer-events: none;
        position: absolute;
        top: 0;
        z-index: 10000;
        left: 0;
        width: 20px;
        height: 20px;
        background: #2f2f2f;
        border: 1px solid #fff;
        border-radius: 50%;
        margin: -10px 0 0 -10px;
        padding: 0;
        transition: background .2s, border-radius .2s, border-color .2s;
      }
      dd-mouse-pointer.click {
        transition: none;
        background: #fff;
      }
    `;
      document.head.appendChild(styleElement);
      document.body.appendChild(cursor);
      document.addEventListener(
        "mousedown",
        (e) => {
          cursor.classList.add("click");
        },
        false
      );
      document.addEventListener(
        "mouseup",
        (e) => {
          cursor.classList.remove("click");
        },
        false
      );
      document.addEventListener(
        "mousemove",
        (e) => {
          cursor.style.left = e.pageX + "px";
          cursor.style.top = e.pageY + "px";
          document
            .elementFromPoint(
              e.pageX - window.scrollX,
              e.pageY - window.scrollY
            )
            .click();
        },
        false
      );
      document.addEventListener("mousemove", (e) => {
        window.mouseX = e.clientX;
        window.mouseY = e.clientY;
      });
    });

    // Move cursor to center of viewport
    await driver.performActions([
      {
        type: "pointer",
        id: "mouse",
        parameters: { pointerType: "mouse" },
        actions: [
          {
            type: "pointerMove",
            duration: 0,
            x: viewportSize.centerX,
            y: viewportSize.centerY,
          },
        ],
      },
    ]);
  }
}

// Move mouse.
async function moveTo(config, step, driver) {
  let result = {
    status: "PASS",
    description: "Moved mouse.",
  };

  // Validate step payload
  isValidStep = validate("moveTo_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Calculate target coordinates based on selector, alignments, and offsets
  const element = await driver.$(step.selector);
  const size = await element.getSize();
  const location = await element.getLocation();
  const dimensions = {
    width: size.width,
    height: size.height,
    x: location.x,
    y: location.y,
  };

  const coordinates = {};
  switch (step.alignment) {
    case "center":
      coordinates.x = dimensions.x + dimensions.width / 2;
      coordinates.y = dimensions.y + dimensions.height / 2;
      break;
    case "top":
      coordinates.x = dimensions.x + dimensions.width / 2;
      coordinates.y = dimensions.y;
      break;
    case "bottom":
      coordinates.x = dimensions.x + dimensions.width / 2;
      coordinates.y = dimensions.y + dimensions.height;
      break;
    case "left":
      coordinates.x = dimensions.x;
      coordinates.y = dimensions.y + dimensions.height / 2;
      break;
    case "right":
      coordinates.x = dimensions.x + dimensions.width;
      coordinates.y = dimensions.y + dimensions.height / 2;
      break;
    default:
      break;
  }

  // Add offsets
  coordinates.x = coordinates.x + step.offset.x;
  coordinates.y = coordinates.y + step.offset.y;

  // Instantiate cursor
  await instantiateCursor(driver);

  try {
    // Move mouse
    await driver
      .action("pointer")
      .move({
        x: coordinates.x,
        y: coordinates.y,
        origin: "pointer",
        duration: step.duration,
      })
      .perform();
  } catch {
    // FAIL
    result.status = "FAIL";
    result.description = `Couldn't move mouse.`;
    return result;
  }

  // PASS
  return result;
}
