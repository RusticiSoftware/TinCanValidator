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
var exports = {};

function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
}

function isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
}

function isString(obj) {
    return typeof obj === 'string';
}

function arrayPop(ary, key) {
    if (key === undefined) return ary.pop();
    if (key < 0 || key >= ary.length) return undefined;
    return ary.splice(key, 1)[0];
}

function pop(obj, key) {
    if (isArray(obj)) return arrayPop(obj, key);
    var val = obj[key];
    delete obj[key];
    return val;
}

function shallowCopy(obj) {
    if (isObject(obj)) return shallowCopyObject(obj);
    else if (isArray(obj)) return shallowCopyArray(obj);
    else {
        var err = new Error("Expected object or array, got a " + typeof(obj));
        err.data = obj;
        throw err;
    }
}

function shallowCopyObject(obj) {
    var result = {};
    for (var key in obj) {
        result[key] = obj[key];
    }
    return result;
}

function shallowCopyArray(ary) {
    return [].concat(ary);
}


exports.addError = function(subErrors, message) {
    /*
     * Given an array of subErrors and a message, creates a new Error object
     * with message and subErrors as a field.
     *
     * :type subErrors: array
     * :type message: string
     * :rtype Error
     */
    if (!isArray(subErrors)) throw new Error(
        "Expected array for subErrors, got " + typeof subErrors +
        " instead: " + subErrors
    );
    if (typeof message !== 'string') message = '' + message;

    var result = new Error(message);
    if (subErrors.length === 0) return result;
    subErrors = subErrors.map(objectifyError);
    if (subErrors.length === 1 && isArray(subErrors[0])) {
        subErrors = subErrors[0];
    }
    result.subErrors = subErrors;
    return result;
};

exports.pprintErrorToString = function(err) {
    /* Hierarchically organizes err and returns it as a JSON string */
    err = objectifyError(err);
    if (err.subErrors) err.subErrors = simplifySubErrors(err.subErrors);
    return JSON.stringify(err, null, 4);
};

exports.pprintError = function(err) {
    /*
     * Prints the error and all subErrors in a hierarchical format.
     */
    console.error(exports.pprintErrorToString(err));
};

function objectifyError(err) {
    /*
     * Transforms an Error object into a regular object that behaves more
     * nicely when pretty-printed.
     *
     * :param err: the error to make pretty-printable
     * :rtype object
     */
    if (!(err instanceof Error)) return err;

    var result = {};

    // copy all fields
    ['message'].                    // message is normally un-iterable
        concat(Object.keys(err)).
        forEach(function(field) {
            if (field === "subErrors") return; // deal with this later
            result[field] = err[field];
        });

    if (err.subErrors) {
        result.subErrors = err.subErrors.map(objectifyError);
    }
    return result;
}

function simplifySubErrors(errs) {
    /*
     * Simplifies nested 1-element trees of subErrors into a flat(ter)
     * array. Like a stack, it gives a view of where the error came from.
     *
     * :param errs: an array of objectified errors (see objectifyError())
     * :returns a flatter array of errors
     * :rtype: array
     */
    if (!errs) return errs;
    if (!isArray(errs)) throw new Error(
        "Expected array for errs, got " + typeof errs +
        " instead: " + errs
    );

    switch (errs.length) {
    case 0: return undefined;
    case 1: return simplifySubError(errs[0]);
    default: return errs.
        map(simplifySubError).
        map(function(ary) { return ary.length === 1 ? ary[0] : ary; });
    }
};

function simplifySubError(err) {
    /*
     * Helper method for simplifySubErrors().
     *
     * :rtype: array
     *
     * If err only has a message,
     * :returns: [err.message]
     * If err only has a message and a subErrors field with length 1,
     * :returns: [err.message].concat(simplifySubError(subErrors[0]))
     * If err only has a message and a subErrors field with length >1,
     * :returns: [err.message, err.subErrors.map(simplifySubError)]
     * If err has more fields, and a subErrors field with length >1, removes 
     * subErrors from err, then
     * :returns: [err, err.subErrors.map(simplifySubError)]
     */
    var message = err.message;

    var subErrors = err.subErrors;
    if (subErrors && subErrors.length === 0) {
        subErrors = undefined;
    }

    // if there are more fields, our "message" needs more data
    if (Object.keys(err).length >
            (message === undefined + subErrors === undefined)) {
        message = shallowCopyObject(err);
        // Our message is now all the data in err
    }

    var result = [message];
    if (!subErrors) return result;

    subErrors = simplifySubErrors(subErrors);
    
    // use message.subErrors to get # errors before simplifySubErrors()
    if (message.subErrors.length === 1) {
        result = result.concat(subErrors);
    } else {
        result.push(subErrors);
    }
    delete message.subErrors;
    return result;
}

return exports;
}));
