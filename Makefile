OUTPUT=publish

RECESS = recess
UGLIFY = uglifyjs

CSS_FILES = $(wildcard css/*.css css/**/*.css)
JS_FILES = $(wildcard js/*.js)


$(OUTPUT):
	mkdir -p $(OUTPUT)
$(OUTPUT)/css:
	mkdir -p $(OUTPUT)/css
$(OUTPUT)/js:
	mkdir -p $(OUTPUT)/js

minify: minify-css minify-js

CSS_MINIFIED = $(patsubst %.css,$(OUTPUT)/%.css,$(CSS_FILES))
JS_MINIFIED = $(patsubst %.js,$(OUTPUT)/%.js,$(JS_FILES))

minify-css: $(OUTPUT)/css $(CSS_FILES) $(CSS_MINIFIED)

minify-js: $(OUTPUT)/js $(JS_FILES) $(JS_MINIFIED)

$(OUTPUT)/css/%.css: css/%.css
	@echo 'Minifying $<'
	$(RECESS) --compress $< >$@
	@echo

$(OUTPUT)/js/%.js: js/%.js
	@echo 'Minifying $<'
	$(UGLIFY) $< >$@
	@echo

.PHONY: copy
copy:
	mkdir -p $(OUTPUT)
	cp *.html $(OUTPUT)/
	mkdir -p $(OUTPUT)/dialogs
	cp dialogs/*.html $(OUTPUT)/dialogs/
	mkdir -p $(OUTPUT)/img
	cp -r img/* $(OUTPUT)/img/
	mkdir -p $(OUTPUT)/js/vendor
	cp -r js/vendor/* $(OUTPUT)/js/vendor/
	cp -r wax $(OUTPUT)/wax

all: $(OUTPUT) minify copy
.PHONY: all

.PHONY: clean
clean:
	rm -rf $(OUTPUT)
