const { validate } = require("../../../doc-detective-common");
const { Key } = require("webdriverio");

exports.typeKeys = typeKeys;

const specialKeyMap = {
  $CTRL$: Key.Ctrl,
  $NULL$: Key.NULL,
  $CANCEL$: Key.Cancel,
  $HELP$: Key.Help,
  $BACKSPACE$: Key.Backspace,
  $TAB$: Key.Tab,
  $CLEAR$: Key.Clear,
  $RETURN$: Key.Return,
  $ENTER$: Key.Enter,
  $SHIFT$: Key.Shift,
  $CONTROL$: Key.Control,
  $ALT$: Key.Alt,
  $PAUSE$: Key.Pause,
  $ESCAPE$: Key.Escape,
  $SPACE$: Key.Space,
  $PAGE_UP$: Key.PageUp,
  $PAGE_DOWN$: Key.PageDown,
  $END$: Key.End,
  $HOME$: Key.Home,
  $ARROW_LEFT$: Key.ArrowLeft,
  $ARROW_UP$: Key.ArrowUp,
  $ARROW_RIGHT$: Key.ArrowRight,
  $ARROW_DOWN$: Key.ArrowDown,
  $INSERT$: Key.Insert,
  $DELETE$: Key.Delete,
  $SEMICOLON$: Key.Semicolon,
  $EQUALS$: Key.Equals,
  $NUMPAD_0$: Key.Numpad0,
  $NUMPAD_1$: Key.Numpad1,
  $NUMPAD_2$: Key.Numpad2,
  $NUMPAD_3$: Key.Numpad3,
  $NUMPAD_4$: Key.Numpad4,
  $NUMPAD_5$: Key.Numpad5,
  $NUMPAD_6$: Key.Numpad6,
  $NUMPAD_7$: Key.Numpad7,
  $NUMPAD_8$: Key.Numpad8,
  $NUMPAD_9$: Key.Numpad9,
  $MULTIPLY$: Key.Multiply,
  $ADD$: Key.Add,
  $SEPARATOR$: Key.Separator,
  $SUBSTRACT$: Key.Subtract,
  $DECIMAL$: Key.Decimal,
  $DIVIDE$: Key.Divide,
  $F1$: Key.F1,
  $F2$: Key.F2,
  $F3$: Key.F3,
  $F4$: Key.F4,
  $F5$: Key.F5,
  $F6$: Key.F6,
  $F7$: Key.F7,
  $F8$: Key.F8,
  $F9$: Key.F9,
  $F10$: Key.F10,
  $F11$: Key.F11,
  $F12$: Key.F12,
  $COMMAND$: Key.Command,
  $ZANKAKU_HANDKAKU$: Key.ZenkakuHankaku
};

// Type a sequence of keys in the active element.
async function typeKeys(config, step, driver) {
  // TODO: Add optional delay between keystrokes

  let result = { status: "PASS", description: "Typed keys." };

  // Validate step payload
  isValidStep = validate("typeKeys_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Convert string to array for consistency
  if (typeof step.keys === "string") step.keys = [step.keys];

  // Substitute special keys
  // 1. For each key, identify if it following the escape pattern of `$...$`.
  // 2. If it does, replace it with the corresponding `Key` object from `specialKeyMap`.
  step.keys = step.keys.map((key) => key.replace(/^\$.+\$$/gm, specialKeyMap[key]));

  // Run action
  try {
    await driver.keys(step.keys);
  } catch {
    // FAIL: Error opening URL
    result.status = "FAIL";
    result.description = "Couldn't type keys.";
    return result;
  }

  // PASS
  return result;
}