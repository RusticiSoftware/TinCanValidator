(function (global, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof module !== 'undefined' && module.exports){
    // CommonJS. Define export.
    module.exports = factory();
  } else {
    // Browser globals
    global.tv4 = factory();
  }
}(this, function () {
"use strict";
var tv4 = require('tv4');
var async = require('async');

var schemaUtils = require('./schemaUtils.js');
var fsUtils = require('./fsUtils');
var errorUtils = require('./errorUtils.js');
var addError = errorUtils.addError;
var pprintError = errorUtils.pprintError;

var exports = {}

exports.VERBOSE = false;
exports.schemaDir = __dirname + '/schema/1.0.1';

function init() {
    exports.schemaDir = fsUtils.stripExtraSlashes(exports.schemaDir);
    exports.schemaName = 'tcapi:' + fsUtils.basename(exports.schemaDir);
    try {
        exports.smartLoadSchemaDirSync();
    } catch (err) {
        pprintError(err);
        throw err;
    }
}

exports.validateWithId = function(obj, id, cb) {
    /* validates obj as id.

    The callback will be called as:
        cb(null) if object is valid.
        cb(err) if object is invalid.
    */
    var uri = exports.schemaName + '#' + id;
    return exports.validateWithUri(obj, uri, cb);
};

exports.validateWithIdSync = function(obj, id) {
    /* validates obj as id. Does nothing if successful, throws an
     * error otherwise.
     */
     var uri = exports.schemaName + '#' + id;
     exports.validateWithUriSync(obj, uri);
};

exports.validateWithUri = function(obj, uri, cb) {
    /* wrapper for schemaUtils.validateWithUri(), with logging
     * if VERBOSE is set.
     */
    schemaUtils.validateWithUri(obj, uri, function(err) {
        if (!err && exports.VERBOSE) console.log('VALID as a %s', uri);
        cb(err);
    });
};

exports.validateWithUriSync = function(obj, uri) {
    /* wrapper for schemaUtils.validateWithUriSync(), with logging
     * if VERBOSE is set.
     */
    schemaUtils.validateWithUriSync(obj, uri); // throws if invalid
    if (exports.VERBOSE) console.log('VALID as a %s', uri);
};

exports.validateAsAny = function(obj, cb) {
    var results = [];
    var errors = [];

    var allIds = Object.keys(exports.schema.properties);
    async.each(
        allIds,
        function(id, callback) {
            exports.validateWithId(obj, id, function(err) {
                if (!err) {
                    results.push(id);
                } else {
                    errors.push(err);
                }
                callback();
            });
        },
        function(err) {
            if (err) return cb(err);

            if (results.length > 0) {
                return cb(null, results);
            }

            return cb(addError(errors,
                "Not valid as any " + exports.schemaName + " object"
            ));
        }
    );
};

exports.validateAsAnySync = function(obj) {
    var results = [];
    var errors = [];

    var allIds = Object.keys(exports.schema.properties);
    allIds.forEach(function(id) {
        try {
            exports.validateWithIdSync(obj, id);
            results.push(id);
        } catch (err) {
            errors.push(err);
        }
    });
    if (results.length > 0) {
        return results;
    }

    throw addError(errors,
        "Not valid as any " + exports.schemaName + " object"
    );
};

exports.readJson = schemaUtils.readJson;
exports.readJsonSync = schemaUtils.readJsonSync;

exports.readJsonFile = schemaUtils.readJsonFile;
exports.readJsonFileSync = schemaUtils.readJsonFileSync;

exports.loadSchemaDir = function(schemaDir, schemaName, cb) {
    if (!schemaDir) {
        schemaDir = exports.schemaDir;
        if (!schemaName) schemaName = exports.schemaName;
    } else {
        if (!schemaName) schemaName = 'tcapi:'+fsUtils.basename(schemaDir);
    }
    if (exports.VERBOSE) console.log('Loading TinCan schema from ' + schemaDir);

    schemaUtils.addSchemaNameFromDir(schemaDir, schemaName,
            function(err, schema) {
        if (err) return cb(addError([err], 'SCHEMA was invalid'));

        exports.schemaDir = schemaDir;
        exports.schemaName = schemaName;
        exports.schema = schema;
        loadFormats(cb);
    });
};

exports.loadSchemaDirSync = function(schemaDir, schemaName) {
    if (!schemaDir) {
        schemaDir = exports.schemaDir;
        if (!schemaName) schemaName = exports.schemaName;
    } else {
        if (!schemaName) schemaName = 'tcapi:'+fsUtils.basename(schemaDir);
    }
    if (exports.VERBOSE) console.log('Loading TinCan schema from ' + schemaDir);

    try {
        var schema = schemaUtils.
            addSchemaNameFromDirSync(schemaDir, schemaName);
    } catch(err) {
        err = addError([err], 'SCHEMA was invalid');
        throw err;
    }

    exports.schemaDir = schemaDir;
    exports.schemaName = schemaName;
    exports.schema = schema;
    loadFormatsSync();
};

function loadFormats(cb) {
    var formatsPath = exports.schemaDir + "/formats/formats.json";
    exports.readJsonFile(formatsPath, function(err, formats) {
        if (err) {
            if (err.code === "ENOENT") return cb();
            return cb(err);
        }

        for (var name in formats) {
            try {
                registerFormatWithRegex(name, formats[name]);
            } catch (err) {
                err = addError([err], "Invalid formats file");
                err.fpath = formatsPath;
                return cb(err);
            }
        }
        return cb();
    });
}

function loadFormatsSync() {
    var formatsPath = exports.schemaDir + "/formats/formats.json";
    try {
        var formats = exports.readJsonFileSync(formatsPath);
    } catch (err) {
        if (err.code === "ENOENT") return;
        throw err;
    }

    for (var name in formats) {
        try {
            registerFormatWithRegex(name, formats[name]);
        } catch (err) {
            err = addError([err], "Invalid formats file");
            err.fpath = formatsPath;
            throw err;
        }
    }
}

function registerFormatWithRegex(name, regex) {
    if (regex instanceof Array) {
        if (!regex.length) return;
        switch (regex.length) {
        case 0: return;
        case 1: regex = regex[0]; break;
        case 2: regex = new RegExp(regex[0], regex[1]); break;
        default:
            var err = new Error("Invalid format value");
            err.name = name;
            err.value = regex;
            throw err;
        }
    }
    if (!(regex instanceof RegExp)) regex = new RegExp(regex);

    tv4.addFormat(name, function(str) {
        if (regex.test(str)) return null;

        // this value is put into the error message by tv4
        var result;
        result = JSON.stringify(str) + " does not match " + name;
        if (regex.source.length < 160) {
            result += " = " + regex;
        } else {
            result += ". Regex is too long to display; see '";
            result += exports.schemaDir + "/formats/formats.json'";
        }
        return result;
    });
}

exports.smartLoadSchemaDir = function(schemaDir, schemaName, cb) {
    if (exports.schema) return cb();
    return exports.loadSchemaDir(schemaDir, schemaName, cb);
};

exports.smartLoadSchemaDirSync = function(schemaDir, schemaName) {
    if (exports.schema) return;
    return exports.loadSchemaDirSync(schemaDir, schemaName);
};

exports.validateJsonFile = function(fpath, id, cb) {
    /*
    cb called as cb(err) when done.
     */
    if (exports.VERBOSE) console.log('Processing  ' + fpath + '  ...');

    schemaUtils.readJsonFile(fpath, function(err, data) {
        if (err) return cb(err);
        exports.validateWithId(data, id, function(err) {
            if (!err) return cb(); // success
            return cb(err);
        });
    });
};

exports.validateJsonFileSync = function(fpath, id) {
    /* throws error if invalid, else does nothing */
    if (exports.VERBOSE) console.log('Processing  ' + fpath + '  ...');

    var data = schemaUtils.readJsonFileSync(fpath);
    exports.validateWithIdSync(data, id); // throws if invalid
};


init();
return exports;
}));
