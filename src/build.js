const path = require("path");
const fs = require("fs");
const uuid = require("uuid");
const { log, actionMap } = require("./utils");
const { validate } = require("doc-detective-common");
const { inferSpec } = require("./inference");
const { Confirm, Form, Toggle } = require("enquirer");

exports.buildSpecs = buildSpecs;

async function buildSpecs(config, files) {
  let specs = [];

  // Loop through files
  for (const file of files) {
    log(config, "debug", `file: ${file}`);
    const extension = path.extname(file);
    let content = fs.readFileSync(file).toString();

    if (extension === ".json") {
      log(config, "debug", `Skipping JSON file: ${file}`);
      continue;
    } else {
      // Process non-JSON
      let id = `${uuid.v4()}`;
      const spec = { id, file, tests: [] };
      content = content.split("\n");
      let ignore = false;
      fileType = config.fileTypes.find((fileType) =>
        fileType.extensions.includes(extension)
      );
      for (const line of content) {
        // If trimmed line is empty, skip
        if (line.trim() === "") continue;
        // console.log(line);
        if (line.includes(fileType.testStartStatementOpen)) {
          continue;
        } else if (line.includes(fileType.testEndStatement)) {
          ignore = false;
        } else if (line.includes(fileType.stepStatementOpen)) {
          continue;
        } else if (line.includes(fileType.testIgnoreStatement)) {
          // Set `ignore` to true
          ignore = true;
        } else if (!ignore) {
          // Test for markup/dynamically generate tests

          // Find test with `id`
          test = spec.tests.find((test) => test.id === id);
          // If test doesn't exist, create it
          if (!test) {
            test = { id, file, steps: [] };
            spec.tests.push(test);
            test = spec.tests.find((test) => test.id === id);
          }

          log(config, "debug", `line: ${line}`);
          let steps = [];

          fileType.markup.forEach((markup) => {
            // Test for markup
            regex = new RegExp(markup.regex, "g");
            const matches = [];
            markup.regex.forEach((regex) => {
              const match = line.matchAll(regex);
              if (match) matches.push(...match);
            });
            // If no matches, skip
            if (matches.length === 0) return false;
            log(config, "debug", `markup: ${markup.name}`);

            matches.forEach((match) => {
              log(config, "debug", `match: ${JSON.stringify(match, null, 2)}`);

              // If `match` doesn't have a capture group, set it to the entire match
              if (match.length === 1) {
                match[1] = match[0];
              }
              markup.actions.forEach((action) => {
                let step = {};
                if (typeof action === "string") {
                  step = JSON.parse(JSON.stringify(actionMap[action]));
                } else if (action.name) {
                  // TODO v3: Remove this block
                  if (action.params) {
                    step = { action: action.name, ...action.params };
                  } else {
                    step = { action: action.name };
                  }
                } else {
                  step = action;
                }
                step.index = match.index;
                // Substitute variables $n with match[n]
                Object.keys(step).forEach((key) => {
                  if (typeof step[key] !== "string") return;
                  // Replace $n with match[n]
                  step[key] = step[key].replace(/\$[0-9]+/g, (stepMatch) => {
                    const index = stepMatch.substring(1);
                    return match[index];
                  });
                });

                log(config, "debug", `step: ${JSON.stringify(step, null, 2)}`);
                steps.push(step);
              });
            });
          });

          if (
            steps.length === 0 &&
            (typeof config.integrations?.openai?.apiKey != undefined ||
              process.env.OPENAI_API_KEY)
          ) {
            // Infer spec
            log(config, "debug", `Infer spec for line: ${line}`);
            const inferredSpec = await inferSpec(config, line);
            if (inferredSpec) {
              steps.push(...inferredSpec.tests[0].steps);
            }
          }

          log(config, "debug", `all steps: ${JSON.stringify(steps, null, 2)}`);
          // Order steps by step.index
          steps.sort((a, b) => a.index - b.index);
          // Remove step.index
          steps.forEach((step) => delete step.index);
          log(
            config,
            "debug",
            `cleaned steps: ${JSON.stringify(steps, null, 2)}`
          );

          // Pause to review detected/inferred steps
          console.log(line);
          console.log("Detected/inferred steps:");
          console.log(steps);
          // Sleep for 5 seconds
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Filter out steps that don't pass validation
          steps = steps.filter((step) => {
            const validation = validate(`${step.action}_v2`, step);
            if (!validation.valid) {
              log(
                config,
                "warning",
                `Step ${step} isn't a valid step. Skipping.`
              );
              return false;
            }
            return true;
          });

          // Pause to review and update steps
          for (let step of steps) {
            console.log(`Step: ${JSON.stringify(step, null, 2)}`);
            const updateBoolean = await new Toggle({
              message: "Update this step?",
              enabled: "Yes",
              disabled: "No",
              initial: true,
            }).run();

            if (updateBoolean) {
              const choices = [];
              Object.keys(step).forEach((key) => {
                choices.push({
                  name: key,
                  message: key,
                  initial: () => {
                    if (typeof step[key] === "object") {
                      return JSON.stringify(step[key],null,0).replace(/\n/g, "")
                    } else {
                      return step[key]
                    }
                  },
                  result: (value) => {
                    if (typeof step[key] === "object") {
                      return JSON.stringify(value, null, 2);
                    }
                    return value;
                  },
                });
              });
              const stepUpdate = await new Form({
                name: "step",
                message: "Review and modify the step:",
                choices: choices,
              }).run();
              console.log(`Step: ${JSON.stringify(stepUpdate)}`);
            }

            process.exit(0);

            if (update) {
              response = await prompt({
                type: "input",
                name: "step",
                message: "Review and modify the step:",
                initial: JSON.stringify(step, null, 2),
              });
              step = JSON.parse(response.step);
            }
          }

          // Push steps to test
          test.steps.push(...steps);
        }
      }

      // Remove tests with no steps
      spec.tests = spec.tests.filter((test) => test.steps.length > 0);

      // Push spec to specs, if it is valid
      const validation = validate("spec_v2", spec);
      if (!validation.valid) {
        log(
          config,
          "warning",
          `Tests from ${file} don't create a valid test specification. Skipping.`
        );
      } else {
        specs.push(spec);
      }
    }
  }
  return specs;
}
