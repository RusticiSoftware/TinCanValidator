test directory
==============
This directory contains

* data - a directory of test cases as JSONs
* test.js - a program to run all the test cases and validate them against 
  lib/schema/1.0.1
* renumber.sh - a program to renumber the test cases if new cases are added

Testing
-------
To run the tests, run

    ./test.js
    
To test only a subset of the tests, you can name which categories of tests you
would like to run as arguments:

    ./test.js statement statementref

Renumbering the tests
---------------------
To renumber the tests, first do a dry run:

    ./renumber.sh

If the renumbering looks good, run it again with the `-x` flag. A script to 
undo the renumbering will be printed to stdout, should you need it.

    ./renumber.sh -x

After this, you can `git add data` and push to your fork. Don't forget to test first!

