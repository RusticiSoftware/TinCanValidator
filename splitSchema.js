#!/usr/bin/env node
"use strict";
var Getopt = require('node-getopt');
var schemaUtils = require('./lib/schemaUtils.js');


var getopt = new Getopt([
    ['h', 'help',    'display this help'],
    ['q', 'quiet',   'silence most messages'],
]).bindHelp();
getopt.setHelp(
    'Usage: splitSchema.js src.json dst_dir [OPTIONS]\n' +
    '    Take a JSON schema, and save its parts as separate files\n\n' +
    'OPTIONS:\n' +
    '[[OPTIONS]]'
);

// global var, stores stuff about the running instance
var cfg = {
    // from parseArgs()
    //quiet: false,
    //srcFile: 'path/to/json/file',
    //dstDir: 'path/to/destination/directory',
};


function init() {
    parseArgs();
}

function printHelp() {
    getopt.showHelp();
}

function parseArgs() {
    // Chop ['node', 'this_file.js'] -- also works when run as ./this_file.js
    var rest = process.argv.slice(2);
    var opt = getopt.parse(rest);

    rest = opt.argv;
    if (rest.length !== 2) {
        printHelp();
        process.exit(1);
    }

    cfg.srcFile = rest[0];
    cfg.dstDir = rest[1];
    schemaUtils.VERBOSE = !opt.options.quiet;
}

function work() {
    schemaUtils.splitSchemaFile(cfg.srcFile, cfg.dstDir, function(err) {
        if (!err) return;
        if (err.code === 'ENOENT') {
            err.message = "File '" + err.path + "' does not exist";
        }
        throw err;
    });
}

function main() {
    init();
    work();
}

main();
