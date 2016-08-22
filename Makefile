all:
	npm install

test:
	@echo "## Makefile: testing schema"
	test/test.js
	@echo
	@echo "## Makefile: testing validate.js"
	./validate.js -t statement test/data/statement/000-good*.json

clean:
        rm -rf node_modules
	cd lib
	rm -rf schema/*
	git submodule deinit -f .
	cd ..

.PHONY: all test clean
