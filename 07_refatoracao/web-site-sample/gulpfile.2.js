'use strict';

// Include Gulp & Tools We'll Use
var gulp = require('gulp');
var nodemon = require('gulp-nodemon');

var $ = require('gulp-load-plugins')();
var del = require('del');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var merge = require('merge-stream');
var path = require('path');
var fs = require('fs');
var glob = require('glob');

var AUTOPREFIXER_BROWSERS = [
    'ie >= 10',
    'ie_mob >= 10',
    'ff >= 30',
    'chrome >= 34',
    'safari >= 7',
    'opera >= 23',
    'ios >= 7',
    'android >= 4.4',
    'bb >= 10'
];

var styleTask = function(stylesPath, srcs) {
    return gulp.src(srcs.map(function(src) {
            return path.join('app', stylesPath, src);
        }))
        .pipe($.changed(stylesPath, { extension: '.css' }))
        .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
        .pipe(gulp.dest('.tmp/' + stylesPath))
        .pipe($.if('*.css', $.cssmin()))
        .pipe(gulp.dest('dist/' + stylesPath))
        .pipe($.size({ title: stylesPath }));
};

// Compile and Automatically Prefix Stylesheets
gulp.task('styles', function() {
    return styleTask('styles', ['**/*.css']);
});

gulp.task('elements', function() {
    return styleTask('elements', ['**/*.css']);
});

// Lint JavaScript
gulp.task('jshint', function() {
    return gulp.src([
            'app/scripts/**/*.js',
            'app/elements/**/*.js',
            'app/elements/**/*.html'
        ])
        .pipe(reload({ stream: true, once: true }))
        .pipe($.jshint.extract()) // Extract JS from .html files
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish'))
        .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

// Optimize Images
gulp.task('images', function() {
    return gulp.src('app/images/**/*')
        .pipe($.cache($.imagemin({
            progressive: true,
            interlaced: true
        })))
        .pipe(gulp.dest('dist/images'))
        .pipe($.size({ title: 'images' }));
});

// Copy All Files At The Root Level (app)
gulp.task('copy', function() {
    var app = gulp.src([
        'app/*',
        '!app/test',
        '!app/precache.json'
    ], {
        dot: true
    }).pipe(gulp.dest('dist'));

    var bower = gulp.src([
        'bower_components/**/*'
    ]).pipe(gulp.dest('dist/bower_components'));

    var elements = gulp.src(['app/elements/**/*.html'])
        .pipe(gulp.dest('dist/elements'));

    var swBootstrap = gulp.src(['bower_components/platinum-sw/bootstrap/*.js'])
        .pipe(gulp.dest('dist/elements/bootstrap'));

    var swToolbox = gulp.src(['bower_components/sw-toolbox/*.js'])
        .pipe(gulp.dest('dist/sw-toolbox'));

    var vulcanized = gulp.src(['app/elements/elements.html'])
        .pipe($.rename('elements.vulcanized.html'))
        .pipe(gulp.dest('dist/elements'));

    return merge(app, bower, elements, vulcanized, swBootstrap, swToolbox)
        .pipe($.size({ title: 'copy' }));
});

// Copy Web Fonts To Dist
gulp.task('fonts', function() {
    return gulp.src(['app/fonts/**'])
        .pipe(gulp.dest('dist/fonts'))
        .pipe($.size({ title: 'fonts' }));
});

// Scan Your HTML For Assets & Optimize Them
gulp.task('html', function() {
    var assets = $.useref.assets({ searchPath: ['.tmp', 'app', 'dist'] });

    return gulp.src(['app/**/*.html', '!app/{elements,test}/**/*.html'])
        // Replace path for vulcanized assets
        .pipe($.if('*.html', $.replace('elements/elements.html', 'elements/elements.vulcanized.html')))
        .pipe(assets)
        // Concatenate And Minify JavaScript
        .pipe($.if('*.js', $.uglify({ preserveComments: 'some' })))
        // Concatenate And Minify Styles
        // In case you are still using useref build blocks
        .pipe($.if('*.css', $.cssmin()))
        .pipe(assets.restore())
        .pipe($.useref())
        // Minify Any HTML
        .pipe($.if('*.html', $.minifyHtml({
            quotes: true,
            empty: true,
            spare: true
        })))
        // Output Files
        .pipe(gulp.dest('dist'))
        .pipe($.size({ title: 'html' }));
});

// Vulcanize imports
gulp.task('vulcanize', function() {
    var DEST_DIR = 'dist/elements';

    return gulp.src('dist/elements/elements.vulcanized.html')
        .pipe($.vulcanize({
            dest: DEST_DIR,
            strip: true,
            inlineCss: true,
            inlineScripts: true
        }))
        .pipe(gulp.dest(DEST_DIR))
        .pipe($.size({ title: 'vulcanize' }));
});

// Generate a list of files that should be precached when serving from 'dist'.
// The list will be consumed by the <platinum-sw-cache> element.
gulp.task('precache', function(callback) {
    var dir = 'dist';

    glob('{elements,scripts,styles}/**/*.*', { cwd: dir }, function(error, files) {
        if (error) {
            callback(error);
        } else {
            files.push('index.html', './', 'bower_components/webcomponentsjs/webcomponents-lite.min.js');
            var filePath = path.join(dir, 'precache.json');
            fs.writeFile(filePath, JSON.stringify(files), callback);
        }
    });
});

// Clean Output Directory
gulp.task('clean', del.bind(null, ['.tmp', 'dist']));

var BROWSER_SYNC_RELOAD_DELAY = 500;

gulp.task('nodemon', function(cb) {
    var called = false;
    return nodemon({

            // nodemon our server
            script: 'server.js',

            // watch core server file(s) that require server restart on change
            watch: ['*.js']
        })
        .on('start', function onStart() {
            // ensure start only got called once
            if (!called) { cb(); }
            called = true;
        })
        .on('restart', function onRestart() {
            // reload connected browsers after a slight delay
            setTimeout(function reload() {
                browserSync.reload({
                    stream: false //
                });
            }, BROWSER_SYNC_RELOAD_DELAY);
        });
});

gulp.task('serve', ['styles', 'elements', 'images', 'nodemon'], function() {

    // for more browser-sync config options: http://www.browsersync.io/docs/options/
    browserSync.init({

        // watch the following files; changes will be injected (css & images) or cause browser to refresh
        files: ['app/**/*.*'],

        // informs browser-sync to proxy our expressjs app which would run at the following location
        proxy: 'http://localhost:3000',

        // informs browser-sync to use the following port for the proxied app
        // notice that the default port is 3000, which would clash with our expressjs
        port: 4000
    });

    gulp.watch(['app/**/*.html'], reload);
    gulp.watch(['app/styles/**/*.css'], ['styles', reload]);
    gulp.watch(['app/elements/**/*.css'], ['elements', reload]);
    // gulp.watch(['app/{scripts,elements}/**/*.js'], ['jshint']);
    gulp.watch(['app/images/**/*'], reload);
});

// Build Production Files, the Default Task
gulp.task('default', ['clean'], function(cb) {
    runSequence(
        ['copy', 'styles'],
        'elements', ['html'],
        'vulcanize',
        cb);
});