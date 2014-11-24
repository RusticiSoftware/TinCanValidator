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
var fs = require('fs');
var fsUtils = require('./fsUtils.js');
var async = require('async');
var tv4 = require('tv4');
var S = require('string');

var errorUtils = require('./errorUtils.js');
var addError = errorUtils.addError;

var exports = {};

// whether to verify whenever schema are loaded or output
exports.SHOULD_VALIDATE = true;
exports.VERBOSE = false;
// exports.metaschema is populated when we are first asked to
// validate a schema; see smartLoadMetaschema().

var default_metaschemaUri = "http://json-schema.org/draft-04/schema";
var default_metaschemaPath = __dirname + '/metaSchema/draft-04.json';

function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
}

function isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
}

exports.loadMetaschema = function(uri, path, cb) {
    if (exports.VERBOSE) console.log('Loading metaschema from ' + path);

    var old_SHOULD_VALIDATE = exports.SHOULD_VALIDATE;
    exports.SHOULD_VALIDATE = false;

    exports.loadSchema(path, function(err, data) {
        if (err) return cb(addError([err], 'METASCHEMA failed to load'));

        exports.metaschema = data;

        exports.SHOULD_VALIDATE = old_SHOULD_VALIDATE;

        exports.validateSchema(exports.metaschema, function(err) {
            if (err) return cb(err);

            exports.addSchemaName(uri, exports.metaschema);
            return cb();
        });
    });
};

exports.loadMetaschemaSync = function(uri, path) {
    /* Synchronously load the metaschema at path as uri. Throws errors if
     * unsuccessful.
     */
    if (exports.VERBOSE) console.log('Loading metaschema from ' + path);

    var old_SHOULD_VALIDATE = exports.SHOULD_VALIDATE;
    exports.SHOULD_VALIDATE = false; // We can't validate without a metaschema!

    try {
        exports.metaschema = exports.loadSchemaSync(path);

        exports.SHOULD_VALIDATE = old_SHOULD_VALIDATE;

        if (exports.SHOULD_VALIDATE) exports.validateSchemaSync(exports.metaschema);
        exports.addSchemaName(uri, exports.metaschema);
    } catch (err) {
        throw addError([err], 'METASCHEMA failed to load');
    }
};

exports.smartLoadMetaschema = function(cb) {
    /*
     * Load the metaschema into exports.metaschema, if exports.metaschema
     * is not already set. If it is, do nothing.
     */
    if (exports.metaschema) return cb();

    exports.loadMetaschema(default_metaschemaUri, default_metaschemaPath,
            function(err) {
        if (err) return cb(err);
        if (!exports.metaschema) return cb(new Error('METASCHEMA not set!'));
        return cb();
    });
};

exports.smartLoadMetaschemaSync = function() {
    /*
     * Load the metaschema into exports.metaschema, if exports.metaschema
     * is not already set. If it is, do nothing. Throws errors if unsuccessful.
     */
    if (exports.metaschema) return;
    exports.loadMetaschemaSync(default_metaschemaUri, default_metaschemaPath);
    if (!exports.metaschema) throw new Error('METASCHEMA not set!');
};

exports.addSchemaName = function(schema, name) {
    tv4.addSchema(name, schema);
};

exports.addSchemaNameFromDir = function(dir, name, cb) {
    /*
     * Reads a directory, makes a schema from it, validates it, and
     * adds it as name.
     */
    if (exports.VERBOSE) console.log('Loading schema from ' + dir);

    exports.loadSchemaDir(dir, function(err, schema) {
        if (err) {
            return cb(addError([err],
                "Could not load schema directory '" + dir + "'"
            ));
        }

        if (!exports.SHOULD_VALIDATE) {
            exports.addSchemaName(schema, name);
            return cb(null, schema);
        }

        exports.validateSchema(schema, function(err) {
            if (err) return cb(err);

            exports.addSchemaName(schema, name);
            cb(null, schema);
        });
    });
};

exports.addSchemaNameFromDirSync = function(dir, name) {
    /*
     * Synchronously reads a directory, makes a schema from it, validates it, and
     * adds it as name. Throws errors if unsuccessful.
     */
    if (exports.VERBOSE) console.log('Loading schema from ' + dir);

    try {
        var schema = exports.loadSchemaDirSync(dir);
    } catch(err) {
        throw addError([err], "Could not load schema directory '" + dir + "'");
    }

    if (exports.SHOULD_VALIDATE) exports.validateSchemaSync(schema);

    exports.addSchemaName(schema, name);
    return schema;
};

exports.validateSchema = function(schema, cb) {
    /*
     * Verifies that schema is an Object compliant with
     * json-schema-draft-04. When done, cb is called as
     * cb(err).
     *
     * :param schema: schema Object to validate
     * schema
     * :param cb: called as cb(err) when done
     */
    exports.smartLoadMetaschema(function(err) {
        if (err) return cb(err);

        exports.validate(schema, exports.metaschema, cb);
    });
};

exports.validateSchemaSync = function(schema, cb) {
    /*
     * Synchronously verifies that schema is an Object compliant with
     * json-schema-draft-04. Throws errors if unsuccessful.
     *
     * :param schema: schema Object to validate
     * schema
     */
    exports.smartLoadMetaschemaSync();
    exports.validateSync(schema, exports.metaschema);
};

exports.uriIsValid = function(uri) {
    if (typeof uri !== 'string') return false;
    if (!tv4.getSchema(uri)) return false;
    return true;
};

exports.validate = function(obj, schema, cb) {
    /*
     * Verifies that obj complies with schema.
     *
     * :param obj: object to verify using schema
     * :param schema: schema Object
     * :param cb: called as cb(err) when done
     * :returns null if no errors and obj is valid
     * :returns an error report Object if not valid
     */
    try {
        exports.validateSync(obj, schema);
        return cb();
    } catch(err) {
        return cb(err);
    }
};

exports.validateSync = function(obj, schema) {
    /*
     * Synchronously verifies that obj complies with schema. Throws errors
     * if unsuccessful.
     *
     * :param obj: object to verify using schema
     * :param schema: schema Object
     */
    if (schema['$ref'] && !exports.uriIsValid(schema['$ref'])) {
        throw new Error(
            "Unknown schema reference: " + JSON.stringify(schema['$ref'])
        );
    }

    var result = tv4.validateResult(obj, schema);

    if (result.valid) return;

    if (result.missing.length > 0) {
        throw new Error(
            'MISSING schemas: ' +
            JSON.stringify(result.missing, null, 4)
        );
    }

    throw cleanValidationErrors(result.error, schema);;
};

function cleanValidationErrors(err, schema) {
    /* Recursively removes the stack fields and adds relative paths to the
     * provided ValidationError and any subErrors. The schema argument is
     * used for calculating the relative path of each error.
     *
     * :param err: the ValidationError to clean
     * :param schema: the schema where the error occurred
     * :returns err after cleaning
     */
    if (err.subErrors === null) delete err.subErrors;
    if (err.stack) delete err.stack;

    err.schemaRelativePath = makeRelativeSchemaPath(err.schemaPath, schema);

    if (!err.dataPath) err.dataPath = '/';
    if (isArray(err.subErrors)) {
        err.subErrors = err.subErrors.map(function(err) {
            return cleanValidationErrors(err, schema);
        });
    }
    return err;
};

function makeRelativeSchemaPath(path, schema) {
    /*
     * Shortens schema paths by replacing with #id whenever possible.
     *
     * :param path: the path to shorten
     * :param schema: the schema object the path is referring to
     * and must be traversed
     * :returns the relative schema path
     * :rtype string
     */
    var relSchemaPath = '';
    if (schema['$ref']) {
        relSchemaPath += schema['$ref'];
        schema = tv4.getSchema(schema['$ref']);
    }

    var turtle = schema;   // where we are now
    path = path.split('/');
    for (var i in path) {
        var seg = path[i];
        if (seg === '') continue;

        relSchemaPath += '/' + seg;

        turtle = turtle[seg];   // works for arrays too!
        if (turtle === undefined) {
            relSchemaPath += "<N/A>";
            return relSchemaPath;
        }
        if (turtle['$ref']) turtle = tv4.getSchema(turtle['$ref']);

        // if found something with an schema id
        // assumes that an id field set to a string is a schema id, and
        // not, say, a property, which must be a object.
        if (turtle.id !== undefined && typeof turtle.id === 'string') {
            relSchemaPath = turtle.id;
        }
    }
    return relSchemaPath;
};

exports.validateWithUri = function(obj, uri, cb) {
    try {
        exports.validateWithUriSync(obj, uri);
    } catch (err) {
        return cb(err);
    }
    cb();
};

exports.validateWithUriSync = function(obj, uri) {
    var ref = {'$ref': uri};
    try {
        exports.validateSync(obj, ref);
    } catch (err) {
        if (S(err.message).startsWith('Unknown schema')) {
            throw err;
        }
        throw addError([err], "INVALID as '" + uri + "'");
    }
};

exports.validateFileWithUri = function(fpath, uri, cb) {
    exports.readJsonFile(fpath, function(err, data) {
        if (err) return cb(err);
        exports.validateWithUri(data, uri, cb);
    });
};

exports.validateFileWithUriSync = function(fpath, uri) {
    var data = exports.readJsonFileSync(fpath);
    exports.validateWithUriSync(data, uri);
};

exports.splitSchema = function(obj, dstPath, cb) {
    /*
     * Takes a large schema Object and splits its 'properties' value into
     * smaller schema files.
     *
     * :param obj: schema Object with a 'properties' member, which is
     * another Object
     * :param dstPath: destination folder for the individual result
     * schema
     * :param cb: called as cb(err) when finished
     */

    dstPath = fsUtils.stripExtraSlashes(dstPath);

    function checkFolder(callback) {
        fsUtils.getFolder(dstPath, callback);
    }

    function writeFiles(callback) {
        var props = obj.properties;

        async.each(
            Object.keys(props),
            function(name, callback) {
                var fpath = dstPath + "/" + name + ".json";
                exports.writeSchema(props[name], fpath, callback);
            },
            callback
        );
    }

    async.series([
            checkFolder,
            writeFiles,
        ],
        cb
    );
};

exports.splitSchemaSync = function(obj, dstPath) {
    /*
     * Synchronously takes a large schema Object and splits its 'properties'
     * value into smaller schema files. Throws errors if unsuccessful.

     * :param obj: schema Object with a 'properties' member, which is
     * another Object
     * :param dstPath: destination folder for the individual result
     * schema
     */

    dstPath = fsUtils.stripExtraSlashes(dstPath);

    fsUtils.getFolderSync(dstPath);

    var props = obj.properties;
    for (var name in props) {
        var fpath = dstPath + "/" + name + ".json";
        exports.writeSchemaSync(props[name], fpath);
    }
};

exports.splitSchemaFile = function(srcPath, dstPath, callback) {
    /*
     * Takes a large JSON schema file and splits its 'properties' value
     * into smaller schema files.
     *
     * :param srcPath: path to JSON schema file
     * :param dstPath: destination folder for the individual result
     * schema
     * :param callback: called as callback(err) when finished
     */
    exports.loadSchema(srcPath, function(err, data) {
        if (err) return callback(err);

        exports.splitSchema(data, dstPath, callback);
    });
};

exports.splitSchemaFileSync = function(srcPath, dstPath) {
    /*
     * Synchronously takes a large JSON schema file and splits its
     * 'properties' value into smaller schema files.
     *
     * :param srcPath: path to JSON schema file
     * :param dstPath: destination folder for the individual result
     * schema
     */
    var data = exports.loadSchemaSync(srcPath);
    exports.splitSchemaSync(data, dstPath);
};

exports.writeSchema = function(obj, fpath, callback){
    /*
     * Saves the schema object obj to fpath as a JSON file.
     *
     * :param obj: Object to convert to JSON string and written to fpath
     * :param fpath: the file to write the JSON to
     * :param callback: called as callback(err) when finished.
     */
    function ensureFields(cb) {
        if (!obj['$schema']) {
            obj['$schema'] = "http://json-schema.org/draft-04/schema#";
        }
        cb();
    }

    function validate(cb) {
        exports.validateSchema(obj, function(err) {
            if (!err) return cb();

            err = addError([err], 'Could not save schema; failed validation');
            err.data = obj;
            return cb(err);
        });
    }

    function write(cb) {
        var textData = JSON.stringify(obj, null, "    ");
        fs.writeFile(fpath, textData, {'encoding': 'utf8'}, function(err) {
            if (err) return cb(err);

            if (exports.VERBOSE) console.log("Wrote file:  " + fpath);
            return cb();
        });
    }

    async.series(
        exports.SHOULD_VALIDATE ? [
            ensureFields,
            validate,
            write,
        ] : [
            ensureFields,
            write,
        ],
        callback
    );
};

exports.writeSchemaSync = function(obj, fpath){
    /*
     * Synchronously saves the schema object obj to fpath as a JSON file.
     *
     * :param obj: Object to convert to JSON string and written to fpath
     * :param fpath: the file to write the JSON to
     */
    if (!obj['$schema']) {
        obj['$schema'] = "http://json-schema.org/draft-04/schema#";
    }

    if (exports.SHOULD_VALIDATE) try {
        exports.validateSchemaSync(obj);
    } catch(err) {
        err = addError([err], 'Could not save schema; failed validation');
        err.data = obj;
        throw err;
    }

    var textData = JSON.stringify(obj, null, 4);
    fs.writeFileSync(fpath, textData, {'encoding': 'utf8'});
    if (exports.VERBOSE) console.log("Wrote file:  " + fpath);
};

exports.readJsonFile = function(fpath, cb) {
    /*
     * cb is called as cb(err, obj) when finished.
     */
    fs.readFile(fpath, function(err, data) {
        if (err) return cb(err);
        
        exports.readJson(data, function(err, data) {
            if (!err) return cb(null, data);
            return cb(addError([err],
                'Could not parse file \'' + fpath + '\''
            ));
        });
    });
};

exports.readJsonFileSync = function(fpath) {
    var data = fs.readFileSync(fpath); // throws error
    
    try {
        data = exports.readJsonSync(data);
    } catch (err) {
        throw addError([err], 'Could not parse file \'' + fpath + '\'');
    }

    return data;
};

exports.readJson = function(str, cb) {
    /*
     * cb is called as cb(err, obj) when finished.
     */
    try {
        var data = exports.readJsonSync(str);
    } catch (err) {
        return cb(err);
    }

    return cb(null, data);
};

exports.readJsonSync = function(str) {
    try {
        var data = JSON.parse(str, 'utf8');
    } catch (err) {
        throw addError([err], 'Could not parse as JSON');
    }

    return data;
};

exports.loadSchema = function(srcPath, cb) {
    /*
     * Loads a single JSON schema file.
     *
     * :param srcPath: the file to read the schema from
     * :param cb: called as cb(err, data) when finished. data
     * is an Object containing the schema
     */
    if (exports.VERBOSE) console.log("Reading file:  " + srcPath);

    exports.readJsonFile(srcPath, function(err, data) {
        if (err) return cb(err);

        if (!exports.SHOULD_VALIDATE) return cb(null, data);

        exports.validateSchema(data, function(err) {
            if (!err) return cb(null, data);
            err = addError([err],
                'Schema in file ' + srcPath + ' failed validation'
            );
            err.data = data;
            err.path = srcPath;
            return cb(err);
        });
    });
};

exports.loadSchemaSync = function(srcPath) {
    /*
     * Synchronously loads a single JSON schema file. Throws errors if
     * unsuccessful.
     *
     * :param srcPath: the file to read the schema from
     */
    if (exports.VERBOSE) console.log("Reading file:  " + srcPath);

    var data = exports.readJsonFileSync(srcPath);
    if (!exports.SHOULD_VALIDATE) return data;

    try {
        exports.validateSchemaSync(data);
    } catch(err) {
        err = addError([err],
            'Schema in file ' + srcPath + ' failed validation'
        );
        err.data = data;
        err.path = srcPath;
        throw err;
    }
    return data;
};

exports.loadSchemaDir = function(srcPath, cb) {
    /*
     * Loads a directory of JSON schema files.
     *
     * :param srcPath: the directory to read the schema from
     * :param cb: called as cb(err, data) when finished. data
     * is an Object containing the schema
     */
    srcPath = fsUtils.stripExtraSlashes(srcPath);
    var props = {};

    function loadAllFiles(next) {
        async.waterfall([
            listJsons,
            function(jsonFiles, nextFile) {
                async.each(jsonFiles, loadOneSchema, nextFile);
            },
        ], finishUp);
    }

    function listJsons(next) {
        fsUtils.listFilesWithExt(srcPath, 'json', function(err, files) {
            if (err) return next(err);
            if (files.length === 0) return next(new Error(
                "The directory '" + srcPath + "' has no .json files!"
            ));

            next(null, files);
        });
    }

    function loadOneSchema(fname, next) {
        async.waterfall([
                function(next) { loadFile(fname, next); },
                checkFile,
                storeOneSchema
            ],
            next
        );
    }

    function loadFile(fname, next) {
        exports.loadSchema(fname, function(err, data) {
            if (err) next(err);
            next(null, data, fname);
        });
    }

    function checkFile(data, fname, next) {
        var basename = fsUtils.basename(fname);
        var strippedName = fsUtils.strippedName(fname);

        if (data.id === undefined) {
            var err = new Error('File has no id field');
            err.suggestion = {
                id: {is: undefined, should_be: '#' + strippedName}
            };
            err.fpath = srcPath + '/' + fname;
            throw err;
        } else if (typeof data.id !== 'string' || data.id === '') {
            var err = new Error('File has an invalid id field');
            err.suggestion = {
                id: {is: data.id, should_be: '#' + strippedName}
            };
            err.fpath = srcPath + '/' + fname;
            throw err;
        }

        var name = S(data.id).chompLeft('#').s;
        if (name !== strippedName) {
            var err = new Error('Field \'id\' does not match its filename');
            err.suggestion = {
                id: {is: data.id, should_be: '#' + strippedName}
            };
            err.fpath = srcPath + '/' + fname;
            throw err;
        }
        next(null, data, name);
    }

    function storeOneSchema(data, name, next) {
        if (data['$schema']) delete data['$schema'];
        props[name] = data;

        next();
    }

    function finishUp(err) {
        if (err) return cb(err);

        var result = {
            "$schema": "http://json-schema.org/draft-04/schema#",
            'additionalProperties': false,
            'type': 'object',
            'properties': props
        };
        return cb(null, result);
    }

    loadAllFiles(cb);
};

exports.loadSchemaDirSync = function(srcPath) {
    /*
     * Synchronously loads a directory of JSON schema files.
     *
     * :param srcPath: the directory to read the schema from
     */
    srcPath = fsUtils.stripExtraSlashes(srcPath);

    var files = fsUtils.listFilesWithExtSync(srcPath, 'json');
    if (files.length === 0) throw new Error(
        "The directory '" + srcPath + "' has no .json files!"
    );

    var props = {};
    files.forEach(function(fname) {
        // load file
        var data = exports.loadSchemaSync(fname);

        // check id corresponds to filename
        var basename = fsUtils.basename(fname);
        var strippedName = fsUtils.strippedName(fname);
        if (data.id === undefined) {
            var err = new Error('File has no id field');
            err.suggestion = {
                id: {is: undefined, should_be: '#' + strippedName}
            };
            err.fpath = srcPath + '/' + fname;
            throw err;
        } else if (typeof data.id !== 'string' || data.id === '') {
            var err = new Error('File has an invalid id field');
            err.suggestion = {
                id: {is: data.id, should_be: '#' + strippedName}
            };
            err.fpath = srcPath + '/' + fname;
            throw err;
        }

        var name = S(data.id).chompLeft('#').s;
        if (name !== strippedName) {
            var err = new Error('Field \'id\' does not match its filename');
            err.suggestion = {
                id: {is: data.id, should_be: '#' + strippedName}
            };
            err.fpath = srcPath + '/' + fname;
            throw err;
        }

        // store file
        if (data['$schema']) delete data['$schema'];
        props[name] = data;
    });

    return {
        "$schema": "http://json-schema.org/draft-04/schema#",
        'additionalProperties': false,
        'type': 'object',
        'properties': props
    };
};

exports.smartLoadMetaschemaSync();

return exports;
}));
