Test data for TinCanValidator
=============================

These JSON files are used to test the the TinCanValidator. The structure of the
`data` directory tree and the names of the files are significant to the testing
engine, and contain data about

* what sort of object the JSON file is supposed to be,

* whether it should validate as good or bad, and

* notes on what the file is testing.

Currently, the tests only cover TinCan version 1.0.1.

The `data` directory
--------------------
Inside the `data` directory are many other directories, whose names must match
the name of an object type within the TinCan Schema. This determines what
subschema the testing engine will try to validate against. Example: files in the
`mbox` directory will be validated as `tcapi:1.0.1#mbox`.

Subdirectories of the `data` directory
--------------------------------------
Here are contained the actual test JSON files.

The files are named with the following format:
```
file-name   = test-number "-" ( "good" / "bad" ) "-" notes ".json"
test-number = "0" 2DIGIT    ; hand-made tests
            / "1" 2DIGIT    ; from the xAPI specification appendices
            / "2" 2DIGIT    ; from the xAPI specification main text
            / "3" 2DIGIT    ; described, but not provided in the xAPI specification
notes       = *( ALPHA / DIGIT / "_" / "+" / "#" )
```
Hence, there are to be exactly two hyphens in the file name.

The test number is informational, and is does not affect the validation.

The next segment, either "good" or "bad", determines whether a good or a bad
validation is to be considered successful.

The final segment contains more information about the source of the test, and
what the file is testing.

Any files that do not end in ".json" are ignored by the test engine.
