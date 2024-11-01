module.exports = { loadEnvs };

function loadEnvs(stringOrObject) {
  if (!stringOrObject) return stringOrObject;
  if (typeof stringOrObject === "object") {
    // Iterate through object and recursively resolve variables
    Object.keys(stringOrObject).forEach((key) => {
      // Resolve all variables in key value
      stringOrObject[key] = loadEnvs(stringOrObject[key]);
    });
  } else if (typeof stringOrObject === "string") {
    // Load variable from string
    variableRegex = new RegExp(/\$[a-zA-Z0-9_]+/, "g");
    matches = stringOrObject.match(variableRegex);
    // If no matches, return string
    if (!matches) return stringOrObject;
    // Iterate matches
    matches.forEach((match) => {
      // Check if is declared variable
      value = process.env[match.substring(1)];
      if (value) {
        // If match is the entire string instead of just being a substring, try to convert value to object
        try {
          if (
            match.length === stringOrObject.length &&
            typeof JSON.parse(stringOrObject) === "object"
          ) {
            value = JSON.parse(value);
          }
        } catch {}
        // Attempt to load additional variables in value
        value = loadEnvs(value);
        // Replace match with variable value
        if (typeof value === "string") {
          // Replace match with value. Supports whole- and sub-string matches.
          stringOrObject = stringOrObject.replace(match, value);
        } else if (typeof value === "object") {
          // If value is an object, replace match with object
          stringOrObject = value;
        }
      }
    });
  }
  return stringOrObject;
}
