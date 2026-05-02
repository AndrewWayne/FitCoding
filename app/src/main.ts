const required = [
  "pixelman", "exercise-name", "form-cue",
  "cam", "skeleton", "rep-count", "time-left", "overlay",
];
for (const id of required) {
  if (!document.getElementById(id)) {
    console.error(`missing DOM node #${id}`);
  }
}
console.log("FitCoding webview booted");
