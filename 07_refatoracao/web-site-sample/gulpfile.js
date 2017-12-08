var gulp = require('gulp'),
    browserSync = require('browser-sync').create(),
    reload = browserSync.reload,
    sass = require('gulp-sass'),
    notify = require('gulp-notify'),
    plumber = require('gulp-plumber'),
    concat = require('gulp-concat'),
    cleanCSS = require('gulp-clean-css'),
    bowerMain = require('bower-main'),
    mainBowerFiles = require('main-bower-files'),
    exists = require('path-exists').sync,
    gulpIgnore = require('gulp-ignore'),
    errorNotifier = require('gulp-error-notifier'),
    runSequence = require('run-sequence'),
    inject = require('gulp-inject'),
    del = require('del');

var baseDirRoot = './';
var bowerBaseDir = baseDirRoot + 'bower_components';
var publicAssets = baseDirRoot + 'public/assets/css';
var sourceAssets = baseDirRoot + 'resources/assets';

//Clean Path CSS, JS compiladed
gulp.task('clean', function() {
    del(publicAssets);
})

// Static Server + watching scss/html files
gulp.task('serve', ['clean', 'sass'], function() {
    browserSync.init({
        server: {
            baseDir: './'
        }
    });

    // gulp.watch('resources/assets/scss/stylesheets/general.scss', ['scss'])

});
// browser-sync task for starting the server.
gulp.task('browser-sync', ['clean', 'sass'], function() {
    //watch files
    var files = [
        publicAssets + '/**/*.css',
        './*.html'
    ];

    //initialize browsersync
    browserSync.init(files, {

        server: {
            baseDir: './'
        },
        // Customise the placement of the snippet
        // and ignore certain paths
        snippetOptions: {

            // Ignore all HTML files within the templates folder
            ignorePaths: "./*.html",

            // Provide a custom Regex for inserting the snippet.
            rule: {
                match: /<\/body>/i,
                fn: function(snippet, match) {
                    return snippet + match;
                }
            }
        }
    });
});
// // register the browsersync plugin to inject snippet
// browserSync.use(require('bs-snippet-injector'), {
//     // path to the file containing the closing </body> tag
//     file: 'index.html'
// });

// Create some task bower components

//Here we only copy files to folder inside source code.
//In this case ./src/lib/
gulp.task("bower:copyfiles", function(cb) {
    return gulp.src(mainBowerFiles({
            overrides: {
                bootstrap: {
                    main: [
                        './dist/js/bootstrap.js',
                        './dist/css/*.min.*',
                        './dist/fonts/*.*'
                    ]
                }
            }
        }))
        .pipe(gulp.dest(publicAssets))
    cb();
});

//This task is the one wich insert the script tag into
// HTML file. In this case is index.html and is in root
gulp.task('bower:insertfiles', function(cb) {
    return gulp.src(baseDirRoot + 'index.html') //file with tags for injection
        .pipe(inject(gulp.src([publicAssets + '/*.js', publicAssets + '/*.css'], { read: false }), {
            starttag: '<!-- bower:{{ext}} -->',
            endtag: '<!-- endbower -->',
            relative: true
        }))
        .pipe(gulp.dest(baseDirRoot)); //where index.html will be saved. Same dir for overwrite old one
})

//And this task will launch the process of copy and include into index.html
gulp.task('bower:buildlib', function(cb) {
    runSequence('bower:copyfiles', 'bower:insertfiles', cb);
})

gulp.task('copy-bower-dep', function() {

    // Copy minified resources (Bower)
    gulp.src(bowerMain('js', 'min.js').minified, { base: bowerBaseDir })
        .pipe(gulp.dest(publicAssets + '/dist/lib'));

    gulp.src(bowerMain('css', 'min.css').minified, { base: bowerBaseDir })
        .pipe(gulp.dest(publicAssets + '/dist/lib'));

    // Copy non-minified resources (Bower)
    // Notice we filter these resources to distinguish which one are minified.
    gulp.src(mainBowerFiles(), { base: bowerBaseDir })
        .pipe(gulpIgnore.include(keepNonMinified))
        .pipe(gulp.dest(publicAssets + '/dist/lib'));
});

/*
 * A function that checks whether a Bower file has a minified version.
 */
function keepNonMinified(file) {

    var keep = true;
    if (file.path.match('\.js$')) {
        var minPath = file.path.replace('.js', '.min.js');
        keep = !exists(minPath);

    } else if (file.path.match('\.css$')) {
        var minPath = file.path.replace('.css', '.min.css');
        keep = !exists(minPath);
    }

    // gutil.log( file.path + ' => ' + keep );
    return keep;
}

// Compile sass into CSS & auto-inject into browsers
gulp.task('sass', function() {

    return gulp.src('resources/assets/sass/stylesheets/*.sass')
        .pipe(errorNotifier())
        // .pipe(sass({
        //     style: 'compressed',
        //     errLogToConsole: false,
        //     onError: function(err) {
        //         return notify().write(err);
        //     }
        // }))
        // .pipe(sass({ errLogToConsole: false, }))
        // .on('error', function(err) {
        //     notify().write(err);
        //     this.emit('end');
        // })
        .pipe(sass({}).on('error', function(err) {
            return notify().write(err);
        }))
        .pipe(plumber())
        .pipe(cleanCSS())
        // .pipe(through(function() {
        //     this.emit("error", new Error("Something happend: Error message!"))
        // }))
        // .on("error", notify.onError("Error: <%= error.message %>"))
        // .pipe(plumber({ errorHandler: notify.onError("Error: <%= error.message %>") }))
        // .pipe(through(function() {
        //     this.emit("error", new Error("Something happend: Error message!"))
        // }))
        .pipe(concat('style.min.css'))
        .pipe(gulp.dest(publicAssets))
        .pipe(browserSync.stream())
        .pipe(notify({ message: 'Styles task complete' }));
    // .pipe(notify({
    //     title: 'Gulp',
    //     subtitle: 'success',
    //     message: 'Sass task',
    //     sound: "Pop"
    // }));
});
gulp.task('watch', function() {
    gulp.watch('resources/assets/sass/**/*.sass', ['sass'])
    gulp.watch('*.html').on('change', browserSync.reload);
});

gulp.task('default', ['browser-sync', 'watch', 'sass', 'bower:buildlib']);