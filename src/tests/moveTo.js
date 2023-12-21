exports.moveTo = moveTo;

// Move mouse.
async function moveTo(config, step, driver) {
  let result = {
    status: "PASS",
    description: "Moved mouse.",
  };

  // Validate step payload
  // TODO: Add validation

  // Instantiate cursor
  await driver.execute(() => {
    if (document.querySelector("mouse-pointer")) return;
    const cursor = document.createElement("mouse-pointer");
    const styleElement = document.createElement("style");
    styleElement.innerHTML = `
      mouse-pointer {
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
      mouse-pointer.button-1 {
        transition: none;
        background: #fff;
      }
      mouse-pointer.button-2 {
        transition: none;
        border-color: #fff;
      }
      mouse-pointer.button-3 {
        transition: none;
        border-radius: 4px;
      }
      mouse-pointer.button-4 {
        transition: none;
        border-color: #fff;
      }
      mouse-pointer.button-5 {
        transition: none;
        border-color: #fff;
      }
    `;
    document.head.appendChild(styleElement);
    document.body.appendChild(cursor);
    document.addEventListener("mousedown", (e) => {
      cursor.classList.add("button-" + e.which);
    }, false);
    document.addEventListener("mouseup", (e) => {
      cursor.classList.remove("button-" + e.which);
    }, false);
    document.addEventListener("mousemove", (e) => {
      cursor.style.left = e.pageX + "px";
      cursor.style.top = e.pageY + "px";
      document.elementFromPoint(e.pageX - window.scrollX, e.pageY - window.scrollY).click();
    }, false);
  });

  try {
    // Set cursor style
    await driver.execute(() => {
      document.body.style.cursor = "default";
    });
    // Execute add event listener for mousemove
    await driver.execute(() => {
      document.addEventListener("mousemove", (e) => {
        window.mouseX = e.clientX;
        window.mouseY = e.clientY;
      });
    });
    await driver.action("pointer").move({x: 100, y: 100, origin: "pointer", duration: 500}).perform();
    const position  = await driver.execute(() => {
      return {
        x: window.mouseX,
        y: window.mouseY,
      };
    });
    // Calc coordinates
    // const bounds = await elementHandle.boundingBox();
    // let x = bounds.x;
    // if (action.offsetX) x = x + Number(action.offsetX);
    // if (action.alignH) {
    //   if (action.alignH === "left") {
    //     alignHOffset = 10;
    //   } else if (action.alignH === "center") {
    //     alignHOffset = bounds.width / 2;
    //   } else if (action.alignH === "right") {
    //     alignHOffset = bounds.width - 10;
    //   } else {
    //     // FAIL
    //     status = "FAIL";
    //     description = `Invalid 'alignH' value.`;
    //     result = { status, description };
    //     return { result };
    //   }
    //   x = x + alignHOffset;
    // }
    // let y = bounds.y;
    // if (action.offsetY) y = y + Number(action.offsetY);
    // if (action.alignV) {
    //   if (action.alignV === "top") {
    //     alignVOffset = 10;
    //   } else if (action.alignV === "center") {
    //     alignVOffset = bounds.height / 2;
    //   } else if (action.alignV === "bottom") {
    //     alignVOffset = bounds.height - 10;
    //   } else {
    //     // FAIL
    //     status = "FAIL";
    //     description = `Invalid 'alignV' value.`;
    //     result = { status, description };
    //     return { result };
    //   }
    //   y = y + alignVOffset;
    // }
    // // Move
    // await page.mouse.move(x, y, { steps: 25 });
    // // Display mouse cursor
    // await page.$eval(
    //   "puppeteer-mouse-pointer",
    //   (e) => (e.style.display = "block")
    // );
    // // PASS
    // status = "PASS";
    // description = `Moved mouse to element.`;
    // result = { status, description };
    // return { result };
  } catch {
    // // FAIL
    // status = "FAIL";
    // description = `Couldn't move mouse to element.`;
    // result = { status, description };
    // return { result };
  }
}
