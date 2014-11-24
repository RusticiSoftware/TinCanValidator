#!/usr/bin/env node

var async = require('async');
var fsUtils = require('../lib/fsUtils.js');
var Getopt = require('node-getopt');
var errorUtils = require('../lib/errorUtils.js');
var S = require('string');

var addError = errorUtils.addError;
var pprintError = errorUtils.pprintError;
try {
    var tcv = require('../lib/tincanValidator.js');
} catch (err) {
    pprintError(err);
    throw new Error("Could not load lib/tincanValidator.js");
}
function pprint(data) {
    console.log(JSON.stringify(data, null, 4));
}


var cfg = {
    //verbose: false,
    //testdir: __dirname + '/data'
};

var getopt = new Getopt([
    ['v', 'verbose',            'more informative messages'],
    ['h', 'help',               'display this help']
]).bindHelp();
getopt.setHelp(
    'Usage: test.js [id ...] [OPTIONS]\n' +
    '    Check the test JSONs against the TinCan schema\n' +
    '\n' +
    'OPTIONS:\n' +
    '[[OPTIONS]]\n'
);


function main() {
    parseArgs();
    work();
}

function parseArgs() {
    // Chop ['node', 'test.js']
    var rest = process.argv.slice(2);
    var opt = getopt.parse(rest);

    rest = opt.argv;
    if (rest.length) {
        cfg.ids = rest;
    }
    cfg.verbose = opt.options.verbose;
    cfg.testdir = __dirname + '/data';
}

function work() {
    if (!cfg.ids || !cfg.ids.length) {
        testRootDir(cfg.testdir, function(err) {});
    } else {
        var dirs = cfg.ids.map(function (id) {
            return cfg.testdir + '/' + id;
        });
        testDirs(dirs, function(err) {});
    }
}

function testDirs(dirs, cb) {
    async.mapSeries(dirs, testIdDir, function(err, results) {
        if (err) return cb(err);
        var total_cats = results.length,
            good_cats = 0,
            bad_cats = 0;
        var total_tests = 0,
            good_tests = 0,
            bad_tests= 0;

        results.forEach(function(result) {
            if (result.bad_tests) bad_cats++;
            else good_cats++;
            total_tests += result.total_tests;
            good_tests += result.good_tests;
            bad_tests += result.bad_tests;
        });
        if (good_cats === total_cats) {
            console.log(
                '\n' +
                'SUMMARY: All ' + good_tests + ' tests in ' + good_cats + ' test categories passed!'
            );
        } else {
            console.log(
                '\n' +
                'SUMMARY: ' + good_cats + '/' + total_cats + ' test categories passed, with ' + bad_tests + ' tests failing out of ' + total_tests
            );
        }
        cb();
    });
}

function testRootDir(dir, cb) {
    dir = fsUtils.stripExtraSlashes(dir);

    fsUtils.listFolders(dir, function(err, dirs) {
        if (err) return cb(err);
        return testDirs(dirs, cb);
    });
}

function testIdDir(dir, cb) {
    dir = fsUtils.stripExtraSlashes(dir);

    fsUtils.listFilesWithExt(dir, 'json', function(err, files) {
        if (err) return cb(err);
        async.mapSeries(files, testFile, function(err, results) {
            var cat_result = {
                total_tests: results.length,
                good_tests: 0,
                bad_tests: 0
            };
            results.forEach(function(result) {
                if (result) cat_result.bad_tests++;
                else cat_result.good_tests++;
            });
            console.log(
                S(fsUtils.basename(dir) + ':').padRight(40).s +
                cat_result.good_tests + '/' + cat_result.total_tests + ' passed'
            );
            cb(null, cat_result);
        });
    });
}

function testFile(fpath, cb) {
    var info = testInfo(fpath);

    function printResult(err, expectedErr) {
        if (err) {
            console.log('FAILED: ' + fpath);
            pprintError(err);
            return cb(null, err);
        }
        else if (cfg.verbose) {
            console.log('OK:     ' + fpath);
            if (expectedErr) {
                pprintError(expectedErr);
            }
        }
        return cb();
    }

    if (info.expected === "good") return testGoodFile(info, printResult);
    else if (info.expected === "bad") return testBadFile(info, printResult);

    // shouldn't ever reach here
    pprint(info);
    throw new Error(
        "Unexpected info.expected (should be 'good' or 'bad')"
    );
}

function testInfo(fpath) {
    var pathSegs = fpath.split('/').reverse();
    var fname = pathSegs[0];
    var fnameSegs = fname.split('.')[0].split('-');

    return {
        fpath: fpath,
        fname: pathSegs[0],
        id: pathSegs[1],
        num: fnameSegs[0],
        expected: fnameSegs[1],
        shortInfo: fnameSegs[2],
    };
}

function testGoodFile(info, cb) {
    tcv.validateJsonFile(info.fpath, info.id, cb);
}

function testBadFile(info, cb) {
    tcv.validateJsonFile(info.fpath, info.id, function(resultErr) {
        if (!resultErr) return cb(new Error('Unexpected success!'));
        return cb(null, resultErr);
    });
}

main();

