#!/usr/bin/env node
"use strict";
var Getopt = require('node-getopt');
var schemaUtils = require('./lib/schemaUtils.js');


var getopt = new Getopt([
    ['h', 'help',    'display this help'],
    ['q', 'quiet',   'silence most messages'],
]).bindHelp();
getopt.setHelp(
    'Usage: joinSchema.js src_dir dst.json [OPTIONS]\n' +
    '    Read a directory of JSON schema, and save them in a single file\n\n' +
    'OPTIONS:\n' +
    '[[OPTIONS]]'
);

// global var, stores stuff about the running instance
var cfg = {
    // from parseArgs()
    //quiet: false,
    //srcDir: 'path/to/source/directory/of/schema',
    //dstFile: 'path/to/destination/json/file',
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

    cfg.srcDir = rest[0];
    cfg.dstFile = rest[1];
    schemaUtils.VERBOSE = !opt.options.quiet;
}

function work() {
    schemaUtils.loadSchemaDir(cfg.srcDir, function(err, data) {
        if (err) throw err;

        schemaUtils.writeSchema(data, cfg.dstFile, function (err) {
            if (err) throw err;
        })
    });
}

function main() {
    init();
    work();
}

main();
