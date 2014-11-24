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
var async = require('async');
var S = require('string');

var exports = {};


/* Path functions */

exports.stripExtraSlashes = function(path) {
    var stripped = path.
        split('/').
        filter(function(seg) { return seg.length; }).
        join('/');
    if (S(path).startsWith('/')) return '/' + stripped;
    return stripped;
};

exports.hasExt = function(path, ext) {
    return S(path).endsWith(S(ext).ensureLeft('.').s);
};

exports.dirname = function(path) {
    path = exports.stripExtraSlashes(path);
    return path.
        split('/').
        slice(0, -1).
        join('/');
};

exports.basename = function(path) {
    path = exports.stripExtraSlashes(path);
    return path.split('/').reverse()[0];
};

exports.strippedName = function(path) {
    /* removes extensions from the basename of the path */
    path = exports.basename(path);
    if (S(path).startsWith('.'))
        return '.' + exports.strippedName(S(path).chompLeft('.').s);
    return path.split('.')[0];
};


/* Type functions */

exports.isFile = function(path, cb) {
    /* cb IS NOT called as cb(err, bool).
     * cb is called as cb(bool)
     */
    fs.stat(path, function(err, stats) {
        if (err) return cb(false);
        return cb(stats.isFile());
    });
};

exports.isFileSync = function(path) {
    /* returns bool */
    try {
        var stat = fs.statSync(path);
    } catch(err) {
        return false;
    }
    return stat.isFile();
};

exports.isDirectory = function(path, cb) {
    /* cb IS NOT called as cb(err, bool).
     * cb is called as cb(bool)
     */
    fs.stat(path, function(err, stats) {
        if (err) return cb(false);
        return cb(stats.isDirectory());
    });
};

exports.isDirectorySync = function(path) {
    /* returns bool */
    try {
        var stat = fs.statSync(path);
    } catch(err) {
        return false;
    }
    return stat.isDirectory();
};


exports.getFolder = function(path, cb) {
    /* creates folder if not present. If present but not a folder,
     * gives error.
     */
    fs.stat(path, function(err, stat) {
        if (err && err.code === 'ENOENT') {
            var permissions = parseInt('0777', 8) & ~process.umask();
            return fs.mkdir(path, permissions, cb);
        }
        else if (err) {
            return cb(err);
        }
        else if (stat && !stat.isDirectory()) {
            return cb(new Error(
                "Not a directory:  " + path
            ));
        }
        // else directory exists
        return cb();
    });
};

exports.getFolderSync = function(path) {
    /* creates folder if not present. If present but not a folder,
     * gives error.
     */
    try {
        var stat = fs.statSync(path);
    } catch(err) {
        if (err.code === 'ENOENT') {
            var permissions = parseInt('0777', 8) & ~process.umask();
            return fs.mkdirSync(path, permissions);
        }
        throw err;
    }

    if (stat && !stat.isDirectory()) {
        throw new Error("Not a directory:  " + path);
    }
    // else directory exists
    return;
};

exports.listFilesWithExt = function(dir, ext, cb) {
    if (typeof ext !== 'string') return cb(new Error(
        'ext (=' + JSON.stringify(ext) + ') must be a string!'
    ));

    function matchesExt(file) {
        return exports.hasExt(file, ext);
    }
    function makeAbsolutePath(file) {
        return S(file).ensureLeft(dir + '/').s;
    }
    
    fs.readdir(dir, function(err, files) {
        if (err) return cb(err);

        files = files.
            filter(matchesExt).
            map(makeAbsolutePath);

        async.filter(files, exports.isFile, function(files) {
            cb(null, files);
        });
    });
};

exports.listFilesWithExtSync = function(dir, ext) {
    if (typeof ext !== 'string') throw new Error(
        'ext (=' + JSON.stringify(ext) + ') must be a string!'
    );

    function matchesExt(file) {
        return exports.hasExt(file, ext);
    }
    function makeAbsolutePath(file) {
        return S(file).ensureLeft(dir + '/').s;
    }
    
    try {
        var files = fs.readdirSync(dir);
    } catch(err) {
        throw new Error("Failed to readdirSync('" + dir + "'):\n" + err);
    }

    files = files.
        filter(matchesExt).
        map(makeAbsolutePath);

    files = files.filter(exports.isFileSync);

    return files;
};

exports.listFolders = function(parent, cb) {
    fs.readdir(parent, function(err, dirs) {
        if (err) return cb(err);

        dirs = dirs.map(function(path) {
            return S(path).ensureLeft(parent + '/').s;
        });

        async.filter(dirs, exports.isDirectory, function(dirs) {
            cb(null, dirs);
        });
    });
};

exports.listFoldersSync = function(parent) {
    try {
        var dirs = fs.readdirSync(parent);
    } catch(err) {
        throw new Error("Failed to readdirSync('" + dir + "'):\n" + err);
    }

    dirs = dirs.
        map(function(path) { 
            return S(path).ensureLeft(parent + '/').s; 
        }).
        filter(exports.isDirectorySync);
    return dirs;
};

exports.readStdinToString = function(cb) {
    var contentArray = [];
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', function(buf) {
        contentArray.push(buf);
    });
    process.stdin.on('end', function() {
        cb(null, contentArray.join(''));
    });
}

return exports;

}));
