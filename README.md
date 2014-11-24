Install
=======
This software requires Node.js to be installed. This can be done using the 
[standalone installer](http://www.nodejs.org), or using your OS's 
[package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager).

To install:

    git clone https://github.com/RusticiSoftware/TinCanValidator.git
    cd TinCanValidator
    make
    make test


What is this?
=============
Tin Can Validator takes JSON objects in, and tells you if they are well-formed
and valid according to the Tin Can API. It will also (optionally) attempt to 
give informative error messages, telling you what went wrong, if anything did. 

`validate.js` is a command-line tool useful for validating individual files. 
`lib` contains the JavaScript library on which `validate.js` is based.

For quick projects, the command-line tool is probably easiest. But if you need
to validate many objects without reloading the schema every time, the library
will be more efficient.


Tin Can Validator command-line tools
====================================
validate.js
-----------
Check the structure of TinCan JSON data

    Usage: validate.js [file.json] [OPTIONS]

    OPTIONS:
      -t, --type=ARG    check against this type id
      -s, --schema=ARG  use this schema directory
      -h, --help        display this help
      -v, --verbose     more informative messages

If file.json is not specified, validates input from stdin.

If no type is specified, tries to validate against all possible types.

If no schema directory is specified, tries to read
\`dirname /path/to/validate.js\`/lib/schema/1.0.1

A schema directory contains schema in JSON schema draft v4 format.
Files in the schema directory with extensions other than .json are
ignored.


test.js
-------
Located in the `test` directory. Runs validation checks against the
v1.0.1 schema (`lib/schema/1.0.1`) using all the test JSONs in `test/data`. 
Good for making sure that the Tin Can Validator library is set up correctly.


Tin Can Validator library
=========================
This Node.js library checks the structure of JavaScript and JSON structures,
ensuring that they are valid according to a schema defined by the Tin Can API.

It is in the `lib` folder. Here is some sample code:
```
var tcv = require('path/to/TinCanValidator/lib/tincanValidator.js');

tcv.readJsonFile('path/to/test.json', function(err, data) {
    if (err) throw err;
    tcv.validateWithId(data, 'statement', function(err) {
        if (err) {
            console.log("Invalid");
            throw err;
        }
        console.log("Valid");
    });
});
```

Or, if you want to do it synchronously:
```
var tcv = require('path/to/TinCanValidator/lib/tincanValidator.js');

var data = tcv.readJsonFileSync('path/to/test.json');
try {
    tcv.validateWithIdSync(data, 'statement');
    console.log("Valid");
} catch (err) {
    console.log("Invalid");
    throw err;
}
```

Debugging
---------
If an error is thrown, it will usually have a `subErrors` item, which is an
array of any errors that caused the error. Since each sub-error may, in turn, 
have a `subError` field of its own, `errorUtils.js` was developed to easily
print the chain of errors. For example:
```
var tcv = require('path/to/TinCanValidator/lib/tincanValidator.js');
var eu = require('path/to/TinCanValidator/lib/errorUtils.js');

tcv.validateJsonFile('path/to/test.json', function(err) {
    if (!err) return;
    eu.pprintError(err);
    var errJson = eu.pprintErrorToString(err);
});
```

If you want to also use this system, you can use the `addError` function to
continue the chain of sub-errors:

```
var tcv = require('path/to/TinCanValidator/lib/tincanValidator.js');
var eu = require('path/to/TinCanValidator/lib/errorUtils.js');

tcv.validateJsonFile('path/to/test.json', function(err) {
    if (!err) return;

    // note that the first argument is an array. Good for when
    // multiple failures have to be traced.
    err = eu.addError([err], "My new error");
    //err.mydata = stuff;
    eu.pprintError(err);
});
```

Other command-line tools
========================
These tools are mostly useful for debugging the schema itself.

joinSchema.js
-------------
Read a directory of JSON schema, and save them in a single file

    Usage: joinSchema.js src_dir dst.json [OPTIONS]

    OPTIONS:
      -h, --help   display this help
      -q, --quiet  silence most messages


splitSchema.js
--------------
Take a JSON schema, and save its parts as separate files

    Usage: splitSchema.js src.json dst_dir [OPTIONS]

    OPTIONS:
      -h, --help   display this help
      -q, --quiet  silence most messages
