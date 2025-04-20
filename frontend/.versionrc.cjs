module.exports = {
  "writerOpts": {
    "commitsSort": false
  },
  "bumpFiles": [
    "package.json",
    "package-lock.json",
    {
      "filename": "../wails.json",
      // wails config version updater
      "updater": {
        "readVersion": function (/** @type {string} */ contents) {
          return JSON.parse(contents).info.productVersion;
        },
        "writeVersion": function (/** @type {string} */ contents, /** @type {string} */ version) {
          const json = JSON.parse(contents);
          json.info.productVersion = version;
          return JSON.stringify(json, null, " ");
        }
      }
    }
  ],
  "types": [
    {
      "type": "feat",
      "section": "Features"
    },
    {
      "type": "fix",
      "section": "Bug Fixes"
    },
    {
      "type": " chore",
      "section": "Chores"
    },
    {
      "type": "docs",
      "hidden": true
    },
    {
      "type": "style",
      "hidden": true
    },
    {
      "type": "refactor",
      "hidden": true
    },
    {
      "type": "perf",
      "hidden": true
    },
    {
      "type": "test",
      "hidden": true
    }
  ]
}
