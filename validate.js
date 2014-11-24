#!/usr/bin/env node
"use strict";
var fsUtils = require('./lib/fsUtils.js');
var async = require('async');
var S = require('string');
var errorUtils = require('./lib/errorUtils.js');
var pprintError = errorUtils.pprintError;
var Getopt = require('node-getopt');
try {
    var tcv = require('./lib/tincanValidator.js');
} catch (err) {
    pprintError(err);
    throw new Error("Could not load lib/tincanValidator.js");
}

// global var, stores stuff about the running instance
var cfg = {
    //schemaName: 'tcapi:1.0.1',
    //schema: //{schema: object}

    // from parseArgs()
    schemaDir: __dirname + '/lib/schema/1.0.1',
    //verbose: false,
    //debug: false,
    //srcFile: 'path/to/json/file'
    //typeId: 'name_of_type'
};

var getopt = new Getopt([
    ['t', 'type=ARG',       'check against this type id'],
    ['s', 'schema=ARG',     'use this schema directory'],
    ['h', 'help',           'display this help'],
    ['v', 'verbose',        'more informative messages'],
    ['d', 'debug',          'even more messages'],
]).bindHelp();
getopt.setHelp(
    'Usage: validate.js [file.json] [OPTIONS]\n' +
    '    Check the structure of TinCan JSON data\n' +
    '\n' +
    'OPTIONS:\n' +
    '[[OPTIONS]]\n' +
    '\n' +
    "If file.json is not specified, validates input from stdin.\n" +
    "\n" +
    "If no type is specified, tries to validate against all possible types.\n" +
    "\n" +
    "If no schema directory is specified, tries to read " +
    "`dirname /path/to/validate.js`/" +
        cfg.schemaDir.split('/').reverse()[0] +
        " (=='" + cfg.schemaDir + "').\n" +
    "\n" +
    "A schema directory contains schema in JSON schema draft v4 format. " +
    "Files in the schema directory with extensions other than .json are " +
    "ignored.\n"
);


function main() {
    parseArgs();

    var tasks = [];

    if (cfg.srcFile) {
        tasks.push(function(next) {
            return tcv.readJsonFile(cfg.srcFile, next);
        });
        tasks.push(function(obj, next) {
            // I'm providing cfg.srcFile for error logging
            next(null, obj, cfg.typeId, cfg.srcFile);
        });
    } else {  // use stdin
        tasks.push(fsUtils.readStdinToString);
        tasks.push(tcv.readJson);
        tasks.push(function(obj, next) {
            // I'm providing '<stdin>' as the fpath for error logging
            next(null, obj, cfg.typeId, '<stdin>');
        });
    }

    tasks.push(validate);

    async.waterfall(tasks, function(err) {
        if (!err) return;
        var msg = handleErrorCode(err) || "ERROR: " + errorUtils.pprintErrorToString(err);
        console.error(msg);
        process.exit(1);
    });
}

function parseArgs() {
    // Chop ['node', 'validate.js']
    var rest = process.argv.slice(2);
    var opt = getopt.parse(rest);

    rest = opt.argv;
    cfg.srcFile = rest[0]; // if undefined, uses stdin
    if (rest.length > 1) {
        console.error("Too many arguments!");
        getopt.showHelp();
        process.exit(1);
    }

    cfg.schemaDir = opt.options.schema || cfg.schemaDir;
    cfg.schemaName = 'tcapi:' + fsUtils.basename(cfg.schemaDir);
    cfg.typeId = opt.options.type;
    cfg.verbose = opt.options.verbose || opt.options['debug'];
    cfg.debug = opt.options['debug'];

    if (cfg.debug) tcv.VERBOSE = true;
    tcv.loadSchemaDirSync(cfg.schemaDir, cfg.schemaName);
}

function validate(obj, id, fpath, cb) {
    /*
    :param obj: an Object to verify as id
    :param id: the type id we are checking against
    :param fpath: for error logging
    :param cb: called as cb(err) when done.
     */
    if (cfg.verbose) console.log('Processing \'' + fpath + '\' ...');

    if (!id) {
        console.warn(
            'WARNING: No schema id provided; trying all possibilities' +
            ' (may take a while...)'
        );
        return tcv.validateAsAny(obj, function(err, results) {
            if (err) return exitWithValidationError(err, id, fpath);

            results.forEach(logValid);
            cb();
        });
    } else {
        return tcv.validateWithId(obj, id, function(err) {
            if (err) return exitWithValidationError(err, id, fpath);

            logValid(id);
            cb();
        });
    }
}

function handleErrorCode(err) {
    if (!err || !err.code) return;
    switch (err.code) {
    case "ENOENT":
        return "ERROR: '" + err.path + "' does not exist";
    case "EISDIR":
        return "ERROR: Is a directory";
    case "EACCES":
        return "ERROR: Don't have permissions to access '" + err.path + "'";
    default:
        return;
    }
}

function logValid(id) {
    if (cfg.debug) return;  // because tcv will do this already
    console.log('VALID as a ' + cfg.schemaName + '#' + id);
}

function printValidationError(err, id, fpath) {
    var msg;

    // if id specified, only one array of errors returned
    // if id not specified, impossible to have 'Unknown schema',
    // since we try all the valid ones known.
    if (id && S(err.message).startsWith('Unknown schema')) {
        msg = "UNKNOWN schema type id '" + id + "'\n" +
            "See '" + cfg.schemaDir + "' for allowed type ids.";
    } else {
        if (cfg.verbose) pprintError(err);

        msg = "INVALID JSON file '" + fpath + "'";
        if (id) msg += " as a " + cfg.schemaName + '#' + id;
    }
    console.log(msg);
}

function exitWithValidationError(err, id, fpath) {
    printValidationError(err, id, fpath);
    process.exit(1);
}

main();
