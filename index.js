var bodyParser = require('body-parser');
var express = require('express');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var request = require('request');
var session = require('express-session');
var passport = require('passport');

var app = express();
app.use(bodyParser.json());
app.use(logger("default"));
app.use(cookieParser());
app.use(enableCORS);
app.use(session({secret: '6ea79c5a2d31f6ddc66451c7b40ef163'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());
app.get('/', sayHello);

require('./app_server/auth.js').setup(app);
require('./app_server/following.js').setup(app);
require('./app_server/posts.js').setup(app);
require('./app_server/profile.js').setup(app);

// Get the port from the environment, i.e., Heroku sets it.
var port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
    require('dotenv').load()
}
//require('./uploadCloudinary.js').setup(app);

// It enables Cross-Origin Resource Sharing for AJAX requests.
function enableCORS(req, res, next) {
    if (req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Authorization,X-Session-Id');
        res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        if (req.method === 'OPTIONS') return res.send(200)
    }
    next();
}

// Test function.
function sayHello(req, res) {
    res.send({"hello": "world"})
}

// Start the server.
var server = app.listen(port, function () {
    console.log('Server listening at http://%s:%s',
        server.address().address,
        server.address().port);
});
